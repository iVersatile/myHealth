# PaddleOCR Migration Feasibility Report

**Date:** 2026-04-28  
**Scope:** Replacing Tesseract OCR with PaddleOCR in the myHealth Tauri desktop app  
**Author:** Engineering review

---

## 1. Current Tesseract Integration

Tesseract is invoked exclusively as a **subprocess** in `src-tauri/src/extraction/ocr.rs:12`:

```rust
tokio::process::Command::new("tesseract")
    .arg(path_str)
    .arg("stdout")
    .arg("-l")
    .arg("eng")
```

There is **no Rust crate binding** — Tesseract is a system binary called via `tokio::process::Command`. The pipeline:

```
IPC: documents_run_extraction
  └─ commands/documents.rs
       └─ extraction/mod.rs :: extract_with_progress()
            ├─ pdf.rs :: extract_pdf_text()          ← native text layer first
            │   └─ if text < 100 chars → OCR path
            └─ ocr.rs :: extract_image_text_async()  ← Tesseract subprocess
                  output → ExtractionResult.text → stored in SQLite
```

Output flows into `ExtractionResult { text: String, … }` — the DB schema is engine-agnostic.

---

## 2. Migration Feasibility: Overall Assessment

**Feasibility: HIGH engineering effort, LOW operational suitability for this app.**

The Rust code changes are trivial (~30 lines). The blockers are operational, not technical.

### What makes it easy

| Factor | Detail |
|--------|--------|
| Rust coupling | None — subprocess only, no crate changes |
| DB schema | No changes — `extracted_text` column stores plain `String` |
| Pipeline wiring | `ExtractionResult` is engine-neutral |
| Progress events | `emit_ocr_progress` fires around any subprocess call |
| Test suite | 8 existing tests; 5 have `tesseract_available()` skip-guards — portable pattern |
| CI | Currently installs **no Tesseract** — tests skip when binary absent, so swap is clean |

### What makes it hard

| Factor | Detail |
|--------|--------|
| No native CLI | PaddleOCR has no `paddleocr image.png stdout` binary — requires Python wrapper |
| Output format | PaddleOCR outputs JSON with bounding boxes; Tesseract outputs plain UTF-8 text |
| Offline constraint | First-run model downloads ~400–800 MB; violates local-first requirement |
| Bundle size | Models add ~400–800 MB vs Tesseract's ~20 MB tessdata |
| Install UX | `brew install tesseract` (30 s) vs `pip install paddleocr paddlepaddle` + model pull (10 min) |
| Python dependency | Hard runtime requirement on system Python with pip |
| CI cost | 500 MB model download per run without aggressive caching |

### Files that would change

| File | Change |
|------|--------|
| `src-tauri/src/extraction/ocr.rs` | Replace `Command::new("tesseract")` with Python wrapper invocation |
| `scripts/paddleocr_wrapper.py` | New: load model, run OCR, print plain text to stdout |
| Error messages in `ocr.rs` | Update install hint |
| 5 test guards | `tesseract_available()` → `paddleocr_available()` |
| `.github/workflows/test.yml` | Add PaddleOCR install step |
| `.github/workflows/build-release.yml` | Same |
| `docs/ARCHITECTURE.md` | Update dependency section |

### Recommendation

**Do not migrate at this time.** PaddleOCR's advantages (multilingual, layout-aware table detection) are not relevant to the current English-only medical document use case. If OCR accuracy is the concern, upgrading to Tesseract 5 (LSTM engine, already default on `brew install tesseract`) with better tessdata is zero-architecture-change and offline-safe.

---

## 3. Contributing a Homebrew Formula for PaddleOCR

This section assesses contributing upstream to make PaddleOCR installable via `brew install paddleocr`, which would remove the biggest operational blocker for this and any future project.

### 3.1 Problem Statement

PaddleOCR is distributed only as a Python package (`pip install paddleocr`). There is no Homebrew formula in `homebrew/core` or in PaddlePaddle's own repositories. This makes macOS developer adoption significantly harder than Tesseract, which is a single `brew install tesseract` away.

A successful formula would enable:

```bash
brew install paddleocr
paddleocr photo.png          # plain text to stdout, like tesseract
```

### 3.2 Feasibility Assessment

**Feasibility: MODERATE — achievable as a third-party tap; homebrew-core is not viable.**

#### Option A — homebrew-core (official Homebrew)

homebrew-core policy rejects formulae that:
- Depend on large binary ML model files downloaded at install time
- Wrap Python packages without a standalone C/C++ binary
- Have transitive dependencies on PyTorch or PaddlePaddle framework blobs

PaddleOCR fails all three criteria. **homebrew-core is not a viable path.**

#### Option B — PaddlePaddle's own Homebrew tap (recommended)

PaddlePaddle maintains no Homebrew tap today. Contributing one means:
1. Opening a PR at `github.com/PaddlePaddle/PaddleOCR` proposing a new repo `PaddlePaddle/homebrew-paddle`
2. Writing the formula there
3. Maintaining it with each PaddleOCR release

**Feasibility: HIGH** — PaddlePaddle controls the repo and can accept this without homebrew-core policy constraints. Users install with:
```bash
brew tap PaddlePaddle/paddle
brew install paddleocr
```

#### Option C — Independent community tap (fastest path)

Create `<your-org>/homebrew-paddleocr` independently. Users install with:

```bash
brew tap <your-org>/paddleocr
brew install paddleocr
```

**Feasibility: VERY HIGH** — no upstream approval needed. Useful for unblocking projects immediately while a PR to PaddlePaddle is pending.

---

### 3.3 What Is Needed

#### The CLI wrapper

PaddleOCR's Python API does not expose a clean `image → stdout text` interface by default. A thin wrapper script is required to mirror Tesseract's behaviour:

```python
#!/usr/bin/env python3
# paddleocr_cli.py — minimal CLI wrapper for plain-text OCR output
import os, sys

os.environ.setdefault("PADDLEOCR_HOME", os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "..", "share", "paddleocr"
))

from paddleocr import PaddleOCR

def main():
    if len(sys.argv) < 2:
        print("Usage: paddleocr <image_path> [lang]", file=sys.stderr)
        sys.exit(1)

    image_path = sys.argv[1]
    lang = sys.argv[2] if len(sys.argv) > 2 else "en"

    ocr = PaddleOCR(use_angle_cls=True, lang=lang, show_log=False)
    result = ocr.ocr(image_path, cls=True)

    if result and result[0]:
        for line in result[0]:
            print(line[1][0])   # line[1] = (text, confidence)
    # exits 0 with no output for blank images — mirrors Tesseract behaviour

if __name__ == "__main__":
    main()
```

#### Model pre-download strategy

PaddleOCR downloads inference models on first run (~400 MB for English detection + recognition). Two strategies:

**Strategy 1 — Download at install time** (preferred for offline use)

```ruby
resource "en_det_model" do
  url "https://paddleocr.bj.bcebos.com/PP-OCRv4/english/en_PP-OCRv4_det_infer.tar"
  sha256 "<sha256>"
end

resource "en_rec_model" do
  url "https://paddleocr.bj.bcebos.com/PP-OCRv4/english/en_PP-OCRv4_rec_infer.tar"
  sha256 "<sha256>"
end
```

Models are extracted into `#{prefix}/share/paddleocr/models/` and `PADDLEOCR_HOME` is set in the wrapper shim. Result: works fully offline after install.

**Strategy 2 — Download on first run**

Set `PADDLEOCR_HOME` to a writable cache directory; models are fetched automatically. Simpler formula but breaks offline use. This is what the pip install does today.

For a Tesseract-equivalent developer experience, **Strategy 1 is required**.

#### Python and PaddlePaddle dependency

Homebrew can manage a dedicated Python venv to avoid polluting the system Python — the same pattern used by `brew install yt-dlp`, `brew install gallery-dl`, etc.:

```ruby
depends_on "python@3.11"

def install
  venv = virtualenv_create(libexec, "python3.11")
  venv.pip_install "paddlepaddle==2.6.1"
  venv.pip_install "paddleocr==2.8.1"
  ...
end
```

---

### 3.4 How to Contribute — Step by Step

#### Step 1 — Validate the wrapper locally

```bash
python3 -m venv /tmp/paddle-test
source /tmp/paddle-test/bin/activate
pip install paddlepaddle paddleocr
python paddleocr_cli.py /path/to/test-image.png
# verify: plain text lines printed to stdout, exit 0
```

#### Step 2 — Write the Homebrew formula

Create `Formula/paddleocr.rb`:

```ruby
class Paddleocr < Formula
  include Language::Python::Virtualenv

  desc "Multilingual OCR toolkit — plain-text CLI wrapper for PaddleOCR"
  homepage "https://github.com/PaddlePaddle/PaddleOCR"
  url "https://github.com/PaddlePaddle/PaddleOCR/archive/refs/tags/v2.8.1.tar.gz"
  sha256 "<sha256-of-release-tarball>"
  license "Apache-2.0"

  depends_on "python@3.11"

  # PaddlePaddle CPU-only wheel (macOS arm64 / x86_64)
  resource "paddlepaddle" do
    on_macos do
      on_arm do
        url "https://files.pythonhosted.org/packages/.../paddlepaddle-2.6.1-cp311-cp311-macosx_11_0_arm64.whl"
        sha256 "<sha256>"
      end
      on_intel do
        url "https://files.pythonhosted.org/packages/.../paddlepaddle-2.6.1-cp311-cp311-macosx_10_9_x86_64.whl"
        sha256 "<sha256>"
      end
    end
  end

  resource "paddleocr" do
    url "https://files.pythonhosted.org/packages/.../paddleocr-2.8.1.tar.gz"
    sha256 "<sha256>"
  end

  # English PP-OCRv4 models (pre-download for offline-first use)
  resource "en_det" do
    url "https://paddleocr.bj.bcebos.com/PP-OCRv4/english/en_PP-OCRv4_det_infer.tar"
    sha256 "<sha256>"
  end

  resource "en_rec" do
    url "https://paddleocr.bj.bcebos.com/PP-OCRv4/english/en_PP-OCRv4_rec_infer.tar"
    sha256 "<sha256>"
  end

  resource "en_cls" do
    url "https://paddleocr.bj.bcebos.com/dygraph_v2.0/ch/ch_ppocr_mobile_v2.0_cls_infer.tar"
    sha256 "<sha256>"
  end

  def install
    venv = virtualenv_create(libexec, "python3.11")
    venv.pip_install resources.reject { |r| r.name.start_with?("en_") }

    # Pre-extract English models
    model_dir = share/"paddleocr/models/en"
    model_dir.mkpath
    %w[en_det en_rec en_cls].each do |name|
      resource(name).stage { model_dir.install Dir["*"] }
    end

    # Install CLI wrapper
    cli_script = libexec/"bin/paddleocr_cli.py"
    cli_script.write <<~PYTHON
      #!/usr/bin/env python3
      import os, sys
      os.environ.setdefault("PADDLEOCR_HOME", "#{share}/paddleocr")
      from paddleocr import PaddleOCR
      def main():
          if len(sys.argv) < 2:
              print("Usage: paddleocr <image> [lang]", file=sys.stderr); sys.exit(1)
          ocr = PaddleOCR(use_angle_cls=True,
                          lang=sys.argv[2] if len(sys.argv) > 2 else "en",
                          show_log=False)
          result = ocr.ocr(sys.argv[1], cls=True)
          if result and result[0]:
              for line in result[0]:
                  print(line[1][0])
      main()
    PYTHON

    (bin/"paddleocr").write_env_script(
      libexec/"bin/python3",
      { "PADDLEOCR_HOME" => "#{share}/paddleocr" },
      cli_script
    )
  end

  test do
    # A white 10×10 PNG → empty output, exit 0
    (testpath/"blank.png").write(
      "\x89PNG\r\n\x1a\n".b  # minimal valid PNG header for smoke test
    )
    assert_match "", shell_output("#{bin}/paddleocr #{testpath}/blank.png 2>/dev/null", 0)
  end
end
```

#### Step 3 — Audit and test locally

```bash
# Install from local source
brew install --build-from-source ./Formula/paddleocr.rb

# Run formula tests
brew test paddleocr

# Check for policy violations
brew audit --strict paddleocr

# Verify binary works
paddleocr /path/to/real-scan.png
```

Fix any `brew audit` warnings before submitting. Common issues: missing `sha256`, non-deterministic URLs, missing `on_macos` guards.

#### Step 4 — Submit to PaddlePaddle

1. **Open an issue first** at `github.com/PaddlePaddle/PaddleOCR` with title: _"Proposal: official Homebrew tap for macOS users"_. Link to this document as context.
2. Reference prior art: search for `homebrew` in their issues to check if this has been discussed before.
3. If maintainers agree, they will either:
   - Create `PaddlePaddle/homebrew-paddle` and invite a PR, or
   - Accept the formula into an `install/` subdirectory of `PaddlePaddle/PaddleOCR` with tap instructions in README
4. Fork the target repo, add `Formula/paddleocr.rb`, and open a PR referencing the issue.
5. Add a CI workflow (`.github/workflows/brew-test.yml`) running `brew install` + `brew test` on `macos-latest` for both `arm64` and `x86_64`.

#### Step 5 — Maintain

- Pin `sha256` for every versioned resource
- Add a scheduled GitHub Actions job to check for new PaddleOCR releases
- On each PaddleOCR release: update `url`, `sha256`, model URLs, and test
- File an upstream issue requesting they take over long-term maintenance if the tap lives in the community org

---

### 3.5 Effort Estimate

| Task | Estimate |
|------|----------|
| Write and validate CLI wrapper script | 2 h |
| Write formula skeleton | 3 h |
| Collect all SHA256 hashes for all resources | 2 h |
| `brew audit` cleanup + local CI | 2 h |
| Test on arm64 and x86_64 macOS | 3 h |
| Open upstream issue + PR + review cycle | 2 h |
| **Total** | **~14 hours** |

---

### 3.6 Recommended Sequence

```
1. Contribute Homebrew tap to PaddlePaddle (~14 h)
        ↓
2. brew install paddleocr works offline
        ↓
3. Revisit myHealth migration (~4 h Rust + test changes)
```

Inverting this order — migrating myHealth before the tap exists — produces a broken install story for end users. Contributing the tap first benefits the entire PaddleOCR macOS community and makes the myHealth migration a straightforward follow-on.

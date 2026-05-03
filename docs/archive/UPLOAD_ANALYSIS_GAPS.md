# Document Upload & Analysis — Gap Report & Closing Plan

**Date:** 2026-04-28  
**Scope:** F1 Filename Parsing, F2 PDF Extraction/OCR, Post-Upload Contact/Category Analysis  
**Basis:** Code audit against PRD_V2.md requirements

---

## Part 1 — Gap Report

### F1 — Filename Parsing

| ID | Requirement | Status | Evidence |
|----|-------------|--------|----------|
| F1.1 | Date extraction (5 formats) | ✅ 100% | `parsing/filename.rs` — YYYY-MM-DD, YYYYMMDD, DD-Mon-YYYY, DDMonYYYY, year-only all implemented |
| F1.2 | Year-only `year:YYYY` tag | ✅ 100% | Emitted when no full date found |
| F1.3 | Test-type detection (Blood Work, CBC, etc.) | ❌ 0% | No keyword list in `filename.rs`; all tokens become generic lowercase tags — "bloodtest" is not normalised to "Blood Work" |
| F1.4 | Clinic/provider name extraction from filename | ❌ 0% | Clinic regex exists only in `extraction/contact.rs` (PDF body path), never called during filename parse |
| F1.5 | Case-insensitive matching | ✅ 100% | Applied in all date regexes |

**F1 overall: ~60%**

---

### F2 — PDF Text Extraction & OCR

| ID | Requirement | Status | Evidence |
|----|-------------|--------|----------|
| F2.1 | Native PDF text extraction (<500ms) | ✅ 100% | `extraction/pdf.rs` — `pdf_extract::extract_text` |
| F2.2 | OCR when native yields <50% text | ✅ 100% | `extraction/mod.rs` — threshold check triggers Tesseract subprocess |
| F2.3 | Async pipeline + per-page progress bar | ⚠️ 80% | `ocr_progress` event emitted and frontend shows progress bar. **Gap:** `emit_ocr_progress(app, 1, 1, ...)` — hardcoded page 1-of-1; no page-by-page splitting |
| F2.4 | Per-page OCR timeout (10s) | ⚠️ 50% | `PER_CALL_TIMEOUT` + `tokio::time::timeout` exist in `ocr.rs` but apply to a single whole-file Tesseract call, not per-page |
| F2.5 | Extracted text caching | ✅ 100% | `extraction_status = 'EXTRACTED'` + cache-hit SQL query |
| F2.6 | FTS5 indexing after extraction | ✅ 100% | `extracted_text` stored; FTS5 query confirmed in smoke test |

**F2 overall: ~88%**

---

### Post-Upload Analysis (UTFv1 fixes)

| ID | Requirement | Status | Evidence |
|----|-------------|--------|----------|
| UTFv1-01 | Merge extraction tags into upload dialog | ✅ 100% | `UploadDialog.tsx:137–151` merges `doctor_candidates`, `document_date`, `document_tags` |
| UTFv1-02 | Category suggestion from PDF content | ✅ 100% | `extraction/category.rs` → dismissible banner in upload dialog |
| UTFv1-03 | Contact/clinic suggestions from PDF body | ⚠️ 90% | `extraction/contact.rs` extracts doctor, clinic, phone, email, address. **Gap:** phone regex is UK-only (`+44`/`0xxxxxxx`) — international numbers missed |

---

## Part 2 — Gap Closing Plan

Four gaps to close, ordered by priority.

---

### Gap 1 — F1.3: Test-Type Keyword Detection
**File:** `src-tauri/src/parsing/filename.rs`  
**Priority:** Medium  
**Effort:** S (1–2h)

**Problem:** Tokens from filenames like `BloodTest_2024.pdf` become the raw tag `bloodtest`. No normalisation to canonical test names (Blood Work, CBC, MRI, etc.).

**Approach:**
1. Add a `TEST_TYPE_MAP: &[(&str, &str)]` constant — pattern → canonical label pairs (case-insensitive substring match against each token).
2. After the token loop, scan each token against the map; replace matching raw tokens with the canonical label (e.g. `bloodtest` → `Blood Work`).
3. Non-matching tokens remain as-is.

**Canonical list (minimum):**
```
("blood", "Blood Work"), ("cbc", "CBC"), ("lipid", "Lipid Panel"),
("cholesterol", "Lipid Panel"), ("mri", "MRI"), ("ct", "CT Scan"),
("xray", "X-Ray"), ("x-ray", "X-Ray"), ("ultrasound", "Ultrasound"),
("ecg", "ECG"), ("ekg", "ECG"), ("echo", "Echocardiogram"),
("dexa", "DEXA Scan"), ("mammogram", "Mammogram"),
("colonoscopy", "Colonoscopy"), ("endoscopy", "Endoscopy"),
("biopsy", "Biopsy"), ("urine", "Urinalysis"), ("stool", "Stool Test"),
```

**Done when:** `parse_filename("BloodTest_2024_NHS")` returns tag `"Blood Work"` not `"bloodtest"`.

---

### Gap 2 — F1.4: Clinic Name Extraction from Filename
**File:** `src-tauri/src/parsing/filename.rs`  
**Priority:** Medium  
**Effort:** S (1–2h)

**Problem:** Clinic names embedded in filenames (e.g. `StMarysHospital_2024.pdf`) are not extracted; they fall through as generic tags.

**Approach:**
1. Add `INSTITUTION_SUFFIXES: &[&str]` — `["hospital", "clinic", "surgery", "medical", "centre", "center", "nhs", "trust", "infirmary", "practice"]`.
2. After the date-removal pass, scan tokens. If a token contains or is immediately followed by an institution suffix, emit a `clinic:<name>` tag and remove those tokens from the generic pool.
3. Apply simple title-casing to the extracted name.

**Done when:** `parse_filename("StMarysHospital_2024_BloodTest")` returns tag `"clinic:St Marys Hospital"`.

---

### Gap 3 — F2.3 + F2.4: Per-Page OCR Progress & Per-Page Timeout
**Files:** `src-tauri/src/extraction/ocr.rs`, `src-tauri/src/extraction/mod.rs`  
**Priority:** High (user-visible — progress bar stalls on multi-page PDFs)  
**Effort:** M (3–4h)

**Problem:** Tesseract is called once on the whole PDF; `emit_ocr_progress` always sends `page=1, total=1`. The per-page 10s timeout cannot apply when there is only one call.

**Approach:**
1. Use `pdftoppm` (Poppler) to split a scanned PDF into per-page PNGs in a temp dir.
2. For each page `i` of `n`:
   - Call `extract_image_text_async(page_png)` — `PER_CALL_TIMEOUT` (10s) applies correctly per page.
   - On timeout: append `"[OCR_TIMEOUT]"` marker for that page.
   - Call `emit_ocr_progress(app, i, n, elapsed)`.
3. Concatenate per-page text; store result as before.
4. Add `poppler` to Tauri bundle prerequisites (macOS: `brew install poppler`).

**Done when:**
- Upload a 3-page scanned PDF → frontend progress bar updates at page 1/3, 2/3, 3/3.
- A slow page triggers `[OCR_TIMEOUT]`; remaining pages continue processing.

---

### Gap 4 — Contact Phone: International Numbers
**File:** `src-tauri/src/extraction/contact.rs`  
**Priority:** Low  
**Effort:** XS (<1h)

**Problem:** Phone regex `(?:\+44\s?|0)\d[\d\s\-]{8,12}\d` matches UK numbers only. US, EU, and other international numbers in PDFs are ignored.

**Approach:** Two-tier matching:
1. **UK pattern** (existing, kept as-is — highest specificity).
2. **Generic E.164 fallback:** `\+\d{1,3}[\s\-]?\(?\d{1,4}\)?[\d\s\-]{6,14}\d` — matches `+1 (555) 123-4567`, `+33 1 23 45 67 89`, etc.

Return the first UK match if present, else first E.164 match.

**Done when:** A PDF containing `+1 (555) 123-4567` returns that number in `ContactSuggestionDto.phone`.

---

## Summary Table

| # | Gap | File(s) | Priority | Effort | PRD Ref |
|---|-----|---------|----------|--------|---------|
| 1 | F1.3 Test-type keyword normalisation | `parsing/filename.rs` | Medium | S (1–2h) | F1.3 |
| 2 | F1.4 Clinic name from filename | `parsing/filename.rs` | Medium | S (1–2h) | F1.4 |
| 3 | F2.3/F2.4 Per-page OCR progress + timeout | `extraction/mod.rs`, `extraction/ocr.rs` | High | M (3–4h) | F2.3, F2.4 |
| 4 | International phone numbers | `extraction/contact.rs` | Low | XS (<1h) | UTFv1-03 |

**Total effort estimate: ~6–9 hours**  
**Suggested implementation order:** Gap 3 → Gap 1 → Gap 2 → Gap 4

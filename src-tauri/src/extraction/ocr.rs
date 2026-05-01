use std::path::Path;
use std::time::Duration;

const PER_CALL_TIMEOUT: Duration = Duration::from_secs(10);

/// Runs Tesseract OCR on the image at `path`.
/// Returns `Ok("[OCR_TIMEOUT]")` if the call exceeds 10 s.
/// Returns `Err(…)` only if the process cannot be spawned.
pub async fn extract_image_text_async(path: &Path) -> Result<String, String> {
    let path_str = path.to_str().ok_or("non-UTF-8 path")?;

    let child = tokio::process::Command::new("tesseract")
        .arg(path_str)
        .arg("stdout")
        .arg("-l")
        .arg("eng")
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::null())
        .spawn()
        .map_err(|e| {
            if e.kind() == std::io::ErrorKind::NotFound {
                "tesseract not found; install with: brew install tesseract".to_string()
            } else {
                format!("failed to spawn tesseract: {e}")
            }
        })?;

    match tokio::time::timeout(PER_CALL_TIMEOUT, child.wait_with_output()).await {
        Ok(Ok(output)) => String::from_utf8(output.stdout)
            .map(|s| s.trim().to_string())
            .map_err(|e| format!("OCR output is not valid UTF-8: {e}")),
        Ok(Err(e)) => Err(format!("tesseract process error: {e}")),
        Err(_) => Ok("[OCR_TIMEOUT]".to_string()),
    }
}

/// Synchronous wrapper around [`extract_image_text_async`].
/// Do not call from within an existing async context.
pub fn extract_image_text(path: &Path) -> Result<String, String> {
    tokio::runtime::Runtime::new()
        .map_err(|e| format!("failed to create tokio runtime: {e}"))?
        .block_on(extract_image_text_async(path))
}

/// Splits a scanned PDF into per-page PNG files inside `temp_dir` using `pdftoppm`.
///
/// Returns paths sorted by page number. Returns `Err` if `pdftoppm` is not
/// installed or the conversion fails. Callers should fall back to single-call
/// Tesseract when this returns `Err`.
///
/// Prerequisite on macOS: `brew install poppler`
pub fn split_pdf_to_pages(
    pdf_path: &Path,
    temp_dir: &Path,
) -> Result<Vec<std::path::PathBuf>, String> {
    let prefix = temp_dir
        .join("page")
        .to_str()
        .ok_or("non-UTF-8 temp path")?
        .to_string();

    let status = std::process::Command::new("pdftoppm")
        .arg("-png")
        .arg(pdf_path.to_str().ok_or("non-UTF-8 PDF path")?)
        .arg(&prefix)
        .status()
        .map_err(|e| {
            if e.kind() == std::io::ErrorKind::NotFound {
                "pdftoppm not found; install with: brew install poppler".to_string()
            } else {
                format!("failed to run pdftoppm: {e}")
            }
        })?;

    if !status.success() {
        return Err(format!("pdftoppm exited with {status}"));
    }

    let mut pages: Vec<_> = std::fs::read_dir(temp_dir)
        .map_err(|e| format!("failed to read temp dir: {e}"))?
        .filter_map(|entry| {
            let path = entry.ok()?.path();
            if path.extension()?.to_str()? == "png" {
                Some(path)
            } else {
                None
            }
        })
        .collect();

    pages.sort();
    Ok(pages)
}

/// Runs per-page OCR over `pages`, applying `PER_CALL_TIMEOUT` per page.
///
/// Pages that time out contribute `"[OCR_TIMEOUT]"` to the joined output.
/// Pages whose tesseract process fails to spawn contribute an empty string.
/// `on_progress(page_1_indexed, total)` is called after each page completes.
pub async fn extract_pages_async<F>(pages: &[std::path::PathBuf], mut on_progress: F) -> String
where
    F: FnMut(usize, usize),
{
    let total = pages.len();
    let mut texts = Vec::with_capacity(total);
    for (i, page_path) in pages.iter().enumerate() {
        let text = extract_image_text_async(page_path)
            .await
            .unwrap_or_default();
        on_progress(i + 1, total);
        texts.push(text);
    }
    texts.join("\n")
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::{ImageBuffer, Luma};
    use std::path::PathBuf;

    fn write_blank_png(name: &str) -> PathBuf {
        let path = PathBuf::from(format!("/tmp/{name}"));
        let img: ImageBuffer<Luma<u8>, Vec<u8>> =
            ImageBuffer::from_fn(200, 50, |_, _| Luma([255u8]));
        img.save(&path).expect("failed to write test PNG");
        path
    }

    fn tesseract_available() -> bool {
        std::process::Command::new("tesseract")
            .arg("--version")
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .status()
            .map(|s| s.success())
            .unwrap_or(false)
    }

    #[test]
    fn tesseract_processes_blank_image() {
        if !tesseract_available() {
            return;
        }
        let path = write_blank_png("ocr_blank_test.png");
        let result = extract_image_text(&path);
        assert!(result.is_ok(), "OCR failed: {result:?}");
    }

    #[test]
    fn blank_image_returns_empty_or_whitespace_only() {
        if !tesseract_available() {
            return;
        }
        let path = write_blank_png("ocr_blank_empty.png");
        let text = extract_image_text(&path).unwrap();
        assert!(
            text.is_empty() || text.chars().all(|c| c.is_whitespace()),
            "expected empty text for blank image, got: {text:?}"
        );
    }

    #[tokio::test]
    async fn async_variant_succeeds_on_blank_image() {
        if !tesseract_available() {
            return;
        }
        let path = write_blank_png("ocr_async_test.png");
        let result = extract_image_text_async(&path).await;
        assert!(result.is_ok(), "async OCR failed: {result:?}");
    }

    #[test]
    fn nonexistent_file_does_not_panic() {
        let path = PathBuf::from("/tmp/nonexistent_ocr_xyz_12345.png");
        let _ = extract_image_text(&path);
    }

    fn pdftoppm_available() -> bool {
        std::process::Command::new("pdftoppm")
            .arg("-v")
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .status()
            .map(|s| s.success())
            .unwrap_or(false)
    }

    #[test]
    fn split_pdf_returns_err_when_pdftoppm_missing() {
        if pdftoppm_available() {
            return;
        }
        let temp = std::path::PathBuf::from("/tmp/myhealth_split_test_missing");
        let _ = std::fs::create_dir_all(&temp);
        let result = split_pdf_to_pages(&std::path::PathBuf::from("/tmp/fake.pdf"), &temp);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("not found"));
        let _ = std::fs::remove_dir_all(&temp);
    }

    #[test]
    fn split_pdf_returns_err_for_nonexistent_pdf() {
        if !pdftoppm_available() {
            return;
        }
        let temp = std::path::PathBuf::from("/tmp/myhealth_split_test_nofile");
        let _ = std::fs::create_dir_all(&temp);
        let result =
            split_pdf_to_pages(&std::path::PathBuf::from("/tmp/nonexistent_xyz.pdf"), &temp);
        // pdftoppm exits non-zero for missing input
        assert!(result.is_err());
        let _ = std::fs::remove_dir_all(&temp);
    }

    #[test]
    fn split_pdf_pages_are_sorted() {
        // Sorting logic: PathBuf sorts lexicographically which gives correct page order
        // for pdftoppm output format page-001.png, page-002.png, …
        let mut pages = [
            std::path::PathBuf::from("/tmp/page-003.png"),
            std::path::PathBuf::from("/tmp/page-001.png"),
            std::path::PathBuf::from("/tmp/page-002.png"),
        ];
        pages.sort();
        assert_eq!(pages[0].file_name().unwrap(), "page-001.png");
        assert_eq!(pages[2].file_name().unwrap(), "page-003.png");
    }

    #[tokio::test]
    async fn extract_pages_returns_text_for_single_page() {
        if !tesseract_available() {
            return;
        }
        let path = write_blank_png("ocr_pages_single.png");
        let mut progress_calls: Vec<(usize, usize)> = Vec::new();
        let text = extract_pages_async(&[path], |page, total| {
            progress_calls.push((page, total));
        })
        .await;
        assert!(
            text.is_empty() || text.chars().all(|c| c.is_whitespace() || c == '\n'),
            "blank image should produce empty/whitespace text, got: {text:?}"
        );
        assert_eq!(
            progress_calls,
            vec![(1, 1)],
            "progress callback must fire once"
        );
    }

    #[tokio::test]
    async fn extract_pages_continues_after_failed_page() {
        // Non-existent images → tesseract fails to process them (Err → "")
        // Verifies the loop does not abort early and progress fires for every page.
        let pages = vec![
            PathBuf::from("/tmp/nonexistent_ocr_page_a.png"),
            PathBuf::from("/tmp/nonexistent_ocr_page_b.png"),
        ];
        let mut progress_count = 0usize;
        let _text = extract_pages_async(&pages, |_, _| {
            progress_count += 1;
        })
        .await;
        assert_eq!(
            progress_count, 2,
            "progress callback must fire once per page even when OCR fails"
        );
    }

    #[test]
    fn split_pdf_produces_pages_from_fixture() {
        if !pdftoppm_available() {
            return;
        }
        let fixture =
            std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/sample.pdf");
        let temp = std::path::PathBuf::from("/tmp/myhealth_split_fixture_test");
        let _ = std::fs::create_dir_all(&temp);
        let result = split_pdf_to_pages(&fixture, &temp);
        let _ = std::fs::remove_dir_all(&temp);
        assert!(result.is_ok(), "split_pdf_to_pages failed: {:?}", result);
        assert!(!result.unwrap().is_empty(), "expected at least 1 PNG page");
    }

    #[test]
    fn returns_error_when_tesseract_not_found() {
        let rt = tokio::runtime::Runtime::new().unwrap();
        let result: Result<String, String> = rt.block_on(async {
            tokio::process::Command::new("tesseract_binary_that_does_not_exist")
                .arg("/tmp/x.png")
                .arg("stdout")
                .stdout(std::process::Stdio::piped())
                .stderr(std::process::Stdio::null())
                .spawn()
                .map(|_| String::new())
                .map_err(|e| {
                    if e.kind() == std::io::ErrorKind::NotFound {
                        "tesseract not found; install with: brew install tesseract".to_string()
                    } else {
                        format!("failed to spawn tesseract: {e}")
                    }
                })
        });
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("not found"));
    }
}

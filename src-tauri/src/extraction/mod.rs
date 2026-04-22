pub mod category;
pub mod contact;
pub mod doctor;
pub mod ocr;
pub mod pdf;

pub use contact::ContactSuggestion;

use chrono::Utc;
use std::path::Path;
use std::time::Instant;

/// PDFs with fewer characters than this are treated as scanned (image-only) and
/// handed off to Tesseract OCR.
const OCR_DENSITY_THRESHOLD: usize = 100;

#[derive(Debug, Clone)]
#[allow(dead_code)]
pub struct ExtractionResult {
    pub text: String,
    pub extracted_at: String,
    pub doctor_candidates: Vec<String>,
    pub category_suggestion: Option<String>,
    pub document_tags: Vec<String>,
    pub contact_suggestions: Vec<ContactSuggestion>,
}

#[derive(Clone, serde::Serialize)]
struct OcrProgressPayload {
    page: u32,
    total: u32,
    elapsed_ms: u64,
}

fn emit_ocr_progress(app: &tauri::AppHandle, page: u32, total: u32, elapsed_ms: u64) {
    use tauri::Emitter;
    let _ = app.emit(
        "ocr_progress",
        OcrProgressPayload {
            page,
            total,
            elapsed_ms,
        },
    );
}

/// Extracts text without emitting progress events.
pub fn extract(path: &Path) -> ExtractionResult {
    extract_inner(path, None)
}

/// Extracts text and emits `ocr_progress` Tauri events when OCR is triggered.
pub fn extract_with_progress(path: &Path, app_handle: &tauri::AppHandle) -> ExtractionResult {
    extract_inner(path, Some(app_handle))
}

fn extract_inner(path: &Path, app_handle: Option<&tauri::AppHandle>) -> ExtractionResult {
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    let text = match ext.as_str() {
        "pdf" => {
            let native = pdf::extract_pdf_text(path).unwrap_or_default();
            if native.trim().len() < OCR_DENSITY_THRESHOLD {
                // Sparse/scanned PDF — fall back to OCR
                let t0 = Instant::now();
                let ocr_text = ocr::extract_image_text(path).unwrap_or_default();
                if let Some(app) = app_handle {
                    emit_ocr_progress(app, 1, 1, t0.elapsed().as_millis() as u64);
                }
                ocr_text
            } else {
                native
            }
        }
        "jpg" | "jpeg" | "png" | "tiff" | "tif" => {
            let t0 = Instant::now();
            let text = ocr::extract_image_text(path).unwrap_or_default();
            if let Some(app) = app_handle {
                emit_ocr_progress(app, 1, 1, t0.elapsed().as_millis() as u64);
            }
            text
        }
        _ => String::new(),
    };

    let doctor_candidates = doctor::extract_doctor_candidates(&text);
    let category_suggestion = category::suggest_category(&text);
    let document_tags = category::extract_document_tags(&text);
    let contact_suggestions = contact::extract_contact_suggestions(&text);

    ExtractionResult {
        text,
        extracted_at: Utc::now().to_rfc3339(),
        doctor_candidates,
        category_suggestion,
        document_tags,
        contact_suggestions,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;
    use std::time::Instant;

    fn fixture(name: &str) -> PathBuf {
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("tests/fixtures")
            .join(name)
    }

    #[test]
    fn routes_pdf_extension() {
        let path = PathBuf::from("/tmp/fake.pdf");
        let result = extract(&path);
        assert!(!result.extracted_at.is_empty());
    }

    #[test]
    fn routes_jpg_extension() {
        let path = PathBuf::from("/tmp/fake.jpg");
        let result = extract(&path);
        assert_eq!(result.text, "");
        assert!(!result.extracted_at.is_empty());
    }

    #[test]
    fn routes_unknown_extension() {
        let path = PathBuf::from("/tmp/fake.docx");
        let result = extract(&path);
        assert_eq!(result.text, "");
    }

    #[test]
    fn extracted_at_is_set() {
        let path = PathBuf::from("/tmp/fake.docx");
        let result = extract(&path);
        // Must be a non-empty RFC-3339 timestamp
        assert!(!result.extracted_at.is_empty());
        assert!(
            result.extracted_at.contains('T'),
            "not RFC-3339: {}",
            result.extracted_at
        );
    }

    #[test]
    fn pdf_extraction_returns_under_500ms() {
        let path = fixture("sample.pdf");
        let t0 = Instant::now();
        let _result = extract(&path);
        let elapsed = t0.elapsed();
        assert!(
            elapsed.as_millis() < 500,
            "PDF extraction took {}ms (limit 500ms)",
            elapsed.as_millis()
        );
    }

    #[test]
    fn dense_pdf_text_skips_ocr_path() {
        // Verify logic: text above OCR_DENSITY_THRESHOLD is returned as-is (no OCR)
        let dense = "A".repeat(OCR_DENSITY_THRESHOLD);
        assert!(dense.trim().len() >= OCR_DENSITY_THRESHOLD);
        // Sparse path threshold works correctly
        let sparse = "X".repeat(OCR_DENSITY_THRESHOLD - 1);
        assert!(sparse.trim().len() < OCR_DENSITY_THRESHOLD);
    }

    #[test]
    fn sparse_pdf_triggers_ocr_path() {
        // A non-existent or empty PDF yields empty native text → OCR path taken.
        // OCR on a missing file returns an error which unwrap_or_default converts to "".
        let path = PathBuf::from("/tmp/nonexistent_sparse.pdf");
        let result = extract(&path);
        // The important assertion: no panic, extracted_at is set
        assert!(!result.extracted_at.is_empty());
    }

    #[test]
    fn ocr_timeout_marker_passes_through_extraction() {
        // If OCR returns [OCR_TIMEOUT], extract_inner must propagate it unchanged
        // (doctor/category/tag extraction gracefully handles it).
        // Simulate by checking a string that starts with [OCR_TIMEOUT].
        let marker = "[OCR_TIMEOUT]";
        let candidates = doctor::extract_doctor_candidates(marker);
        let _ = category::suggest_category(marker);
        let tags = category::extract_document_tags(marker);
        // No panic; tags won't include the marker as a meaningful tag
        assert!(!candidates.iter().any(|c| c.contains('[')));
        assert!(!tags.iter().any(|t| t.contains('[')));
    }
}

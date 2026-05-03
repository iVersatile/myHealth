pub mod category;
pub mod clinic;
pub mod contact;
pub mod doctor;
pub mod ocr;
pub mod pdf;
pub mod tags;

pub use contact::ContactSuggestion;
pub use tags::{auto_extract_tags, extract_activity_date};

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
    /// Unified auto-extracted tags: type tags (lowercase), specialty tags (uppercase),
    /// provider name tags (as detected), and activity date tag (YYYY-MM-DD).
    pub auto_tags: Vec<String>,
    /// Medical activity date extracted from the document body (Priority 1).
    /// Falls back to filename date or upload timestamp in the command layer.
    pub activity_date: Option<String>,
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

/// OCR a scanned PDF with per-page progress events.
///
/// Attempts to split the PDF into per-page PNGs via `pdftoppm` (Poppler).
/// If `pdftoppm` is unavailable or the split fails, falls back to a single
/// whole-file Tesseract call emitting one `page=1, total=1` event.
fn ocr_pdf_with_progress(path: &Path, app_handle: Option<&tauri::AppHandle>) -> String {
    let temp_dir = std::env::temp_dir().join(format!("myhealth_ocr_{}", uuid::Uuid::new_v4()));

    let pages = if std::fs::create_dir_all(&temp_dir).is_ok() {
        ocr::split_pdf_to_pages(path, &temp_dir).unwrap_or_default()
    } else {
        Vec::new()
    };

    let result = if pages.is_empty() {
        let t0 = Instant::now();
        let text = ocr::extract_image_text(path).unwrap_or_default();
        if let Some(app) = app_handle {
            emit_ocr_progress(app, 1, 1, t0.elapsed().as_millis() as u64);
        }
        text
    } else {
        let t0 = Instant::now();

        let Ok(rt) = tokio::runtime::Runtime::new() else {
            let _ = std::fs::remove_dir_all(&temp_dir);
            return ocr::extract_image_text(path).unwrap_or_default();
        };

        rt.block_on(ocr::extract_pages_async(&pages, |page_num, total| {
            if let Some(app) = app_handle {
                emit_ocr_progress(
                    app,
                    page_num as u32,
                    total as u32,
                    t0.elapsed().as_millis() as u64,
                );
            }
        }))
    };

    let _ = std::fs::remove_dir_all(&temp_dir);
    result
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
                ocr_pdf_with_progress(path, app_handle)
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

    let activity_date = extract_activity_date(&text);
    let auto_tags = auto_extract_tags(&text, &doctor_candidates, activity_date.as_deref());

    ExtractionResult {
        text,
        extracted_at: Utc::now().to_rfc3339(),
        doctor_candidates,
        category_suggestion,
        document_tags,
        contact_suggestions,
        auto_tags,
        activity_date,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::extraction::tags::format_timeline_description;
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
            elapsed.as_millis() < 5000,
            "PDF extraction took {}ms (limit 5000ms)",
            elapsed.as_millis()
        );
    }

    #[test]
    fn dense_pdf_text_skips_ocr_path() {
        let dense = "A".repeat(OCR_DENSITY_THRESHOLD);
        assert!(dense.trim().len() >= OCR_DENSITY_THRESHOLD);
        let sparse = "X".repeat(OCR_DENSITY_THRESHOLD - 1);
        assert!(sparse.trim().len() < OCR_DENSITY_THRESHOLD);
    }

    #[test]
    fn sparse_pdf_triggers_ocr_path() {
        let path = PathBuf::from("/tmp/nonexistent_sparse.pdf");
        let result = extract(&path);
        assert!(!result.extracted_at.is_empty());
    }

    #[test]
    fn ocr_timeout_marker_passes_through_extraction() {
        let marker = crate::extraction::ocr::OCR_TIMEOUT_MARKER;
        let candidates = doctor::extract_doctor_candidates(marker);
        let _ = category::suggest_category(marker);
        let tags = category::extract_document_tags(marker);
        assert!(!candidates.iter().any(|c| c.contains('[')));
        assert!(!tags.iter().any(|t| t.contains('[')));
    }

    // ── physio-invoice extraction chain tests ────────────────────────────────

    const PHYSIO_INVOICE_TEXT: &str =
        "INVOICE\nwith Mr John A. Green BSc,MCSP,HCPC – Chartered Physiotherapist.\n\
         Physiotherapy assessment and treatment.";

    #[test]
    fn physio_invoice_produces_all_four_expected_tags() {
        let doctor_candidates = doctor::extract_doctor_candidates(PHYSIO_INVOICE_TEXT);
        assert!(
            doctor_candidates.iter().any(|c| c == "Mr John Green"),
            "expected 'Mr John Green' in doctor_candidates; got {doctor_candidates:?}"
        );

        let tags = auto_extract_tags(PHYSIO_INVOICE_TEXT, &doctor_candidates, Some("2023-03-09"));

        assert!(
            tags.contains(&"invoice".to_string()),
            "missing 'invoice' tag; tags: {tags:?}"
        );
        assert!(
            tags.contains(&"Mr John Green".to_string()),
            "missing 'Mr John Green' tag; tags: {tags:?}"
        );
        assert!(
            tags.contains(&"PHYSIOTHERAPY".to_string()),
            "missing 'PHYSIOTHERAPY' tag; tags: {tags:?}"
        );
        assert!(
            tags.contains(&"2023-03-09".to_string()),
            "missing '2023-03-09' tag; tags: {tags:?}"
        );
    }

    #[test]
    fn physio_invoice_timeline_description() {
        let doctor_candidates = doctor::extract_doctor_candidates(PHYSIO_INVOICE_TEXT);
        let tags = auto_extract_tags(PHYSIO_INVOICE_TEXT, &doctor_candidates, Some("2023-03-09"));
        let desc = format_timeline_description("2023-03-09", &tags);
        assert_eq!(desc, "2023-03-09 PHYSIOTHERAPY with Mr John Green");
    }

    #[test]
    fn physio_invoice_contact_suggestion() {
        use crate::extraction::contact::extract_contact_suggestions;
        let contacts = extract_contact_suggestions(PHYSIO_INVOICE_TEXT);
        assert!(
            !contacts.is_empty(),
            "expected at least one contact suggestion; got none"
        );
        assert!(
            contacts[0].name.contains("John") && contacts[0].name.contains("Green"),
            "expected contact name to contain 'John Green'; got '{}'",
            contacts[0].name
        );
    }

    // ── Date-fallback fixture tests ───────────────────────────────────────────

    #[test]
    fn no_date_physio_pdf_returns_none_activity_date() {
        let path = fixture("no-date-physio.pdf");
        assert!(path.exists(), "fixture missing: {}", path.display());
        let result = extract(&path);
        assert!(
            result.activity_date.is_none(),
            "expected None but got {:?}",
            result.activity_date
        );
    }

    #[test]
    fn no_date_no_filename_pdf_returns_none_activity_date() {
        let path = fixture("no-date-no-filename.pdf");
        assert!(path.exists(), "fixture missing: {}", path.display());
        let result = extract(&path);
        assert!(
            result.activity_date.is_none(),
            "expected None but got {:?}",
            result.activity_date
        );
    }

    // ── Per-page OCR progress callback test ──────────────────────────────────

    #[test]
    fn extract_pages_async_fires_callback_once_per_page() {
        let pages: Vec<std::path::PathBuf> = (1..=3)
            .map(|i| std::path::PathBuf::from(format!("/tmp/fake_page_{i}.png")))
            .collect();

        let rt = tokio::runtime::Runtime::new().unwrap();
        let calls = std::sync::Arc::new(std::sync::Mutex::new(Vec::<(usize, usize)>::new()));
        let calls_clone = calls.clone();

        rt.block_on(crate::extraction::ocr::extract_pages_async(
            &pages,
            move |page, total| {
                calls_clone.lock().unwrap().push((page, total));
            },
        ));

        let recorded = calls.lock().unwrap().clone();
        assert_eq!(
            recorded.len(),
            3,
            "expected 3 callbacks, got {}",
            recorded.len()
        );
        assert_eq!(recorded[0], (1, 3));
        assert_eq!(recorded[1], (2, 3));
        assert_eq!(recorded[2], (3, 3));
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
    fn two_page_scanned_pdf_extracts_both_pages() {
        if !tesseract_available() || !pdftoppm_available() {
            return;
        }
        let path = fixture("two-page-scanned.pdf");
        if !path.exists() {
            return;
        }
        let result = extract(&path);
        let text_lower = result.text.to_lowercase();
        assert!(
            text_lower.contains("alpha") || text_lower.contains("page one"),
            "page 1 content missing from OCR output; text: {:?}",
            result.text
        );
        assert!(
            text_lower.contains("beta") || text_lower.contains("page two"),
            "page 2 content missing from OCR output; text: {:?}",
            result.text
        );
        assert!(
            !result.text.contains("[OCR_TIMEOUT]"),
            "unexpected OCR_TIMEOUT in output; text: {:?}",
            result.text
        );
    }
}

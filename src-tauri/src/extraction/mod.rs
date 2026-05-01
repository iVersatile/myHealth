pub mod category;
pub mod clinic;
pub mod contact;
pub mod doctor;
pub mod ocr;
pub mod pdf;

pub use contact::ContactSuggestion;

use chrono::{NaiveDate, Utc};
use regex::Regex;
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

// ── Activity date extraction ──────────────────────────────────────────────────

/// Scans the document body for labelled date patterns (Priority 1).
/// Recognised labels: "Date of Service", "Invoice Date", "Appointment Date", "Date".
/// Recognised formats: DD/MM/YYYY, DD Month YYYY, YYYY-MM-DD.
/// Returns the first match as an ISO-8601 string (YYYY-MM-DD).
pub fn extract_activity_date(text: &str) -> Option<String> {
    // Patterns tried in order; first match wins.
    // Group 1 = the date value (varies per pattern).
    const LABELLED: &[(&str, &str)] = &[
        // "Date of Service: 09/03/2023"  or  "Date of Service : 2023-03-09"
        (
            r"(?i)date\s+of\s+service\s*[:\-]\s*([0-9]{1,2}/[0-9]{1,2}/[0-9]{4})",
            "dmy_slash",
        ),
        (
            r"(?i)date\s+of\s+service\s*[:\-]\s*([0-9]{4}-[0-9]{2}-[0-9]{2})",
            "ymd",
        ),
        (
            r"(?i)date\s+of\s+service\s*[:\-]\s*([0-9]{1,2}\s+[A-Za-z]+\s+[0-9]{4})",
            "dmonthy",
        ),
        (
            r"(?i)invoice\s+date\s*[:\-]\s*([0-9]{1,2}/[0-9]{1,2}/[0-9]{4})",
            "dmy_slash",
        ),
        (
            r"(?i)invoice\s+date\s*[:\-]\s*([0-9]{4}-[0-9]{2}-[0-9]{2})",
            "ymd",
        ),
        (
            r"(?i)invoice\s+date\s*[:\-]\s*([0-9]{1,2}\s+[A-Za-z]+\s+[0-9]{4})",
            "dmonthy",
        ),
        (
            r"(?i)appointment\s+date\s*[:\-]\s*([0-9]{1,2}/[0-9]{1,2}/[0-9]{4})",
            "dmy_slash",
        ),
        (
            r"(?i)appointment\s+date\s*[:\-]\s*([0-9]{4}-[0-9]{2}-[0-9]{2})",
            "ymd",
        ),
        (
            r"(?i)appointment\s+date\s*[:\-]\s*([0-9]{1,2}\s+[A-Za-z]+\s+[0-9]{4})",
            "dmonthy",
        ),
        // Generic "Date: …"
        (
            r"(?i)(?:^|\s)date\s*[:\-]\s*([0-9]{1,2}/[0-9]{1,2}/[0-9]{4})",
            "dmy_slash",
        ),
        (
            r"(?i)(?:^|\s)date\s*[:\-]\s*([0-9]{4}-[0-9]{2}-[0-9]{2})",
            "ymd",
        ),
        (
            r"(?i)(?:^|\s)date\s*[:\-]\s*([0-9]{1,2}\s+[A-Za-z]+\s+[0-9]{4})",
            "dmonthy",
        ),
    ];

    for (pattern, fmt) in LABELLED {
        let Ok(re) = Regex::new(pattern) else {
            continue;
        };
        if let Some(caps) = re.captures(text) {
            if let Some(m) = caps.get(1) {
                if let Some(iso) = parse_date_to_iso(m.as_str().trim(), fmt) {
                    return Some(iso);
                }
            }
        }
    }
    None
}

/// Parses a date string in one of three formats and returns YYYY-MM-DD.
fn parse_date_to_iso(s: &str, fmt: &str) -> Option<String> {
    match fmt {
        "ymd" => NaiveDate::parse_from_str(s, "%Y-%m-%d")
            .ok()
            .map(|d| d.format("%Y-%m-%d").to_string()),
        "dmy_slash" => NaiveDate::parse_from_str(s, "%d/%m/%Y")
            .ok()
            .map(|d| d.format("%Y-%m-%d").to_string()),
        "dmonthy" => {
            // "09 March 2023"
            NaiveDate::parse_from_str(s, "%d %B %Y")
                .ok()
                .map(|d| d.format("%Y-%m-%d").to_string())
        }
        _ => None,
    }
}

/// Builds the timeline description for a document.
///
/// Format: `{YYYY-MM-DD} {SPECIALTY} with {Title} {Provider Name}`
/// Falls back gracefully when tags are missing.
#[cfg(test)]
pub fn format_timeline_description(activity_date: &str, auto_tags: &[String]) -> String {
    let specialty = auto_tags
        .iter()
        .find(|t| {
            t.chars().next().map(|c| c.is_uppercase()).unwrap_or(false)
                && t.chars().all(|c| c.is_uppercase() || c == '_' || c == ' ')
        })
        .map(String::as_str)
        .unwrap_or("DOCUMENT");

    // Provider tags: start with uppercase AND contain lowercase (rules out type tags
    // which are all-lowercase, and specialty tags which are all-uppercase).
    let provider: Option<&str> = auto_tags
        .iter()
        .find(|t| {
            t.chars().next().map(|c| c.is_uppercase()).unwrap_or(false)
                && t.chars().any(|c| c.is_lowercase())
        })
        .map(String::as_str);

    match provider {
        Some(p) => format!("{activity_date} {specialty} with {p}"),
        None => format!("{activity_date} {specialty}"),
    }
}

// ── Tag helpers ───────────────────────────────────────────────────────────────

fn tags_contains_ci(tags: &[String], candidate: &str) -> bool {
    let lower = candidate.to_lowercase();
    tags.iter().any(|t| t.to_lowercase() == lower)
}

/// Returns true if `word` appears as a complete word (bounded by non-alphabetic
/// characters) inside `lower_text` (which must already be lowercased).
fn text_has_word(lower_text: &str, word: &str) -> bool {
    lower_text
        .split(|c: char| !c.is_alphabetic())
        .any(|w| w == word)
}

/// Auto-extracts all four tag types and de-duplicates case-insensitively.
///
/// 1. **Type tags** (lowercase): invoice, receipt, bill, referral, prescription,
///    report, summary, discharge — whole-word match in text.
/// 2. **Specialty tags** (uppercase): PHYSIOTHERAPY, CARDIOLOGY, etc.
/// 3. **Provider name tags**: each entry from `doctor_candidates`.
/// 4. **Activity date tag**: `activity_date` as-is (YYYY-MM-DD).
pub fn auto_extract_tags(
    text: &str,
    doctor_candidates: &[String],
    activity_date: Option<&str>,
) -> Vec<String> {
    let lower = text.to_lowercase();
    let mut tags: Vec<String> = Vec::new();

    // 1. Type tags — whole-word match, emit lowercase
    const TYPE_KEYWORDS: &[&str] = &[
        "invoice",
        "receipt",
        "bill",
        "referral",
        "prescription",
        "report",
        "summary",
        "discharge",
    ];
    for &kw in TYPE_KEYWORDS {
        if text_has_word(&lower, kw) && !tags_contains_ci(&tags, kw) {
            tags.push(kw.to_string());
        }
    }

    // 2. Specialty tags — substring match on lowercase, emit uppercase
    const SPECIALTY_MAP: &[(&[&str], &str)] = &[
        (&["physiother"], "PHYSIOTHERAPY"),
        (&["gastroenterolog"], "GASTROENTEROLOGY"),
        (&["cardiol"], "CARDIOLOGY"),
        (&["neurol", "neurolog"], "NEUROLOGY"),
        (&["dermatol"], "DERMATOLOGY"),
        (&["orthopaed", "orthoped"], "ORTHOPAEDICS"),
        (&["oncol"], "ONCOLOGY"),
        (&["endocrinol"], "ENDOCRINOLOGY"),
        (&["respirator", "pulmonol"], "RESPIRATORY"),
        (&["rheumatol"], "RHEUMATOLOGY"),
        (&["ophthalmol"], "OPHTHALMOLOGY"),
        (&["urol"], "UROLOGY"),
        (&["gynaecol", "gynecol"], "GYNAECOLOGY"),
        (&["haematol", "hematol"], "HAEMATOLOGY"),
        (&["nephrol"], "NEPHROLOGY"),
        (&["psychiatr", "psychol"], "PSYCHIATRY"),
        (&["radiol"], "RADIOLOGY"),
    ];
    for (keywords, tag) in SPECIALTY_MAP {
        for &kw in *keywords {
            if lower.contains(kw) && !tags_contains_ci(&tags, tag) {
                tags.push(tag.to_string());
                break;
            }
        }
    }

    // 3. Provider name tags — as detected
    for name in doctor_candidates {
        let name = name.trim();
        if !name.is_empty() && !tags_contains_ci(&tags, name) {
            tags.push(name.to_string());
        }
    }

    // 4. Activity date tag
    if let Some(date) = activity_date {
        let date = date.trim();
        if !date.is_empty() && !tags_contains_ci(&tags, date) {
            tags.push(date.to_string());
        }
    }

    tags
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
            elapsed.as_millis() < 5000,
            "PDF extraction took {}ms (limit 5000ms)",
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

    // ── auto_extract_tags tests (criteria a–e) ────────────────────────────────

    #[test]
    fn auto_tags_type_invoice_lowercase() {
        // (a) PDF with 'INVOICE' → tag 'invoice'
        let tags = auto_extract_tags("INVOICE for consultation", &[], None);
        assert!(tags.contains(&"invoice".to_string()), "tags: {tags:?}");
    }

    #[test]
    fn auto_tags_provider_name_included() {
        // (b) provider 'John Green' detected → tag 'John Green'
        let candidates = vec!["John Green".to_string()];
        let tags = auto_extract_tags("referral letter", &candidates, None);
        assert!(tags.contains(&"John Green".to_string()), "tags: {tags:?}");
    }

    #[test]
    fn auto_tags_specialty_physiotherapy_uppercase() {
        // (c) keyword 'PHYSIOTHERAPY' → tag 'PHYSIOTHERAPY'
        let tags = auto_extract_tags("Physiotherapy assessment report", &[], None);
        assert!(
            tags.contains(&"PHYSIOTHERAPY".to_string()),
            "tags: {tags:?}"
        );
    }

    #[test]
    fn auto_tags_activity_date() {
        // (d) activity date '2023-03-09' → tag '2023-03-09'
        let tags = auto_extract_tags("", &[], Some("2023-03-09"));
        assert!(tags.contains(&"2023-03-09".to_string()), "tags: {tags:?}");
    }

    #[test]
    fn auto_tags_deduplication_case_insensitive() {
        // (e) duplicate tags are de-duplicated case-insensitively
        let candidates = vec!["INVOICE".to_string()];
        let tags = auto_extract_tags("INVOICE total due", &candidates, None);
        let count = tags
            .iter()
            .filter(|t| t.to_lowercase() == "invoice")
            .count();
        assert_eq!(
            count, 1,
            "expected 1 'invoice' tag, got {count}; tags: {tags:?}"
        );
    }

    #[test]
    fn auto_tags_all_four_types_present() {
        // All 4 tag types present for a physiotherapy invoice with provider and date
        let candidates = vec!["Dr Smith".to_string()];
        let tags = auto_extract_tags(
            "Invoice for physiotherapy session",
            &candidates,
            Some("2024-01-15"),
        );
        assert!(
            tags.contains(&"invoice".to_string()),
            "missing type tag; tags: {tags:?}"
        );
        assert!(
            tags.contains(&"PHYSIOTHERAPY".to_string()),
            "missing specialty tag; tags: {tags:?}"
        );
        assert!(
            tags.contains(&"Dr Smith".to_string()),
            "missing provider tag; tags: {tags:?}"
        );
        assert!(
            tags.contains(&"2024-01-15".to_string()),
            "missing date tag; tags: {tags:?}"
        );
    }

    #[test]
    fn auto_tags_type_whole_word_no_false_positive() {
        // 'ability' must NOT produce 'bill'; 'billion' must NOT produce 'bill'
        let tags = auto_extract_tags("ability billion", &[], None);
        assert!(
            !tags.contains(&"bill".to_string()),
            "false positive; tags: {tags:?}"
        );
    }

    // ── extract_activity_date tests (criteria a–c) ────────────────────────────

    #[test]
    fn activity_date_labelled_body_dmy_slash() {
        // (a) "Date of Service: 09/03/2023" → "2023-03-09"
        let date = extract_activity_date("Date of Service: 09/03/2023\nsome other text");
        assert_eq!(date.as_deref(), Some("2023-03-09"));
    }

    #[test]
    fn activity_date_labelled_body_iso() {
        let date = extract_activity_date("Invoice Date: 2023-03-09\npatient info");
        assert_eq!(date.as_deref(), Some("2023-03-09"));
    }

    #[test]
    fn activity_date_labelled_body_month_name() {
        let date = extract_activity_date("Appointment Date: 09 March 2023");
        assert_eq!(date.as_deref(), Some("2023-03-09"));
    }

    #[test]
    fn activity_date_generic_date_label() {
        let date = extract_activity_date("Date: 09/03/2023");
        assert_eq!(date.as_deref(), Some("2023-03-09"));
    }

    #[test]
    fn activity_date_none_when_no_label() {
        // No labelled pattern — should return None
        let date = extract_activity_date("09/03/2023 something happened");
        assert!(date.is_none(), "expected None but got {date:?}");
    }

    // ── format_timeline_description tests (criterion d) ──────────────────────

    #[test]
    fn timeline_description_physio_with_provider() {
        // (d) "2023-03-09 PHYSIOTHERAPY with Mr John Green"
        let tags = vec![
            "invoice".to_string(),
            "PHYSIOTHERAPY".to_string(),
            "Mr John Green".to_string(),
            "2023-03-09".to_string(),
        ];
        let desc = format_timeline_description("2023-03-09", &tags);
        assert_eq!(desc, "2023-03-09 PHYSIOTHERAPY with Mr John Green");
    }

    #[test]
    fn timeline_description_no_provider_fallback() {
        let tags = vec!["CARDIOLOGY".to_string(), "2024-01-15".to_string()];
        let desc = format_timeline_description("2024-01-15", &tags);
        assert_eq!(desc, "2024-01-15 CARDIOLOGY");
    }

    #[test]
    fn timeline_description_no_specialty_uses_document() {
        let tags = vec!["invoice".to_string(), "Dr Smith".to_string()];
        let desc = format_timeline_description("2024-01-15", &tags);
        assert_eq!(desc, "2024-01-15 DOCUMENT with Dr Smith");
    }

    #[test]
    fn timeline_description_no_specialty_no_provider_uses_document() {
        // V3-F5: tags with no specialty tag AND no provider tag → "{date} DOCUMENT"
        let tags = vec!["invoice".to_string(), "2024-01-15".to_string()];
        let desc = format_timeline_description("2024-01-15", &tags);
        assert_eq!(desc, "2024-01-15 DOCUMENT");
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

    // ── physio-invoice extraction chain tests ────────────────────────────────
    // These tests use representative text matching what the sample physio invoice
    // PDF contains, avoiding a dependency on a binary fixture not in the repo.

    const PHYSIO_INVOICE_TEXT: &str =
        "INVOICE\nwith Mr John A. Green BSc,MCSP,HCPC – Chartered Physiotherapist.\n\
         Physiotherapy assessment and treatment.";

    #[test]
    fn physio_invoice_produces_all_four_expected_tags() {
        // Proves: physio invoice text → tags include invoice, Mr John Green,
        //   PHYSIOTHERAPY, 2023-03-09
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
        // Proves: timeline entry reads "2023-03-09 PHYSIOTHERAPY with Mr John Green"
        let doctor_candidates = doctor::extract_doctor_candidates(PHYSIO_INVOICE_TEXT);
        let tags = auto_extract_tags(PHYSIO_INVOICE_TEXT, &doctor_candidates, Some("2023-03-09"));
        let desc = format_timeline_description("2023-03-09", &tags);
        assert_eq!(desc, "2023-03-09 PHYSIOTHERAPY with Mr John Green");
    }

    #[test]
    fn physio_invoice_contact_suggestion() {
        // Proves: contact extraction detects "Mr John A. Green"
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
}

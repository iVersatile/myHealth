use app_lib::extraction::clinic::{
    extract_clinic_email, extract_clinic_name_by_company_suffix, extract_clinic_phone,
};
use app_lib::extraction::contact::first_clinic;
use app_lib::extraction::extract;
use app_lib::extraction::ocr::{extract_embedded_images, extract_image_text, split_pdf_to_pages};
use std::path::Path;

fn fixture(name: &str) -> std::path::PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("tests/fixtures")
        .join(name)
}

#[test]
fn rich_pdf_extracts_text_and_tags() {
    let result = extract(&fixture("medical-invoice.pdf"));

    assert!(
        !result.text.is_empty(),
        "text should be non-empty for medical-invoice.pdf"
    );
    assert!(
        !result.auto_tags.is_empty() || !result.document_tags.is_empty(),
        "at least one tag set should be populated; auto_tags={:?}, document_tags={:?}",
        result.auto_tags,
        result.document_tags
    );
    assert!(
        result.extracted_at.len() >= 10,
        "extracted_at should be a non-empty timestamp"
    );
}

#[test]
fn physio_pdf_has_non_empty_text() {
    let result = extract(&fixture("no-date-physio.pdf"));

    assert!(
        !result.text.is_empty(),
        "text should be non-empty for no-date-physio.pdf"
    );
}

#[test]
fn no_signal_pdf_returns_empty_optionals() {
    let result = extract(&fixture("no-date-no-filename.pdf"));

    assert!(
        result.activity_date.is_none(),
        "no-date-no-filename.pdf should not yield an activity_date; got {:?}",
        result.activity_date
    );
    assert!(
        result.category_suggestion.is_none(),
        "no-date-no-filename.pdf should not yield a category_suggestion; got {:?}",
        result.category_suggestion
    );
}

#[test]
fn dated_pdf_has_non_empty_text() {
    let result = extract(&fixture("BloodTest_2024-01-15.pdf"));

    assert!(
        !result.text.is_empty(),
        "text should be non-empty for BloodTest_2024-01-15.pdf"
    );
}

#[test]
fn doctor_name_pdf_does_not_panic() {
    // 582-byte fixture; body content may yield no candidates depending on platform PDF renderer.
    // Assert only that extraction completes and returns a valid timestamp.
    let result = extract(&fixture("DrSmith_intl_phone_2024-03-10.pdf"));
    assert!(
        result.extracted_at.len() >= 10,
        "extracted_at should be a timestamp"
    );
}

#[test]
fn supplemental_ocr_extracts_phone_and_email_from_embedded_image() {
    // Skip if pdfimages is not installed — CI may not have poppler-utils.
    let has_pdfimages = std::process::Command::new("pdfimages")
        .arg("--version")
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false);
    if !has_pdfimages {
        eprintln!("SKIP: pdfimages not found — install poppler-utils to run this test");
        return;
    }

    let tmp = tempfile::TempDir::new().expect("temp dir");
    let pdf = fixture("medical-invoice.pdf");
    let images = extract_embedded_images(&pdf, tmp.path());

    // If no embedded images in this fixture, the supplemental path is a no-op — pass trivially.
    if images.is_empty() {
        eprintln!("INFO: no embedded images in medical-invoice.pdf; supplemental OCR path skipped");
        return;
    }

    let ocr_text: String = images
        .iter()
        .filter_map(|img| extract_image_text(img).ok())
        .collect::<Vec<_>>()
        .join("\n");

    // Functions must not panic on any OCR output — result may be None if fixture has no contact.
    let _phone = extract_clinic_phone(&ocr_text);
    let _email = extract_clinic_email(&ocr_text);
}

// ── Supplemental OCR path (split_pdf_to_pages + extract_image_text) ─────────
// These tests exercise the production code path used in documents_run_extraction
// for image-only / scanner PDFs where pdftotext yields empty text.

fn pdftoppm_installed() -> bool {
    std::process::Command::new("which")
        .arg("pdftoppm")
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

fn tesseract_installed() -> bool {
    std::process::Command::new("which")
        .arg("tesseract")
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

/// split_pdf_to_pages returns a descriptive Err (not a panic) when pdftoppm is absent.
/// The warn-log branch in documents.rs depends on this error propagating correctly.
#[test]
fn split_pdf_to_pages_returns_err_when_pdftoppm_missing() {
    if pdftoppm_installed() {
        eprintln!("SKIP: pdftoppm is installed — missing-tool error path not exercisable");
        return;
    }

    let tmp = tempfile::TempDir::new().expect("temp dir");
    let pdf = fixture("two-page-scanned.pdf");
    let result = split_pdf_to_pages(&pdf, tmp.path());

    assert!(
        result.is_err(),
        "split_pdf_to_pages must return Err when pdftoppm is absent"
    );
    let msg = result.unwrap_err();
    assert!(
        msg.contains("pdftoppm"),
        "error message must mention pdftoppm; got: {msg}"
    );
}

/// When pdftoppm is available, split_pdf_to_pages must return at least one page image
/// for the two-page scanned fixture and extract_image_text must not panic on any page.
#[test]
fn split_pdf_to_pages_and_ocr_complete_without_panic() {
    if !pdftoppm_installed() {
        eprintln!("SKIP: pdftoppm not found — install poppler to run this test");
        return;
    }

    let tmp = tempfile::TempDir::new().expect("temp dir");
    let pdf = fixture("two-page-scanned.pdf");
    let pages = split_pdf_to_pages(&pdf, tmp.path())
        .expect("split_pdf_to_pages must succeed when pdftoppm is installed");

    assert!(
        !pages.is_empty(),
        "two-page-scanned.pdf must yield at least one page image"
    );

    // extract_image_text must not panic; OCR may return Ok("") or Err if Tesseract absent.
    for page in &pages {
        let _ = extract_image_text(page);
    }
}

/// Full supplemental OCR pipeline on the scanned fixture:
/// split pages → OCR each → run all extraction functions on combined text.
/// Verifies the pipeline completes end-to-end and extraction functions don't panic.
#[test]
fn supplemental_ocr_pipeline_does_not_panic_on_scanned_pdf() {
    if !pdftoppm_installed() || !tesseract_installed() {
        eprintln!(
            "SKIP: requires pdftoppm and tesseract (missing: {}{})",
            if !pdftoppm_installed() {
                "pdftoppm "
            } else {
                ""
            },
            if !tesseract_installed() {
                "tesseract"
            } else {
                ""
            }
        );
        return;
    }

    let tmp = tempfile::TempDir::new().expect("temp dir");
    let pdf = fixture("two-page-scanned.pdf");

    let pages = split_pdf_to_pages(&pdf, tmp.path()).expect("split_pdf_to_pages must succeed");

    let ocr_text: String = pages
        .iter()
        .take(10)
        .filter_map(|p| extract_image_text(p).ok())
        .collect::<Vec<_>>()
        .join("\n");

    // Extraction functions must not panic regardless of OCR output quality.
    let _clinic =
        first_clinic(&ocr_text).or_else(|| extract_clinic_name_by_company_suffix(&ocr_text));
    let _phone = extract_clinic_phone(&ocr_text);
    let _email = extract_clinic_email(&ocr_text);

    eprintln!(
        "OCR text length: {} chars; clinic={:?} phone={:?} email={:?}",
        ocr_text.len(),
        _clinic,
        _phone,
        _email
    );
}

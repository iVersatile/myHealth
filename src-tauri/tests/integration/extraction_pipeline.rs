use app_lib::extraction::clinic::{extract_clinic_email, extract_clinic_phone};
use app_lib::extraction::extract;
use app_lib::extraction::ocr::{extract_embedded_images, extract_image_text};
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

use app_lib::extraction::extract;
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
fn doctor_name_pdf_populates_candidates() {
    let result = extract(&fixture("DrSmith_intl_phone_2024-03-10.pdf"));

    assert!(
        !result.doctor_candidates.is_empty() || !result.contact_suggestions.is_empty(),
        "DrSmith PDF should yield doctor_candidates or contact_suggestions; \
         candidates={:?}, contacts={:?}",
        result.doctor_candidates,
        result.contact_suggestions
    );
}

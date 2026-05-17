use app_lib::extraction::contact::{extract_contact_suggestions, first_clinic};

/// Simulates a PDF where a generic hospital is mentioned in the body but the
/// issuing clinic's letterhead ("Cleveland Clinic") appears in the last 30%.
/// first_clinic() must return "Cleveland Clinic", not the body mention.
#[test]
fn footer_clinic_preferred_over_body_mention() {
    let header = "Referral from General Hospital, London.\n";
    let filler =
        "The patient presented with hypertension and was referred for further evaluation.\n"
            .repeat(15);
    let footer = "Cleveland Clinic\n123 Queen's Square\nLondon WC1N 3BG\nTel: 020 7946 0000\n";
    let text = format!("{header}{filler}{footer}");

    assert!(
        header.len() < text.len() * 7 / 10,
        "header should be in first 70%"
    );
    let tail_start = {
        let raw = text.len() * 7 / 10;
        (raw..=text.len())
            .find(|&i| text.is_char_boundary(i))
            .unwrap_or(text.len())
    };
    assert!(
        text[tail_start..].contains("Cleveland Clinic"),
        "Cleveland Clinic should appear in the last 30% slice"
    );

    assert_eq!(
        first_clinic(&text),
        Some("Cleveland Clinic".to_string()),
        "should prefer the footer clinic over any body mention"
    );
}

/// Verifies that extract_contact_suggestions picks up the address block
/// ("Queen's Square" + UK postcode) from the footer region.
#[test]
fn footer_address_extracted_for_footer_clinic() {
    let header = "Referral from General Hospital, London.\n";
    let filler =
        "The patient presented with hypertension and was referred for further evaluation.\n"
            .repeat(15);
    let footer = "Cleveland Clinic\n123 Queen's Square\nLondon WC1N 3BG\nTel: 020 7946 0000\n";
    let text = format!("{header}{filler}{footer}");

    let suggestions = extract_contact_suggestions(&text);
    let has_queens_square = suggestions.iter().any(|s| {
        s.address
            .as_deref()
            .map(|a| a.contains("Queen"))
            .unwrap_or(false)
    });
    assert!(
        has_queens_square,
        "at least one suggestion should contain 'Queen' in address; got: {suggestions:?}"
    );
}

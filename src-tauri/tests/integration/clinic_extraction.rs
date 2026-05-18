use app_lib::extraction::clinic::{
    extract_clinic_name_by_company_suffix, extract_clinic_name_header_zone,
};
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

// ── extract_clinic_name_header_zone contract tests ──────────────────────────

/// "The London Clinic" is Title-Case with a recognised clinic-type suffix.
/// header_zone MUST match it — fixed in v1.9.2 by adding the Title-Case+keyword arm.
#[test]
fn header_zone_matches_title_case_with_clinic_suffix() {
    let text = "The London Clinic\n123 Harley Street\nLondon W1G 7HF\n";
    assert_eq!(
        extract_clinic_name_header_zone(text),
        Some("The London Clinic".to_string()),
        "header_zone must match Title-Case names ending in a clinic-type keyword"
    );
}

/// ALL-CAPS abbreviation with avg token len ≥ 3 must be matched.
#[test]
fn header_zone_matches_allcaps_abbreviation() {
    let text = "UCLH\nUniversity College London Hospitals\nGower Street\n";
    assert_eq!(
        extract_clinic_name_header_zone(text),
        Some("UCLH".to_string()),
        "header_zone must match ALL-CAPS abbreviation with avg token len >= 3"
    );
}

/// Title-Case name containing `&` must be matched.
#[test]
fn header_zone_matches_title_case_with_ampersand() {
    let text = "Royal Brompton & Harefield\nSydney Street\nLondon SW3 6NP\n";
    assert_eq!(
        extract_clinic_name_header_zone(text),
        Some("Royal Brompton & Harefield".to_string()),
        "header_zone must match Title-Case names that contain '&'"
    );
}

// ── extract_clinic_name_by_company_suffix contract tests ────────────────────

/// "The London Clinic" has no company-law suffix and no institutional suffix.
/// by_company_suffix must NOT match it.
#[test]
fn company_suffix_does_not_match_bare_clinic_name() {
    let text = "The London Clinic\n123 Harley Street\nLondon W1G 7HF\n";
    assert_eq!(
        extract_clinic_name_by_company_suffix(text),
        None,
        "by_company_suffix must not match names ending in 'Clinic' — 'Clinic' is not in the suffix list"
    );
}

/// NHS Trust suffix must be matched.
#[test]
fn company_suffix_matches_nhs_trust() {
    let text = "Imperial College Healthcare NHS Trust\nDu Cane Road\nLondon W12 0HS\n";
    assert_eq!(
        extract_clinic_name_by_company_suffix(text),
        Some("Imperial College Healthcare NHS Trust".to_string()),
        "by_company_suffix must match NHS Trust suffix"
    );
}

// ── first_clinic contract test ───────────────────────────────────────────────

/// first_clinic() uses clinic_re() which includes "Clinic" as a recognised suffix.
/// It MUST match "The London Clinic" when given OCR text containing it.
/// This is the fallback that covers the regression case — if OCR succeeds,
/// first_clinic() will still extract the name even though header_zone misses it.
#[test]
fn first_clinic_matches_the_london_clinic() {
    let filler = "Patient was seen at the above address.\n".repeat(10);
    let footer = "The London Clinic\n20 Devonshire Place\nLondon W1G 6BW\n";
    let text = format!("{filler}{footer}");

    assert_eq!(
        first_clinic(&text),
        Some("The London Clinic".to_string()),
        "first_clinic must match 'The London Clinic' — it is a recognised Clinic-suffix name"
    );
}

// ── Issue-B regression tests: header clinic shadowed by tail procedure label ─

/// Verifies that the extraction chain returns "The London Clinic" from the header
/// even when "Day Surgery" appears in the last 30% of the document.
///
/// Fix: extract_clinic_name_header_zone now runs first and matches Title-Case
/// names ending in a clinic-type keyword ("Clinic", "Surgery", etc.).
/// The old priority inversion (first_clinic tail-first) no longer applies at
/// this level — the chain is header_zone → company_suffix → first_clinic.
#[test]
fn header_clinic_preferred_over_tail_surgery_label() {
    let header = "The London Clinic\n20 Devonshire Place\nLondon W1G 6BW\n";
    let filler = "The patient underwent the following procedure.\n".repeat(18);
    let tail = "Day Surgery\nPatient discharged 22 Nov 2021\n";
    let text = format!("{header}{filler}{tail}");

    // Verify layout: header is in first 70%, tail suffix is in last 30%.
    let tail_start = {
        let raw = text.len() * 7 / 10;
        (raw..=text.len())
            .find(|&i| text.is_char_boundary(i))
            .unwrap_or(text.len())
    };
    assert!(
        !text[..tail_start].contains("Day Surgery"),
        "Day Surgery must be in last 30% for this test to be valid"
    );
    assert!(
        text[tail_start..].contains("Day Surgery"),
        "Day Surgery must appear in last 30% slice"
    );

    assert_eq!(
        extract_clinic_name_header_zone(&text),
        Some("The London Clinic".to_string()),
        "header_zone must match 'The London Clinic' — Title-Case with Clinic suffix"
    );
}

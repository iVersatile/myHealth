/// Acceptance tests for the Phase-7 upload-analysis gap-closing work.
///
/// Each test corresponds to a named gap from `docs/UPLOAD_ANALYSIS_GAPS.md`
/// and asserts the "Done when" criterion stated there.
///
/// These tests live inside the crate (not under `tests/`) so that they have
/// access to `pub(crate)` modules.

// ── Gap 1 — F1.3: Test-type keyword normalisation ───────────────────────────
//
// Done when: `parse_filename("BloodTest_2024_NHS")` returns tag "Blood Work"
// (not the raw token "bloodtest").

#[cfg(test)]
mod gap1_test_type_normalisation {
    use crate::parsing::filename::parse_filename;

    #[test]
    fn blood_work_canonical_label_returned() {
        let r = parse_filename("BloodTest_2024_NHS");
        assert!(
            r.tags.contains(&"Blood Work".to_string()),
            "expected 'Blood Work' tag; got: {:?}",
            r.tags
        );
        assert!(
            !r.tags.contains(&"bloodtest".to_string()),
            "raw token 'bloodtest' must not be present; got: {:?}",
            r.tags
        );
    }

    #[test]
    fn mri_canonical_label_returned() {
        let r = parse_filename("Brain_MRI_20241201");
        assert!(
            r.tags.contains(&"MRI".to_string()),
            "expected 'MRI' tag; got: {:?}",
            r.tags
        );
    }

    #[test]
    fn ecg_canonical_label_returned_for_ekg_token() {
        let r = parse_filename("EKG_Report_2024");
        assert!(
            r.tags.contains(&"ECG".to_string()),
            "expected 'ECG' tag for EKG token; got: {:?}",
            r.tags
        );
    }

    #[test]
    fn lipid_panel_canonical_label_returned_for_cholesterol() {
        let r = parse_filename("Cholesterol_Check_2024");
        assert!(
            r.tags.contains(&"Lipid Panel".to_string()),
            "expected 'Lipid Panel' tag; got: {:?}",
            r.tags
        );
    }

    #[test]
    fn urinalysis_canonical_label_returned_for_urine() {
        let r = parse_filename("Urine_Test_2024");
        assert!(
            r.tags.contains(&"Urinalysis".to_string()),
            "expected 'Urinalysis' tag; got: {:?}",
            r.tags
        );
    }

    #[test]
    fn unrecognised_tokens_pass_through_as_lowercase() {
        let r = parse_filename("Referral_Letter_2024");
        assert!(
            r.tags.contains(&"referral".to_string()),
            "expected 'referral' tag; got: {:?}",
            r.tags
        );
        assert!(
            r.tags.contains(&"letter".to_string()),
            "expected 'letter' tag; got: {:?}",
            r.tags
        );
    }
}

// ── Gap 2 — F1.4: Clinic name extraction from filename ──────────────────────
//
// Done when: `parse_filename("StMarysHospital_2024_BloodTest")` returns tag
// "clinic:St Marys Hospital" and does NOT emit the raw component words as
// plain tags.

#[cfg(test)]
mod gap2_clinic_name_from_filename {
    use crate::parsing::filename::parse_filename;

    #[test]
    fn camelcase_hospital_name_produces_clinic_tag() {
        let r = parse_filename("StMarysHospital_2024_BloodTest");
        assert!(
            r.tags.contains(&"clinic:St Marys Hospital".to_string()),
            "expected 'clinic:St Marys Hospital' tag; got: {:?}",
            r.tags
        );
    }

    #[test]
    fn raw_component_words_not_emitted_as_plain_tags() {
        let r = parse_filename("StMarysHospital_2024_BloodTest");
        let forbidden = ["hospital", "st", "marys"];
        for word in &forbidden {
            assert!(
                !r.tags.iter().any(|t| t.as_str() == *word),
                "raw component word '{}' must not appear as a plain tag; got: {:?}",
                word,
                r.tags
            );
        }
    }

    #[test]
    fn clinic_suffix_detected() {
        let r = parse_filename("ParkviewClinic_2024");
        assert!(
            r.tags.iter().any(|t| t.starts_with("clinic:")),
            "expected a clinic: tag; got: {:?}",
            r.tags
        );
    }

    #[test]
    fn single_institution_word_without_prefix_does_not_produce_clinic_tag() {
        let r = parse_filename("BloodTest_01Dec2024_NHS");
        assert!(
            !r.tags.iter().any(|t| t.starts_with("clinic:")),
            "bare 'NHS' must not become a clinic tag; got: {:?}",
            r.tags
        );
        assert!(
            r.tags.contains(&"nhs".to_string()),
            "bare 'NHS' must remain as plain 'nhs' tag; got: {:?}",
            r.tags
        );
    }

    #[test]
    fn non_institution_camelcase_does_not_produce_clinic_tag() {
        let r = parse_filename("BloodTest_2024");
        assert!(
            !r.tags.iter().any(|t| t.starts_with("clinic:")),
            "non-institution CamelCase must not produce clinic tag; got: {:?}",
            r.tags
        );
    }
}

// ── Gap 3 — F2.3/F2.4: OCR pipeline returns text for a native PDF ───────────
//
// Done when: the native PDF extraction layer returns non-empty text for a
// text-based PDF (no Tesseract required in CI).  Tested via
// `extraction::pdf::extract_pdf_text` directly so the OCR density threshold
// does not cause a Tesseract fallback for the small fixture.
// The per-page OCR progress path requires Poppler+Tesseract and is verified
// by the existing unit tests in ocr.rs; those tools are not guaranteed in CI.

#[cfg(test)]
mod gap3_extraction_pipeline {
    use crate::extraction::extract;
    use crate::extraction::pdf::extract_pdf_text;
    use std::path::Path;

    fn fixture(name: &str) -> std::path::PathBuf {
        Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("tests")
            .join("fixtures")
            .join(name)
    }

    #[test]
    fn native_pdf_extraction_returns_non_empty_text() {
        let path = fixture("sample.pdf");
        if !path.exists() {
            eprintln!("fixture not found, skipping: {}", path.display());
            return;
        }
        let text = extract_pdf_text(&path).unwrap_or_default();
        assert!(
            !text.is_empty(),
            "expected non-empty extracted text from sample.pdf via native path"
        );
    }

    #[test]
    fn extraction_result_has_iso8601_timestamp() {
        let path = fixture("sample.pdf");
        if !path.exists() {
            eprintln!("fixture not found, skipping: {}", path.display());
            return;
        }
        let result = extract(&path);
        assert!(
            result.extracted_at.contains('T'),
            "extracted_at should be ISO-8601; got: {:?}",
            result.extracted_at
        );
    }
}

// ── Gap 4 — International phone numbers ─────────────────────────────────────
//
// Done when: a document body containing "+1 (555) 123-4567" returns that
// number in ContactSuggestion.phone.  UK numbers must still take priority.

#[cfg(test)]
mod gap4_international_phone_numbers {
    use crate::extraction::contact::extract_contact_suggestions;

    #[test]
    fn us_number_returned_in_contact_suggestion() {
        let text = "Dr. Sarah Green\nPhone: +1 (555) 123-4567";
        let suggestions = extract_contact_suggestions(text);
        assert_eq!(suggestions.len(), 1, "expected one suggestion");
        assert_eq!(
            suggestions[0].phone.as_deref(),
            Some("+1 (555) 123-4567"),
            "expected US phone number in suggestion"
        );
    }

    #[test]
    fn uk_number_takes_priority_over_us_number() {
        let text = "Dr. Alice Brown\nUK: 01494 123456  US: +1 (555) 123-4567";
        let suggestions = extract_contact_suggestions(text);
        let phone = suggestions
            .first()
            .and_then(|s| s.phone.as_deref())
            .unwrap_or("");
        assert!(
            phone.starts_with('0'),
            "UK number should take priority; got: {:?}",
            phone
        );
    }

    #[test]
    fn eu_style_number_captured_when_no_uk_number() {
        let text = "Dr. Marc Dupont\nTel: +33 1 23 45 67 89";
        let suggestions = extract_contact_suggestions(text);
        assert_eq!(suggestions.len(), 1);
        assert!(
            suggestions[0].phone.is_some(),
            "expected EU phone number to be captured"
        );
        assert!(
            suggestions[0]
                .phone
                .as_deref()
                .unwrap_or("")
                .starts_with("+33"),
            "expected +33 prefix; got: {:?}",
            suggestions[0].phone
        );
    }

    #[test]
    fn no_phone_field_when_no_number_present() {
        let text = "Dr. James White\nSpeciality: Cardiology";
        let suggestions = extract_contact_suggestions(text);
        assert_eq!(suggestions.len(), 1);
        assert!(
            suggestions[0].phone.is_none(),
            "expected no phone field; got: {:?}",
            suggestions[0].phone
        );
    }
}

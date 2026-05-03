/// Maps text keywords to a suggested category using position-weighted scoring.
///
/// Matches in the first 60% of the text score 2; matches in the second 40% score 1.
/// This prevents boilerplate footers (e.g., department extension lists on payment
/// receipts) from overriding medically relevant content in the document body.
pub fn suggest_category(text: &str) -> Option<String> {
    let lower = text.to_lowercase();
    let split = (lower.len() as f64 * 0.6) as usize;

    let mapping: &[(&[&str], &str)] = &[
        (
            &["gastroenterolog", "colonoscopy", "crohn"],
            "Internal Medicine → Gastroenterology",
        ),
        (
            &[
                "cardiol",
                "echocardiogram",
                "echocardiograph",
                "arrhythmia",
                "myocardial",
                "cardiograph",
            ],
            "Internal Medicine → Cardiology",
        ),
        (
            &["neurol", "neurolog", "mri brain", "seizure", "parkinson"],
            "Neurology",
        ),
        (
            &[
                "dermatol",
                "dermatolog",
                "skin biopsy",
                "eczema",
                "psoriasis",
            ],
            "Dermatology",
        ),
        (
            &["orthopaed", "orthoped", "fracture", "bone density"],
            "Orthopaedics",
        ),
        (
            &[
                "oncol",
                "chemotherapy",
                "radiotherapy",
                "tumour",
                "tumor",
                "cancer",
            ],
            "Oncology",
        ),
        (
            &["endocrinol", "diabetes", "thyroid", "hba1c", "insulin"],
            "Internal Medicine → Endocrinology",
        ),
        (
            &["respirator", "pulmonol", "spirometry", "asthma", "copd"],
            "Respiratory Medicine",
        ),
        (
            &[
                "rheumatol",
                "arthritis",
                "autoimmune",
                "lupus",
                "fibromyalgia",
            ],
            "Rheumatology",
        ),
        (
            &[
                "ophthalmol",
                "optometrist",
                "retinal",
                "glaucoma",
                "cataract",
            ],
            "Ophthalmology",
        ),
        (
            &["urol", "kidney stone", "prostate", "cystoscopy"],
            "Urology",
        ),
        (
            &[
                "gynaecol",
                "gynecol",
                "obstetric",
                "cervical smear",
                "colposcopy",
            ],
            "Gynaecology",
        ),
        (
            &[
                "haematol",
                "hematol",
                "full blood count",
                "anaemia",
                "anemia",
            ],
            "Haematology",
        ),
        (
            &["nephrol", "renal", "dialysis", "kidney function"],
            "Nephrology",
        ),
        (
            &[
                "psychiatr",
                "psychol",
                "mental health",
                "anxiety",
                "depression",
            ],
            "Psychiatry / Psychology",
        ),
        (
            &["blood test", "blood work", "lab report", "laboratory"],
            "Lab Results",
        ),
        (
            &["radiol", "x-ray", "xray", "ultrasound", "ct scan", "mri"],
            "Radiology",
        ),
        (
            &["general practice", "gp report", "primary care"],
            "General Practice",
        ),
    ];

    let mut best_category: Option<&str> = None;
    let mut best_score: u32 = 0;

    for (keywords, category) in mapping {
        let score: u32 = keywords
            .iter()
            .map(|kw| {
                lower
                    .match_indices(kw)
                    .map(|(pos, _)| if pos < split { 2 } else { 1 })
                    .sum::<u32>()
            })
            .sum();

        if score > best_score {
            best_score = score;
            best_category = Some(category);
        }
    }

    best_category.map(|s| s.to_string())
}

/// Extracts document-level tags from text (specialty name, invoice indicator).
pub fn extract_document_tags(text: &str) -> Vec<String> {
    let lower = text.to_lowercase();
    let mut tags: Vec<String> = Vec::new();

    let specialty_tags: &[(&[&str], &str)] = &[
        (&["gastroenterolog"], "gastroenterology"),
        (&["cardiol"], "cardiology"),
        (&["neurol", "neurolog"], "neurology"),
        (&["dermatol"], "dermatology"),
        (&["orthopaed", "orthoped"], "orthopaedics"),
        (&["oncol"], "oncology"),
        (&["endocrinol"], "endocrinology"),
        (&["respirator", "pulmonol"], "respiratory"),
        (&["rheumatol"], "rheumatology"),
        (&["ophthalmol"], "ophthalmology"),
        (&["haematol", "hematol"], "haematology"),
        (&["psychiatr", "psychol"], "psychiatry"),
        (&["physiother"], "physiotherapy"),
    ];

    for (keywords, tag) in specialty_tags {
        for kw in *keywords {
            if lower.contains(kw) {
                let tag_str = (*tag).to_string();
                if !tags.contains(&tag_str) {
                    tags.push(tag_str);
                }
                break;
            }
        }
    }

    let invoice_keywords = [
        "invoice",
        "bill\n",
        "receipt",
        "payment due",
        "amount due",
        "total due",
    ];
    if invoice_keywords.iter().any(|kw| lower.contains(kw)) {
        tags.push("invoice".to_string());
    }

    tags
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn suggests_gastroenterology_category() {
        let text = "Referred to Dr. Michael Chapman, Gastroenterologist, for further assessment.";
        assert_eq!(
            suggest_category(text),
            Some("Internal Medicine → Gastroenterology".to_string())
        );
    }

    #[test]
    fn suggests_cardiology_from_echocardiogram() {
        let text = "Echocardiogram report from the cardiology department.";
        assert_eq!(
            suggest_category(text),
            Some("Internal Medicine → Cardiology".to_string())
        );
    }

    #[test]
    fn suggests_cardiology_from_echocardiograph_keyword() {
        // "Echocardiograph" appears in real London Clinic invoices without the "-gram" suffix.
        let text = "Echocardiograph performed by Ms Ying Wang at The London Clinic.";
        assert_eq!(
            suggest_category(text),
            Some("Internal Medicine → Cardiology".to_string())
        );
    }

    #[test]
    fn endoscopy_in_footer_does_not_trigger_gastroenterology() {
        // Simulates a London Clinic payment receipt where the real procedure
        // (Echocardiograph) is in the body and the department extension list
        // (including "Endoscopy - 3145") is in the footer.
        let body = "INVOICE\nEchocardiograph\nCardiograph\nThe London Clinic\n".repeat(10);
        let footer = "DEPARTMENT EXTENSIONS\nEndoscopy - 3145\nPhysiotherapy - 3200\n".repeat(5);
        let text = format!("{body}{footer}");
        assert_eq!(
            suggest_category(&text),
            Some("Internal Medicine → Cardiology".to_string())
        );
    }

    #[test]
    fn endoscopy_alone_does_not_suggest_gastroenterology() {
        let text = "Endoscopy department extension 3145.";
        // "endoscopy" was removed from the gastroenterology keyword list.
        // No other keyword matches, so result is None.
        assert_eq!(suggest_category(text), None);
    }

    #[test]
    fn returns_none_for_unrecognised_text() {
        let text = "Patient attended the clinic on Monday.";
        assert_eq!(suggest_category(text), None);
    }

    #[test]
    fn extracts_specialty_tag() {
        let text = "Your Gastroenterologist will review the results.";
        let tags = extract_document_tags(text);
        assert!(tags.contains(&"gastroenterology".to_string()));
    }

    #[test]
    fn extracts_invoice_tag() {
        let text = "Invoice for consultation services. Amount due: £150.00";
        let tags = extract_document_tags(text);
        assert!(tags.contains(&"invoice".to_string()));
    }

    #[test]
    fn returns_empty_for_plain_text() {
        let text = "General appointment note.";
        assert!(extract_document_tags(text).is_empty());
    }
}

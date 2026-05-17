use regex::Regex;
use std::sync::OnceLock;

static HEADER_RE: OnceLock<Regex> = OnceLock::new();
static INVOICE_LINE_RE: OnceLock<Regex> = OnceLock::new();

fn header_re() -> &'static Regex {
    HEADER_RE.get_or_init(|| {
        Regex::new(r"(?im)^(?:notes|assessment|plan|impression|clinical notes|findings)\s*:")
            .expect("valid regex")
    })
}

pub fn extract_clinical_notes(text: &str) -> Option<String> {
    let re = header_re();
    let m = re.find(text)?;
    let after_header = text[m.end()..].trim_start();
    let body = match re.find(after_header) {
        Some(next) => &after_header[..next.start()],
        None => after_header,
    };
    let trimmed = body.trim();
    if trimmed.len() < 10 {
        return None;
    }
    Some(trimmed.chars().take(1000).collect())
}

fn invoice_line_re() -> &'static Regex {
    INVOICE_LINE_RE.get_or_init(|| {
        Regex::new(r"(?m)^(.{5,80}?)\s{2,}(?:\d+\s+)?[£$][\d,]+\.\d{2}").expect("valid regex")
    })
}

/// Extract invoice line-item descriptions from text.
///
/// Matches lines where a description is followed by 2+ spaces and a price
/// (£/$ with pence). Returns the description portion only, trimmed.
/// Summary labels (Total, Subtotal, VAT, Tax, Discount) are excluded.
pub fn extract_invoice_line_items(text: &str) -> Vec<String> {
    invoice_line_re()
        .captures_iter(text)
        .filter_map(|c| c.get(1))
        .map(|m| m.as_str().trim().to_string())
        .filter(|s| {
            if s.is_empty() {
                return false;
            }
            let lower = s.to_lowercase();
            !matches!(
                lower.as_str(),
                "total" | "subtotal" | "sub-total" | "vat" | "tax" | "discount" | "amount due"
            )
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extracts_assessment_section() {
        let text = "Patient Name: John Doe\n\nAssessment:\nPatient presents with mild hypertension and fatigue.\n\nPlan:\nIncrease medication dosage.";
        let result = extract_clinical_notes(text);
        assert!(result.is_some());
        let notes = result.unwrap();
        assert!(notes.contains("hypertension"));
        assert!(!notes.contains("Plan:"));
    }

    #[test]
    fn extracts_notes_section() {
        let text =
            "Date: 2024-01-15\n\nNotes: Follow-up required in two weeks. Blood pressure stable.";
        let result = extract_clinical_notes(text);
        assert!(result.is_some());
        assert!(result.unwrap().contains("Follow-up"));
    }

    #[test]
    fn returns_none_when_no_header() {
        let text = "Invoice #12345\nDate: 2024-01-15\nAmount: £150.00";
        assert!(extract_clinical_notes(text).is_none());
    }

    #[test]
    fn returns_none_when_body_too_short() {
        let text = "Assessment:\nOK";
        assert!(extract_clinical_notes(text).is_none());
    }

    #[test]
    fn truncates_at_1000_chars() {
        let long_body = "x".repeat(2000);
        let text = format!("Assessment:\n{long_body}");
        let result = extract_clinical_notes(&text).unwrap();
        assert_eq!(result.chars().count(), 1000);
    }

    #[test]
    fn case_insensitive_header() {
        let text = "ASSESSMENT:\nPatient has elevated blood glucose levels.";
        assert!(extract_clinical_notes(text).is_some());
    }

    #[test]
    fn extracts_four_invoice_line_items() {
        let text = "\
The Evewell Ltd
INVOICE

COVID-19 PCR Test                 £120.00
Consultation                      £200.00
Gynae Ultrasound Scan              £350.00
Cervical Smear and HPV Subtyping   £180.00

Total  £850.00
";
        let items = extract_invoice_line_items(text);
        assert_eq!(items.len(), 4, "expected 4 items; got: {items:?}");
        assert!(
            items.iter().any(|i| i.contains("COVID-19 PCR")),
            "missing COVID line; items: {items:?}"
        );
        assert!(
            items.iter().any(|i| i.contains("Consultation")),
            "missing Consultation; items: {items:?}"
        );
        assert!(
            items.iter().any(|i| i.contains("Gynae Ultrasound")),
            "missing Ultrasound; items: {items:?}"
        );
        assert!(
            items.iter().any(|i| i.contains("Cervical Smear")),
            "missing Smear; items: {items:?}"
        );
    }

    #[test]
    fn returns_empty_when_no_invoice_format() {
        let text = "Assessment:\nPatient presents with mild hypertension.";
        assert!(extract_invoice_line_items(text).is_empty());
    }

    #[test]
    fn invoice_line_items_use_pound_sign() {
        let text = "Blood test  £45.00\nX-ray      £95.00";
        let items = extract_invoice_line_items(text);
        assert_eq!(items.len(), 2);
    }

    #[test]
    fn invoice_line_items_use_dollar_sign() {
        let text = "Lab panel  $120.00\nConsult    $250.00";
        let items = extract_invoice_line_items(text);
        assert_eq!(items.len(), 2);
    }
}

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
    Some(trimmed.chars().take(3000).collect())
}

fn invoice_line_re() -> &'static Regex {
    INVOICE_LINE_RE.get_or_init(|| {
        // Full line: description (5-120 chars) + 2+ spaces + optional qty + optional currency + price
        Regex::new(r"(?m)^(.{5,120}?)\s{2,}(?:\d+\s+)?(?:[£$€])?[\d,]+\.\d{2}")
            .expect("valid regex")
    })
}

fn is_summary_label(s: &str) -> bool {
    let lower = s.to_lowercase();
    lower.starts_with("total")
        || lower.starts_with("subtotal")
        || lower.starts_with("sub-total")
        || lower.starts_with("amount due")
        || lower.starts_with("vat")
        || lower.starts_with("tax")
        || lower.starts_with("discount")
}

/// Returns full invoice lines (description + price). Used for display.
pub fn extract_invoice_line_items(text: &str) -> Vec<String> {
    invoice_line_re()
        .captures_iter(text)
        .filter_map(|c| c.get(0))
        .map(|m| m.as_str().trim().to_string())
        .filter(|s| !s.is_empty() && !is_summary_label(s))
        .collect()
}

/// Returns description-only strings (prices/qty/currency stripped), joined with "; " by caller.
pub fn extract_invoice_descriptions(text: &str) -> Vec<String> {
    invoice_line_re()
        .captures_iter(text)
        .filter_map(|c| c.get(1))
        .map(|m| m.as_str().trim().to_string())
        .filter(|s| !s.is_empty() && !is_summary_label(s))
        .collect()
}

/// Returns the first meaningful block of text: consecutive non-empty lines joined with ", ",
/// stopping at ~120 chars or the first blank line. Returns None if result < 3 chars.
pub fn extract_first_lines(text: &str) -> Option<String> {
    let mut result = String::new();
    for line in text.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            if !result.is_empty() {
                break;
            }
            continue;
        }
        if !result.is_empty() {
            result.push_str(", ");
        }
        result.push_str(trimmed);
        if result.len() >= 120 {
            break;
        }
    }
    if result.len() < 3 {
        None
    } else {
        Some(result)
    }
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
    fn truncates_at_3000_chars() {
        let long_body = "x".repeat(4000);
        let text = format!("Assessment:\n{long_body}");
        let result = extract_clinical_notes(&text).unwrap();
        assert_eq!(result.chars().count(), 3000);
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

    // --- extract_invoice_descriptions ---

    static EVEWELL_TEXT: &str = "\
The Evewell Ltd
INVOICE

COVID-19 PCR Test                 £120.00
Consultation                      £200.00
Gynae Ultrasound Scan              £350.00
Cervical Smear and HPV Subtyping   £180.00

Total  £850.00
";

    #[test]
    fn invoice_descriptions_strip_price() {
        let descs = extract_invoice_descriptions(EVEWELL_TEXT);
        assert_eq!(descs.len(), 4, "got: {descs:?}");
        assert!(descs.iter().any(|d| d == "COVID-19 PCR Test"), "{descs:?}");
        assert!(descs.iter().any(|d| d == "Consultation"), "{descs:?}");
        assert!(
            descs.iter().any(|d| d == "Gynae Ultrasound Scan"),
            "{descs:?}"
        );
        assert!(
            descs
                .iter()
                .any(|d| d == "Cervical Smear and HPV Subtyping"),
            "{descs:?}"
        );
        assert!(
            descs.iter().all(|d| !d.contains("£") && !d.contains(".")),
            "price leaked into description: {descs:?}"
        );
    }

    #[test]
    fn invoice_descriptions_single_item() {
        let text = "Initial out-patient consultation  £250.00\nTotal  £250.00";
        let descs = extract_invoice_descriptions(text);
        assert_eq!(descs, vec!["Initial out-patient consultation"]);
    }

    #[test]
    fn invoice_descriptions_excludes_total() {
        let descs = extract_invoice_descriptions(EVEWELL_TEXT);
        assert!(
            descs.iter().all(|d| !d.to_lowercase().starts_with("total")),
            "total leaked: {descs:?}"
        );
    }

    #[test]
    fn invoice_descriptions_joined_semicolon() {
        let descs = extract_invoice_descriptions(EVEWELL_TEXT);
        let joined = descs.join("; ");
        assert!(joined.contains("; "), "no semicolon separator: {joined}");
        assert!(!joined.contains("£"), "price in joined: {joined}");
    }

    // --- extract_first_lines ---

    #[test]
    fn first_lines_multi_line_stops_at_blank() {
        let text = "REGISTRATION FORM\nTuesday, January 10, 2023\n\nMore content here";
        let result = extract_first_lines(text).unwrap();
        assert_eq!(result, "REGISTRATION FORM, Tuesday, January 10, 2023");
    }

    #[test]
    fn first_lines_single_line() {
        let text = "Zoom Call 23.02.23\n\nAgenda: ...";
        let result = extract_first_lines(text).unwrap();
        assert_eq!(result, "Zoom Call 23.02.23");
    }

    #[test]
    fn first_lines_skips_leading_blanks() {
        let text = "\n\nCardiography\nCD5DP015 Echocardiograph\n\nMore";
        let result = extract_first_lines(text).unwrap();
        assert_eq!(result, "Cardiography, CD5DP015 Echocardiograph");
    }

    #[test]
    fn first_lines_stops_at_120_chars() {
        let long_line = "A".repeat(130);
        let text = format!("{long_line}\nSecond line");
        let result = extract_first_lines(&text).unwrap();
        assert!(result.len() >= 120);
        assert!(!result.contains("Second"));
    }

    #[test]
    fn first_lines_returns_none_when_empty() {
        assert!(extract_first_lines("").is_none());
        assert!(extract_first_lines("  \n  \n").is_none());
    }
}

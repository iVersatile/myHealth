use regex::Regex;
use std::sync::OnceLock;

static HEADER_RE: OnceLock<Regex> = OnceLock::new();

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
}

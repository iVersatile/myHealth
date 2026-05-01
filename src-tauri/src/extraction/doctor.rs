use regex::Regex;
use std::sync::OnceLock;

static DR_PATTERN: OnceLock<Regex> = OnceLock::new();

fn dr_regex() -> &'static Regex {
    DR_PATTERN.get_or_init(|| {
        // Groups: 1=title, 2=first name, 3=last name; middle initials consumed but not captured
        Regex::new(
            r"\b(Dr\.?|Prof\.?|Mr\.?|Mrs\.?|Ms\.?|Miss|Sir)\s+([A-Z][a-z]+)(?:\s+[A-Z]\.)*\s+([A-Z][a-z]+)",
        )
        .expect("doctor regex is valid")
    })
}

/// Extracts candidate provider names from free text.
///
/// Matches titles Dr/Prof/Mr/Mrs/Ms/Miss/Sir followed by a first and last name,
/// ignoring middle initials. Returns normalised "Title First Last" strings,
/// deduplicated in the order they first appear.
pub fn extract_doctor_candidates(text: &str) -> Vec<String> {
    let re = dr_regex();
    let mut seen = std::collections::HashSet::new();
    let mut results = Vec::new();

    for cap in re.captures_iter(text) {
        let name = format!("{} {} {}", &cap[1], &cap[2], &cap[3]);
        if seen.insert(name.clone()) {
            results.push(name);
        }
    }
    results
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extracts_standard_dr_dot_name() {
        let text = "Referred by Dr. John Smith for further assessment.";
        let candidates = extract_doctor_candidates(text);
        assert_eq!(candidates, vec!["Dr. John Smith"]);
    }

    #[test]
    fn extracts_dr_without_dot() {
        let text = "Your consultant Dr Jane Doe will contact you.";
        let candidates = extract_doctor_candidates(text);
        assert_eq!(candidates, vec!["Dr Jane Doe"]);
    }

    #[test]
    fn extracts_multiple_doctors() {
        let text = "Dr. Alice Brown reviewed by Dr. Charles Davis.";
        let candidates = extract_doctor_candidates(text);
        assert_eq!(candidates.len(), 2);
        assert!(candidates[0].contains("Alice Brown"));
        assert!(candidates[1].contains("Charles Davis"));
    }

    #[test]
    fn deduplicates_repeated_names() {
        let text = "Dr. John Smith is your GP. Contact Dr. John Smith.";
        let candidates = extract_doctor_candidates(text);
        assert_eq!(candidates.len(), 1);
        assert_eq!(candidates[0], "Dr. John Smith");
    }

    #[test]
    fn returns_empty_when_no_doctor_found() {
        let text = "Patient attended clinic on Monday for a blood test.";
        let candidates = extract_doctor_candidates(text);
        assert!(candidates.is_empty());
    }

    #[test]
    fn ignores_single_word_after_dr() {
        let text = "The Dr. Smith result was normal.";
        let candidates = extract_doctor_candidates(text);
        assert!(candidates.is_empty());
    }

    #[test]
    fn extracts_mr_with_middle_initial() {
        let text = "with Mr John A. Green BSc,MCSP,HCPC – Chartered Physiotherapist.";
        let candidates = extract_doctor_candidates(text);
        assert_eq!(candidates, vec!["Mr John Green"]);
    }

    #[test]
    fn extracts_mrs_prefix() {
        let text = "Referred to Mrs Alice Brown for follow-up.";
        let candidates = extract_doctor_candidates(text);
        assert_eq!(candidates, vec!["Mrs Alice Brown"]);
    }

    #[test]
    fn extracts_prof_prefix() {
        let text = "Prof. Sarah Jones led the research.";
        let candidates = extract_doctor_candidates(text);
        assert_eq!(candidates, vec!["Prof. Sarah Jones"]);
    }
}

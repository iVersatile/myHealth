use regex::Regex;
use std::sync::OnceLock;

static DR_PATTERN: OnceLock<Regex> = OnceLock::new();

fn dr_regex() -> &'static Regex {
    DR_PATTERN.get_or_init(|| {
        Regex::new(r"\bDr\.?\s+([A-Z][a-z]+\s+[A-Z][a-z]+)").expect("doctor regex is valid")
    })
}

/// Extracts candidate doctor names from free text.
///
/// Matches patterns like "Dr. John Smith" or "Dr Jane Doe".
/// Returns deduplicated names in the order they first appear.
pub fn extract_doctor_candidates(text: &str) -> Vec<String> {
    let re = dr_regex();
    let mut seen = std::collections::HashSet::new();
    let mut results = Vec::new();

    for cap in re.captures_iter(text) {
        if let Some(full) = cap.get(0) {
            let name = full.as_str().trim().to_string();
            if seen.insert(name.clone()) {
                results.push(name);
            }
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
}

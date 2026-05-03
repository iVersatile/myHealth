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

/// Returns the first doctor name that does NOT appear in a referral context
/// (e.g. "Referred by Dr. Smith", "Requested by Dr. Jones").
/// Falls back to the first candidate when all are in referral contexts.
pub fn extract_performing_doctor(text: &str) -> Option<String> {
    const REFERRAL_PHRASES: &[&str] = &[
        "referred by",
        "referring dr",
        "referring physician",
        "referring doctor",
        "requested by",
        "ordered by",
        "from dr",
        "from prof",
        "copy to",
        "cc:",
        "gp:",
        "patient:",
        "patient name:",
        "patient name",
        "name of patient",
        "name:",
        "for patient",
    ];
    const WINDOW: usize = 60;

    let re = dr_regex();
    let lower = text.to_lowercase();
    // Track previous match end so referral phrases from earlier candidates
    // don't bleed into the context window of later candidates.
    let mut prev_match_end = 0usize;

    for cap in re.captures_iter(text) {
        let name = format!("{} {} {}", &cap[1], &cap[2], &cap[3]);
        let match_start = cap.get(0).unwrap().start();
        let match_end = cap.get(0).unwrap().end();
        let context_start = match_start.saturating_sub(WINDOW).max(prev_match_end);
        let context = &lower[context_start..match_start];
        let is_referral = REFERRAL_PHRASES.iter().any(|p| context.contains(p));

        if !is_referral {
            return Some(name);
        }
        prev_match_end = match_end;
    }

    None
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

    // --- extract_performing_doctor ---

    #[test]
    fn performing_doctor_skips_referred_by() {
        let text = "Referred by Dr. John Smith. Performed by Dr. Alice Brown.";
        assert_eq!(
            extract_performing_doctor(text).as_deref(),
            Some("Dr. Alice Brown")
        );
    }

    #[test]
    fn performing_doctor_skips_requested_by() {
        let text = "Requested by Dr. John Smith. Cardiologist Dr. Alice Brown.";
        assert_eq!(
            extract_performing_doctor(text).as_deref(),
            Some("Dr. Alice Brown")
        );
    }

    #[test]
    fn performing_doctor_returns_none_when_all_referral() {
        let text = "Referred by Dr. John Smith. Ordered by Dr. Alice Brown.";
        assert!(extract_performing_doctor(text).is_none());
    }

    #[test]
    fn performing_doctor_returns_none_when_empty() {
        assert!(extract_performing_doctor("No doctors here.").is_none());
    }

    #[test]
    fn performing_doctor_returns_none_when_only_referral_candidate() {
        let text = "Referred by Dr. John Smith for echocardiogram.";
        assert!(extract_performing_doctor(text).is_none());
    }

    #[test]
    fn performing_doctor_skips_patient_label() {
        // "Patient: Ms Ying Wang" must not be identified as the performing doctor.
        let text = "Patient: Ms Ying Wang\nPerformed by Dr. Alice Brown.";
        assert_eq!(
            extract_performing_doctor(text).as_deref(),
            Some("Dr. Alice Brown")
        );
    }

    #[test]
    fn performing_doctor_returns_none_when_only_patient_label() {
        let text = "Patient name: Ms Ying Wang\nDate: 22 Nov 2021";
        assert!(extract_performing_doctor(text).is_none());
    }

    #[test]
    fn performing_doctor_skips_for_patient_prefix() {
        let text = "For patient Mrs Jane Doe. Consultant: Dr. Bob Green.";
        assert_eq!(
            extract_performing_doctor(text).as_deref(),
            Some("Dr. Bob Green")
        );
    }
}

use std::collections::HashMap;

use crate::commands::appointments::Appointment;
use crate::commands::documents::Document;

#[derive(Debug, Clone)]
pub struct LinkCandidate {
    pub appointment_id: String,
    pub score: u8,
    pub reasons: Vec<String>,
}

/// Score document–appointment link candidates using 4 signals.
/// Returns only candidates with score ≥ 4, sorted descending.
pub fn score_candidates(
    doc: &Document,
    appointments: &[Appointment],
    appt_categories: &HashMap<String, Vec<String>>,
) -> Vec<LinkCandidate> {
    let mut results: Vec<LinkCandidate> = appointments
        .iter()
        .filter_map(|appt| {
            let candidate = compute_candidate(doc, appt, appt_categories);
            if candidate.score >= 4 {
                Some(candidate)
            } else {
                None
            }
        })
        .collect();
    results.sort_by_key(|c| std::cmp::Reverse(c.score));
    results
}

fn compute_candidate(
    doc: &Document,
    appt: &Appointment,
    appt_categories: &HashMap<String, Vec<String>>,
) -> LinkCandidate {
    let mut score: u8 = 0;
    let mut reasons: Vec<String> = Vec::new();

    // Signal 1: +3 if document date is within ±3 days of appointment date
    if let Some(doc_date) = &doc.document_date {
        if date_within_days(doc_date, &appt.appt_date, 3) {
            score += 3;
            reasons.push("date within 3 days".to_string());
        }
    }

    // Signal 2: +3 if doctor name appears in extracted_text (Levenshtein ≤ 2)
    if let Some(doctor) = &appt.doctor_name {
        if !doctor.is_empty() {
            if let Some(text) = &doc.extracted_text {
                if fuzzy_contains(text, doctor) {
                    score += 3;
                    reasons.push(format!("doctor \"{}\" in extracted text", doctor));
                }
            }
        }
    }

    // Signal 3: +2 if document category matches one of the appointment's categories
    if let Some(categories) = appt_categories.get(&appt.id) {
        if categories
            .iter()
            .any(|c| c.eq_ignore_ascii_case(&doc.category))
        {
            score += 2;
            reasons.push(format!("shared category \"{}\"", doc.category));
        }
    }

    // Signal 4: +2 if clinic name appears in extracted_text or notes
    if let Some(clinic) = &appt.clinic_name {
        if !clinic.is_empty() {
            let search_text = format!(
                "{} {}",
                doc.extracted_text.as_deref().unwrap_or("").to_lowercase(),
                doc.notes.as_deref().unwrap_or("").to_lowercase()
            );
            if search_text.contains(&clinic.to_lowercase()) {
                score += 2;
                reasons.push(format!("clinic \"{}\" in document", clinic));
            }
        }
    }

    LinkCandidate {
        appointment_id: appt.id.clone(),
        score,
        reasons,
    }
}

/// Returns true if any word in `text` is within Levenshtein distance ≤ 2 of `name`.
/// Falls back to substring match for short names (≤ 3 chars).
fn fuzzy_contains(text: &str, name: &str) -> bool {
    let name_lower = name.to_lowercase();
    let text_lower = text.to_lowercase();

    if name_lower.len() <= 3 {
        return text_lower.contains(&name_lower);
    }

    let threshold = if name_lower.len() <= 5 { 1 } else { 2 };

    text_lower
        .split_whitespace()
        .any(|word| strsim::levenshtein(word, &name_lower) <= threshold)
}

/// Returns true if two ISO-8601 date strings are within `days` of each other.
fn date_within_days(a: &str, b: &str, days: i64) -> bool {
    let Some(da) = parse_date_prefix(a) else {
        return false;
    };
    let Some(db) = parse_date_prefix(b) else {
        return false;
    };
    (da - db).abs() <= days
}

/// Parse the YYYY-MM-DD prefix of an ISO-8601 string into a day number.
fn parse_date_prefix(s: &str) -> Option<i64> {
    let date = s.get(..10)?;
    let mut parts = date.split('-');
    let y: i64 = parts.next()?.parse().ok()?;
    let m: i64 = parts.next()?.parse().ok()?;
    let d: i64 = parts.next()?.parse().ok()?;
    if !(1..=12).contains(&m) || !(1..=31).contains(&d) {
        return None;
    }
    Some(y * 365 + y / 4 - y / 100 + y / 400 + (m * 306 + 5) / 10 + d)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_doc(
        id: &str,
        category: &str,
        document_date: Option<&str>,
        extracted_text: Option<&str>,
        notes: Option<&str>,
    ) -> Document {
        Document {
            id: id.to_string(),
            filename: format!("{id}.pdf"),
            file_path: format!("/tmp/{id}.pdf"),
            mime_type: "application/pdf".to_string(),
            file_size_bytes: 100,
            category: category.to_string(),
            thumbnail_path: None,
            notes: notes.map(str::to_string),
            created_at: "2024-01-01T00:00:00Z".to_string(),
            updated_at: "2024-01-01T00:00:00Z".to_string(),
            is_deleted: false,
            document_date: document_date.map(str::to_string),
            activity_date: None,
            extracted_metadata: None,
            extracted_text: extracted_text.map(str::to_string),
            tags: vec![],
        }
    }

    fn make_appt(
        id: &str,
        appt_date: &str,
        doctor_name: Option<&str>,
        clinic_name: Option<&str>,
    ) -> Appointment {
        Appointment {
            id: id.to_string(),
            title: "Consultation".to_string(),
            doctor_name: doctor_name.map(str::to_string),
            clinic_name: clinic_name.map(str::to_string),
            specialty: None,
            appt_date: appt_date.to_string(),
            duration_min: 30,
            location: None,
            notes: None,
            status: "scheduled".to_string(),
            reminder_min: 0,
            created_at: "2024-01-01T00:00:00Z".to_string(),
            updated_at: "2024-01-01T00:00:00Z".to_string(),
            document_ids: vec![],
            contact_ids: vec![],
            recurrence_series_id: None,
        }
    }

    // Signal 1: date within 3 days → +3 (below threshold alone)
    #[test]
    fn signal1_date_within_3_days_below_threshold() {
        let doc = make_doc("d1", "lab", Some("2024-12-01"), None, None);
        let appt = make_appt("a1", "2024-12-03T09:00:00Z", None, None);
        let cats = HashMap::new();
        assert!(score_candidates(&doc, &[appt], &cats).is_empty());
    }

    // Signal 1 boundary: exactly 3 days + clinic → ≥4
    #[test]
    fn signal1_exactly_3_days_boundary() {
        let doc = make_doc(
            "d2",
            "lab",
            Some("2024-05-01"),
            Some("NHS blood test results"),
            None,
        );
        let appt = make_appt("a2", "2024-05-04T09:00:00Z", None, Some("NHS"));
        let cats = HashMap::new();
        let results = score_candidates(&doc, &[appt], &cats);
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].score, 5);
        assert!(results[0].reasons.iter().any(|r| r.contains("date")));
    }

    // Signal 1: 4 days away → no date score
    #[test]
    fn signal1_4_days_no_score() {
        let doc = make_doc("d3", "lab", Some("2024-05-01"), None, None);
        let appt = make_appt("a3", "2024-05-05T09:00:00Z", Some("Smith"), None);
        let cats = HashMap::new();
        assert!(score_candidates(&doc, &[appt], &cats).is_empty());
    }

    // Signal 2: doctor name exact match in extracted_text → +3
    #[test]
    fn signal2_doctor_exact_in_extracted_text() {
        let doc = make_doc(
            "d4",
            "lab",
            Some("2024-12-01"),
            Some("Referred by Dr Smith for review"),
            None,
        );
        let appt = make_appt("a4", "2024-12-01T09:00:00Z", Some("Smith"), None);
        let cats = HashMap::new();
        let results = score_candidates(&doc, &[appt], &cats);
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].score, 6);
        assert!(results[0].reasons.iter().any(|r| r.contains("doctor")));
    }

    // Signal 2: doctor name with 1 typo → still matches
    #[test]
    fn signal2_doctor_fuzzy_levenshtein_1() {
        let doc = make_doc(
            "d5",
            "lab",
            Some("2024-12-01"),
            Some("referred by smithh for blood test"),
            None,
        );
        let appt = make_appt("a5", "2024-12-01T09:00:00Z", Some("smith"), None);
        let cats = HashMap::new();
        let results = score_candidates(&doc, &[appt], &cats);
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].score, 6);
    }

    // Signal 2: doctor not in extracted_text → no score
    #[test]
    fn signal2_doctor_not_in_text_no_score() {
        let doc = make_doc(
            "d6",
            "lab",
            None,
            Some("Patient seen for routine checkup"),
            None,
        );
        let appt = make_appt("a6", "2024-12-01T09:00:00Z", Some("Johnson"), None);
        let cats = HashMap::new();
        assert!(score_candidates(&doc, &[appt], &cats).is_empty());
    }

    // Signal 3: shared category → +2
    #[test]
    fn signal3_shared_category() {
        let doc = make_doc("d7", "lab", Some("2024-10-05"), None, None);
        let appt = make_appt("a7", "2024-10-05T08:00:00Z", None, None);
        let mut cats = HashMap::new();
        cats.insert("a7".to_string(), vec!["lab".to_string()]);
        let results = score_candidates(&doc, &[appt], &cats);
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].score, 5);
        assert!(results[0].reasons.iter().any(|r| r.contains("category")));
    }

    // Signal 4: clinic in extracted_text → +2
    #[test]
    fn signal4_clinic_in_extracted_text() {
        let doc = make_doc(
            "d8",
            "lab",
            Some("2024-09-20"),
            Some("NHS Royal Free Hospital blood test results"),
            None,
        );
        let appt = make_appt("a8", "2024-09-20T11:00:00Z", None, Some("NHS"));
        let cats = HashMap::new();
        let results = score_candidates(&doc, &[appt], &cats);
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].score, 5);
        assert!(results[0].reasons.iter().any(|r| r.contains("clinic")));
    }

    // All 4 signals → score 10
    #[test]
    fn all_four_signals_score_10() {
        let doc = make_doc(
            "d9",
            "lab",
            Some("2024-08-10"),
            Some("NHS Smith ECG report"),
            None,
        );
        let appt = make_appt("a9", "2024-08-10T09:00:00Z", Some("Smith"), Some("NHS"));
        let mut cats = HashMap::new();
        cats.insert("a9".to_string(), vec!["lab".to_string()]);
        let results = score_candidates(&doc, &[appt], &cats);
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].score, 10);
        assert_eq!(results[0].reasons.len(), 4);
    }

    // Results sorted descending
    #[test]
    fn results_sorted_descending() {
        let doc = make_doc(
            "d10",
            "lab",
            Some("2024-07-01"),
            Some("NHS Smith report"),
            None,
        );
        let appt_high = make_appt("a_high", "2024-07-01T09:00:00Z", Some("Smith"), Some("NHS"));
        let appt_low = make_appt("a_low", "2024-07-01T09:00:00Z", None, None);
        let mut cats = HashMap::new();
        cats.insert("a_low".to_string(), vec!["lab".to_string()]);
        let results = score_candidates(&doc, &[appt_low, appt_high], &cats);
        assert_eq!(results.len(), 2);
        assert!(results[0].score >= results[1].score);
        assert_eq!(results[0].appointment_id, "a_high");
    }

    // Performance: 200 appointments scored in < 200ms
    #[test]
    fn perf_200_appointments_under_200ms() {
        use std::time::Instant;

        let doc = make_doc(
            "perf",
            "lab",
            Some("2024-06-15"),
            Some("Dr Johnson NHS blood test"),
            None,
        );
        let appointments: Vec<Appointment> = (0..200)
            .map(|i| {
                make_appt(
                    &format!("a{i}"),
                    "2024-06-15T09:00:00Z",
                    Some("Johnson"),
                    Some("NHS"),
                )
            })
            .collect();
        let mut cats = HashMap::new();
        for i in 0..200 {
            cats.insert(format!("a{i}"), vec!["lab".to_string()]);
        }

        let start = Instant::now();
        let results = score_candidates(&doc, &appointments, &cats);
        let elapsed = start.elapsed();

        assert!(!results.is_empty());
        assert!(
            elapsed.as_millis() < 200,
            "Scoring 200 appointments took {}ms (limit 200ms)",
            elapsed.as_millis()
        );
    }
}

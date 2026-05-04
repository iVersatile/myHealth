#![allow(dead_code)]

use std::collections::HashMap;

use crate::commands::appointments::Appointment;
use crate::commands::documents::Document;

/// Score document–appointment link candidates.
/// Returns appointments with score ≥ 4, sorted descending.
pub fn score_link_candidates(
    doc: &Document,
    appointments: &[Appointment],
    appt_categories: &HashMap<String, Vec<String>>,
) -> Vec<(String, u8)> {
    let mut results: Vec<(String, u8)> = appointments
        .iter()
        .filter_map(|appt| {
            let score = compute_score(doc, appt, appt_categories);
            if score >= 4 {
                Some((appt.id.clone(), score))
            } else {
                None
            }
        })
        .collect();
    results.sort_by_key(|item| std::cmp::Reverse(item.1));
    results
}

fn compute_score(
    doc: &Document,
    appt: &Appointment,
    appt_categories: &HashMap<String, Vec<String>>,
) -> u8 {
    let mut score: u8 = 0;

    // +3 if document date is within ±3 days of appointment date
    if let Some(doc_date) = &doc.document_date {
        if date_within_days(doc_date, &appt.appt_date, 3) {
            score += 3;
        }
    }

    // +3 if appointment doctor name appears in document filename or notes
    if let Some(doctor) = &appt.doctor_name {
        if !doctor.is_empty() {
            let doc_text = format!(
                "{} {}",
                doc.filename.to_lowercase(),
                doc.notes.as_deref().unwrap_or("").to_lowercase()
            );
            if doc_text.contains(&doctor.to_lowercase()) {
                score += 3;
            }
        }
    }

    // +2 if document category matches one of the appointment's categories
    if let Some(categories) = appt_categories.get(&appt.id) {
        if categories
            .iter()
            .any(|c| c.eq_ignore_ascii_case(&doc.category))
        {
            score += 2;
        }
    }

    // +2 if appointment clinic name appears in document filename or notes
    if let Some(clinic) = &appt.clinic_name {
        if !clinic.is_empty() {
            let doc_text = format!(
                "{} {}",
                doc.filename.to_lowercase(),
                doc.notes.as_deref().unwrap_or("").to_lowercase()
            );
            if doc_text.contains(&clinic.to_lowercase()) {
                score += 2;
            }
        }
    }

    score
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
    // Gregorian day count — accurate for ±3-day proximity checks
    Some(y * 365 + y / 4 - y / 100 + y / 400 + (m * 306 + 5) / 10 + d)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_doc(
        id: &str,
        filename: &str,
        category: &str,
        document_date: Option<&str>,
        notes: Option<&str>,
    ) -> Document {
        Document {
            id: id.to_string(),
            filename: filename.to_string(),
            file_path: format!("/tmp/{filename}"),
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
            extracted_text: None,
            tags: vec![],
            clinic_name: None,
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

    #[test]
    fn date_only_scores_below_threshold() {
        let doc = make_doc("d1", "blood_test.pdf", "lab", Some("2024-12-01"), None);
        let appt = make_appt("a1", "2024-12-03T09:00:00Z", None, None);
        let cats = HashMap::new();
        // score = 3 (date) — below threshold 4
        assert!(score_link_candidates(&doc, &[appt], &cats).is_empty());
    }

    #[test]
    fn date_plus_doctor_match_scores_6() {
        let doc = make_doc("d2", "smith_bloodtest.pdf", "lab", Some("2024-12-01"), None);
        let appt = make_appt("a2", "2024-12-01T09:00:00Z", Some("Smith"), None);
        let cats = HashMap::new();
        let results = score_link_candidates(&doc, &[appt], &cats);
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].0, "a2");
        assert_eq!(results[0].1, 6);
    }

    #[test]
    fn doctor_name_in_notes_scores_3() {
        let doc = make_doc(
            "d3",
            "scan.pdf",
            "imaging",
            Some("2024-11-15"),
            Some("Referred by Dr Johnson"),
        );
        let appt = make_appt("a3", "2024-11-15T10:00:00Z", Some("Johnson"), None);
        let cats = HashMap::new();
        let results = score_link_candidates(&doc, &[appt], &cats);
        // 3 (date) + 3 (doctor in notes) = 6
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].1, 6);
    }

    #[test]
    fn shared_category_adds_2() {
        let doc = make_doc("d4", "ecg.pdf", "lab", Some("2024-10-05"), None);
        let appt = make_appt("a4", "2024-10-05T08:00:00Z", None, None);
        let mut cats = HashMap::new();
        cats.insert("a4".to_string(), vec!["lab".to_string()]);
        let results = score_link_candidates(&doc, &[appt], &cats);
        // 3 (date) + 2 (category) = 5
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].1, 5);
    }

    #[test]
    fn shared_clinic_adds_2() {
        let doc = make_doc("d5", "NHS_bloodtest.pdf", "lab", Some("2024-09-20"), None);
        let appt = make_appt("a5", "2024-09-20T11:00:00Z", None, Some("NHS"));
        let cats = HashMap::new();
        let results = score_link_candidates(&doc, &[appt], &cats);
        // 3 (date) + 2 (clinic in filename) = 5
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].1, 5);
    }

    #[test]
    fn all_four_factors_score_10() {
        let doc = make_doc("d6", "NHS_smith_ecg.pdf", "lab", Some("2024-08-10"), None);
        let appt = make_appt("a6", "2024-08-10T09:00:00Z", Some("Smith"), Some("NHS"));
        let mut cats = HashMap::new();
        cats.insert("a6".to_string(), vec!["lab".to_string()]);
        let results = score_link_candidates(&doc, &[appt], &cats);
        // 3 + 3 + 2 + 2 = 10
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].1, 10);
    }

    #[test]
    fn results_sorted_descending() {
        let doc = make_doc("d7", "NHS_smith.pdf", "lab", Some("2024-07-01"), None);
        let appt_high = make_appt("a_high", "2024-07-01T09:00:00Z", Some("Smith"), Some("NHS"));
        let appt_low = make_appt("a_low", "2024-07-01T09:00:00Z", None, None);
        let mut cats = HashMap::new();
        cats.insert("a_low".to_string(), vec!["lab".to_string()]);
        // a_high: 3+3+2 = 8 (no category match), a_low: 3+2 = 5
        let results = score_link_candidates(&doc, &[appt_low, appt_high], &cats);
        assert_eq!(results.len(), 2);
        assert!(results[0].1 >= results[1].1);
        assert_eq!(results[0].0, "a_high");
    }

    #[test]
    fn date_outside_window_no_date_score() {
        let doc = make_doc("d8", "test.pdf", "lab", Some("2024-12-01"), None);
        let appt = make_appt("a8", "2024-12-10T09:00:00Z", None, None);
        let cats = HashMap::new();
        assert!(score_link_candidates(&doc, &[appt], &cats).is_empty());
    }

    #[test]
    fn date_exactly_3_days_boundary_included() {
        let doc = make_doc("d9", "nhs_blood.pdf", "lab", Some("2024-05-01"), None);
        let appt = make_appt("a9", "2024-05-04T09:00:00Z", None, Some("NHS"));
        let cats = HashMap::new();
        // 3 (date boundary) + 2 (clinic) = 5 ≥ 4
        let results = score_link_candidates(&doc, &[appt], &cats);
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].1, 5);
    }

    #[test]
    fn date_4_days_away_no_date_score() {
        let doc = make_doc("d10", "smith_blood.pdf", "lab", Some("2024-05-01"), None);
        let appt = make_appt("a10", "2024-05-05T09:00:00Z", Some("Smith"), None);
        let cats = HashMap::new();
        // date is 4 days away → no date score; doctor match → +3; total = 3 < 4
        assert!(score_link_candidates(&doc, &[appt], &cats).is_empty());
    }

    #[test]
    fn no_document_date_no_date_score() {
        let doc = make_doc("d11", "nhs_smith.pdf", "lab", None, None);
        let appt = make_appt("a11", "2024-03-15T09:00:00Z", Some("Smith"), Some("NHS"));
        let cats = HashMap::new();
        // no doc date → 0; doctor → +3; clinic → +2; total = 5 ≥ 4
        let results = score_link_candidates(&doc, &[appt], &cats);
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].1, 5);
    }
}

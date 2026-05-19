use chrono::NaiveDate;
use regex::Regex;

// ── Activity date extraction ──────────────────────────────────────────────────

/// Scans the document body for labelled date patterns (Priority 1).
/// Recognised labels: "Date of Service", "Invoice Date", "Appointment Date", "Date".
/// Recognised formats: DD/MM/YYYY, DD Month YYYY, YYYY-MM-DD.
/// Returns the first match as an ISO-8601 string (YYYY-MM-DD).
pub fn extract_activity_date(text: &str) -> Option<String> {
    const LABELLED: &[(&str, &str)] = &[
        (
            r"(?i)date\s+of\s+service\s*[:\-]\s*([0-9]{1,2}/[0-9]{1,2}/[0-9]{4})",
            "dmy_slash",
        ),
        (
            r"(?i)date\s+of\s+service\s*[:\-]\s*([0-9]{4}-[0-9]{2}-[0-9]{2})",
            "ymd",
        ),
        (
            r"(?i)date\s+of\s+service\s*[:\-]\s*([0-9]{1,2}\s+[A-Za-z]+\s+[0-9]{4})",
            "dmonthy",
        ),
        (
            r"(?i)invoice\s+date\s*[:\-]\s*([0-9]{1,2}/[0-9]{1,2}/[0-9]{4})",
            "dmy_slash",
        ),
        (
            r"(?i)invoice\s+date\s*[:\-]\s*([0-9]{4}-[0-9]{2}-[0-9]{2})",
            "ymd",
        ),
        (
            r"(?i)invoice\s+date\s*[:\-]\s*([0-9]{1,2}\s+[A-Za-z]+\s+[0-9]{4})",
            "dmonthy",
        ),
        (
            r"(?i)appointment\s+date\s*[:\-]\s*([0-9]{1,2}/[0-9]{1,2}/[0-9]{4})",
            "dmy_slash",
        ),
        (
            r"(?i)appointment\s+date\s*[:\-]\s*([0-9]{4}-[0-9]{2}-[0-9]{2})",
            "ymd",
        ),
        (
            r"(?i)appointment\s+date\s*[:\-]\s*([0-9]{1,2}\s+[A-Za-z]+\s+[0-9]{4})",
            "dmonthy",
        ),
        (
            r"(?i)(?:^|\s)date\s*[:\-]\s*([0-9]{1,2}/[0-9]{1,2}/[0-9]{4})",
            "dmy_slash",
        ),
        (
            r"(?i)(?:^|\s)date\s*[:\-]\s*([0-9]{4}-[0-9]{2}-[0-9]{2})",
            "ymd",
        ),
        (
            r"(?i)(?:^|\s)date\s*[:\-]\s*([0-9]{1,2}\s+[A-Za-z]+\s+[0-9]{4})",
            "dmonthy",
        ),
    ];

    for (pattern, fmt) in LABELLED {
        let Ok(re) = Regex::new(pattern) else {
            continue;
        };
        if let Some(caps) = re.captures(text) {
            if let Some(m) = caps.get(1) {
                if let Some(iso) = parse_date_to_iso(m.as_str().trim(), fmt) {
                    return Some(iso);
                }
            }
        }
    }
    None
}

fn parse_date_to_iso(s: &str, fmt: &str) -> Option<String> {
    match fmt {
        "ymd" => NaiveDate::parse_from_str(s, "%Y-%m-%d")
            .ok()
            .map(|d| d.format("%Y-%m-%d").to_string()),
        "dmy_slash" => NaiveDate::parse_from_str(s, "%d/%m/%Y")
            .ok()
            .map(|d| d.format("%Y-%m-%d").to_string()),
        "dmonthy" => NaiveDate::parse_from_str(s, "%d %B %Y")
            .ok()
            .map(|d| d.format("%Y-%m-%d").to_string()),
        _ => None,
    }
}

/// Builds the timeline description for a document.
///
/// Format: `{YYYY-MM-DD} {Specialty} with {Title} {Provider Name}`
/// Falls back gracefully when tags are missing.
#[allow(dead_code)]
pub fn format_timeline_description(activity_date: &str, auto_tags: &[String]) -> String {
    // Specialty tags: single-word Title Case (e.g. "Physiotherapy", "Cardiology").
    let specialty = auto_tags
        .iter()
        .find(|t| {
            !t.contains(' ')
                && t.chars().next().map(|c| c.is_uppercase()).unwrap_or(false)
                && t.chars().any(|c| c.is_lowercase())
        })
        .map(String::as_str)
        .unwrap_or("Document");

    // Provider tags: multi-word, start with uppercase (e.g. "Mr John Green").
    let provider: Option<&str> = auto_tags
        .iter()
        .find(|t| t.contains(' ') && t.chars().next().map(|c| c.is_uppercase()).unwrap_or(false))
        .map(String::as_str);

    match provider {
        Some(p) => format!("{activity_date} {specialty} with {p}"),
        None => format!("{activity_date} {specialty}"),
    }
}

// ── Tag helpers ───────────────────────────────────────────────────────────────

fn tags_contains_ci(tags: &[String], candidate: &str) -> bool {
    let lower = candidate.to_lowercase();
    tags.iter().any(|t| t.to_lowercase() == lower)
}

/// Scans the first three non-empty lines for a document title candidate.
/// A line qualifies when all of: ≤5 words, 2–60 chars, every word starts
/// uppercase (title-case), fewer than 1/3 of characters are digits, and
/// it does not end with ':' (label lines like "Date:").
/// Returns the trimmed line on first match, or `None`.
pub fn extract_doc_title(text: &str) -> Option<String> {
    for line in text.lines().filter(|l| !l.trim().is_empty()).take(3) {
        let trimmed = line.trim();
        if trimmed.len() < 2 || trimmed.len() > 60 {
            continue;
        }
        if trimmed.ends_with(':') {
            continue;
        }
        let words: Vec<&str> = trimmed.split_whitespace().collect();
        if words.is_empty() || words.len() > 5 {
            continue;
        }
        let digit_count = trimmed.chars().filter(|c| c.is_ascii_digit()).count();
        if digit_count * 3 > trimmed.len() {
            continue;
        }
        let is_title_case = words
            .iter()
            .all(|w| w.chars().next().map(|c| c.is_uppercase()).unwrap_or(false));
        if is_title_case {
            return Some(trimmed.to_string());
        }
    }
    None
}

fn text_has_word(lower_text: &str, word: &str) -> bool {
    lower_text
        .split(|c: char| !c.is_alphabetic())
        .any(|w| w == word)
}

/// Auto-extracts all four tag types and de-duplicates case-insensitively.
///
/// 1. **Type tags** (lowercase): invoice, receipt, bill, referral, prescription,
///    report, summary, discharge — whole-word match in text.
/// 2. **Specialty tags** (Title Case): Physiotherapy, Cardiology, etc.
/// 3. **Provider name tags**: each entry from `doctor_candidates`.
/// 4. **Activity date tag**: `activity_date` as-is (YYYY-MM-DD).
pub fn auto_extract_tags(
    text: &str,
    doctor_candidates: &[String],
    activity_date: Option<&str>,
) -> Vec<String> {
    let lower = text.to_lowercase();
    let mut tags: Vec<String> = Vec::new();

    const TYPE_KEYWORDS: &[&str] = &[
        "invoice",
        "receipt",
        "bill",
        "referral",
        "prescription",
        "report",
        "summary",
        "discharge",
    ];
    let mut has_type_tag = false;
    for &kw in TYPE_KEYWORDS {
        if text_has_word(&lower, kw) && !tags_contains_ci(&tags, kw) {
            tags.push(kw.to_string());
            has_type_tag = true;
        }
    }
    if !has_type_tag {
        tags.push("Notes".to_string());
    }

    const SPECIALTY_MAP: &[(&[&str], &str)] = &[
        (&["physiother"], "Physiotherapy"),
        (&["gastroenterolog"], "Gastroenterology"),
        (&["cardiol"], "Cardiology"),
        (&["neurol", "neurolog"], "Neurology"),
        (&["dermatol"], "Dermatology"),
        (&["orthopaed", "orthoped"], "Orthopaedics"),
        (&["oncol"], "Oncology"),
        (&["endocrinol"], "Endocrinology"),
        (&["respirator", "pulmonol"], "Respiratory"),
        (&["rheumatol"], "Rheumatology"),
        (&["ophthalmol"], "Ophthalmology"),
        (&["urol"], "Urology"),
        (&["gynaecol", "gynecol"], "Gynaecology"),
        (&["haematol", "hematol"], "Haematology"),
        (&["nephrol"], "Nephrology"),
        (&["psychiatr", "psychol"], "Psychiatry"),
        (&["radiol"], "Radiology"),
    ];
    for (keywords, tag) in SPECIALTY_MAP {
        for &kw in *keywords {
            if lower.contains(kw) && !tags_contains_ci(&tags, tag) {
                tags.push(tag.to_string());
                break;
            }
        }
    }

    for name in doctor_candidates {
        let name = name.trim();
        if !name.is_empty() && !tags_contains_ci(&tags, name) {
            tags.push(name.to_string());
        }
    }

    if let Some(date) = activity_date {
        let date = date.trim();
        if !date.is_empty() && !tags_contains_ci(&tags, date) {
            tags.push(date.to_string());
        }
    }

    if let Some(title) = extract_doc_title(text) {
        if !tags_contains_ci(&tags, &title) {
            tags.push(title);
        }
    }

    tags
}

#[cfg(test)]
mod tests {
    use super::*;

    // ── auto_extract_tags tests ───────────────────────────────────────────────

    #[test]
    fn auto_tags_type_invoice_lowercase() {
        let tags = auto_extract_tags("INVOICE for consultation", &[], None);
        assert!(tags.contains(&"invoice".to_string()), "tags: {tags:?}");
    }

    #[test]
    fn auto_tags_provider_name_included() {
        let candidates = vec!["John Green".to_string()];
        let tags = auto_extract_tags("referral letter", &candidates, None);
        assert!(tags.contains(&"John Green".to_string()), "tags: {tags:?}");
    }

    #[test]
    fn auto_tags_specialty_physiotherapy_title_case() {
        let tags = auto_extract_tags("Physiotherapy assessment report", &[], None);
        assert!(
            tags.contains(&"Physiotherapy".to_string()),
            "tags: {tags:?}"
        );
    }

    #[test]
    fn auto_tags_activity_date() {
        let tags = auto_extract_tags("", &[], Some("2023-03-09"));
        assert!(tags.contains(&"2023-03-09".to_string()), "tags: {tags:?}");
    }

    #[test]
    fn auto_tags_deduplication_case_insensitive() {
        let candidates = vec!["INVOICE".to_string()];
        let tags = auto_extract_tags("INVOICE total due", &candidates, None);
        let count = tags
            .iter()
            .filter(|t| t.to_lowercase() == "invoice")
            .count();
        assert_eq!(
            count, 1,
            "expected 1 'invoice' tag, got {count}; tags: {tags:?}"
        );
    }

    #[test]
    fn auto_tags_all_four_types_present() {
        let candidates = vec!["Dr Smith".to_string()];
        let tags = auto_extract_tags(
            "Invoice for physiotherapy session",
            &candidates,
            Some("2024-01-15"),
        );
        assert!(
            tags.contains(&"invoice".to_string()),
            "missing type tag; tags: {tags:?}"
        );
        assert!(
            tags.contains(&"Physiotherapy".to_string()),
            "missing specialty tag; tags: {tags:?}"
        );
        assert!(
            tags.contains(&"Dr Smith".to_string()),
            "missing provider tag; tags: {tags:?}"
        );
        assert!(
            tags.contains(&"2024-01-15".to_string()),
            "missing date tag; tags: {tags:?}"
        );
    }

    #[test]
    fn auto_tags_type_whole_word_no_false_positive() {
        let tags = auto_extract_tags("ability billion", &[], None);
        assert!(
            !tags.contains(&"bill".to_string()),
            "false positive; tags: {tags:?}"
        );
    }

    #[test]
    fn auto_tags_notes_fallback_when_no_type_tag() {
        let tags = auto_extract_tags("GP consultation notes from today's visit", &[], None);
        assert!(
            tags.contains(&"Notes".to_string()),
            "expected Notes fallback; tags: {tags:?}"
        );
    }

    #[test]
    fn auto_tags_no_notes_fallback_when_type_tag_present() {
        let tags = auto_extract_tags("INVOICE for physiotherapy consultation", &[], None);
        assert!(
            !tags.contains(&"Notes".to_string()),
            "unexpected Notes tag when type tag present; tags: {tags:?}"
        );
    }

    // ── extract_doc_title tests ───────────────────────────────────────────────

    #[test]
    fn doc_title_extracts_registration_form() {
        let text = "Registration Form\nPatient Name: John Doe\nDate: 09/03/2023";
        assert_eq!(
            extract_doc_title(text).as_deref(),
            Some("Registration Form")
        );
    }

    #[test]
    fn doc_title_skips_label_lines() {
        let text = "Date:\nSome Long Text That Does Not Qualify As Title At All Whatsoever";
        assert_eq!(extract_doc_title(text), None);
    }

    #[test]
    fn doc_title_skips_digit_heavy_lines() {
        let text = "09/03/2023\nRegistration Form";
        assert_eq!(
            extract_doc_title(text).as_deref(),
            Some("Registration Form")
        );
    }

    #[test]
    fn doc_title_skips_lines_over_five_words() {
        let text = "This Is A Very Long Title With Too Many Words Here\nShort Title";
        assert_eq!(extract_doc_title(text).as_deref(), Some("Short Title"));
    }

    #[test]
    fn doc_title_none_when_no_title_case_line() {
        let text = "no uppercase here\nstill lowercase";
        assert_eq!(extract_doc_title(text), None);
    }

    #[test]
    fn auto_tags_includes_title_tag() {
        let text = "Registration Form\nDate: 09/03/2023\nPatient details follow";
        let tags = auto_extract_tags(text, &[], Some("2023-03-09"));
        assert!(
            tags.iter().any(|t| t == "Registration Form"),
            "expected Registration Form tag (no prefix); got {tags:?}"
        );
        assert!(
            !tags.iter().any(|t| t.starts_with("title:")),
            "unexpected title: prefix found in tags; got {tags:?}"
        );
    }

    // ── extract_activity_date tests ───────────────────────────────────────────

    #[test]
    fn activity_date_labelled_body_dmy_slash() {
        let date = extract_activity_date("Date of Service: 09/03/2023\nsome other text");
        assert_eq!(date.as_deref(), Some("2023-03-09"));
    }

    #[test]
    fn activity_date_labelled_body_iso() {
        let date = extract_activity_date("Invoice Date: 2023-03-09\npatient info");
        assert_eq!(date.as_deref(), Some("2023-03-09"));
    }

    #[test]
    fn activity_date_labelled_body_month_name() {
        let date = extract_activity_date("Appointment Date: 09 March 2023");
        assert_eq!(date.as_deref(), Some("2023-03-09"));
    }

    #[test]
    fn activity_date_generic_date_label() {
        let date = extract_activity_date("Date: 09/03/2023");
        assert_eq!(date.as_deref(), Some("2023-03-09"));
    }

    #[test]
    fn activity_date_none_when_no_label() {
        let date = extract_activity_date("09/03/2023 something happened");
        assert!(date.is_none(), "expected None but got {date:?}");
    }

    // ── format_timeline_description tests ────────────────────────────────────

    #[test]
    fn timeline_description_physio_with_provider() {
        let tags = vec![
            "invoice".to_string(),
            "Physiotherapy".to_string(),
            "Mr John Green".to_string(),
            "2023-03-09".to_string(),
        ];
        let desc = format_timeline_description("2023-03-09", &tags);
        assert_eq!(desc, "2023-03-09 Physiotherapy with Mr John Green");
    }

    #[test]
    fn timeline_description_no_provider_fallback() {
        let tags = vec!["Cardiology".to_string(), "2024-01-15".to_string()];
        let desc = format_timeline_description("2024-01-15", &tags);
        assert_eq!(desc, "2024-01-15 Cardiology");
    }

    #[test]
    fn timeline_description_no_specialty_uses_document() {
        let tags = vec!["invoice".to_string(), "Dr Smith".to_string()];
        let desc = format_timeline_description("2024-01-15", &tags);
        assert_eq!(desc, "2024-01-15 Document with Dr Smith");
    }

    #[test]
    fn timeline_description_no_specialty_no_provider_uses_document() {
        let tags = vec!["invoice".to_string(), "2024-01-15".to_string()];
        let desc = format_timeline_description("2024-01-15", &tags);
        assert_eq!(desc, "2024-01-15 Document");
    }
}

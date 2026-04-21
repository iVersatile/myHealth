use chrono::NaiveDate;

#[derive(Debug, PartialEq)]
pub struct ParsedFilename {
    pub document_date: Option<NaiveDate>,
    pub tags: Vec<String>,
}

const STOPWORDS: &[&str] = &[
    "a", "an", "the", "and", "or", "of", "in", "on", "at", "to", "for", "with", "by", "from", "up",
    "as", "is", "it", "its",
];

const MONTHS: &[(&str, u32)] = &[
    ("jan", 1),
    ("feb", 2),
    ("mar", 3),
    ("apr", 4),
    ("may", 5),
    ("jun", 6),
    ("jul", 7),
    ("aug", 8),
    ("sep", 9),
    ("oct", 10),
    ("nov", 11),
    ("dec", 12),
];

fn parse_month(s: &str) -> Option<u32> {
    let lower = s.to_lowercase();
    MONTHS
        .iter()
        .find(|(name, _)| *name == lower.as_str())
        .map(|(_, m)| *m)
}

pub fn parse_filename(stem: &str) -> ParsedFilename {
    // Normalise underscores to spaces so \b word-boundary works between tokens and digits.
    let mut remaining = stem.replace('_', " ");
    let mut document_date: Option<NaiveDate> = None;
    let mut extra_tags: Vec<String> = Vec::new();

    // Pattern: YYYY-MM-DD  e.g. 2024-12-01
    if document_date.is_none() {
        let re =
            regex::Regex::new(r"\b(19|20)\d{2}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])\b").unwrap();
        if let Some(m) = re.find(&remaining) {
            let s = m.as_str();
            let parts: Vec<&str> = s.split('-').collect();
            if let (Ok(y), Ok(mo), Ok(d)) = (
                parts[0].parse::<i32>(),
                parts[1].parse::<u32>(),
                parts[2].parse::<u32>(),
            ) {
                document_date = NaiveDate::from_ymd_opt(y, mo, d);
                remaining = remaining.replacen(s, " ", 1);
            }
        }
    }

    // Pattern: YYYYMMDD  e.g. 20241201
    if document_date.is_none() {
        let re =
            regex::Regex::new(r"\b(19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\b").unwrap();
        if let Some(m) = re.find(&remaining) {
            let s = m.as_str();
            if let (Ok(y), Ok(mo), Ok(d)) = (
                s[0..4].parse::<i32>(),
                s[4..6].parse::<u32>(),
                s[6..8].parse::<u32>(),
            ) {
                if let Some(date) = NaiveDate::from_ymd_opt(y, mo, d) {
                    document_date = Some(date);
                    remaining = remaining.replacen(s, " ", 1);
                }
            }
        }
    }

    // Pattern: DD-Mon-YYYY  e.g. 01-Dec-2024
    if document_date.is_none() {
        let re = regex::Regex::new(
            r"(?i)\b(0[1-9]|[12]\d|3[01])-(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-(19|20)\d{2}\b",
        )
        .unwrap();
        if let Some(m) = re.find(&remaining) {
            let s = m.as_str();
            let parts: Vec<&str> = s.split('-').collect();
            if let (Ok(d), Some(mo), Ok(y)) = (
                parts[0].parse::<u32>(),
                parse_month(parts[1]),
                parts[2].parse::<i32>(),
            ) {
                if let Some(date) = NaiveDate::from_ymd_opt(y, mo, d) {
                    document_date = Some(date);
                    remaining = remaining.replacen(s, " ", 1);
                }
            }
        }
    }

    // Pattern: DDMonYYYY  e.g. 01Dec2024
    if document_date.is_none() {
        let re = regex::Regex::new(
            r"(?i)\b(0[1-9]|[12]\d|3[01])(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)(19|20)\d{2}\b",
        )
        .unwrap();
        if let Some(m) = re.find(&remaining) {
            let s = m.as_str();
            let day_str = &s[0..2];
            let year_str = &s[s.len() - 4..];
            let mon_str = &s[2..s.len() - 4];
            if let (Ok(d), Some(mo), Ok(y)) = (
                day_str.parse::<u32>(),
                parse_month(mon_str),
                year_str.parse::<i32>(),
            ) {
                if let Some(date) = NaiveDate::from_ymd_opt(y, mo, d) {
                    document_date = Some(date);
                    remaining = remaining.replacen(s, " ", 1);
                }
            }
        }
    }

    // Pattern: 4-digit year alone → tag year:YYYY, no full date
    if document_date.is_none() {
        let re = regex::Regex::new(r"\b(19|20)\d{2}\b").unwrap();
        if let Some(m) = re.find(&remaining) {
            let s = m.as_str();
            if let Ok(y) = s.parse::<i32>() {
                if (1900..=2100).contains(&y) {
                    extra_tags.push(format!("year:{s}"));
                    remaining = remaining.replacen(s, " ", 1);
                }
            }
        }
    }

    // Remaining tokens → candidate tags
    let mut tags: Vec<String> = remaining
        .split(|c: char| c == '_' || c == '-' || c.is_whitespace())
        .map(|t| t.trim().to_lowercase())
        .filter(|t| {
            !t.is_empty()
                && t.len() > 1
                && !STOPWORDS.contains(&t.as_str())
                && t.chars().any(|c| c.is_alphabetic())
        })
        .collect();

    tags.extend(extra_tags);
    tags.dedup();

    ParsedFilename {
        document_date,
        tags,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn date(y: i32, m: u32, d: u32) -> NaiveDate {
        NaiveDate::from_ymd_opt(y, m, d).unwrap()
    }

    // ── Date pattern tests ───────────────────────────────────────────────────

    #[test]
    fn parses_ddmmmyyyy() {
        let r = parse_filename("BloodTest_01Dec2024_NHS");
        assert_eq!(r.document_date, Some(date(2024, 12, 1)));
    }

    #[test]
    fn parses_dd_mon_yyyy() {
        let r = parse_filename("Report_01-Dec-2024_GP");
        assert_eq!(r.document_date, Some(date(2024, 12, 1)));
    }

    #[test]
    fn parses_yyyymmdd() {
        let r = parse_filename("Scan_20241201_MRI");
        assert_eq!(r.document_date, Some(date(2024, 12, 1)));
    }

    #[test]
    fn parses_yyyy_mm_dd() {
        let r = parse_filename("Invoice_2024-12-01_Hospital");
        assert_eq!(r.document_date, Some(date(2024, 12, 1)));
    }

    #[test]
    fn year_only_produces_tag_no_date() {
        let r = parse_filename("AnnualReport_2024_NHS");
        assert_eq!(r.document_date, None);
        assert!(
            r.tags.contains(&"year:2024".to_string()),
            "tags: {:?}",
            r.tags
        );
    }

    // ── Tag extraction tests ─────────────────────────────────────────────────

    #[test]
    fn extracts_nhs_tag_from_blood_test() {
        let r = parse_filename("BloodTest_01Dec2024_NHS");
        assert!(r.tags.contains(&"nhs".to_string()), "tags: {:?}", r.tags);
    }

    #[test]
    fn stopwords_excluded_from_tags() {
        let r = parse_filename("The_Report_of_2024");
        assert!(!r.tags.contains(&"the".to_string()));
        assert!(!r.tags.contains(&"of".to_string()));
    }

    #[test]
    fn single_char_tokens_excluded() {
        let r = parse_filename("A_B_Report_2024-12-01");
        assert!(!r.tags.iter().any(|t| t.len() == 1));
    }

    #[test]
    fn tags_are_lowercase() {
        let r = parse_filename("BloodTest_01Dec2024_NHS");
        for tag in &r.tags {
            assert_eq!(*tag, tag.to_lowercase(), "tag not lowercase: {tag}");
        }
    }

    #[test]
    fn no_date_all_tokens_become_tags() {
        let r = parse_filename("cardiology_referral_letter");
        assert_eq!(r.document_date, None);
        assert!(r.tags.contains(&"cardiology".to_string()));
        assert!(r.tags.contains(&"referral".to_string()));
        assert!(r.tags.contains(&"letter".to_string()));
    }

    #[test]
    fn month_case_insensitive_ddmmmyyyy() {
        let r = parse_filename("Report_01DEC2024");
        assert_eq!(r.document_date, Some(date(2024, 12, 1)));
    }

    #[test]
    fn month_case_insensitive_dd_mon_yyyy() {
        let r = parse_filename("Report_01-dec-2024");
        assert_eq!(r.document_date, Some(date(2024, 12, 1)));
    }
}

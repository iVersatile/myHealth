use regex::Regex;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ExtractedAddress {
    pub label: Option<String>,
    pub line1: String,
}

/// Extract a UK company registration number from OCR text.
/// Matches patterns like "Company Registration No: 6780032" or "Company Registration Number 01234567".
pub fn extract_company_registration_number(text: &str) -> Option<String> {
    let re = Regex::new(r"(?i)Company\s+Registration\s+(?:No\.?|Number)[.:\s]*(\d{6,8})")
        .expect("valid regex");
    re.captures(text)
        .and_then(|c| c.get(1))
        .map(|m| m.as_str().to_string())
}

/// Extract a clinic/company name by matching a company-suffix pattern anywhere in the document.
///
/// Handles two layouts:
///   • Header layout: "The Evewell Ltd\nINVOICE\n..." — name at start of line
///   • Bank-transfer layout: "Account Name: The Evewell (Harley Street) Ltd" — name after label
///
/// Parentheses in names (e.g. "(Harley Street)") are supported.
/// Also matches NHS/hospital institutional suffixes: Hospital, NHS Trust, NHS Foundation Trust,
/// Health Centre, Medical Centre, Infirmary.
pub fn extract_clinic_name_by_company_suffix(text: &str) -> Option<String> {
    let re = Regex::new(
        r"(?m)^(?:Account\s+Name:\s+)?([A-Z][A-Za-z0-9'&()\- \t]{2,60}?\s+(?:Ltd\.?|Limited|plc|PLC|LLP|LLC|NHS\s+(?:Foundation\s+)?Trust|Hospital|Health\s+Centre|Medical\s+Centre|Infirmary))\b",
    )
    .expect("valid regex");
    re.captures(text)
        .and_then(|c| c.get(1))
        .map(|m| m.as_str().trim().to_string())
}

/// Extract a clinic name from the header zone (first 15 lines) of OCR text.
///
/// Targets bare institutional abbreviations and short names that have no company-law suffix
/// (Ltd/plc) and no clinic-type keyword (Hospital/Clinic/Centre). Examples: "RB&HH", "UCLH".
///
/// A line qualifies when ALL of these hold:
///   - 1–6 whitespace-separated tokens
///   - No digit characters
///   - Either entirely ALL-CAPS (≥4 avg chars/token, to skip generic words like "DATE")
///     OR Title-Case and contains `&`
///
/// Common single-token all-caps document field labels that are never clinic names.
static GENERIC_HEADER_LABELS: &[&str] = &[
    "TO",
    "FROM",
    "DATE",
    "INVOICE",
    "REF",
    "TOTAL",
    "NAME",
    "ADDRESS",
    "SUBJECT",
    "RE",
    "DEAR",
    "PATIENT",
    "DOCTOR",
    "PAGE",
    "BILL",
    "TIME",
    "ITEM",
    "COST",
    "PAID",
    "DUE",
    "NOTE",
    "ATTN",
    "CC",
    "FAX",
    "TEL",
    "EMAIL",
    "PHONE",
    "VAT",
    "TAX",
    "RECEIPT",
    "STATEMENT",
    "SUMMARY",
    "DETAILS",
    "DESCRIPTION",
];

pub fn extract_clinic_name_header_zone(text: &str) -> Option<String> {
    for line in text.lines().take(15) {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        let words: Vec<&str> = trimmed.split_whitespace().collect();
        if words.is_empty() || words.len() > 6 {
            continue;
        }
        if trimmed.chars().any(|c| c.is_ascii_digit()) {
            continue;
        }
        if GENERIC_HEADER_LABELS.contains(&trimmed) {
            continue;
        }
        let has_ampersand = trimmed.contains('&');
        let is_all_caps =
            trimmed == trimmed.to_uppercase() && trimmed.chars().any(|c| c.is_alphabetic());

        if is_all_caps {
            // Skip very short tokens (single letters, "IT", "OF", etc.)
            let avg_len: usize = words.iter().map(|w| w.len()).sum::<usize>() / words.len();
            if avg_len < 3 {
                continue;
            }
            return Some(trimmed.to_string());
        }

        if has_ampersand && words.len() <= 6 {
            return Some(trimmed.to_string());
        }

        // Title-Case line ending in a recognised clinic-type keyword.
        // Catches "The London Clinic", "Harley Street Surgery", etc.
        const CLINIC_KEYWORDS: &[&str] = &[
            "Clinic",
            "Surgery",
            "Hospital",
            "Practice",
            "Centre",
            "Center",
            "Infirmary",
            "Dispensary",
        ];
        let is_title_case = words
            .iter()
            .all(|w| w.chars().next().map(|c| c.is_uppercase()).unwrap_or(true));
        if is_title_case {
            if let Some(&last) = words.last() {
                if CLINIC_KEYWORDS.contains(&last) {
                    return Some(trimmed.to_string());
                }
            }
        }
    }
    None
}

fn is_label(s: &str) -> bool {
    let words: Vec<&str> = s.split_whitespace().collect();
    !s.is_empty()
        && words.len() <= 4
        && s == s.to_uppercase()
        && s.chars().any(|c| c.is_alphabetic())
}

fn collect_block(lines: &[&str], anchor: usize) -> (Option<String>, String, usize) {
    let start = anchor.saturating_sub(5);
    let block_start = (start..=anchor)
        .find(|&j| !lines[j].trim().is_empty())
        .unwrap_or(anchor);
    let end = (anchor + 1).min(lines.len());

    let first_line = lines[block_start].trim();
    let (label, content_start) = if is_label(first_line) && block_start + 1 < end {
        (Some(first_line.to_string()), block_start + 1)
    } else if block_start > 0 {
        let prev = lines[block_start - 1].trim();
        if is_label(prev) {
            (Some(prev.to_string()), block_start)
        } else {
            (None, block_start)
        }
    } else {
        (None, block_start)
    };

    let candidate = lines[content_start..end]
        .iter()
        .map(|l| l.trim())
        .filter(|l| !l.is_empty())
        .collect::<Vec<_>>()
        .join(", ");

    (label, candidate, end)
}

/// Extract a UK/international phone number from OCR text.
/// Matches patterns like "Tel: 020 7123 4567" or "T 020 7123 4567".
pub fn extract_clinic_phone(text: &str) -> Option<String> {
    let re = Regex::new(r"(?i)(?:Tel(?:ephone)?[:\s]+|T\s+)(\+?[\d\s\(\)\-]{7,20}\d)")
        .expect("valid regex");
    re.captures(text)
        .and_then(|c| c.get(1))
        .map(|m| m.as_str().trim().to_string())
}

/// Extract an email address from OCR text.
/// Matches patterns like "Email: info@clinic.com" or bare "info@clinic.com".
pub fn extract_clinic_email(text: &str) -> Option<String> {
    let re =
        Regex::new(r"(?i)(?:E(?:mail)?[:\s]+)?([A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,})")
            .expect("valid regex");
    re.captures(text)
        .and_then(|c| c.get(1))
        .map(|m| m.as_str().trim().to_string())
}

/// Extract up to 5 postal addresses from OCR text.
///
/// Primary strategy: anchor on lines that contain a full UK postcode.
/// Fallback (when zero addresses found via postcode): anchor on lines that contain
/// a street-type keyword (e.g. "Street", "Road") or a partial London postcode
/// prefix (e.g. W1, EC1, SW1), to handle OCR output where the full postcode is
/// absent or malformed.
pub fn extract_clinic_addresses(text: &str) -> Vec<ExtractedAddress> {
    let postcode_re = Regex::new(r"[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}").expect("valid regex");

    let lines: Vec<&str> = text.lines().collect();
    let mut addresses = Vec::new();

    let mut i = 0;
    while i < lines.len() && addresses.len() < 5 {
        if postcode_re.is_match(lines[i]) {
            let (label, candidate, end) = collect_block(&lines, i);
            if !candidate.is_empty() {
                addresses.push(ExtractedAddress {
                    label,
                    line1: candidate,
                });
            }
            i = end;
        } else {
            i += 1;
        }
    }

    if addresses.is_empty() {
        addresses = extract_addresses_by_street_keyword(text, &lines);
    }

    addresses
}

/// Fallback address extraction anchored on street-type keywords or partial London
/// postcode prefixes. Used when the primary postcode-based scan finds nothing.
fn extract_addresses_by_street_keyword(text: &str, lines: &[&str]) -> Vec<ExtractedAddress> {
    let _ = text;
    let street_re = Regex::new(
        r"(?i)\b(?:Street|Road|Avenue|Lane|Gardens?|Close|Drive|Crescent|Place|Square|Way|Court|Terrace|Hill|Gate|Walk|Row|Mews)\b",
    )
    .expect("valid regex");
    // Partial London/UK postcode area codes without the full inward code
    let partial_re =
        Regex::new(r"\b(?:W1|EC[1-4]|SW\d|SE\d|E\d|N\d|NW\d|WC[12])[A-Z]?\b").expect("valid regex");

    let mut addresses: Vec<ExtractedAddress> = Vec::new();
    let mut i = 0;

    while i < lines.len() && addresses.len() < 5 {
        let line = lines[i];
        if street_re.is_match(line) || partial_re.is_match(line) {
            let (label, candidate, end) = collect_block(lines, i);
            if !candidate.is_empty() {
                addresses.push(ExtractedAddress {
                    label,
                    line1: candidate,
                });
            }
            i = end;
        } else {
            i += 1;
        }
    }

    addresses
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extracts_ltd_company_name_from_header() {
        let text = "The Evewell Ltd\nINVOICE\n\nCOVID-19 PCR Test  £120.00\n";
        assert_eq!(
            extract_clinic_name_by_company_suffix(text).as_deref(),
            Some("The Evewell Ltd")
        );
    }

    #[test]
    fn extracts_limited_company_name() {
        let text = "Harley Street Diagnostics Limited\nInvoice #1234\n";
        assert_eq!(
            extract_clinic_name_by_company_suffix(text).as_deref(),
            Some("Harley Street Diagnostics Limited")
        );
    }

    #[test]
    fn returns_none_when_no_company_suffix() {
        let text = "Dr. Jane Smith\nAssessment:\nPatient presents with hypertension.\n";
        assert!(extract_clinic_name_by_company_suffix(text).is_none());
    }

    #[test]
    fn finds_company_name_beyond_500_chars() {
        let padding = "x".repeat(600);
        let text = format!("{padding}\nHidden Clinic Ltd\nrest of document");
        assert_eq!(
            extract_clinic_name_by_company_suffix(&text).as_deref(),
            Some("Hidden Clinic Ltd")
        );
    }

    #[test]
    fn extracts_name_from_account_name_label() {
        let text = "Account Name: The Evewell (Harley Street) Ltd\nSort Code: 60-07-38\n";
        assert_eq!(
            extract_clinic_name_by_company_suffix(text).as_deref(),
            Some("The Evewell (Harley Street) Ltd")
        );
    }

    #[test]
    fn extracts_company_registration_number() {
        let text = "City Medical Centre\nCompany Registration No: 6780032\nTel: 020 1234 5678";
        assert_eq!(
            extract_company_registration_number(text).as_deref(),
            Some("6780032")
        );
    }

    #[test]
    fn extracts_company_registration_number_variant() {
        let text = "Company Registration Number 01234567";
        assert_eq!(
            extract_company_registration_number(text).as_deref(),
            Some("01234567")
        );
    }

    #[test]
    fn returns_none_when_no_company_registration_number() {
        let text = "Dr. Smith, GP Surgery, Tel: 01632 960000";
        assert!(extract_company_registration_number(text).is_none());
    }

    #[test]
    fn extracts_three_postal_addresses() {
        let text = "\
Main Reception
1 Hospital Road
London
SW1A 1AA

Outpatient Department
45 Clinic Lane
Manchester
M1 1AE

Pharmacy
7 Health Street
Birmingham
B1 1BB
";
        let addresses = extract_clinic_addresses(text);
        assert_eq!(
            addresses.len(),
            3,
            "expected 3 addresses, got: {:?}",
            addresses
        );
    }

    #[test]
    fn returns_empty_when_no_postcode_and_no_street_keyword() {
        let text = "No address here at all";
        assert!(extract_clinic_addresses(text).is_empty());
    }

    #[test]
    fn fallback_extracts_address_with_street_keyword_and_no_postcode() {
        let text = "\
25 Wimpole Street
London
";
        let addresses = extract_clinic_addresses(text);
        assert!(
            !addresses.is_empty(),
            "expected ≥1 address from street-keyword fallback; got none"
        );
        assert!(
            addresses[0].line1.contains("Wimpole Street"),
            "expected 'Wimpole Street' in address; got: {:?}",
            addresses[0].line1
        );
    }

    #[test]
    fn fallback_extracts_multiple_addresses_by_street_keyword() {
        let text = "\
25 Wimpole Street
London

10 Harley Road
London
";
        let addresses = extract_clinic_addresses(text);
        assert!(
            addresses.len() >= 2,
            "expected ≥2 addresses; got: {:?}",
            addresses
        );
    }

    #[test]
    fn postcode_path_takes_priority_over_fallback() {
        // When a full postcode is present the primary path should run, not the fallback
        let text = "\
25 Wimpole Street
London
W1G 8GT
";
        let addresses = extract_clinic_addresses(text);
        assert_eq!(
            addresses.len(),
            1,
            "expected exactly 1 address via postcode path; got: {:?}",
            addresses
        );
        assert!(
            addresses[0].line1.contains("Wimpole Street"),
            "expected 'Wimpole Street' in address; got: {:?}",
            addresses[0].line1
        );
    }

    #[test]
    fn extracts_label_from_all_caps_line_before_block() {
        let text = "\
MAIN RECEPTION
1 Hospital Road
London
SW1A 1AA
";
        let addresses = extract_clinic_addresses(text);
        assert_eq!(addresses.len(), 1);
        assert_eq!(addresses[0].label.as_deref(), Some("MAIN RECEPTION"));
        assert!(addresses[0].line1.contains("1 Hospital Road"));
    }

    #[test]
    fn does_not_use_label_when_line_is_mixed_case() {
        let text = "\
Main Reception
1 Hospital Road
London
SW1A 1AA
";
        let addresses = extract_clinic_addresses(text);
        assert_eq!(addresses.len(), 1);
        assert!(addresses[0].label.is_none());
    }

    #[test]
    fn extracts_phone_with_tel_label() {
        let text = "City Medical\nTel: 020 7123 4567\nLondon";
        assert_eq!(extract_clinic_phone(text).as_deref(), Some("020 7123 4567"));
    }

    #[test]
    fn extracts_phone_with_t_prefix() {
        let text = "T 020 7123 4567";
        assert_eq!(extract_clinic_phone(text).as_deref(), Some("020 7123 4567"));
    }

    #[test]
    fn returns_none_when_no_phone() {
        let text = "City Medical\n1 Hospital Road\nLondon SW1A 1AA";
        assert!(extract_clinic_phone(text).is_none());
    }

    #[test]
    fn extracts_email_with_label() {
        let text = "City Medical\nEmail: info@citymedical.co.uk\nLondon";
        assert_eq!(
            extract_clinic_email(text).as_deref(),
            Some("info@citymedical.co.uk")
        );
    }

    #[test]
    fn extracts_bare_email_without_label() {
        let text = "Contact us at billing@clinic.com for invoices";
        assert_eq!(
            extract_clinic_email(text).as_deref(),
            Some("billing@clinic.com")
        );
    }

    #[test]
    fn returns_none_when_no_email() {
        let text = "City Medical\n1 Hospital Road\nLondon SW1A 1AA";
        assert!(extract_clinic_email(text).is_none());
    }

    #[test]
    fn does_not_use_label_when_line_exceeds_four_words() {
        let text = "\
THIS IS A VERY LONG LABEL HERE
1 Hospital Road
London
SW1A 1AA
";
        let addresses = extract_clinic_addresses(text);
        assert_eq!(addresses.len(), 1);
        assert!(addresses[0].label.is_none());
    }

    #[test]
    fn extracts_abbreviation_from_header() {
        let text = "RB&HH\nINVOICE\nDate: 30 Jan 2023\nPatient: John Smith\n";
        assert_eq!(
            extract_clinic_name_header_zone(text).as_deref(),
            Some("RB&HH")
        );
    }

    #[test]
    fn extracts_all_caps_abbreviation_from_header() {
        let text = "UCLH\nDepartment of Medicine\nInvoice No: 12345\n";
        assert_eq!(
            extract_clinic_name_header_zone(text).as_deref(),
            Some("UCLH")
        );
    }

    #[test]
    fn returns_none_when_header_has_no_clinic_name() {
        let text = "The patient presents with chest pain.\nHistory of hypertension.\nNo previous surgery.\n";
        assert!(extract_clinic_name_header_zone(text).is_none());
    }

    #[test]
    fn ignores_lines_with_digits_in_header() {
        let text = "123 Main Street\nLondon\nRB&HH\n";
        assert_eq!(
            extract_clinic_name_header_zone(text).as_deref(),
            Some("RB&HH")
        );
    }

    #[test]
    fn ignores_generic_short_all_caps_words() {
        let text = "TO\nFROM\nDATE\nRB&HH\nINVOICE\n";
        assert_eq!(
            extract_clinic_name_header_zone(text).as_deref(),
            Some("RB&HH")
        );
    }

    #[test]
    fn extracts_nhs_foundation_trust_name() {
        let text = "Royal Brompton & Harefield NHS Foundation Trust\nRef: 9876\n";
        assert_eq!(
            extract_clinic_name_by_company_suffix(text).as_deref(),
            Some("Royal Brompton & Harefield NHS Foundation Trust")
        );
    }

    #[test]
    fn extracts_hospital_suffix_name() {
        let text = "St Mary's Hospital\nLondon\nInvoice #555\n";
        assert_eq!(
            extract_clinic_name_by_company_suffix(text).as_deref(),
            Some("St Mary's Hospital")
        );
    }
}

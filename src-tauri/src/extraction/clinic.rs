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

/// Extract up to 5 postal addresses from OCR text.
/// An address is a contiguous block of lines that contains a UK postcode.
/// If the line immediately before the block is all-caps, ≤ 4 words, and contains
/// at least one alphabetic character, it is treated as a label for that address.
pub fn extract_clinic_addresses(text: &str) -> Vec<ExtractedAddress> {
    let postcode_re = Regex::new(r"[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}").expect("valid regex");

    let lines: Vec<&str> = text.lines().collect();
    let mut addresses = Vec::new();

    let mut i = 0;
    while i < lines.len() && addresses.len() < 5 {
        if postcode_re.is_match(lines[i]) {
            // Walk back up to 5 lines to find the address start
            let start = i.saturating_sub(5);
            let block_start = (start..=i)
                .find(|&j| !lines[j].trim().is_empty())
                .unwrap_or(i);
            let end = (i + 1).min(lines.len());

            // Detect label: all-caps, ≤ 4 words, contains at least one letter.
            // Check the first line of the block first; if it matches, skip it
            // from the address content. Otherwise check the line before the block.
            let is_label = |s: &str| -> bool {
                let words: Vec<&str> = s.split_whitespace().collect();
                !s.is_empty()
                    && words.len() <= 4
                    && s == s.to_uppercase()
                    && s.chars().any(|c| c.is_alphabetic())
            };

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
    fn returns_empty_when_no_postcode() {
        let text = "No address here at all";
        assert!(extract_clinic_addresses(text).is_empty());
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
}

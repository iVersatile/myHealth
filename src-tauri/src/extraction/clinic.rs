use regex::Regex;

/// Extract a UK company registration number from OCR text.
/// Matches patterns like "Company Registration No: 6780032" or "Company Registration Number 01234567".
#[allow(dead_code)]
pub fn extract_company_registration_number(text: &str) -> Option<String> {
    let re = Regex::new(r"(?i)Company\s+Registration\s+(?:No\.?|Number)[.:\s]*(\d{6,8})")
        .expect("valid regex");
    re.captures(text)
        .and_then(|c| c.get(1))
        .map(|m| m.as_str().to_string())
}

/// Extract up to 5 postal addresses from OCR text.
/// An address is a contiguous block of lines that contains a UK postcode.
#[allow(dead_code)]
pub fn extract_clinic_addresses(text: &str) -> Vec<String> {
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
            let candidate = lines[block_start..end]
                .iter()
                .map(|l| l.trim())
                .filter(|l| !l.is_empty())
                .collect::<Vec<_>>()
                .join(", ");
            if !candidate.is_empty() {
                addresses.push(candidate);
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
}

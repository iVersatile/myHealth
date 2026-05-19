use regex::Regex;
use std::sync::OnceLock;

#[derive(Debug, Clone)]
pub struct ContactSuggestion {
    pub name: String,
    pub title: Option<String>,
    pub specialty: Option<String>,
    pub clinic: Option<String>,
    pub address: Option<String>,
    pub phone: Option<String>,
    pub email: Option<String>,
}

static DR_PATTERN: OnceLock<Regex> = OnceLock::new();
static ALLCAPS_NAME_PATTERN: OnceLock<Regex> = OnceLock::new();
static GP_LABEL_PATTERN: OnceLock<Regex> = OnceLock::new();
static PHONE_PATTERN: OnceLock<Regex> = OnceLock::new();
static INTL_PHONE_PATTERN: OnceLock<Regex> = OnceLock::new();
static EMAIL_PATTERN: OnceLock<Regex> = OnceLock::new();
static CLINIC_PATTERN: OnceLock<Regex> = OnceLock::new();
static POSTCODE_PATTERN: OnceLock<Regex> = OnceLock::new();
static TITLE_PATTERN: OnceLock<Regex> = OnceLock::new();

fn dr_re() -> &'static Regex {
    DR_PATTERN.get_or_init(|| {
        // Matches Dr/Prof/Mr/Mrs/Ms/Miss/Sir followed by first name, optional middle
        // initials, and last name; full match preserved as contact name
        Regex::new(
            r"\b(?:Dr\.?|Prof\.?|Mr\.?|Mrs\.?|Ms\.?|Miss|Sir)\s+[A-Z][a-z]+(?:\s+[A-Z]\.)*(?:\s+[A-Z][a-z]+)+",
        )
        .expect("doctor regex valid")
    })
}

fn allcaps_name_re() -> &'static Regex {
    ALLCAPS_NAME_PATTERN.get_or_init(|| {
        // Matches names like "Mary Margaret MURPHY" — 2+ Title-case words followed by
        // one or more ALLCAPS surname tokens (≥2 chars). Requiring 2+ leading Title-case
        // words avoids false positives on standalone acronyms or single-word headers.
        Regex::new(r"\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\s+[A-Z]{2,}(?:\s+[A-Z]{2,})*)\b")
            .expect("allcaps name regex valid")
    })
}

fn gp_label_re() -> &'static Regex {
    GP_LABEL_PATTERN.get_or_init(|| {
        // Matches "GP: Vaibhav SHARMA", "GP: Dr Jane Lee", "Consultant: Mr Ahmed Al-Rashid".
        // Optional title prefix is consumed but NOT captured; capture group 1 = name only.
        // Uses [ \t]+ (not \s+) to stop at line boundaries and avoid absorbing clinic names.
        Regex::new(
            r"\b(?:GP|Consultant|Registrar|Physiotherapist?|Nurse|Specialist|Surgeon|Provider|Doctor|Clinician|Practitioner|Physician|Therapist):?[ \t]+(?:(?:Dr\.?|Prof\.?|Mr\.?|Mrs\.?|Ms\.?|Miss|Sir)[ \t]+)?([A-Z][a-zA-Z\-']+(?:[ \t]+[A-Z][a-zA-Z\-']+)*)",
        )
        .expect("gp label regex valid")
    })
}

fn phone_re() -> &'static Regex {
    PHONE_PATTERN.get_or_init(|| {
        // Covers common UK formats including parenthesised area codes, freephone,
        // non-geographic (03xx), mobiles and +44 international prefixes.
        // London +44 branch handles both "20 XXXX XXXX" and "203 XXX XXXX" styles.
        Regex::new(
            r"(?:\+44[\s\-]?(?:\(0\)[\s\-]?)?(?:20[\s\-]?(?:\d{4}[\s\-]?\d{4}|\d[\s\-]?\d{3}[\s\-]?\d{4})|\d{2,4}[\s\-]?\d{3,8})|\(?02\d\)?[\s\-]?\d{4}[\s\-]?\d{4}|\(?01[1-9]\d\)?[\s\-]?\d{3}[\s\-]?\d{4}|\(?01\d{3}\)?[\s\-]?\d{6}|07\d{3}[\s\-]?\d{6}|0(?:800|808|300|330|345|370|845|870)[\s\-]?\d{3}[\s\-]?\d{3,4})",
        )
        .expect("phone regex valid")
    })
}

fn intl_phone_re() -> &'static Regex {
    INTL_PHONE_PATTERN.get_or_init(|| {
        // Matches E.164-style international numbers (non-UK): +CC (NNN) NNN-NNNN etc.
        Regex::new(r"\+[1-9]\d{0,2}(?:\s?\(?\d{1,5}\)?[\s\-]?){2,5}")
            .expect("intl phone regex valid")
    })
}

fn email_re() -> &'static Regex {
    EMAIL_PATTERN.get_or_init(|| {
        Regex::new(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}").expect("email regex valid")
    })
}

fn clinic_re() -> &'static Regex {
    CLINIC_PATTERN.get_or_init(|| {
        Regex::new(
            r"(?:The[ \t]+)?([A-Z][A-Za-z0-9'\-]+(?:(?:[ \t]+&[ \t]+|[ \t]+)[A-Z][A-Za-z0-9'\-]+)*)[ \t]+(?i:Medical(?:[ \t]+Centre|[ \t]+Group)?|Clinic|Hospital|Practice|Surgery|Health(?:[ \t]+Centre)?|Physiotherapy|Dental(?:[ \t]+Practice)?|Osteopath(?:ic)?|Chiropractic|Therapy|Wellness|Ltd\.?|Limited|PLC|LLP|LLC)",
        )
        .expect("clinic regex valid")
    })
}

fn postcode_re() -> &'static Regex {
    POSTCODE_PATTERN.get_or_init(|| {
        Regex::new(r"\b[A-Z]{1,2}\d{1,2}[A-Z]?\s*\d[A-Z]{2}\b").expect("postcode regex valid")
    })
}

fn title_re() -> &'static Regex {
    TITLE_PATTERN.get_or_init(|| {
        Regex::new(r"^(Dr\.?|Prof\.?|Mr\.?|Mrs\.?|Ms\.?|Miss|Sir)(?:\s|$)")
            .expect("title regex valid")
    })
}

/// Converts tokens that are entirely ASCII uppercase (≥ 2 chars) to title-case.
/// All other tokens (mixed-case, hyphenated, abbreviated, etc.) are returned unchanged.
fn normalize_name(name: &str) -> String {
    name.split_whitespace()
        .map(|token| {
            if token.len() >= 2 && token.bytes().all(|b| b.is_ascii_uppercase()) {
                let mut chars = token.chars();
                match chars.next() {
                    Some(first) => {
                        first.to_uppercase().to_string() + &chars.as_str().to_lowercase()
                    }
                    None => String::new(),
                }
            } else {
                token.to_string()
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}

fn extract_title_from_name(name: &str) -> Option<String> {
    title_re()
        .captures(name)
        .and_then(|c| c.get(1))
        .map(|m| m.as_str().to_string())
}

fn first_email(text: &str) -> Option<String> {
    email_re().find(text).map(|m| m.as_str().to_string())
}

fn first_phone(text: &str) -> Option<String> {
    phone_re()
        .find(text)
        .map(|m| m.as_str().trim().to_string())
        .or_else(|| {
            intl_phone_re()
                .find(text)
                .map(|m| m.as_str().trim().to_string())
        })
}

pub fn first_clinic(text: &str) -> Option<String> {
    // Line-starter words that signal the clinic name appears in a boilerplate phrase
    // ("For professional services at X") rather than as a standalone header/label.
    const BOILERPLATE_LINE_STARTERS: &[&str] = &[
        "For",
        "In",
        "At",
        "From",
        "To",
        "Of",
        "On",
        "By",
        "Re",
        "As",
        "Per",
        "With",
        "Without",
        "Regarding",
    ];

    // Returns true when the regex match (given its absolute byte offset in `text`)
    // is embedded in a boilerplate sentence rather than on a dedicated header line.
    let is_boilerplate = |abs_start: usize| -> bool {
        let line_start = text[..abs_start].rfind('\n').map(|i| i + 1).unwrap_or(0);
        let first_word = text[line_start..].split_whitespace().next().unwrap_or("");
        BOILERPLATE_LINE_STARTERS.contains(&first_word)
    };

    let raw = text.len() * 7 / 10;
    let tail_start = (raw..=text.len())
        .find(|&i| text.is_char_boundary(i))
        .unwrap_or(text.len());

    for m in clinic_re().find_iter(&text[tail_start..]) {
        if !is_boilerplate(tail_start + m.start()) {
            return Some(m.as_str().trim().to_string());
        }
    }
    for m in clinic_re().find_iter(text) {
        if !is_boilerplate(m.start()) {
            return Some(m.as_str().trim().to_string());
        }
    }
    None
}

/// Extracts an address block anchored by a UK postcode.
///
/// Walks backwards from the postcode collecting up to 4 non-empty lines.
fn extract_address(text: &str) -> Option<String> {
    let pc_match = postcode_re().find(text)?;
    let before = &text[..pc_match.start()];
    let postcode = pc_match.as_str().trim();

    let lines: Vec<&str> = before
        .lines()
        .rev()
        .map(|l| l.trim())
        .filter(|l| !l.is_empty())
        .take(4)
        .collect::<Vec<_>>()
        .into_iter()
        .rev()
        .collect();

    if lines.is_empty() {
        Some(postcode.to_string())
    } else {
        Some(format!("{}, {}", lines.join(", "), postcode))
    }
}

/// Returns the specialty found within 200 chars after the doctor name end position.
fn specialty_near(text: &str, name_end: usize) -> Option<String> {
    let window = &text[name_end..std::cmp::min(name_end + 200, text.len())];
    let lower = window.to_lowercase();

    let specialties: &[(&str, &str)] = &[
        ("gastroenterolog", "Gastroenterology"),
        ("cardiol", "Cardiology"),
        ("neurol", "Neurology"),
        ("dermatol", "Dermatology"),
        ("orthopaed", "Orthopaedics"),
        ("orthoped", "Orthopaedics"),
        ("oncol", "Oncology"),
        ("endocrinol", "Endocrinology"),
        ("respirator", "Respiratory Medicine"),
        ("pulmonol", "Respiratory Medicine"),
        ("rheumatol", "Rheumatology"),
        ("ophthalmol", "Ophthalmology"),
        ("haematol", "Haematology"),
        ("hematol", "Haematology"),
        ("psychiatr", "Psychiatry"),
        ("urol", "Urology"),
        ("gynaecol", "Gynaecology"),
        ("gynecol", "Gynaecology"),
        ("nephrol", "Nephrology"),
    ];

    for (kw, label) in specialties {
        if lower.contains(kw) {
            return Some((*label).to_string());
        }
    }
    None
}

/// Extracts contact suggestions from free text.
///
/// Each detected doctor/titleholder becomes one ContactSuggestion.  Shared
/// fields (clinic, phone, email, address) are attached to the first suggestion
/// only — we cannot reliably assign them per-doctor in multi-doctor documents.
///
/// If no named contact is found but at least one of phone/email is present, a
/// fallback suggestion is returned using the clinic name (if detected) so the
/// extracted contact details are not lost.
pub fn extract_contact_suggestions(text: &str) -> Vec<ContactSuggestion> {
    let mut seen = std::collections::HashSet::new();
    let mut suggestions: Vec<ContactSuggestion> = Vec::new();

    let clinic = first_clinic(text);
    let phone = first_phone(text);
    let email = first_email(text);
    let address = extract_address(text);

    let mut push = |name: String, name_end: usize| {
        if !seen.insert(name.clone()) {
            return;
        }
        let specialty = specialty_near(text, name_end);
        let title = extract_title_from_name(&name);
        let (c, p, e, a) = if suggestions.is_empty() {
            (
                clinic.clone(),
                phone.clone(),
                email.clone(),
                address.clone(),
            )
        } else {
            (None, None, None, None)
        };
        suggestions.push(ContactSuggestion {
            name,
            title,
            specialty,
            clinic: c,
            phone: p,
            email: e,
            address: a,
        });
    };

    // Pass 1: role-labelled names ("GP: Vaibhav SHARMA", "GP: Dr Jane Lee").
    // Collect full-match byte ranges so Pass 2 can skip title matches inside them.
    let mut gp_ranges: Vec<std::ops::Range<usize>> = Vec::new();
    for cap in gp_label_re().captures_iter(text) {
        let full = cap.get(0).unwrap();
        gp_ranges.push(full.start()..full.end());
        let name = normalize_name(cap.get(1).unwrap().as_str().trim());
        let end = cap.get(1).unwrap().end();
        push(name, end);
    }

    // Pass 2: title-prefixed names (Dr., Prof., Mr., etc.), skipping regions
    // already claimed by a role-label match in Pass 1.
    for cap in dr_re().captures_iter(text) {
        let m = cap.get(0).unwrap();
        let overlaps = gp_ranges
            .iter()
            .any(|r| m.start() < r.end && m.end() > r.start);
        if !overlaps {
            push(m.as_str().trim().to_string(), m.end());
        }
    }

    // Pass 3: ALLCAPS-surname names ("Mary Margaret MURPHY", "Dr John SMITH").
    // Already-seen names from passes 1-2 are skipped automatically.
    for cap in allcaps_name_re().captures_iter(text) {
        let name = normalize_name(cap.get(1).unwrap().as_str().trim());
        let end = cap.get(1).unwrap().end();
        push(name, end);
    }

    // If no named contact was found, fall back to a clinic-level suggestion so
    // that extracted phone/email/address are still surfaced to the user.
    if suggestions.is_empty() {
        let has_contact = phone.is_some() || email.is_some();
        if has_contact {
            if let Some(clinic_name) = clinic.clone() {
                suggestions.push(ContactSuggestion {
                    name: clinic_name,
                    title: None,
                    specialty: None,
                    clinic: None,
                    phone,
                    email,
                    address,
                });
            }
        }
    }

    suggestions
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extracts_doctor_with_specialty() {
        let text = "Dr. Michael Chapman, Gastroenterologist, specialises in bowel conditions.";
        let suggestions = extract_contact_suggestions(text);
        assert_eq!(suggestions.len(), 1);
        assert_eq!(suggestions[0].name, "Dr. Michael Chapman");
        assert_eq!(
            suggestions[0].specialty.as_deref(),
            Some("Gastroenterology")
        );
    }

    #[test]
    fn extracts_uk_phone_number() {
        let text = "Contact us on 01494 123456 or visit our website.";
        assert!(first_phone(text).is_some());
    }

    #[test]
    fn extracts_email_address() {
        let text = "Please email appointments@billmedical.co.uk for enquiries.";
        assert_eq!(
            first_email(text),
            Some("appointments@billmedical.co.uk".to_string())
        );
    }

    #[test]
    fn extracts_address_with_postcode() {
        let text =
            "Business Suite 2\nEast House\n33-41 Chiltern Avenue\nAmersham\nBuckinghamshire\nHP6 5AE";
        let addr = extract_address(text);
        assert!(addr.is_some());
        let a = addr.unwrap();
        assert!(a.contains("HP6 5AE"));
    }

    #[test]
    fn returns_empty_when_no_doctor() {
        let text = "Patient report — no doctor mentioned.";
        assert!(extract_contact_suggestions(text).is_empty());
    }

    #[test]
    fn extracts_international_phone_number() {
        let text = "Call us at +1 (555) 123-4567 for appointments.";
        assert_eq!(first_phone(text), Some("+1 (555) 123-4567".to_string()));
    }

    #[test]
    fn uk_pattern_takes_priority_over_international() {
        let text = "UK: 01494 123456  US: +1 (555) 123-4567";
        let phone = first_phone(text);
        assert!(
            phone
                .as_deref()
                .map(|p| p.starts_with('0'))
                .unwrap_or(false),
            "expected UK number first, got: {phone:?}"
        );
    }

    #[test]
    fn intl_phone_attached_to_first_doctor() {
        let text = "Dr. Sarah Green\nPhone: +1 (555) 123-4567";
        let suggestions = extract_contact_suggestions(text);
        assert_eq!(suggestions.len(), 1);
        assert_eq!(suggestions[0].phone.as_deref(), Some("+1 (555) 123-4567"));
    }

    #[test]
    fn shared_details_only_on_first_doctor() {
        let text = "Dr. Alice Brown and Dr. Charles Davis work here.\nTel: 020 1234 5678";
        let suggestions = extract_contact_suggestions(text);
        assert_eq!(suggestions.len(), 2);
        assert!(suggestions[1].phone.is_none());
        assert!(suggestions[1].clinic.is_none());
    }

    #[test]
    fn extracts_uk_mobile_number() {
        let text = "Call us on 07544 370440 to book.";
        assert_eq!(first_phone(text), Some("07544 370440".to_string()));
    }

    #[test]
    fn extracts_uk_landline_number() {
        let text = "Appointments: 01234 567890";
        assert_eq!(first_phone(text), Some("01234 567890".to_string()));
    }

    #[test]
    fn extracts_plus44_london_number() {
        let text = "International line: +44 20 7946 0958";
        assert_eq!(first_phone(text), Some("+44 20 7946 0958".to_string()));
    }

    #[test]
    fn extracts_title_from_dr_name() {
        let text = "Dr. John Smith consulted on the case.";
        let suggestions = extract_contact_suggestions(text);
        assert_eq!(suggestions.len(), 1);
        assert_eq!(suggestions[0].title.as_deref(), Some("Dr."));
    }

    #[test]
    fn extracts_title_from_prof_name() {
        let text = "Prof. Alice Brown led the seminar.";
        let suggestions = extract_contact_suggestions(text);
        assert_eq!(suggestions.len(), 1);
        assert_eq!(suggestions[0].title.as_deref(), Some("Prof."));
    }

    #[test]
    fn extracts_mr_with_middle_initial_as_contact() {
        let text = "with Mr John A. Green BSc,MCSP,HCPC – Chartered Physiotherapist.";
        let suggestions = extract_contact_suggestions(text);
        assert_eq!(suggestions.len(), 1);
        assert_eq!(suggestions[0].name, "Mr John A. Green");
        assert_eq!(suggestions[0].title.as_deref(), Some("Mr"));
    }

    #[test]
    fn extracts_mr_contact_with_phone_and_email() {
        let text =
            "with Mr John A. Green BSc – Chartered Physiotherapist.\nTEL: 07544 370440\nEmail: jg@example.com";
        let suggestions = extract_contact_suggestions(text);
        assert_eq!(suggestions.len(), 1);
        assert_eq!(suggestions[0].phone.as_deref(), Some("07544 370440"));
        assert_eq!(suggestions[0].email.as_deref(), Some("jg@example.com"));
    }

    #[test]
    fn extracts_uk_london_number() {
        let text = "Appointments: 020 7946 0958";
        assert_eq!(first_phone(text), Some("020 7946 0958".to_string()));
    }

    #[test]
    fn extracts_eu_phone_number() {
        let text = "Contact: +33 1 23 45 67 89 for details.";
        let phone = first_phone(text);
        assert!(phone.is_some(), "expected EU phone, got None");
        assert!(phone.unwrap().starts_with("+33"));
    }

    #[test]
    fn returns_none_when_no_phone_in_text() {
        let text = "No contact details available in this document.";
        assert_eq!(first_phone(text), None);
    }

    #[test]
    fn debug_sample_pdf_extraction() {
        let path =
            std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/sample.pdf");
        let text = crate::extraction::pdf::extract_pdf_text(&path).unwrap_or_default();
        println!("PDF TEXT REPR:\n{text:?}");
        let suggestions = extract_contact_suggestions(&text);
        println!("CONTACTS:\n{suggestions:#?}");
    }

    #[test]
    fn debug_physio_pdf_extraction() {
        let path = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("tests/fixtures/no-date-physio.pdf");
        let text = crate::extraction::pdf::extract_pdf_text(&path).unwrap_or_default();
        println!("PHYSIO PDF TEXT REPR:\n{text:?}");
        let suggestions = extract_contact_suggestions(&text);
        println!("PHYSIO CONTACTS:\n{suggestions:#?}");
    }

    #[test]
    fn extracts_clinic_with_ampersand_separator() {
        let text =
            "Mr John A. Smith\nSpringfield Physiotherapy & Sports Medicine Clinic\n123 Main St";
        let suggestions = extract_contact_suggestions(text);
        assert_eq!(suggestions.len(), 1);
        assert_eq!(
            suggestions[0].clinic.as_deref(),
            Some("Springfield Physiotherapy & Sports Medicine Clinic")
        );
    }

    #[test]
    fn clinic_name_does_not_span_newlines_across_header() {
        // "INVOICE" must not be merged with the clinic name on the next line
        let text = "INVOICE\n\nSpringfield Physiotherapy & Sports Medicine Clinic\n14 Elm Street\nMr John A. Smith";
        let suggestions = extract_contact_suggestions(text);
        assert_eq!(suggestions.len(), 1);
        assert_eq!(
            suggestions[0].clinic.as_deref(),
            Some("Springfield Physiotherapy & Sports Medicine Clinic")
        );
    }

    #[test]
    fn detects_clinic_inline_mid_sentence() {
        let text = "Your appointment at City Medical Centre has been confirmed.";
        assert_eq!(first_clinic(text), Some("City Medical Centre".to_string()));
    }

    #[test]
    fn detects_clinic_inline_with_the_prefix() {
        let text = "You were seen at The Riverside Clinic on 1st January.";
        assert_eq!(first_clinic(text), Some("The Riverside Clinic".to_string()));
    }

    #[test]
    fn extracts_allcaps_surname_contact() {
        let text = "Referred by Mary Margaret MURPHY for further assessment.";
        let suggestions = extract_contact_suggestions(text);
        assert_eq!(suggestions.len(), 1);
        assert_eq!(suggestions[0].name, "Mary Margaret Murphy");
    }

    #[test]
    fn extracts_gp_labelled_contact() {
        let text = "GP: Vaibhav SHARMA\nInstitute Of Preventative Medicine\n29 Old Gloucester Street\nLondon WC1N 3AX";
        let suggestions = extract_contact_suggestions(text);
        assert_eq!(suggestions.len(), 1);
        assert_eq!(suggestions[0].name, "Vaibhav Sharma");
    }

    #[test]
    fn extracts_allcaps_surname() {
        // "Dr John SMITH" — no role label; matched by allcaps_name_re and normalized
        let text = "Referred by Dr John SMITH for orthopaedic review.";
        let suggestions = extract_contact_suggestions(text);
        assert_eq!(suggestions.len(), 1);
        assert!(
            suggestions[0].name.contains("Smith"),
            "expected 'Smith' in name, got: {}",
            suggestions[0].name
        );
    }

    #[test]
    fn extracts_role_labelled_name() {
        // Role label without ALLCAPS — "GP: Dr Jane Lee"
        let text = "GP: Dr Jane Lee";
        let suggestions = extract_contact_suggestions(text);
        assert_eq!(
            suggestions.len(),
            1,
            "expected 1 suggestion, got: {suggestions:#?}"
        );
        assert_eq!(suggestions[0].name, "Jane Lee");

        // Role label with ALLCAPS surname — "GP: Dr Jane Lee" variant
        let text2 = "Consultant: Mr Ahmed Al-Rashid";
        let suggestions2 = extract_contact_suggestions(text2);
        assert_eq!(
            suggestions2.len(),
            1,
            "expected 1 suggestion, got: {suggestions2:#?}"
        );
        assert_eq!(suggestions2[0].name, "Ahmed Al-Rashid");
    }

    #[test]
    fn extracts_plus44_london_03_number() {
        let text = "Tel +44 (0) 203 423 7500";
        assert_eq!(first_phone(text), Some("+44 (0) 203 423 7500".to_string()));
    }

    #[test]
    fn extracts_clinic_from_footer_when_also_mentioned_earlier() {
        // "General Hospital" appears once near the start (first ~5%);
        // neutral filler fills the middle; "Cleveland Clinic" only in the last ~5%.
        // tail_start = 70% — the tail contains only filler + footer, so
        // first_clinic should return "Cleveland Clinic" not "General Hospital".
        let header = "Referred from General Hospital for consultation.\n";
        let filler = "The patient attended for routine monitoring of blood pressure.\n".repeat(15);
        let footer = "Cleveland Clinic\n123 Queen's Square\nLondon WC1N 3BG\n";
        let text = format!("{header}{filler}{footer}");
        // Sanity: header ends well within first 70%
        assert!(header.len() < text.len() * 7 / 10);
        assert_eq!(first_clinic(&text), Some("Cleveland Clinic".to_string()));
    }

    #[test]
    fn falls_back_to_full_text_when_no_footer_match() {
        // "Springfield Medical Centre" appears in the first ~4% of text.
        // The remaining 96% is neutral filler with no clinic keywords.
        // tail scan finds nothing → fallback full-text scan returns the clinic.
        let clinic_line = "Springfield Medical Centre\n";
        let filler = "The patient attended for routine monitoring of blood pressure.\n".repeat(15);
        let text = format!("{clinic_line}{filler}");
        // Sanity: clinic is well before tail_start
        assert!(clinic_line.len() < text.len() * 7 / 10);
        assert_eq!(
            first_clinic(&text),
            Some("Springfield Medical Centre".to_string())
        );
    }

    #[test]
    fn first_clinic_skips_boilerplate_hospital_returns_header_clinic() {
        // Regression for v1.9.3: short invoices from "Bill Medical" contained
        // "For Professional Services at Princess Grace Hospital" in the tail.
        // first_clinic() was returning "Princess Grace Hospital" (boilerplate line)
        // instead of "Bill Medical" (header line).
        let text = "\
Bill Medical\n\
12 Harley Street, London W1G 9PQ\n\
Doctor: Michael Chapman\n\
\n\
For Professional Services at Princess Grace Hospital\n\
Amount Due: £250.00\n";
        assert_eq!(
            first_clinic(text),
            Some("Bill Medical".to_string()),
            "should return header clinic, not boilerplate hospital reference"
        );
    }

    #[test]
    fn extracts_contact_from_bill_medical_invoice_with_doctor_label() {
        // Regression for v1.9.3: "Doctor:" label was not in gp_label_re,
        // so "Michael Chapman" was never extracted as a contact suggestion.
        let text = "\
Bill Medical\n\
12 Harley Street, London W1G 9PQ\n\
Tel: 020 7946 0111\n\
Doctor: Michael Chapman\n\
\n\
For Professional Services at Princess Grace Hospital\n\
Amount Due: £250.00\n";
        let suggestions = extract_contact_suggestions(text);
        assert!(
            suggestions
                .iter()
                .any(|s| s.name.contains("Michael") && s.name.contains("Chapman")),
            "expected 'Michael Chapman' in suggestions; got: {:?}",
            suggestions.iter().map(|s| &s.name).collect::<Vec<_>>()
        );
    }
}

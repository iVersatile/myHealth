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

fn phone_re() -> &'static Regex {
    PHONE_PATTERN.get_or_init(|| {
        Regex::new(
            r"(?:\+44[\s\-]?20[\s\-]?\d{4}[\s\-]?\d{4}|\+44[\s\-]?\d{3,4}[\s\-]?\d{6}|07\d{3}[\s\-]?\d{6}|01\d{3}[\s\-]?\d{6}|02\d[\s\-]?\d{4}[\s\-]?\d{4})",
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
            r"(?m)^([A-Z][A-Za-z0-9&'\-]+(?: [A-Z][A-Za-z0-9&'\-]+)*)\s+(?:Medical(?:\s+Centre|\s+Group)?|Clinic|Hospital|Practice|Surgery|Health(?:\s+Centre)?)",
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

fn first_clinic(text: &str) -> Option<String> {
    clinic_re()
        .find(text)
        .map(|m| m.as_str().trim().to_string())
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
/// Each detected doctor becomes one ContactSuggestion.  Shared fields
/// (clinic, phone, email, address) are attached to the first suggestion only —
/// we cannot reliably assign them per-doctor in multi-doctor documents.
pub fn extract_contact_suggestions(text: &str) -> Vec<ContactSuggestion> {
    let re = dr_re();
    let mut seen = std::collections::HashSet::new();
    let mut suggestions: Vec<ContactSuggestion> = Vec::new();

    let clinic = first_clinic(text);
    let phone = first_phone(text);
    let email = first_email(text);
    let address = extract_address(text);

    for cap in re.captures_iter(text) {
        let full_match = cap.get(0).unwrap();
        let name = full_match.as_str().trim().to_string();

        if !seen.insert(name.clone()) {
            continue;
        }

        let specialty = specialty_near(text, full_match.end());
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
}

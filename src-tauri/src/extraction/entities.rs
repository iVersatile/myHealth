use regex::Regex;
use std::sync::OnceLock;
use uuid::Uuid;

#[derive(Debug, Clone, PartialEq)]
pub enum EntityType {
    Medication,
    Diagnosis,
    LabValue,
    Referral,
}

impl EntityType {
    pub fn as_str(&self) -> &'static str {
        match self {
            EntityType::Medication => "medication",
            EntityType::Diagnosis => "diagnosis",
            EntityType::LabValue => "lab_value",
            EntityType::Referral => "referral",
        }
    }
}

#[derive(Debug, Clone)]
pub struct ExtractedEntity {
    pub id: String,
    pub entity_type: EntityType,
    pub name: String,
    pub value: Option<String>,
    pub unit: Option<String>,
    pub raw_text: String,
}

impl ExtractedEntity {
    fn new(
        entity_type: EntityType,
        name: impl Into<String>,
        value: Option<String>,
        unit: Option<String>,
        raw_text: impl Into<String>,
    ) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            entity_type,
            name: name.into(),
            value,
            unit,
            raw_text: raw_text.into(),
        }
    }
}

// ── Medication ───────────────────────────────────────────────────────────────

static MED_RE: OnceLock<Regex> = OnceLock::new();

fn med_re() -> &'static Regex {
    MED_RE.get_or_init(|| {
        // Single-word drug name (≥4 chars) followed by dose + unit. Multi-word capture
        // causes false positives by absorbing preceding context words ("is taking Drug").
        Regex::new(
            r"(?i)\b([A-Za-z][a-z]{3,})\s+(\d+(?:\.\d+)?)\s*(mg|mcg|µg|g|ml|mL|IU|units?|%)\b",
        )
        .unwrap()
    })
}

fn extract_medications(text: &str) -> Vec<ExtractedEntity> {
    med_re()
        .captures_iter(text)
        .map(|cap| {
            let raw = cap[0].to_string();
            let name = cap[1].trim().to_string();
            let value = Some(cap[2].to_string());
            let unit = Some(cap[3].to_string());
            ExtractedEntity::new(EntityType::Medication, name, value, unit, raw)
        })
        .collect()
}

// ── Diagnosis ────────────────────────────────────────────────────────────────

static DX_LABEL_RE: OnceLock<Regex> = OnceLock::new();

fn dx_label_re() -> &'static Regex {
    DX_LABEL_RE.get_or_init(|| {
        Regex::new(r"(?i)(?:Diagnosis|Assessment|Impression|Problem|Condition):\s*([^\n]{3,80})")
            .unwrap()
    })
}

fn extract_diagnoses(text: &str) -> Vec<ExtractedEntity> {
    dx_label_re()
        .captures_iter(text)
        .map(|cap| {
            let raw = cap[0].trim().to_string();
            let name = cap[1].trim().to_string();
            ExtractedEntity::new(EntityType::Diagnosis, name, None, None, raw)
        })
        .collect()
}

// ── Lab Values ───────────────────────────────────────────────────────────────

static LAB_RE: OnceLock<Regex> = OnceLock::new();

fn lab_re() -> &'static Regex {
    LAB_RE.get_or_init(|| {
        Regex::new(
            r"(?i)\b(HbA1c|eGFR|creatinine|cholesterol|LDL|HDL|triglycerides|TSH|T4|T3|haemoglobin|hemoglobin|WBC|platelets|sodium|potassium|glucose|INR|PSA)\s*[:\s]\s*(\d+(?:\.\d+)?)\s*([a-zA-Z/%]+(?:/[a-zA-Z]+)?)",
        )
        .unwrap()
    })
}

static BP_RE: OnceLock<Regex> = OnceLock::new();

fn bp_re() -> &'static Regex {
    BP_RE.get_or_init(|| Regex::new(r"(?i)\bBP\s+(\d{2,3}/\d{2,3})\b").unwrap())
}

fn extract_lab_values(text: &str) -> Vec<ExtractedEntity> {
    let mut results: Vec<ExtractedEntity> = lab_re()
        .captures_iter(text)
        .map(|cap| {
            let raw = cap[0].to_string();
            let name = cap[1].to_string();
            let value = Some(cap[2].to_string());
            let unit = Some(cap[3].to_string());
            ExtractedEntity::new(EntityType::LabValue, name, value, unit, raw)
        })
        .collect();

    for cap in bp_re().captures_iter(text) {
        let raw = cap[0].to_string();
        let value = cap[1].to_string();
        results.push(ExtractedEntity::new(
            EntityType::LabValue,
            "BP",
            Some(value),
            Some("mmHg".to_string()),
            raw,
        ));
    }

    results
}

// ── Referrals ────────────────────────────────────────────────────────────────

static REFERRAL_RE: OnceLock<Regex> = OnceLock::new();

fn referral_re() -> &'static Regex {
    REFERRAL_RE.get_or_init(|| {
        Regex::new(
            r"(?i)(?:referred?\s+to|referral\s+to|please\s+see|refer\s+(?:this\s+patient\s+)?to)\s+([A-Za-z][^\n,]{2,60})",
        )
        .unwrap()
    })
}

fn extract_referrals(text: &str) -> Vec<ExtractedEntity> {
    referral_re()
        .captures_iter(text)
        .map(|cap| {
            let raw = cap[0].trim().to_string();
            let name = cap[1].trim().to_string();
            ExtractedEntity::new(EntityType::Referral, name, None, None, raw)
        })
        .collect()
}

// ── Public entry point ───────────────────────────────────────────────────────

pub fn extract_entities(text: &str) -> Vec<ExtractedEntity> {
    let mut entities = Vec::new();
    entities.extend(extract_medications(text));
    entities.extend(extract_diagnoses(text));
    entities.extend(extract_lab_values(text));
    entities.extend(extract_referrals(text));
    entities
}

// ── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_medication_with_dose() {
        let text = "Patient is taking Lisinopril 10mg once daily.";
        let entities = extract_entities(text);
        let meds: Vec<_> = entities
            .iter()
            .filter(|e| e.entity_type == EntityType::Medication)
            .collect();
        assert!(!meds.is_empty(), "expected at least one medication");
        assert_eq!(meds[0].name.to_lowercase(), "lisinopril");
        assert_eq!(meds[0].value.as_deref(), Some("10"));
        assert_eq!(meds[0].unit.as_deref(), Some("mg"));
    }

    #[test]
    fn detects_medication_multi_word_name() {
        let text = "Prescribed metformin 500 mg twice daily.";
        let entities = extract_entities(text);
        let meds: Vec<_> = entities
            .iter()
            .filter(|e| e.entity_type == EntityType::Medication)
            .collect();
        assert!(!meds.is_empty());
        assert_eq!(meds[0].name.to_lowercase(), "metformin");
        assert_eq!(meds[0].value.as_deref(), Some("500"));
    }

    #[test]
    fn detects_diagnosis_after_label() {
        let text = "Diagnosis: Essential hypertension\nAssessment: Type 2 diabetes mellitus";
        let entities = extract_entities(text);
        let dx: Vec<_> = entities
            .iter()
            .filter(|e| e.entity_type == EntityType::Diagnosis)
            .collect();
        assert_eq!(dx.len(), 2);
        assert!(dx[0].name.to_lowercase().contains("hypertension"));
        assert!(dx[1].name.to_lowercase().contains("diabetes"));
    }

    #[test]
    fn detects_hba1c_lab_value() {
        let text = "HbA1c: 6.2%";
        let entities = extract_entities(text);
        let labs: Vec<_> = entities
            .iter()
            .filter(|e| e.entity_type == EntityType::LabValue)
            .collect();
        assert!(!labs.is_empty());
        let hba1c = labs.iter().find(|e| e.name.to_lowercase() == "hba1c");
        assert!(hba1c.is_some());
        assert_eq!(hba1c.unwrap().value.as_deref(), Some("6.2"));
        assert_eq!(hba1c.unwrap().unit.as_deref(), Some("%"));
    }

    #[test]
    fn detects_egfr_lab_value() {
        let text = "eGFR 72 mL/min";
        let entities = extract_entities(text);
        let labs: Vec<_> = entities
            .iter()
            .filter(|e| e.entity_type == EntityType::LabValue)
            .collect();
        assert!(!labs.is_empty());
        let egfr = labs.iter().find(|e| e.name.to_lowercase() == "egfr");
        assert!(egfr.is_some());
        assert_eq!(egfr.unwrap().value.as_deref(), Some("72"));
    }

    #[test]
    fn detects_blood_pressure() {
        let text = "Vital signs: BP 130/85 mmHg, HR 72.";
        let entities = extract_entities(text);
        let labs: Vec<_> = entities
            .iter()
            .filter(|e| e.entity_type == EntityType::LabValue)
            .collect();
        let bp = labs.iter().find(|e| e.name == "BP");
        assert!(bp.is_some());
        assert_eq!(bp.unwrap().value.as_deref(), Some("130/85"));
    }

    #[test]
    fn detects_referral_referred_to() {
        let text = "Patient referred to cardiology for further evaluation.";
        let entities = extract_entities(text);
        let refs: Vec<_> = entities
            .iter()
            .filter(|e| e.entity_type == EntityType::Referral)
            .collect();
        assert!(!refs.is_empty());
        assert!(refs[0].name.to_lowercase().contains("cardiology"));
    }

    #[test]
    fn detects_referral_please_see() {
        let text = "Please see the respiratory team for assessment.";
        let entities = extract_entities(text);
        let refs: Vec<_> = entities
            .iter()
            .filter(|e| e.entity_type == EntityType::Referral)
            .collect();
        assert!(!refs.is_empty());
        assert!(refs[0].name.to_lowercase().contains("respiratory"));
    }

    #[test]
    fn returns_empty_for_blank_text() {
        let entities = extract_entities("");
        assert!(entities.is_empty());
    }

    #[test]
    fn entity_has_nonempty_id() {
        let text = "Diagnosis: Asthma";
        let entities = extract_entities(text);
        assert!(!entities.is_empty());
        assert!(!entities[0].id.is_empty());
    }

    #[test]
    fn raw_text_preserved() {
        let text = "Impression: Chronic kidney disease stage 3";
        let entities = extract_entities(text);
        let dx: Vec<_> = entities
            .iter()
            .filter(|e| e.entity_type == EntityType::Diagnosis)
            .collect();
        assert!(!dx.is_empty());
        assert!(dx[0].raw_text.to_lowercase().contains("chronic kidney"));
    }
}

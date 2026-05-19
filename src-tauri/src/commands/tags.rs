use crate::commands::{AppState, CommandError};
use tauri::State;

#[derive(Debug, serde::Serialize)]
pub struct Icd10Suggestion {
    pub code: String,
    pub description: String,
    pub confidence: f32,
}

// Top ICD-10-CM codes by clinical frequency (code, description)
static ICD10_CODES: &[(&str, &str)] = &[
    // Chest / Respiratory
    ("R07.9", "Chest pain unspecified"),
    ("R07.0", "Pain in throat"),
    ("R07.1", "Chest pain on breathing"),
    ("R07.2", "Precordial pain"),
    ("R07.89", "Other chest pain"),
    ("J06.9", "Acute upper respiratory infection unspecified"),
    ("J18.9", "Pneumonia unspecified organism"),
    ("J20.9", "Acute bronchitis unspecified"),
    ("J45.909", "Unspecified asthma uncomplicated"),
    (
        "J44.1",
        "Chronic obstructive pulmonary disease with acute exacerbation",
    ),
    ("R05.9", "Cough unspecified"),
    ("R06.00", "Dyspnea unspecified"),
    ("R06.09", "Other forms of dyspnea"),
    // Cardiovascular
    ("I10", "Essential primary hypertension"),
    (
        "I25.10",
        "Atherosclerotic heart disease of native coronary artery without angina pectoris",
    ),
    ("I21.9", "Acute myocardial infarction unspecified"),
    ("I48.91", "Unspecified atrial fibrillation"),
    ("I50.9", "Heart failure unspecified"),
    ("I63.9", "Cerebral infarction unspecified"),
    ("I73.9", "Peripheral vascular disease unspecified"),
    ("R00.0", "Tachycardia unspecified"),
    ("R00.1", "Bradycardia unspecified"),
    ("R00.8", "Other abnormalities of heart beat"),
    // Diabetes / Endocrine
    ("E11.9", "Type 2 diabetes mellitus without complications"),
    ("E11.65", "Type 2 diabetes mellitus with hyperglycemia"),
    (
        "E11.40",
        "Type 2 diabetes mellitus with diabetic neuropathy unspecified",
    ),
    ("E10.9", "Type 1 diabetes mellitus without complications"),
    ("E03.9", "Hypothyroidism unspecified"),
    (
        "E05.90",
        "Thyrotoxicosis unspecified without thyrotoxic crisis",
    ),
    ("E66.9", "Obesity unspecified"),
    ("E78.5", "Hyperlipidemia unspecified"),
    ("E78.00", "Pure hypercholesterolemia unspecified"),
    // Musculoskeletal
    ("M54.5", "Low back pain"),
    ("M54.50", "Low back pain unspecified"),
    ("M54.2", "Cervicalgia"),
    ("M79.3", "Panniculitis unspecified"),
    ("M79.604", "Pain in right arm"),
    ("M79.622", "Pain in left upper arm"),
    ("M25.511", "Pain in right shoulder"),
    ("M25.512", "Pain in left shoulder"),
    ("M25.561", "Pain in right knee"),
    ("M25.562", "Pain in left knee"),
    ("M17.11", "Primary osteoarthritis right knee"),
    ("M17.12", "Primary osteoarthritis left knee"),
    (
        "M47.816",
        "Spondylosis without myelopathy or radiculopathy lumbar region",
    ),
    (
        "M81.0",
        "Age-related osteoporosis without current pathological fracture",
    ),
    // Neurological / Mental Health
    (
        "G43.909",
        "Migraine unspecified not intractable without status migrainosus",
    ),
    ("G89.29", "Other chronic pain"),
    ("R51.9", "Headache unspecified"),
    (
        "F32.9",
        "Major depressive disorder single episode unspecified",
    ),
    ("F41.1", "Generalized anxiety disorder"),
    ("F41.9", "Anxiety disorder unspecified"),
    ("F43.10", "Post-traumatic stress disorder unspecified"),
    ("F32.A", "Depression unspecified"),
    ("G47.00", "Insomnia unspecified"),
    ("G47.33", "Obstructive sleep apnea adult"),
    // Gastrointestinal
    ("K21.0", "Gastro-esophageal reflux disease with esophagitis"),
    (
        "K21.9",
        "Gastro-esophageal reflux disease without esophagitis",
    ),
    (
        "K57.30",
        "Diverticulosis of large intestine without perforation or abscess without bleeding",
    ),
    ("K58.9", "Irritable bowel syndrome without diarrhea"),
    ("K92.1", "Melena"),
    ("R10.9", "Unspecified abdominal pain"),
    ("R10.10", "Upper abdominal pain unspecified"),
    ("R10.30", "Lower abdominal pain unspecified"),
    ("K29.70", "Gastritis unspecified without bleeding"),
    (
        "K80.20",
        "Calculus of gallbladder without cholecystitis without obstruction",
    ),
    // Genitourinary
    ("N39.0", "Urinary tract infection site not specified"),
    ("N18.9", "Chronic kidney disease unspecified"),
    ("N18.3", "Chronic kidney disease stage 3 unspecified"),
    ("R31.9", "Hematuria unspecified"),
    (
        "N40.0",
        "Benign prostatic hyperplasia without lower urinary tract symptoms",
    ),
    (
        "N92.0",
        "Excessive and frequent menstruation with regular cycle",
    ),
    // Skin
    ("L30.9", "Dermatitis unspecified"),
    ("L70.0", "Acne vulgaris"),
    ("B02.9", "Zoster without complications"),
    ("L29.9", "Pruritus unspecified"),
    // Eyes / ENT
    ("H66.90", "Otitis media unspecified unspecified ear"),
    ("H10.9", "Unspecified conjunctivitis"),
    ("J30.9", "Allergic rhinitis unspecified"),
    ("J32.9", "Chronic sinusitis unspecified"),
    ("J02.9", "Acute pharyngitis unspecified"),
    ("J03.90", "Acute tonsillitis unspecified"),
    // Infectious
    (
        "A09",
        "Other and unspecified gastroenteritis and colitis of infectious and unspecified origin",
    ),
    ("B34.9", "Viral infection unspecified"),
    (
        "J11.1",
        "Influenza due to unidentified influenza virus with other respiratory manifestations",
    ),
    ("U07.1", "COVID-19"),
    // Symptoms / Signs
    ("R55", "Syncope and collapse"),
    ("R42", "Dizziness and giddiness"),
    ("R53.1", "Weakness"),
    ("R53.83", "Other fatigue"),
    ("R50.9", "Fever unspecified"),
    ("R73.09", "Other abnormal glucose"),
    (
        "R79.89",
        "Other specified abnormal findings of blood chemistry",
    ),
    // Preventive / Z-codes
    (
        "Z00.00",
        "Encounter for general adult medical examination without abnormal findings",
    ),
    (
        "Z00.01",
        "Encounter for general adult medical examination with abnormal findings",
    ),
    (
        "Z12.31",
        "Encounter for screening mammogram for malignant neoplasm of breast",
    ),
    ("Z23", "Encounter for immunization"),
    ("Z51.11", "Encounter for antineoplastic chemotherapy"),
    ("Z87.891", "Personal history of nicotine dependence"),
    // Oncology
    (
        "C50.919",
        "Malignant neoplasm of unspecified site of unspecified female breast",
    ),
    (
        "C34.90",
        "Malignant neoplasm of unspecified part of unspecified bronchus and lung",
    ),
    ("C18.9", "Malignant neoplasm of colon unspecified"),
    ("C61", "Malignant neoplasm of prostate"),
    // Metabolic / Labs
    ("E87.1", "Hypo-osmolality and hyponatremia"),
    ("E87.5", "Hyperkalemia"),
    ("D64.9", "Anemia unspecified"),
    ("D50.9", "Iron deficiency anemia unspecified"),
    // Allergy
    (
        "T78.1XXA",
        "Other adverse food reactions not elsewhere classified initial encounter",
    ),
    ("J30.1", "Allergic rhinitis due to pollen"),
    // Screening
    ("Z01.818", "Encounter for other preprocedural examination"),
    (
        "Z13.6",
        "Encounter for screening for cardiovascular disorders",
    ),
];

fn levenshtein(a: &str, b: &str) -> usize {
    let a: Vec<char> = a.chars().collect();
    let b: Vec<char> = b.chars().collect();
    let (m, n) = (a.len(), b.len());
    if m == 0 {
        return n;
    }
    if n == 0 {
        return m;
    }
    let mut dp = vec![0usize; n + 1];
    for (j, val) in dp.iter_mut().enumerate() {
        *val = j;
    }
    for i in 1..=m {
        let mut prev = dp[0];
        dp[0] = i;
        for j in 1..=n {
            let temp = dp[j];
            dp[j] = if a[i - 1] == b[j - 1] {
                prev
            } else {
                1 + prev.min(dp[j]).min(dp[j - 1])
            };
            prev = temp;
        }
    }
    dp[n]
}

#[tauri::command]
pub fn icd10_suggest(text: String) -> Vec<Icd10Suggestion> {
    let input_tokens: Vec<String> = text
        .to_lowercase()
        .split(|c: char| !c.is_alphabetic())
        .filter(|t| t.len() >= 3)
        .map(|t| t.to_string())
        .collect();
    if input_tokens.is_empty() {
        return vec![];
    }
    let mut results: Vec<Icd10Suggestion> = ICD10_CODES
        .iter()
        .filter_map(|(code, desc)| {
            let desc_tokens: Vec<String> = desc
                .to_lowercase()
                .split(|c: char| !c.is_alphabetic())
                .filter(|t| t.len() >= 3)
                .map(|t| t.to_string())
                .collect();
            let mut matched = 0usize;
            for input_tok in &input_tokens {
                let threshold = if input_tok.len() < 5 { 0usize } else { 2usize };
                let is_match = desc_tokens
                    .iter()
                    .any(|dt| levenshtein(input_tok, dt) <= threshold);
                if is_match {
                    matched += 1;
                }
            }
            if matched == 0 {
                return None;
            }
            Some(Icd10Suggestion {
                code: code.to_string(),
                description: desc.to_string(),
                confidence: matched as f32 / input_tokens.len() as f32,
            })
        })
        .collect();
    results.sort_by(|a, b| {
        b.confidence
            .partial_cmp(&a.confidence)
            .unwrap_or(std::cmp::Ordering::Equal)
    });
    results.truncate(10);
    results
}

#[tauri::command]
pub fn appointment_tags_get(
    appointment_id: String,
    state: State<AppState>,
) -> Result<Vec<String>, CommandError> {
    let guard = state.db.lock()?;
    let ctx = crate::commands::CommandContext::new(&guard)?;
    let mut stmt = ctx
        .conn
        .prepare("SELECT tag FROM appointment_tags WHERE appointment_id = ? ORDER BY tag")?;
    let tags = stmt
        .query_map([&appointment_id], |row| row.get(0))?
        .collect::<rusqlite::Result<Vec<String>>>()?;
    Ok(tags)
}

#[tauri::command]
pub fn appointment_tags_set(
    appointment_id: String,
    tags: Vec<String>,
    state: State<AppState>,
) -> Result<(), CommandError> {
    let guard = state.db.lock()?;
    let ctx = crate::commands::CommandContext::new(&guard)?;
    ctx.conn.execute(
        "DELETE FROM appointment_tags WHERE appointment_id = ?",
        [&appointment_id],
    )?;
    for tag in &tags {
        ctx.conn.execute(
            "INSERT OR IGNORE INTO appointment_tags (appointment_id, tag) VALUES (?1, ?2)",
            rusqlite::params![appointment_id, tag],
        )?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn chest_pain_returns_r07_suggestion() {
        let results = icd10_suggest("chest pain".to_string());
        assert!(
            !results.is_empty(),
            "expected at least one suggestion for 'chest pain'"
        );
        let has_r07 = results.iter().any(|s| s.code.starts_with("R07"));
        assert!(
            has_r07,
            "expected R07.* in results, got: {:?}",
            results.iter().map(|s| &s.code).collect::<Vec<_>>()
        );
    }

    #[test]
    fn gibberish_returns_empty() {
        let results = icd10_suggest("xqzwvp fljkrhm".to_string());
        assert!(results.is_empty(), "expected empty results for gibberish");
    }

    #[test]
    fn empty_input_returns_empty() {
        let results = icd10_suggest(String::new());
        assert!(results.is_empty());
    }

    #[test]
    fn results_sorted_by_confidence_descending() {
        let results = icd10_suggest("diabetes mellitus type 2".to_string());
        if results.len() > 1 {
            for i in 0..results.len() - 1 {
                assert!(
                    results[i].confidence >= results[i + 1].confidence,
                    "results not sorted by confidence"
                );
            }
        }
    }

    #[test]
    fn results_truncated_to_ten() {
        let results = icd10_suggest("pain".to_string());
        assert!(results.len() <= 10, "results should not exceed 10");
    }
}

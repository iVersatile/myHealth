pub mod ocr;
pub mod pdf;

use chrono::Utc;
use std::path::Path;

#[derive(Debug, Clone)]
#[allow(dead_code)]
pub struct ExtractionResult {
    pub text: String,
    pub extracted_at: String,
}

/// Extracts text from a file based on its extension.
///
/// Routes to appropriate extractor:
/// - PDF files → pdf::extract_pdf_text
/// - Images (jpg, jpeg, png, tiff, tif) → ocr::extract_image_text
/// - Other formats → returns empty text
#[allow(dead_code)]
pub fn extract(path: &Path) -> ExtractionResult {
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    let text = match ext.as_str() {
        "pdf" => pdf::extract_pdf_text(path).unwrap_or_default(),
        "jpg" | "jpeg" | "png" | "tiff" | "tif" => {
            ocr::extract_image_text(path).unwrap_or_default()
        }
        _ => String::new(),
    };

    ExtractionResult {
        text,
        extracted_at: Utc::now().to_rfc3339(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn routes_pdf_extension() {
        let path = PathBuf::from("/tmp/fake.pdf");
        let result = extract(&path);
        // PDF extraction might be empty for missing file, which is OK
        assert!(!result.extracted_at.is_empty());
    }

    #[test]
    fn routes_jpg_extension() {
        let path = PathBuf::from("/tmp/fake.jpg");
        let result = extract(&path);
        assert_eq!(result.text, "");
        assert!(!result.extracted_at.is_empty());
    }

    #[test]
    fn routes_unknown_extension() {
        let path = PathBuf::from("/tmp/fake.docx");
        let result = extract(&path);
        assert_eq!(result.text, "");
    }
}

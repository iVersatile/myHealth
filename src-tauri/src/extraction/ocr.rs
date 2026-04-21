use std::path::Path;

/// Extracts text from image files using OCR.
///
/// Currently a stub returning empty string since system Tesseract
/// is not installed. In production, this would use a real OCR engine.
pub fn extract_image_text(path: &Path) -> Result<String, String> {
    // Stub: return empty string for now
    // In the future, replace with actual OCR (leptess or pure-Rust alternative)
    let _ = path;
    Ok(String::new())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn returns_empty_for_jpeg() {
        let path = PathBuf::from("/tmp/fake.jpg");
        let result = extract_image_text(&path);
        assert_eq!(result, Ok(String::new()));
    }

    #[test]
    fn returns_empty_for_png() {
        let path = PathBuf::from("/tmp/fake.png");
        let result = extract_image_text(&path);
        assert_eq!(result, Ok(String::new()));
    }
}

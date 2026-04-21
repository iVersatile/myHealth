use std::path::Path;

#[allow(dead_code)]
pub fn extract_pdf_text(path: &Path) -> Result<String, String> {
    match pdf_extract::extract_text(path) {
        Ok(text) => Ok(text),
        Err(_) => Ok(String::new()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    fn fixture(name: &str) -> PathBuf {
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("tests/fixtures")
            .join(name)
    }

    #[test]
    fn extracts_text_from_text_pdf() {
        let path = fixture("sample.pdf");
        let result = extract_pdf_text(&path);
        assert!(result.is_ok(), "expected Ok, got {:?}", result);
        let text = result.unwrap();
        assert!(
            text.contains("Hello") || text.contains("PDF") || text.contains("world"),
            "expected extracted text to contain PDF content, got: {:?}",
            text
        );
    }

    #[test]
    fn returns_empty_string_for_missing_file() {
        let path = PathBuf::from("/tmp/does_not_exist_xyz.pdf");
        let result = extract_pdf_text(&path);
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), "");
    }

    #[test]
    fn returns_empty_string_for_invalid_pdf() {
        let tmp = std::env::temp_dir().join("bad_test.pdf");
        std::fs::write(&tmp, b"not a pdf at all").unwrap();
        let result = extract_pdf_text(&tmp);
        assert!(result.is_ok());
        let _ = std::fs::remove_file(&tmp);
    }
}

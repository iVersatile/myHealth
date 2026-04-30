use std::collections::HashMap;

/// Extractive summarizer: TF-IDF sentence scoring + position bias.
/// Returns up to `max_sentences` top-scored sentences in original order.
pub fn summarize(text: &str, max_sentences: usize) -> Vec<String> {
    let sentences: Vec<&str> = split_sentences(text);
    if sentences.len() <= max_sentences {
        return sentences.iter().map(|s| s.trim().to_string()).collect();
    }

    let tf_idf = compute_tf_idf(&sentences);
    let last = sentences.len() - 1;

    let mut scored: Vec<(usize, f64)> = sentences
        .iter()
        .enumerate()
        .map(|(i, sent)| {
            let base = sentence_score(sent, &tf_idf);
            let position_bonus = if i == 0 || i == last { 0.3 } else { 0.0 };
            (i, base + position_bonus)
        })
        .collect();

    // Sort descending by score, pick top N, restore original order.
    scored.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
    let mut top: Vec<usize> = scored.iter().take(max_sentences).map(|(i, _)| *i).collect();
    top.sort_unstable();

    top.iter()
        .map(|&i| sentences[i].trim().to_string())
        .collect()
}

fn split_sentences(text: &str) -> Vec<&str> {
    let mut sentences: Vec<&str> = Vec::new();
    let mut start = 0;
    let bytes = text.as_bytes();
    let len = bytes.len();

    let mut i = 0;
    while i < len {
        if matches!(bytes[i], b'.' | b'!' | b'?') {
            let end = i + 1;
            let candidate = text[start..end].trim();
            if !candidate.is_empty() {
                sentences.push(&text[start..end]);
            }
            // Skip whitespace after terminator.
            i = end;
            while i < len && bytes[i].is_ascii_whitespace() {
                i += 1;
            }
            start = i;
        } else {
            i += 1;
        }
    }
    // Trailing text without a terminator.
    let tail = text[start..].trim();
    if !tail.is_empty() {
        sentences.push(&text[start..]);
    }
    sentences
}

fn tokenize(text: &str) -> Vec<String> {
    text.to_lowercase()
        .split(|c: char| !c.is_alphanumeric())
        .filter(|t| t.len() > 2)
        .map(|t| t.to_string())
        .collect()
}

fn compute_tf_idf(sentences: &[&str]) -> HashMap<String, f64> {
    let n = sentences.len() as f64;
    let mut df: HashMap<String, usize> = HashMap::new();

    let tokenized: Vec<Vec<String>> = sentences.iter().map(|s| tokenize(s)).collect();

    for tokens in &tokenized {
        let unique: std::collections::HashSet<&String> = tokens.iter().collect();
        for term in unique {
            *df.entry(term.clone()).or_insert(0) += 1;
        }
    }

    let mut tfidf: HashMap<String, f64> = HashMap::new();
    for tokens in &tokenized {
        let tf_counts = term_frequency(tokens);
        for (term, tf) in &tf_counts {
            let idf = (n / (*df.get(term).unwrap_or(&1) as f64)).ln() + 1.0;
            *tfidf.entry(term.clone()).or_insert(0.0) += tf * idf;
        }
    }
    tfidf
}

fn term_frequency(tokens: &[String]) -> HashMap<String, f64> {
    let mut counts: HashMap<String, usize> = HashMap::new();
    for t in tokens {
        *counts.entry(t.clone()).or_insert(0) += 1;
    }
    let total = tokens.len().max(1) as f64;
    counts
        .into_iter()
        .map(|(k, v)| (k, v as f64 / total))
        .collect()
}

fn sentence_score(sentence: &str, tfidf: &HashMap<String, f64>) -> f64 {
    let tokens = tokenize(sentence);
    if tokens.is_empty() {
        return 0.0;
    }
    let sum: f64 = tokens
        .iter()
        .map(|t| tfidf.get(t).copied().unwrap_or(0.0))
        .sum();
    sum / tokens.len() as f64
}

#[cfg(test)]
mod tests {
    use super::*;

    fn ten_sentence_notes() -> &'static str {
        "The patient presented with persistent lower back pain. \
        Pain has been ongoing for three weeks. \
        Physical examination revealed muscle tension in the lumbar region. \
        No neurological deficits were detected. \
        An X-ray showed no fractures or abnormalities. \
        The patient was prescribed anti-inflammatory medication. \
        Physiotherapy sessions were recommended twice weekly. \
        Patient should avoid heavy lifting for the next month. \
        Follow-up appointment scheduled for four weeks time. \
        Patient was advised to contact the clinic if symptoms worsen."
    }

    #[test]
    fn ten_sentence_input_returns_three_sentences() {
        let result = summarize(ten_sentence_notes(), 3);
        assert_eq!(result.len(), 3, "expected 3 sentences, got {:?}", result);
    }

    #[test]
    fn summaries_are_valid_substrings_of_original() {
        let notes = ten_sentence_notes();
        for sentence in summarize(notes, 3) {
            assert!(
                notes.contains(sentence.trim()),
                "summary sentence not found in original: {:?}",
                sentence
            );
        }
    }

    #[test]
    fn short_notes_returned_as_is() {
        let short = "Patient doing well. Follow-up in two weeks.";
        let result = summarize(short, 3);
        assert_eq!(result.len(), 2);
        assert!(result[0].contains("Patient doing well"));
        assert!(result[1].contains("Follow-up in two weeks"));
    }

    #[test]
    fn single_sentence_returned_as_is() {
        let single = "Patient has a mild fever.";
        let result = summarize(single, 3);
        assert_eq!(result.len(), 1);
    }

    #[test]
    fn empty_notes_returns_empty() {
        let result = summarize("", 3);
        assert!(result.is_empty());
    }
}

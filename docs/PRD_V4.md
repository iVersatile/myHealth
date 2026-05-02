# myHealth PRD V4 — Enhancement: LLM-Assisted Document Tag Extraction

**Status:** Planned (Post-MVP)
**Priority:** Medium
**Depends on:** PRD V3 (current implementation with rule-based extraction)

---

## Context

The current `auto_extract_tags()` pipeline (Rust, `src-tauri/src/extraction/mod.rs`) uses rule-based heuristics:

1. Type tags — keyword matching (lowercase)
2. Specialty tags — medical specialty keyword matching (UPPERCASE)
3. Provider name tags — NER-style title-case heuristic
4. Activity date tag — regex date extraction
5. Document title tag — first-3-lines title-case heading scan (`title:` prefix)

This approach works well for structured forms and referral letters but degrades on:
- Scanned documents with poor OCR quality
- Discharge summaries with dense prose
- Non-standard document layouts
- Foreign-language or bilingual documents

---

## Enhancement: LLM-Assisted Extraction (Option D)

Replace or augment the rule-based pipeline with an on-device LLM pass that extracts structured metadata from raw OCR text.

### Proposed Behaviour

On document upload (after OCR):

1. Send the first 1,000 tokens of OCR text to an on-device LLM (e.g. llama.cpp with Mistral 7B).
2. Prompt the model to return a JSON object with the following fields:
   ```json
   {
     "title": "Registration Form",
     "specialty": "CARDIOLOGY",
     "provider": "Dr Jane Smith",
     "activity_date": "2023-01-10",
     "tags": ["registration", "cardiology"]
   }
   ```
3. Merge LLM output with rule-based output, preferring LLM values when present and confidence ≥ threshold.
4. Store merged result in the `tags` column as before; persist `activity_date` separately.

### Constraints

- **Local-only**: The LLM must run entirely on-device. No API calls to any external service.
- **Opt-in**: Feature is disabled by default; user must enable it in Settings.
- **Graceful degradation**: If the LLM is unavailable or returns malformed JSON, fall back silently to rule-based extraction.
- **Performance**: Extraction must complete within 10 seconds on an M1 MacBook Air.
- **Model size**: Bundled model must be ≤ 4 GB; prefer quantised (Q4_K_M or smaller).

---

## Acceptance Criteria

| # | Criterion | How to verify |
|---|-----------|---------------|
| AC-1 | Upload `Registration Form` PDF → tag `title:Registration Form` present in document tags | Manual test: upload PDF, open document detail, inspect tags |
| AC-2 | Upload cardiology referral letter → tag `CARDIOLOGY` and `activity_date` extracted correctly | Manual test: compare extracted date to letter date |
| AC-3 | Upload a document when LLM is disabled → rule-based tags still generated, no error | Toggle LLM off in Settings, upload document |
| AC-4 | Upload a corrupt/blank PDF → no crash; empty tags returned; upload succeeds | Manual test with blank PDF |
| AC-5 | Extraction completes within 10 s on M1 MacBook Air (timed from upload button press to tags visible) | Manual timing test |
| AC-6 | No network traffic generated during extraction | Use macOS `lsof` / Little Snitch to verify no outbound connections |
| AC-7 | LLM returns malformed JSON → fallback to rule-based tags silently | Unit test: mock LLM response with invalid JSON |
| AC-8 | Settings toggle persists across app restarts | Close and reopen app, verify toggle state |

---

## Out of Scope for This Version

- Cloud/remote LLM calls
- Model fine-tuning on user data
- Batch re-extraction of existing documents
- Real-time extraction progress UI (silent background process only)

---

## Implementation Notes

- Preferred runtime: `llama.cpp` via Tauri sidecar or Rust bindings (`llm` crate)
- Model selection to be confirmed during spike; candidates: Mistral 7B Q4, Phi-3 Mini
- Prompt template to be developed and tested separately before integration
- JSON schema validation required before merging LLM output
- Confidence scoring: require all returned string fields to be non-empty; reject partial results

---

*Created: 2026-05-02 | Based on manual test feedback from session 2026-05-02*

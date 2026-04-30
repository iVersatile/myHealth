'use client'

import { useEffect, useRef, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { open } from '@tauri-apps/plugin-dialog'
import { Document, DocumentCategory, DOCUMENT_CATEGORIES, CATEGORY_LABELS } from '../../store/documentsStore'
import { CategoryPicker, Category } from '../categories/CategoryPicker'

interface UploadDialogProps {
  onClose: () => void
  onUploaded: (doc: Document) => void
}

interface ContactSuggestion {
  name: string
  specialty: string | null
  clinic: string | null
  address: string | null
  phone: string | null
  email: string | null
}

interface ExtractionSuggestions {
  doctor_candidates: string[]
  category_suggestion: string | null
  document_tags: string[]
  auto_tags: string[]
  contact_suggestions: ContactSuggestion[]
}

interface DuplicateCandidate {
  primary_contact_id: string
  contact: { id: string; name: string }
  similarity_score: number
  match_reason: string
}

interface OcrProgress {
  page: number
  total: number
  elapsed_ms: number
}

type ContactPhase =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'duplicate'; newId: string; match: DuplicateCandidate }
  | { kind: 'saved' }

type Step = 'pick' | 'analyzing' | 'review'

export function UploadDialog({ onClose, onUploaded }: UploadDialogProps) {
  const [step, setStep] = useState<Step>('pick')
  const [dragging, setDragging] = useState(false)
  const [analyzeError, setAnalyzeError] = useState<string | null>(null)

  // Set after upload in the analyzing step
  const [uploadedDoc, setUploadedDoc] = useState<Document | null>(null)

  // Review step state — pre-populated from extraction results
  const [category, setCategory] = useState<DocumentCategory>('lab')
  const [tagsRaw, setTagsRaw] = useState('')
  const [notes, setNotes] = useState('')
  const [allCategories, setAllCategories] = useState<Category[]>([])
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([])
  const [categorySuggestion, setCategorySuggestion] = useState<string | null>(null)
  const [categorySuggestionDismissed, setCategorySuggestionDismissed] = useState(false)
  const [contactSuggestions, setContactSuggestions] = useState<ContactSuggestion[]>([])
  const [contactPhases, setContactPhases] = useState<Map<string, ContactPhase>>(new Map())
  const [confirming, setConfirming] = useState(false)
  const [confirmError, setConfirmError] = useState<string | null>(null)
  const [ocrProgress, setOcrProgress] = useState<OcrProgress | null>(null)
  const unlistenRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    return () => {
      unlistenRef.current?.()
    }
  }, [])

  useEffect(() => {
    invoke<Array<{ id: string; name: string; parent_id: string | null; color_hex: string; is_system: boolean; sort_order: number }>>('categories_list')
      .then((rows) =>
        setAllCategories(
          rows.map((r) => ({
            id: r.id,
            name: r.name,
            parentId: r.parent_id,
            colorHex: r.color_hex,
            isSystem: r.is_system,
            sortOrder: r.sort_order,
          }))
        )
      )
      .catch(() => {})
  }, [])

  async function processFile(filePath: string) {
    setStep('analyzing')
    setAnalyzeError(null)
    try {
      const doc = await invoke<Document>('documents_upload', {
        filePath,
        category: 'lab',
        notes: null,
      })
      setUploadedDoc(doc)

      // Run PDF extraction only for PDFs
      const extractedTags: string[] = [...doc.tags]
      if (doc.document_date) {
        extractedTags.push(doc.document_date)
      }

      const isOcrCandidate =
        doc.mime_type === 'application/pdf' || (doc.mime_type?.startsWith('image/') ?? false)

      if (isOcrCandidate) {
        try {
          const unlisten = await listen<OcrProgress>('ocr_progress', (e) => {
            setOcrProgress(e.payload)
          })
          unlistenRef.current = unlisten

          const suggestions = await invoke<ExtractionSuggestions>('documents_run_extraction', {
            id: doc.id,
            emitProgress: true,
          })

          unlistenRef.current?.()
          unlistenRef.current = null
          setOcrProgress(null)

          setCategorySuggestion(suggestions.category_suggestion)
          setContactSuggestions(suggestions.contact_suggestions)

          for (const tag of [
            ...suggestions.auto_tags,
            ...suggestions.doctor_candidates,
            ...suggestions.document_tags,
          ]) {
            const lower = tag.toLowerCase()
            if (!extractedTags.some((t) => t.toLowerCase() === lower)) {
              extractedTags.push(tag)
            }
          }
        } catch {
          unlistenRef.current?.()
          unlistenRef.current = null
          setOcrProgress(null)
          // Extraction failure is non-fatal — still proceed to review
        }
      }

      setTagsRaw(extractedTags.filter(Boolean).join(', '))

      setStep('review')
    } catch (err: unknown) {
      setAnalyzeError(err instanceof Error ? err.message : String(err))
      setStep('pick')
    }
  }

  async function pickFile() {
    const selected = await open({
      multiple: false,
      filters: [
        { name: 'Documents', extensions: ['pdf', 'jpg', 'jpeg', 'png', 'webp', 'heic', 'tiff'] },
      ],
    })
    if (typeof selected === 'string') {
      await processFile(selected)
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    setDragging(true)
  }

  function handleDragLeave() {
    setDragging(false)
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (!file) return
    const nativePath = (file as File & { path?: string }).path
    if (nativePath) {
      await processFile(nativePath)
    }
  }

  async function handleCancel() {
    if (uploadedDoc) {
      try {
        await invoke('documents_delete', { id: uploadedDoc.id })
      } catch {
        // Best-effort cleanup
      }
    }
    onClose()
  }

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault()
    if (!uploadedDoc) return
    setConfirming(true)
    setConfirmError(null)
    try {
      const finalTags = tagsRaw
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)

      await Promise.all([
        invoke<Document>('documents_update', {
          id: uploadedDoc.id,
          category,
          notes: notes.trim() || null,
        }),
        invoke('documents_tags_set', { id: uploadedDoc.id, tags: finalTags }),
        ...selectedCategoryIds.map((categoryId) =>
          invoke('categories_assign_document', { documentId: uploadedDoc.id, categoryId })
        ),
      ])

      const final = await invoke<Document>('documents_get', { id: uploadedDoc.id })
      onUploaded(final)
      onClose()
    } catch (err: unknown) {
      setConfirmError(err instanceof Error ? err.message : String(err))
    } finally {
      setConfirming(false)
    }
  }

  const categories = DOCUMENT_CATEGORIES.filter((c) => c !== 'all')

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="upload-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={step === 'pick' ? onClose : undefined}
        aria-hidden="true"
      />

      {/* Panel — max-height + flex column so footer stays pinned and body scrolls */}
      <div className="relative z-10 flex max-h-[calc(100vh-2rem)] w-full max-w-md flex-col overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-lg)]">
        {/* Header — always visible */}
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--color-border)] px-6 py-4">
          <h2
            id="upload-dialog-title"
            className="text-[var(--text-lg)] font-semibold text-[var(--color-text)]"
          >
            {step === 'pick' && 'Upload Document'}
            {step === 'analyzing' && 'Analysing…'}
            {step === 'review' && 'Review & Confirm'}
          </h2>
          {step === 'pick' && (
            <button
              type="button"
              aria-label="Close dialog"
              onClick={onClose}
              className="rounded-[var(--radius-sm)] p-1 text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-sunken)]"
            >
              ✕
            </button>
          )}
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">
          {/* ── Step 1: Pick ── */}
          {step === 'pick' && (
            <div className="p-6">
              {analyzeError && (
                <p className="mb-4 rounded-[var(--radius-md)] border border-[var(--color-danger)] px-3 py-2 text-[var(--text-sm)] text-[var(--color-danger)]">
                  {analyzeError}
                </p>
              )}
              <button
                type="button"
                onClick={() => void pickFile()}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={(e) => void handleDrop(e)}
                className={[
                  'flex w-full flex-col items-center justify-center gap-2 rounded-[var(--radius-lg)] border-2 border-dashed px-4 py-12 text-center transition-colors duration-[var(--duration-fast)]',
                  dragging
                    ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5'
                    : 'border-[var(--color-border)] hover:border-[var(--color-primary)] hover:bg-[var(--color-surface-sunken)]',
                ].join(' ')}
              >
                <span className="text-3xl">↑</span>
                <span className="text-[var(--text-sm)] font-medium text-[var(--color-text)]">
                  Drop file here or click to browse
                </span>
                <span className="text-[var(--text-xs)] text-[var(--color-text-secondary)]">
                  PDF, JPG, PNG, HEIC, TIFF, WebP
                </span>
              </button>
            </div>
          )}

          {/* ── Step 2: Analysing ── */}
          {step === 'analyzing' && (
            <div className="flex flex-col items-center gap-4 px-6 py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-primary)]" />
              {ocrProgress ? (
                <div className="flex w-full flex-col gap-2">
                  <p className="text-center text-[var(--text-sm)] text-[var(--color-text-secondary)]">
                    Extracting text — page {ocrProgress.page} of {ocrProgress.total}{' '}
                    ({Math.round(ocrProgress.elapsed_ms / 1000)}s elapsed)
                  </p>
                  <div
                    role="progressbar"
                    aria-valuenow={ocrProgress.page}
                    aria-valuemin={0}
                    aria-valuemax={ocrProgress.total}
                    aria-label="OCR progress"
                    className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-border)]"
                  >
                    <div
                      className="h-full rounded-full bg-[var(--color-primary)] transition-[width] duration-200"
                      style={{ width: `${Math.round((ocrProgress.page / ocrProgress.total) * 100)}%` }}
                    />
                  </div>
                </div>
              ) : (
                <p className="text-[var(--text-sm)] text-[var(--color-text-secondary)]">
                  Uploading and extracting document data…
                </p>
              )}
            </div>
          )}

          {/* ── Step 3: Review ── */}
          {step === 'review' && uploadedDoc && (
            <form
              id="upload-review-form"
              onSubmit={(e) => void handleConfirm(e)}
              className="flex flex-col gap-4 p-6"
            >
              {/* Filename + detected date */}
              <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-4 py-3">
                <p className="text-[var(--text-sm)] font-medium text-[var(--color-text)]">
                  {uploadedDoc.filename}
                </p>
                {uploadedDoc.document_date && (
                  <p className="mt-1 text-[var(--text-xs)] text-[var(--color-text-secondary)]">
                    Date detected from filename:{' '}
                    <span className="font-medium text-[var(--color-text)]">
                      {uploadedDoc.document_date}
                    </span>
                  </p>
                )}
              </div>

              {/* Category suggestion from PDF extraction */}
              {categorySuggestion && !categorySuggestionDismissed && (
                <div className="flex items-center justify-between gap-2 rounded-[var(--radius-md)] border border-[var(--color-primary)]/30 bg-[var(--color-primary)]/5 px-3 py-2">
                  <p className="text-[var(--text-sm)] text-[var(--color-text)]">
                    Suggested category:{' '}
                    <span className="font-medium">{categorySuggestion}</span>
                  </p>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => setCategorySuggestionDismissed(true)}
                      className="text-[var(--text-xs)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              )}

              {/* Detected contacts from PDF extraction */}
              {contactSuggestions.length > 0 && (
                <div className="flex flex-col gap-2">
                  <p className="text-[var(--text-sm)] font-medium text-[var(--color-text)]">
                    Detected contacts
                  </p>
                  {contactSuggestions.map((cs) => {
                    const phase = contactPhases.get(cs.name) ?? { kind: 'idle' as const }

                    function setPhase(p: ContactPhase) {
                      setContactPhases((prev) => new Map([...prev, [cs.name, p]]))
                    }

                    async function handleSave() {
                      setPhase({ kind: 'saving' })
                      try {
                        const newContact = await invoke<{ id: string }>('contacts_create', {
                          input: {
                            name: cs.name,
                            role: 'Doctor',
                            specialty: cs.specialty,
                            phone: cs.phone,
                            email: cs.email,
                            clinic: cs.clinic,
                            address: cs.address,
                            notes: null,
                          },
                        })
                        const dupes = await invoke<DuplicateCandidate[]>('find_duplicate_contacts', {
                          userId: '',
                          contactId: newContact.id,
                          threshold: 0.85,
                        })
                        const topDupe = dupes[0]
                        if (topDupe) {
                          setPhase({ kind: 'duplicate', newId: newContact.id, match: topDupe })
                        } else {
                          setPhase({ kind: 'saved' })
                        }
                      } catch {
                        setPhase({ kind: 'idle' })
                      }
                    }

                    async function handleMerge(newId: string, existingId: string) {
                      try {
                        await invoke('merge_contacts', {
                          userId: '',
                          primaryId: existingId,
                          duplicateIds: [newId],
                        })
                      } catch {
                        // merge failure is non-fatal — contact still exists
                      }
                      setPhase({ kind: 'saved' })
                    }

                    async function handleCancelDuplicate(newId: string) {
                      try {
                        await invoke('contacts_delete', { id: newId })
                      } catch {
                        // best-effort cleanup
                      }
                      setPhase({ kind: 'idle' })
                    }

                    return (
                      <div
                        key={cs.name}
                        className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-3 py-2"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex flex-col gap-0.5 text-[var(--text-xs)]">
                            <span className="font-medium text-[var(--color-text)]">{cs.name}</span>
                            {cs.specialty && (
                              <span className="text-[var(--color-text-secondary)]">{cs.specialty}</span>
                            )}
                            {cs.clinic && (
                              <span className="text-[var(--color-text-secondary)]">{cs.clinic}</span>
                            )}
                            {cs.address && (
                              <span className="text-[var(--color-text-secondary)]">{cs.address}</span>
                            )}
                            {cs.phone && (
                              <span className="text-[var(--color-text-secondary)]">{cs.phone}</span>
                            )}
                            {cs.email && (
                              <span className="text-[var(--color-text-secondary)]">{cs.email}</span>
                            )}
                          </div>
                          {phase.kind !== 'duplicate' && (
                            <button
                              type="button"
                              disabled={phase.kind === 'saving' || phase.kind === 'saved'}
                              onClick={() => void handleSave()}
                              className="shrink-0 rounded-[var(--radius-sm)] border border-[var(--color-border)] px-2 py-1 text-[var(--text-xs)] text-[var(--color-text-secondary)] transition-colors duration-[var(--duration-fast)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] disabled:cursor-default disabled:opacity-40"
                            >
                              {phase.kind === 'saved' ? 'Saved' : phase.kind === 'saving' ? 'Checking…' : 'Save as Contact'}
                            </button>
                          )}
                        </div>

                        {phase.kind === 'duplicate' && (
                          <div className="rounded-[var(--radius-sm)] border border-[var(--color-warning)]/40 bg-[var(--color-warning)]/5 px-2 py-1.5 text-[var(--text-xs)]">
                            <p className="mb-1.5 text-[var(--color-text)]">
                              Possible duplicate:{' '}
                              <span className="font-medium">{phase.match.contact.name}</span>{' '}
                              ({Math.round(phase.match.similarity_score * 100)}% match) — merge?
                            </p>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => void handleMerge(phase.newId, phase.match.contact.id)}
                                className="rounded-[var(--radius-sm)] bg-[var(--color-primary)] px-2 py-0.5 text-[var(--text-xs)] font-medium text-[var(--color-text-inverse)]"
                              >
                                Merge
                              </button>
                              <button
                                type="button"
                                onClick={() => setPhase({ kind: 'saved' })}
                                className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-2 py-0.5 text-[var(--text-xs)] text-[var(--color-text-secondary)]"
                              >
                                Keep both
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleCancelDuplicate(phase.newId)}
                                className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-2 py-0.5 text-[var(--text-xs)] text-[var(--color-text-secondary)]"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Category */}
              <div className="flex flex-col gap-1">
                <label
                  htmlFor="upload-category"
                  className="text-[var(--text-sm)] font-medium text-[var(--color-text)]"
                >
                  Category
                </label>
                <select
                  id="upload-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as DocumentCategory)}
                  className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-3 py-2 text-[var(--text-sm)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                >
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {CATEGORY_LABELS[cat]}
                    </option>
                  ))}
                </select>
              </div>

              {/* Medical Categories */}
              {allCategories.length > 0 && (
                <div className="flex flex-col gap-1">
                  <label className="text-[var(--text-sm)] font-medium text-[var(--color-text)]">
                    Medical Categories{' '}
                    <span className="font-normal text-[var(--color-text-secondary)]">(optional)</span>
                  </label>
                  <CategoryPicker
                    categories={allCategories}
                    selectedIds={selectedCategoryIds}
                    onChange={setSelectedCategoryIds}
                  />
                </div>
              )}

              {/* Tags — pre-populated from filename parsing */}
              <div className="flex flex-col gap-1">
                <label
                  htmlFor="upload-tags"
                  className="text-[var(--text-sm)] font-medium text-[var(--color-text)]"
                >
                  Tags{' '}
                  <span className="font-normal text-[var(--color-text-secondary)]">
                    (comma-separated)
                  </span>
                </label>
                <input
                  id="upload-tags"
                  type="text"
                  value={tagsRaw}
                  onChange={(e) => setTagsRaw(e.target.value)}
                  placeholder="e.g. blood test, annual, Dr. Smith"
                  className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-3 py-2 text-[var(--text-sm)] text-[var(--color-text)] placeholder:text-[var(--color-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                />
              </div>

              {/* Notes */}
              <div className="flex flex-col gap-1">
                <label
                  htmlFor="upload-notes"
                  className="text-[var(--text-sm)] font-medium text-[var(--color-text)]"
                >
                  Notes{' '}
                  <span className="font-normal text-[var(--color-text-secondary)]">(optional)</span>
                </label>
                <textarea
                  id="upload-notes"
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any additional context…"
                  className="resize-none rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-3 py-2 text-[var(--text-sm)] text-[var(--color-text)] placeholder:text-[var(--color-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                />
              </div>

              {confirmError && (
                <p className="rounded-[var(--radius-md)] border border-[var(--color-danger)] px-3 py-2 text-[var(--text-sm)] text-[var(--color-danger)]">
                  {confirmError}
                </p>
              )}
            </form>
          )}
        </div>

        {/* Footer — pinned at bottom for review step */}
        {step === 'review' && (
          <div className="flex shrink-0 justify-end gap-3 border-t border-[var(--color-border)] px-6 py-4">
            <button
              type="button"
              onClick={() => void handleCancel()}
              disabled={confirming}
              className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-4 py-2 text-[var(--text-sm)] text-[var(--color-text)] transition-colors duration-[var(--duration-fast)] hover:bg-[var(--color-surface-sunken)] disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="upload-review-form"
              disabled={confirming}
              className="rounded-[var(--radius-md)] bg-[var(--color-primary)] px-4 py-2 text-[var(--text-sm)] font-medium text-[var(--color-text-inverse)] transition-colors duration-[var(--duration-fast)] hover:bg-[var(--color-primary-hover)] disabled:opacity-40"
            >
              {confirming ? 'Saving…' : 'Confirm Upload'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

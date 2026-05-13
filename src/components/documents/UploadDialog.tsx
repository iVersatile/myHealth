'use client'

import { useEffect, useRef, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { open } from '@tauri-apps/plugin-dialog'
import { Document, DocumentCategory, DOCUMENT_CATEGORIES } from '../../store/documentsStore'
import { useToast } from '../../hooks/useToast'
import { Toast } from '../shared/Toast'
import { UploadReviewStep } from './UploadReviewStep'
import { buildTimelineDescription } from './uploadTypes'
import type { ContactSuggestion, ClinicSuggestion, ContactPhase, ClinicPhase, FileQueueItem, FileQueueStatus } from './uploadTypes'
import type { Category } from '../categories/CategoryPicker'
export type { ExtractedAddress, ClinicSuggestion, ContactSuggestion, FileQueueStatus, FileQueueItem } from './uploadTypes'

interface UploadDialogProps {
  onClose: () => void
  onUploaded: (doc: Document, unsavedClinicSuggestions: ClinicSuggestion[], unsavedContactSuggestions: ContactSuggestion[]) => void
}

interface ExtractionSuggestions {
  doctor_candidates: string[]
  category_suggestion: string | null
  document_tags: string[]
  auto_tags: string[]
  contact_suggestions: ContactSuggestion[]
  clinic_suggestions: ClinicSuggestion[]
  activity_date: string | null
  extracted_text_preview: string | null
}

interface OcrProgress {
  page: number
  total: number
  elapsed_ms: number
}

type Step = 'pick' | 'analyzing' | 'review'

export function UploadDialog({ onClose, onUploaded }: UploadDialogProps) {
  const [step, setStep] = useState<Step>('pick')
  const [dragging, setDragging] = useState(false)
  const [analyzeError, setAnalyzeError] = useState<string | null>(null)
  const [uploadedDoc, setUploadedDoc] = useState<Document | null>(null)

  const [category, setCategory] = useState<DocumentCategory>('lab')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [notes, setNotes] = useState('')
  const [allCategories, setAllCategories] = useState<Category[]>([])
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([])
  const [categorySuggestion, setCategorySuggestion] = useState<string | null>(null)
  const [categorySuggestionDismissed, setCategorySuggestionDismissed] = useState(false)
  const [contactSuggestions, setContactSuggestions] = useState<ContactSuggestion[]>([])
  const [contactPhases, setContactPhases] = useState<Map<string, ContactPhase>>(new Map())
  const [dismissedContacts, setDismissedContacts] = useState<Set<string>>(new Set())
  const [clinicSuggestions, setClinicSuggestions] = useState<ClinicSuggestion[]>([])
  const [clinicPhase, setClinicPhase] = useState<ClinicPhase>({ kind: 'idle' })
  const [dismissedClinics, setDismissedClinics] = useState<Set<string>>(new Set())
  const [timelineDescription, setTimelineDescription] = useState('')
  const [activityDate, setActivityDate] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [confirmError, setConfirmError] = useState<string | null>(null)
  const [ocrProgress, setOcrProgress] = useState<OcrProgress | null>(null)
  const [extractedTextPreview, setExtractedTextPreview] = useState<string | null>(null)
  const [docCategories, setDocCategories] = useState<string[]>(
    DOCUMENT_CATEGORIES.filter((c) => c !== 'all')
  )
  const [fileQueue, setFileQueue] = useState<FileQueueItem[]>([])
  const [batchMode, setBatchMode] = useState(false)
  const [batchUploadId, setBatchUploadId] = useState<string | null>(null)
  const [batchDocIds, setBatchDocIds] = useState<string[]>([])
  const { message: toastMessage, show: showToast } = useToast(4000)
  const unlistenRef = useRef<(() => void) | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    return () => { unlistenRef.current?.() }
  }, [])

  useEffect(() => {
    invoke<string[]>('documents_valid_categories')
      .then(setDocCategories)
      .catch(() => {})
  }, [])

  useEffect(() => {
    invoke<Array<{ id: string; name: string; parent_id: string | null; color_hex: string; is_system: boolean; sort_order: number }>>('categories_list')
      .then((rows) =>
        setAllCategories(rows.map((r) => ({
          id: r.id, name: r.name, parentId: r.parent_id,
          colorHex: r.color_hex, isSystem: r.is_system, sortOrder: r.sort_order,
        })))
      )
      .catch(() => {})
  }, [])

  async function processFile(filePath: string) {
    setStep('analyzing')
    setAnalyzeError(null)
    try {
      const doc = await invoke<Document>('documents_upload', { filePath, category: 'lab', notes: null })
      setUploadedDoc(doc)

      const extractedTags: string[] = [...doc.tags]
      if (doc.document_date) extractedTags.push(doc.document_date)

      const isOcrCandidate =
        doc.mime_type === 'application/pdf' || (doc.mime_type?.startsWith('image/') ?? false)

      if (isOcrCandidate) {
        try {
          const unlisten = await listen<OcrProgress>('ocr_progress', (e) => setOcrProgress(e.payload))
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
          setClinicSuggestions(suggestions.clinic_suggestions ?? [])
          const clinicList = await invoke<Array<{ id: string; name: string }>>('clinics_list').catch(() => [])
          const firstSuggested = (suggestions.clinic_suggestions ?? [])[0]
          if (firstSuggested) {
            const match = clinicList.find(
              (c) => c.name.toLowerCase() === firstSuggested.name.toLowerCase()
            )
            if (match) {
              setClinicPhase({ kind: 'duplicate', existingId: match.id })
            }
          }
          const actDate = suggestions.activity_date ?? null
          setActivityDate(actDate)
          setTimelineDescription(buildTimelineDescription(actDate, suggestions.contact_suggestions[0] ?? null))
          setExtractedTextPreview(suggestions.extracted_text_preview ?? null)

          for (const tag of [...(suggestions.auto_tags ?? []), ...(suggestions.doctor_candidates ?? []), ...(suggestions.document_tags ?? [])]) {
            const lower = tag.toLowerCase()
            if (!extractedTags.some((t) => t.toLowerCase() === lower)) extractedTags.push(tag)
          }
        } catch (extractionErr: unknown) {
          unlistenRef.current?.()
          unlistenRef.current = null
          setOcrProgress(null)
          const msg =
            extractionErr instanceof Error
              ? extractionErr.message
              : typeof extractionErr === 'string'
                ? extractionErr
                : (extractionErr as Record<string, unknown>)?.message
                    ? String((extractionErr as Record<string, unknown>).message)
                    : JSON.stringify(extractionErr)
          setAnalyzeError(msg)
          setStep('pick')
          return
        }
      }

      setTags(extractedTags.filter(Boolean))
      setStep('review')
    } catch (err: unknown) {
      setAnalyzeError(err instanceof Error ? err.message : String(err))
      setStep('pick')
    }
  }

  async function runBatchQueue(queue: FileQueueItem[], uploadId: string) {
    const collectedIds: string[] = []
    for (const item of queue) {
      setFileQueue((prev) =>
        prev.map((f) => (f.path === item.path ? { ...f, status: 'processing' } : f))
      )
      try {
        const doc = await invoke<Document>('documents_upload', {
          filePath: item.path,
          category: 'lab',
          notes: null,
        })
        const isOcrCandidate =
          doc.mime_type === 'application/pdf' || (doc.mime_type?.startsWith('image/') ?? false)
        if (isOcrCandidate) {
          await invoke('documents_run_extraction', { id: doc.id, emitProgress: false })
        }
        collectedIds.push(doc.id)
        setFileQueue((prev) =>
          prev.map((f) => (f.path === item.path ? { ...f, status: 'done' } : f))
        )
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        setFileQueue((prev) =>
          prev.map((f) =>
            f.path === item.path ? { ...f, status: 'error', errorMessage: msg } : f
          )
        )
      }
    }
    setBatchDocIds(collectedIds)
    setBatchUploadId(uploadId)
    const n = collectedIds.length
    if (n > 0) {
      try {
        const pending = await invoke<number>('get_pending_review_count')
        const entitiesMsg = pending > 0 ? ` — ${pending} entities pending review` : ''
        showToast(`${n} document${n !== 1 ? 's' : ''} uploaded${entitiesMsg}`)
      } catch {
        showToast(`${n} document${n !== 1 ? 's' : ''} uploaded`)
      }
    }
  }

  function handlePaths(paths: string[]) {
    if (paths.length === 0) return
    if (paths.length === 1) {
      void processFile(paths[0]!)
      return
    }
    const uploadId = crypto.randomUUID()
    const queue = paths.map((p) => ({
      path: p,
      filename: p.split('/').pop() ?? p,
      status: 'queued' as FileQueueStatus,
    }))
    setBatchMode(true)
    setFileQueue(queue)
    void runBatchQueue(queue, uploadId)
  }

  async function pickFiles() {
    const selected = await open({
      multiple: true,
      filters: [{ name: 'Documents', extensions: ['pdf', 'jpg', 'jpeg', 'png', 'webp', 'heic', 'tiff'] }],
    })
    if (!selected) return
    const paths = Array.isArray(selected) ? selected : [selected]
    handlePaths(paths)
  }

  function pickFolder() {
    folderInputRef.current?.click()
  }

  function handleDragOver(e: React.DragEvent) { e.preventDefault(); setDragging(true) }
  function handleDragLeave() { setDragging(false) }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const accepted = Array.from(e.dataTransfer.files).filter(
      (f) => f.type === 'application/pdf' || f.type.startsWith('image/')
    )
    if (accepted.length === 0) return
    const paths = accepted
      .map((f) => (f as File & { path?: string }).path)
      .filter((p): p is string => Boolean(p))
    if (paths.length > 0) handlePaths(paths)
  }

  async function handleCancel() {
    if (uploadedDoc) {
      try { await invoke('documents_delete', { id: uploadedDoc.id }) } catch { /* best-effort */ }
    }
    onClose()
  }

  async function handleAcceptCategorySuggestion(suggestion: string) {
    try {
      const id = await invoke<string>('categories_create_if_not_exists', { name: suggestion })
      setSelectedCategoryIds((prev) => prev.includes(id) ? prev : [...prev, id])
    } catch { /* non-fatal */ }
    setCategorySuggestionDismissed(true)
  }

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault()
    if (!uploadedDoc) return
    setConfirming(true)
    setConfirmError(null)
    try {
      const pendingTag = tagInput.trim()
      const finalTags =
        pendingTag && !tags.some((t) => t.toLowerCase() === pendingTag.toLowerCase())
          ? [...tags, pendingTag]
          : tags

      await Promise.all([
        invoke<Document>('documents_update', { id: uploadedDoc.id, category, notes: notes.trim() || null, activityDate: activityDate ?? null }),
        invoke('documents_tags_set', { id: uploadedDoc.id, tags: finalTags }),
        ...selectedCategoryIds.map((categoryId) =>
          invoke('categories_assign_document', { documentId: uploadedDoc.id, categoryId })
        ),
      ])

      const final = await invoke<Document>('documents_get', { id: uploadedDoc.id })
      const unsaved = clinicSuggestions.filter(
        (c) => !dismissedClinics.has(c.name) && clinicPhase.kind !== 'saved',
      )
      const unsavedContacts = contactSuggestions.filter(
        (cs) => !dismissedContacts.has(cs.name) && (contactPhases.get(cs.name) ?? { kind: 'idle' }).kind !== 'saved',
      )
      onUploaded(final, unsaved, unsavedContacts)
      onClose()
    } catch (err: unknown) {
      setConfirmError(err instanceof Error ? err.message : String(err))
    } finally {
      setConfirming(false)
    }
  }

  function addTag(value: string) {
    const trimmed = value.trim()
    if (!trimmed) return
    if (!tags.some((t) => t.toLowerCase() === trimmed.toLowerCase())) {
      setTags((prev) => [...prev, trimmed])
    }
    setTagInput('')
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="upload-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center"
    >
      <div
        className="absolute inset-0 bg-black/50"
        onClick={step === 'pick' ? onClose : undefined}
        aria-hidden="true"
      />

      <div className="relative z-10 flex max-h-[calc(100vh-2rem)] w-full max-w-md flex-col overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-lg)]">
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

        <div className="flex-1 overflow-y-auto">
          {/* ── Step 1: Pick ── */}
          {step === 'pick' && (
            <div className="p-6">
              {analyzeError && (
                <p className="mb-4 rounded-[var(--radius-md)] border border-[var(--color-danger)] px-3 py-2 text-[var(--text-sm)] text-[var(--color-danger)]">
                  {analyzeError}
                </p>
              )}
              {/* Hidden multi-file input */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="sr-only"
                accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.tiff"
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? [])
                  const paths = files
                    .map((f) => (f as File & { path?: string }).path ?? f.name)
                    .filter(Boolean)
                  if (paths.length > 0) handlePaths(paths)
                  e.target.value = ''
                }}
              />
              {/* Hidden folder input */}
              <input
                ref={folderInputRef}
                type="file"
                className="sr-only"
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore – webkitdirectory not in standard typings
                webkitdirectory="true"
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? [])
                  const paths = files
                    .map((f) => (f as File & { path?: string }).path ?? f.name)
                    .filter(Boolean)
                  if (paths.length > 0) handlePaths(paths)
                  e.target.value = ''
                }}
              />
              {/* Drop zone */}
              <div
                data-testid="batch-upload-zone"
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={[
                  'flex w-full flex-col items-center justify-center gap-2 rounded-[var(--radius-lg)] border-2 border-dashed px-4 py-8 text-center transition-colors duration-[var(--duration-fast)]',
                  dragging
                    ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5'
                    : 'border-[var(--color-border)]',
                ].join(' ')}
              >
                <span className="text-3xl">{dragging ? '⬇' : '↑'}</span>
                <span className="text-[var(--text-sm)] font-medium text-[var(--color-text)]">
                  {dragging ? 'Drop files here' : 'Drag files here or use buttons below'}
                </span>
                {!dragging && (
                  <span className="text-[var(--text-xs)] text-[var(--color-text-secondary)]">
                    PDF, JPG, PNG, HEIC, TIFF, WebP
                  </span>
                )}
              </div>
              {/* Select Files / Select Folder button group */}
              <div className="mt-3 flex gap-2">
                <button
                  data-testid="select-files-btn"
                  type="button"
                  onClick={() => void pickFiles()}
                  className="flex-1 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-4 py-2 text-[var(--text-sm)] font-medium text-[var(--color-text)] hover:bg-[var(--color-surface-sunken)]"
                >
                  Select Files
                </button>
                <button
                  data-testid="select-folder-btn"
                  type="button"
                  onClick={pickFolder}
                  className="flex-1 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-4 py-2 text-[var(--text-sm)] font-medium text-[var(--color-text)] hover:bg-[var(--color-surface-sunken)]"
                >
                  Select Folder
                </button>
              </div>
              {/* Batch queue */}
              {batchMode && fileQueue.length > 0 && (
                <ul className="mt-4 flex flex-col gap-1">
                  {fileQueue.map((item) => (
                    <li
                      key={item.path}
                      data-testid="upload-file-row"
                      data-status={item.status}
                      className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-3 py-2 text-[var(--text-sm)]"
                    >
                      <span className="flex-1 truncate text-[var(--color-text)]">{item.filename}</span>
                      <span className="shrink-0">
                        {item.status === 'queued' && (
                          <span className="rounded-full bg-[var(--color-surface-sunken)] px-2 py-0.5 text-[var(--text-xs)] text-[var(--color-text-secondary)]">
                            Queued
                          </span>
                        )}
                        {item.status === 'processing' && (
                          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
                        )}
                        {item.status === 'done' && (
                          <span className="text-green-600 dark:text-green-400">✓</span>
                        )}
                        {item.status === 'error' && (
                          <span className="flex items-center gap-1 text-[var(--color-danger)]">
                            <span>✗</span>
                            {item.errorMessage && (
                              <span className="max-w-[160px] truncate text-[var(--text-xs)]">
                                {item.errorMessage}
                              </span>
                            )}
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
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
            <UploadReviewStep
              uploadedDoc={uploadedDoc}
              category={category} setCategory={setCategory}
              tags={tags} setTags={setTags}
              tagInput={tagInput} setTagInput={setTagInput}
              notes={notes} setNotes={setNotes}
              allCategories={allCategories}
              selectedCategoryIds={selectedCategoryIds} setSelectedCategoryIds={setSelectedCategoryIds}
              categorySuggestion={categorySuggestion}
              categorySuggestionDismissed={categorySuggestionDismissed}
              setCategorySuggestionDismissed={setCategorySuggestionDismissed}
              contactSuggestions={contactSuggestions}
              contactPhases={contactPhases} setContactPhases={setContactPhases}
              dismissedContacts={dismissedContacts} setDismissedContacts={setDismissedContacts}
              clinicSuggestions={clinicSuggestions}
              clinicPhase={clinicPhase} setClinicPhase={setClinicPhase}
              dismissedClinics={dismissedClinics} setDismissedClinics={setDismissedClinics}
              timelineDescription={timelineDescription} setTimelineDescription={setTimelineDescription}
              activityDate={activityDate} setActivityDate={setActivityDate}
              confirming={confirming}
              confirmError={confirmError}
              docCategories={docCategories}
              extractedTextPreview={extractedTextPreview}
              onAcceptCategorySuggestion={(suggestion) => void handleAcceptCategorySuggestion(suggestion)}
              onSubmit={(e) => void handleConfirm(e)}
              addTag={addTag}
            />
          )}
        </div>

        {/* Footer */}
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
      <Toast message={toastMessage} />
    </div>
  )
}

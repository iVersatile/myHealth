'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { invoke } from '@tauri-apps/api/core'
import { Appointment, STATUS_LABELS } from '../../../../store/appointmentsStore'
import { CATEGORY_LABELS } from '../../../../store/documentsStore'
import { CategoryPicker, type Category } from '../../../../components/categories/CategoryPicker'

interface LinkedDocument {
  document_id: string
  filename: string
  category: string
  document_date: string | null
  score: number
  created_at: string
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatApptDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function AppointmentDetailClient() {
  const searchParams = useSearchParams()
  const id = searchParams.get('id') ?? ''
  const router = useRouter()

  const [appt, setAppt] = useState<Appointment | null>(null)
  const [linkedDocs, setLinkedDocs] = useState<LinkedDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [unlinking, setUnlinking] = useState<string | null>(null)

  const [allCategories, setAllCategories] = useState<Category[]>([])
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([])

  const [linkedNotes, setLinkedNotes] = useState<Array<{ id: string; title: string }>>([])

  const [summary, setSummary] = useState<string[] | null>(null)
  const [summarizing, setSummarizing] = useState(false)
  const [summaryError, setSummaryError] = useState<string | null>(null)
  const [summaryOpen, setSummaryOpen] = useState(false)

  interface Icd10Suggestion {
    code: string
    description: string
    confidence: number
  }
  const [savedTags, setSavedTags] = useState<string[]>([])
  const [suggestions, setSuggestions] = useState<Icd10Suggestion[]>([])
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set())
  const [suggesting, setSuggesting] = useState(false)
  const [suggestError, setSuggestError] = useState<string | null>(null)
  const [savingTags, setSavingTags] = useState(false)

  useEffect(() => {
    if (!id) return
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const [fetchedAppt, fetchedLinks, catRows, assignedIds, fetchedTags, fetchedNotes] = await Promise.all([
          invoke<Appointment>('appointments_get', { id }),
          invoke<LinkedDocument[]>('get_appointment_links', { userId: '', appointmentId: id }),
          invoke<Array<{ id: string; name: string; parent_id: string | null; color_hex: string; is_system: boolean; sort_order: number }>>('categories_list'),
          invoke<string[]>('categories_for_appointment', { appointmentId: id }),
          invoke<string[]>('appointment_tags_get', { appointmentId: id }),
          invoke<Array<{ id: string; title: string }>>('notes_for_entity', { entityType: 'appointment', entityId: id }),
        ])
        setAppt(fetchedAppt)
        setLinkedDocs(fetchedLinks)
        setSavedTags(fetchedTags)
        setLinkedNotes(fetchedNotes)
        setAllCategories(catRows.map(r => ({
          id: r.id,
          name: r.name,
          parentId: r.parent_id,
          colorHex: r.color_hex,
          isSystem: r.is_system,
          sortOrder: r.sort_order,
        })))
        setSelectedCategoryIds(assignedIds)
      } catch (e) {
        setError(String(e))
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [id])

  async function handleUnlink(documentId: string) {
    setUnlinking(documentId)
    try {
      await invoke('unlink_document_from_appointment', {
        userId: '',
        documentId,
        appointmentId: id,
      })
      setLinkedDocs((prev) => prev.filter((d) => d.document_id !== documentId))
    } catch (e) {
      setError(String(e))
    } finally {
      setUnlinking(null)
    }
  }

  async function handleSummarize() {
    setSummarizing(true)
    setSummaryError(null)
    try {
      const sentences = await invoke<string[]>('summarize_appointment_notes', {
        userId: '',
        appointmentId: id,
      })
      setSummary(sentences)
      setSummaryOpen(true)
    } catch (e) {
      setSummaryError(String(e))
    } finally {
      setSummarizing(false)
    }
  }

  async function handleSuggestIcd10() {
    if (!appt) return
    setSuggesting(true)
    setSuggestError(null)
    setSuggestions([])
    setSelectedCodes(new Set())
    try {
      const text = [appt.title, appt.specialty, appt.notes].filter(Boolean).join(' ')
      const results = await invoke<Icd10Suggestion[]>('icd10_suggest', { text })
      setSuggestions(results)
    } catch (e) {
      setSuggestError(String(e))
    } finally {
      setSuggesting(false)
    }
  }

  function toggleSuggestion(code: string) {
    setSelectedCodes((prev) => {
      const next = new Set(prev)
      if (next.has(code)) next.delete(code)
      else next.add(code)
      return next
    })
  }

  async function handleSaveTags() {
    const merged = Array.from(new Set([...savedTags, ...Array.from(selectedCodes)]))
    setSavingTags(true)
    try {
      await invoke('appointment_tags_set', { appointmentId: id, tags: merged })
      setSavedTags(merged)
      setSuggestions([])
      setSelectedCodes(new Set())
    } catch (e) {
      setSuggestError(String(e))
    } finally {
      setSavingTags(false)
    }
  }

  async function handleRemoveTag(tag: string) {
    const next = savedTags.filter((t) => t !== tag)
    try {
      await invoke('appointment_tags_set', { appointmentId: id, tags: next })
      setSavedTags(next)
    } catch (e) {
      setError(String(e))
    }
  }

  async function handleCategoryChange(nextIds: string[]) {
    const toAdd = nextIds.filter(cid => !selectedCategoryIds.includes(cid))
    const toRemove = selectedCategoryIds.filter(cid => !nextIds.includes(cid))
    try {
      await Promise.all([
        ...toAdd.map(categoryId =>
          invoke('assign_category_to_appointment', { userId: '', appointmentId: id, categoryId })
        ),
        ...toRemove.map(categoryId =>
          invoke('unassign_category_from_appointment', { userId: '', appointmentId: id, categoryId })
        ),
      ])
      setSelectedCategoryIds(nextIds)
    } catch (e) {
      setError(String(e))
    }
  }

  if (!id) {
    return (
      <div className="p-8 text-[var(--color-text-secondary)]">
        No appointment selected.{' '}
        <Link href="/appointments" className="text-[var(--color-accent)] underline">
          Back to appointments
        </Link>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="p-8 text-[var(--color-text-secondary)]" aria-label="Loading appointment">
        Loading…
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8 text-[var(--color-danger)]" role="alert">
        {error}
      </div>
    )
  }

  if (!appt) {
    return (
      <div className="p-8 text-[var(--color-text-secondary)]">
        Appointment not found.{' '}
        <Link href="/appointments" className="text-[var(--color-accent)] underline">
          Back to appointments
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      {/* Back nav */}
      <button
        type="button"
        onClick={() => router.back()}
        className="text-[var(--text-sm)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
      >
        ← Back
      </button>

      {/* Appointment header */}
      <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-6 shadow-[var(--shadow-sm)]">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h1 className="text-[var(--text-2xl)] font-bold text-[var(--color-text)]">{appt.title}</h1>
          <span className="rounded-full bg-[var(--color-accent-muted)] px-3 py-0.5 text-[var(--text-sm)] font-medium text-[var(--color-accent)]">
            {STATUS_LABELS[appt.status]}
          </span>
        </div>

        <dl className="mt-4 grid grid-cols-1 gap-3 text-[var(--text-sm)] sm:grid-cols-2">
          <div>
            <dt className="text-[var(--color-text-secondary)]">Date &amp; Time</dt>
            <dd className="font-medium text-[var(--color-text)]">{formatApptDate(appt.appt_date)}</dd>
          </div>
          {appt.doctor_name && (
            <div>
              <dt className="text-[var(--color-text-secondary)]">Doctor</dt>
              <dd className="font-medium text-[var(--color-text)]">{appt.doctor_name}</dd>
            </div>
          )}
          {appt.clinic_name && (
            <div>
              <dt className="text-[var(--color-text-secondary)]">Clinic</dt>
              <dd className="font-medium text-[var(--color-text)]">{appt.clinic_name}</dd>
            </div>
          )}
          {appt.specialty && (
            <div>
              <dt className="text-[var(--color-text-secondary)]">Specialty</dt>
              <dd className="font-medium text-[var(--color-text)]">{appt.specialty}</dd>
            </div>
          )}
          {appt.location && (
            <div>
              <dt className="text-[var(--color-text-secondary)]">Location</dt>
              <dd className="font-medium text-[var(--color-text)]">{appt.location}</dd>
            </div>
          )}
          {appt.duration_min > 0 && (
            <div>
              <dt className="text-[var(--color-text-secondary)]">Duration</dt>
              <dd className="font-medium text-[var(--color-text)]">{appt.duration_min} min</dd>
            </div>
          )}
        </dl>

        {appt.notes && (
          <div className="mt-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[var(--text-sm)] text-[var(--color-text-secondary)]">Notes</p>
              <button
                type="button"
                onClick={() => void handleSummarize()}
                disabled={summarizing}
                className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-2 py-0.5 text-[var(--text-xs)] text-[var(--color-accent)] transition-colors duration-[var(--duration-fast)] hover:bg-[var(--color-accent-muted)] disabled:opacity-50"
              >
                {summarizing ? 'Summarizing…' : 'Summarize Notes'}
              </button>
            </div>
            <p className="mt-1 whitespace-pre-wrap text-[var(--text-sm)] text-[var(--color-text)]">{appt.notes}</p>

            {summaryError && (
              <p className="mt-2 text-[var(--text-xs)] text-[var(--color-danger)]" role="alert">
                {summaryError}
              </p>
            )}

            {summary !== null && (
              <div className="mt-3">
                <button
                  type="button"
                  aria-expanded={summaryOpen}
                  onClick={() => setSummaryOpen((o) => !o)}
                  className="flex items-center gap-1 text-[var(--text-xs)] font-medium text-[var(--color-accent)] hover:underline"
                >
                  <span>{summaryOpen ? '▾' : '▸'}</span>
                  <span>AI Summary ({summary.length} key {summary.length === 1 ? 'point' : 'points'})</span>
                </button>
                {summaryOpen && (
                  <ul
                    aria-label="Appointment notes summary"
                    className="mt-2 space-y-1.5 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-sunken)] p-3"
                  >
                    {summary.map((sentence, i) => (
                      <li key={i} className="flex gap-2 text-[var(--text-sm)] text-[var(--color-text)]">
                        <span className="mt-0.5 shrink-0 text-[var(--color-accent)]">•</span>
                        <span>{sentence}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Medical categories */}
      {allCategories.length > 0 && (
        <section aria-label="Medical categories">
          <h2 className="mb-3 text-[var(--text-lg)] font-semibold text-[var(--color-text)]">
            Medical Categories
          </h2>
          <CategoryPicker
            categories={allCategories}
            selectedIds={selectedCategoryIds}
            onChange={(ids) => void handleCategoryChange(ids)}
          />
        </section>
      )}

      {/* ICD-10 tags */}
      <section aria-label="ICD-10 medical codes">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-[var(--text-lg)] font-semibold text-[var(--color-text)]">
            ICD-10 Codes
          </h2>
          <button
            type="button"
            onClick={() => void handleSuggestIcd10()}
            disabled={suggesting || !appt?.notes}
            className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-1 text-[var(--text-xs)] text-[var(--color-accent)] transition-colors duration-[var(--duration-fast)] hover:bg-[var(--color-accent-muted)] disabled:opacity-50"
          >
            {suggesting ? 'Suggesting…' : 'Suggest ICD-10 Codes'}
          </button>
        </div>

        {savedTags.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {savedTags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-3 py-1 text-[var(--text-xs)] font-medium text-[var(--color-text)]"
              >
                {tag}
                <button
                  type="button"
                  aria-label={`Remove tag ${tag}`}
                  onClick={() => void handleRemoveTag(tag)}
                  className="text-[var(--color-text-secondary)] hover:text-[var(--color-danger)]"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        {suggestError && (
          <p className="mb-2 text-[var(--text-xs)] text-[var(--color-danger)]" role="alert">
            {suggestError}
          </p>
        )}

        {suggestions.length > 0 && (
          <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-4">
            <p className="mb-3 text-[var(--text-sm)] font-medium text-[var(--color-text)]">
              Select codes to add:
            </p>
            <ul className="space-y-2">
              {suggestions.map((s) => (
                <li key={s.code} className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id={`icd-${s.code}`}
                    checked={selectedCodes.has(s.code)}
                    onChange={() => toggleSuggestion(s.code)}
                    className="mt-0.5 h-4 w-4 cursor-pointer accent-[var(--color-accent)]"
                  />
                  <label htmlFor={`icd-${s.code}`} className="cursor-pointer text-[var(--text-sm)] text-[var(--color-text)]">
                    <span className="font-mono font-semibold text-[var(--color-accent)]">{s.code}</span>
                    {' — '}
                    {s.description}
                    <span className="ml-2 text-[var(--text-xs)] text-[var(--color-text-secondary)]">
                      ({Math.round(s.confidence * 100)}%)
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => void handleSaveTags()}
              disabled={savingTags || selectedCodes.size === 0}
              className="mt-4 rounded-[var(--radius-sm)] bg-[var(--color-accent)] px-4 py-1.5 text-[var(--text-sm)] font-medium text-white transition-opacity duration-[var(--duration-fast)] hover:opacity-90 disabled:opacity-50"
            >
              {savingTags ? 'Saving…' : `Accept ${selectedCodes.size} Code${selectedCodes.size !== 1 ? 's' : ''}`}
            </button>
          </div>
        )}

        {suggestions.length === 0 && savedTags.length === 0 && !suggesting && (
          <p className="text-[var(--text-sm)] text-[var(--color-text-secondary)]">
            No ICD-10 codes added yet. Click &quot;Suggest ICD-10 Codes&quot; to get suggestions from the appointment notes.
          </p>
        )}
      </section>

      {/* Linked notes */}
      <section aria-label="Linked notes">
        <h2 className="mb-3 text-[var(--text-lg)] font-semibold text-[var(--color-text)]">
          Linked Notes
          {linkedNotes.length > 0 && (
            <span className="ml-2 text-[var(--text-sm)] font-normal text-[var(--color-text-secondary)]">
              ({linkedNotes.length})
            </span>
          )}
        </h2>
        {linkedNotes.length === 0 ? (
          <p className="text-[var(--text-sm)] text-[var(--color-text-secondary)]">
            No notes linked yet. Open a note and link it to this appointment.
          </p>
        ) : (
          <ul className="space-y-2">
            {linkedNotes.map((note) => (
              <li key={note.id}>
                <Link
                  href={`/notes/view?id=${note.id}`}
                  className="block rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-4 py-3 text-[var(--text-sm)] font-medium text-[var(--color-accent)] hover:underline"
                >
                  {note.title || 'Untitled'}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Linked documents */}
      <section aria-label="Linked documents">
        <h2 className="mb-3 text-[var(--text-lg)] font-semibold text-[var(--color-text)]">
          Linked Documents
          {linkedDocs.length > 0 && (
            <span className="ml-2 text-[var(--text-sm)] font-normal text-[var(--color-text-secondary)]">
              ({linkedDocs.length})
            </span>
          )}
        </h2>

        {linkedDocs.length === 0 ? (
          <p className="text-[var(--text-sm)] text-[var(--color-text-secondary)]">
            No documents linked yet. Open a document and link it to this appointment.
          </p>
        ) : (
          <ul className="space-y-3">
            {linkedDocs.map((doc) => (
              <li
                key={doc.document_id}
                className="flex items-start justify-between gap-4 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-4"
              >
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/documents/view?id=${doc.document_id}`}
                    className="truncate text-[var(--text-sm)] font-medium text-[var(--color-accent)] hover:underline"
                  >
                    {doc.filename}
                  </Link>
                  <p className="mt-0.5 text-[var(--text-xs)] text-[var(--color-text-secondary)]">
                    {(CATEGORY_LABELS as Record<string, string>)[doc.category] ?? doc.category}
                    {doc.document_date && ` · ${formatDate(doc.document_date)}`}
                  </p>
                  <p className="mt-0.5 text-[var(--text-xs)] text-[var(--color-text-secondary)]">
                    Score: {doc.score}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label={`Unlink ${doc.filename}`}
                  disabled={unlinking === doc.document_id}
                  onClick={() => void handleUnlink(doc.document_id)}
                  className="shrink-0 rounded-[var(--radius-sm)] border border-[var(--color-border)] px-2 py-1 text-[var(--text-xs)] text-[var(--color-danger)] transition-colors duration-[var(--duration-fast)] hover:bg-[var(--color-surface-sunken)] disabled:opacity-50"
                >
                  {unlinking === doc.document_id ? '…' : 'Unlink'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

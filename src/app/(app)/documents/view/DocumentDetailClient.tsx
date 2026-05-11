'use client'

import { useEffect, useState } from 'react'
import { confirm } from '@tauri-apps/plugin-dialog'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { invoke, convertFileSrc } from '@tauri-apps/api/core'
import { Document, CATEGORY_LABELS } from '../../../../store/documentsStore'
import { ENTITY_CONFIG } from '../../../../lib/entities'
import { CategoryPicker, type Category } from '../../../../components/categories/CategoryPicker'
import type { Appointment } from '../../../../store/appointmentsStore'
import type { Note } from '../../../../store/notesStore'
import { useToast } from '../../../../hooks/useToast'
import { Toast } from '../../../../components/shared/Toast'
import { downloadReport, type ReportData } from '../../../../components/documents/DocumentReport'

interface DocumentEntity {
  id: string
  document_id: string
  entity_type: string
  name: string
  value: string | null
  unit: string | null
  raw_text: string
  created_at: string
}

interface DocumentLink {
  id: string
  document_id: string
  appointment_id: string
  link_type: string
  confidence: string
  created_at: string
}

interface LinkSuggestion {
  appointment_id: string
  appointment_title: string
  score: number
  reasons: string[]
}

interface Clinic {
  id: string
  name: string
  address: string | null
  phone: string | null
  created_at: string
  company_registration_number: string | null
}

interface Symptom {
  id: string
  name: string
  severity: number | null
  onset_date: string | null
  notes: string | null
  deleted_at: string | null
  created_at: string
  updated_at: string
}

interface Medication {
  id: string
  name: string
  dosage: string | null
  frequency: string | null
  start_date: string | null
  end_date: string | null
  notes: string | null
  deleted_at: string | null
  created_at: string
  updated_at: string
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function DocumentDetailClient() {
  const searchParams = useSearchParams()
  const id = searchParams.get('id') ?? ''
  const router = useRouter()

  const { message: toastMessage, show: showToast } = useToast()
  const [doc, setDoc] = useState<Document | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [tags, setTags] = useState<string[]>([])
  const [newTag, setNewTag] = useState('')
  const [notes, setNotes] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)
  const [notesSaved, setNotesSaved] = useState(false)
  const [savingTags, setSavingTags] = useState(false)
  const [activityDate, setActivityDate] = useState('')
  const [savingActivityDate, setSavingActivityDate] = useState(false)
  const [activityDateSaved, setActivityDateSaved] = useState(false)

  const [allCategories, setAllCategories] = useState<Category[]>([])
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([])

  const [links, setLinks] = useState<DocumentLink[]>([])
  const [allAppointments, setAllAppointments] = useState<Appointment[]>([])
  const [selectedApptId, setSelectedApptId] = useState('')
  const [linkingAppt, setLinkingAppt] = useState(false)

  const [clinicEntityExists, setClinicEntityExists] = useState<boolean | null>(null)
  const [savingClinic, setSavingClinic] = useState(false)
  const [clinicSaveError, setClinicSaveError] = useState<string | null>(null)

  const [suggestions, setSuggestions] = useState<LinkSuggestion[]>([])
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set())
  const [linkedNotes, setLinkedNotes] = useState<Note[]>([])
  const [entities, setEntities] = useState<DocumentEntity[]>([])

  const [linkedSymptoms, setLinkedSymptoms] = useState<Symptom[]>([])
  const [allSymptoms, setAllSymptoms] = useState<Symptom[]>([])
  const [selectedSymptomId, setSelectedSymptomId] = useState('')

  const [linkedMedications, setLinkedMedications] = useState<Medication[]>([])
  const [allMedications, setAllMedications] = useState<Medication[]>([])
  const [selectedMedicationId, setSelectedMedicationId] = useState('')
  const [exportingReport, setExportingReport] = useState(false)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const [fetched, catRows, assignedIds, existingLinks, appts, scored, fetchedNotes, fetchedEntities, fetchedSymptoms, fetchedMedications, allSym, allMed] = await Promise.all([
          invoke<Document>('documents_get', { id }),
          invoke<
            Array<{
              id: string
              name: string
              parent_id: string | null
              color_hex: string
              is_system: boolean
              sort_order: number
            }>
          >('categories_list'),
          invoke<string[]>('categories_for_document', { documentId: id }),
          invoke<DocumentLink[]>('links_list_for_document', { documentId: id }),
          invoke<Appointment[]>('appointments_list', { month: null, status: null }),
          invoke<LinkSuggestion[]>('links_score_candidates', { documentId: id }),
          invoke<Note[]>('notes_for_entity', { entityType: 'document', entityId: id }),
          invoke<DocumentEntity[]>('document_entities_get', { documentId: id }),
          invoke<Symptom[]>('symptoms_for_entity', { entityType: 'document', entityId: id }),
          invoke<Medication[]>('medications_for_entity', { entityType: 'document', entityId: id }),
          invoke<Symptom[]>('symptoms_list'),
          invoke<Medication[]>('medications_list'),
        ])
        setDoc(fetched)
        setTags(fetched.tags)
        setNotes(fetched.notes ?? '')
        setActivityDate(fetched.activity_date?.slice(0, 10) ?? '')
        if (fetched.clinic_name) {
          const allClinics = await invoke<Clinic[]>('clinics_list')
          const match = allClinics.some((c) => c.name.toLowerCase() === fetched.clinic_name!.toLowerCase())
          setClinicEntityExists(match)
        }
        setAllCategories(
          catRows.map((r) => ({
            id: r.id,
            name: r.name,
            parentId: r.parent_id,
            colorHex: r.color_hex,
            isSystem: r.is_system,
            sortOrder: r.sort_order,
          }))
        )
        setSelectedCategoryIds(assignedIds)
        setLinks(existingLinks)
        setAllAppointments(appts)
        setSuggestions(scored)
        setLinkedNotes(fetchedNotes)
        setEntities(fetchedEntities)
        setLinkedSymptoms(fetchedSymptoms)
        setLinkedMedications(fetchedMedications)
        setAllSymptoms(allSym.filter((s) => !s.deleted_at))
        setAllMedications(allMed.filter((m) => !m.deleted_at))
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [id])

  async function handleSaveClinicEntity() {
    if (!doc?.clinic_name) return
    setSavingClinic(true)
    setClinicSaveError(null)
    try {
      await invoke('clinics_create_if_not_exists', {
        name: doc.clinic_name,
        address: null,
        phone: null,
        companyRegistrationNumber: null,
        addresses: [],
      })
      setClinicEntityExists(true)
    } catch {
      setClinicSaveError('Failed to create clinic. Please try again.')
    } finally {
      setSavingClinic(false)
    }
  }

  async function handleSaveActivityDate() {
    if (!doc) return
    setSavingActivityDate(true)
    try {
      await invoke('documents_update', {
        id: doc.id,
        activityDate: activityDate || null,
      })
      setDoc({ ...doc, activity_date: activityDate || null })
      setActivityDateSaved(true)
      setTimeout(() => setActivityDateSaved(false), 2000)
    } finally {
      setSavingActivityDate(false)
    }
  }

  async function handleSaveNotes() {
    if (!doc) return
    setSavingNotes(true)
    try {
      await invoke('documents_update', { id: doc.id, notes: notes.trim() || null })
      setNotesSaved(true)
      setTimeout(() => setNotesSaved(false), 2000)
    } finally {
      setSavingNotes(false)
    }
  }

  async function handleAddTag() {
    const tag = newTag.trim()
    if (!tag || !doc || tags.includes(tag)) return
    const next = [...tags, tag]
    setSavingTags(true)
    try {
      await invoke('documents_tags_set', { id: doc.id, tags: next })
      setTags(next)
      setNewTag('')
    } finally {
      setSavingTags(false)
    }
  }

  async function handleRemoveTag(tag: string) {
    if (!doc) return
    const next = tags.filter((t) => t !== tag)
    setSavingTags(true)
    try {
      await invoke('documents_tags_set', { id: doc.id, tags: next })
      setTags(next)
    } finally {
      setSavingTags(false)
    }
  }

  async function handleCategoryChange(nextIds: string[]) {
    if (!doc) return
    const toAdd = nextIds.filter((id) => !selectedCategoryIds.includes(id))
    const toRemove = selectedCategoryIds.filter((id) => !nextIds.includes(id))
    try {
      await Promise.all([
        ...toAdd.map((categoryId) =>
          invoke('assign_category_to_document', { userId: '', documentId: doc.id, categoryId })
        ),
        ...toRemove.map((categoryId) =>
          invoke('unassign_category_from_document', { userId: '', documentId: doc.id, categoryId })
        ),
      ])
      setSelectedCategoryIds(nextIds)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function handleLinkAppointment() {
    if (!doc || !selectedApptId) return
    setLinkingAppt(true)
    try {
      const link = await invoke<DocumentLink>('links_create', {
        input: {
          document_id: doc.id,
          appointment_id: selectedApptId,
          link_type: 'related',
          confidence: 'manual',
        },
      })
      setLinks((prev) => [...prev, link])
      setSelectedApptId('')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLinkingAppt(false)
    }
  }

  async function handleUnlinkAppointment(linkId: string) {
    try {
      await invoke('links_delete', { id: linkId })
      setLinks((prev) => prev.filter((l) => l.id !== linkId))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function handleLinkSymptom() {
    if (!doc || !selectedSymptomId) return
    try {
      await invoke('symptom_link', { symptomId: selectedSymptomId, toType: 'document', toId: doc.id })
      const refreshed = await invoke<Symptom[]>('symptoms_for_entity', { entityType: 'document', entityId: doc.id })
      setLinkedSymptoms(refreshed)
      setSelectedSymptomId('')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function handleUnlinkSymptom(symptomId: string) {
    if (!doc) return
    try {
      await invoke('symptom_unlink', { symptomId, toType: 'document', toId: doc.id })
      setLinkedSymptoms((prev) => prev.filter((s) => s.id !== symptomId))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function handleLinkMedication() {
    if (!doc || !selectedMedicationId) return
    try {
      await invoke('medication_link', { medicationId: selectedMedicationId, toType: 'document', toId: doc.id })
      const refreshed = await invoke<Medication[]>('medications_for_entity', { entityType: 'document', entityId: doc.id })
      setLinkedMedications(refreshed)
      setSelectedMedicationId('')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function handleUnlinkMedication(medicationId: string) {
    if (!doc) return
    try {
      await invoke('medication_unlink', { medicationId, toType: 'document', toId: doc.id })
      setLinkedMedications((prev) => prev.filter((m) => m.id !== medicationId))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function handleConfirmSuggestion(suggestion: LinkSuggestion) {
    if (!doc) return
    try {
      await invoke('link_document_to_appointment', {
        userId: '',
        documentId: doc.id,
        appointmentId: suggestion.appointment_id,
        score: suggestion.score,
      })
      const refreshed = await invoke<DocumentLink[]>('links_list_for_document', {
        documentId: doc.id,
      })
      setLinks(refreshed)
      setSuggestions((prev) => prev.filter((s) => s.appointment_id !== suggestion.appointment_id))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  function handleDismissSuggestion(appointmentId: string) {
    setDismissedIds((prev) => new Set([...prev, appointmentId]))
  }

  async function handleExportReport() {
    if (!doc) return
    setExportingReport(true)
    try {
      const data = await invoke<ReportData>('documents_export_report', { documentId: doc.id })
      await downloadReport(data)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setExportingReport(false)
    }
  }

  async function handleDelete() {
    if (!doc) return
    if (!await confirm(`Delete "${doc.filename}"? This can be undone from the trash.`)) return
    showToast('Moved to Trash')
    await invoke('documents_delete', { id: doc.id })
    router.push('/documents')
  }

  async function openInFinder() {
    if (!doc) return
    await invoke('documents_get_file_url', { id: doc.id })
  }

  if (loading) {
    return (
      <p className="py-16 text-center text-[var(--text-sm)] text-[var(--color-text-secondary)]">
        Loading…
      </p>
    )
  }

  if (error || !doc) {
    return (
      <p className="rounded-[var(--radius-md)] border border-[var(--color-danger)] px-4 py-3 text-[var(--text-sm)] text-[var(--color-danger)]">
        {error ?? 'Document not found.'}
      </p>
    )
  }

  const isPdf = doc.mime_type === 'application/pdf'
  const isImage = doc.mime_type.startsWith('image/')
  const assetUrl = convertFileSrc(doc.file_path)
  const catLabel = CATEGORY_LABELS[doc.category as keyof typeof CATEGORY_LABELS] ?? doc.category

  return (
    <div>
      <div className="mb-5 flex items-center gap-2 text-[var(--text-sm)] text-[var(--color-text-secondary)]">
        <Link href="/documents" className="hover:text-[var(--color-text)]">
          ◀ Documents
        </Link>
        <span>/</span>
        <span className="truncate text-[var(--color-text)]">{doc.filename}</span>
      </div>

      <div className="flex gap-6">
        <div className="flex min-h-[480px] flex-1 flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-raised)]">
          {isPdf && (
            <iframe
              src={assetUrl}
              title={doc.filename}
              className="h-[600px] w-full rounded-[var(--radius-lg)]"
            />
          )}
          {isImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={assetUrl}
              alt={doc.filename}
              className="h-full max-h-[600px] w-full rounded-[var(--radius-lg)] object-contain"
            />
          )}
          {!isPdf && !isImage && (
            <div className="flex flex-1 items-center justify-center p-8 text-[var(--color-text-secondary)]">
              <p className="text-[var(--text-sm)]">Preview not available for this file type.</p>
            </div>
          )}
          <div className="border-t border-[var(--color-border)] px-4 py-3">
            <button
              type="button"
              onClick={() => void openInFinder()}
              className="text-[var(--text-sm)] text-[var(--color-primary)] hover:underline"
            >
              ↓ Open in Finder
            </button>
          </div>
        </div>

        <aside className="w-64 shrink-0 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-5">
          <h2 className="mb-4 text-[var(--text-base)] font-semibold text-[var(--color-text)]">
            Details
          </h2>
          <dl className="flex flex-col gap-3 text-[var(--text-sm)]">
            <div>
              <dt className="text-[var(--color-text-secondary)]">Category</dt>
              <dd className="font-medium text-[var(--color-text)]">{catLabel}</dd>
            </div>
            {doc.clinic_name && (
              <div>
                <dt className="text-[var(--color-text-secondary)]">Clinic</dt>
                <dd className="font-medium text-[var(--color-text)]">{doc.clinic_name}</dd>
                {clinicEntityExists === false && (
                  <div className="mt-1 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] p-2">
                    <p className="mb-1 text-[var(--text-xs)] text-[var(--color-text-secondary)]">Not saved as a clinic yet</p>
                    {clinicSaveError && (
                      <p className="mb-1 text-[var(--text-xs)] text-red-500">{clinicSaveError}</p>
                    )}
                    <button
                      type="button"
                      data-testid="detail-save-clinic-btn"
                      disabled={savingClinic}
                      onClick={() => void handleSaveClinicEntity()}
                      className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-2 py-1 text-[var(--text-xs)] text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] disabled:opacity-40"
                    >
                      {savingClinic ? 'Saving…' : 'Save as Clinic'}
                    </button>
                  </div>
                )}
              </div>
            )}
            <div>
              <dt className="text-[var(--color-text-secondary)]">Uploaded</dt>
              <dd className="font-medium text-[var(--color-text)]">{formatDate(doc.created_at)}</dd>
            </div>
            <div>
              <dt className="mb-1 text-[var(--color-text-secondary)]">Activity Date</dt>
              <dd className="flex gap-1">
                <input
                  type="date"
                  data-testid="detail-activity-date-input"
                  value={activityDate}
                  onChange={(e) => setActivityDate(e.target.value)}
                  className="min-w-0 flex-1 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-[var(--text-xs)] text-[var(--color-text)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                />
                <button
                  type="button"
                  data-testid="detail-activity-date-save"
                  disabled={savingActivityDate}
                  onClick={() => void handleSaveActivityDate()}
                  className="shrink-0 rounded-[var(--radius-sm)] border border-[var(--color-border)] px-2 py-1 text-[var(--text-xs)] text-[var(--color-text)] disabled:opacity-40 hover:bg-[var(--color-surface-sunken)]"
                >
                  {activityDateSaved ? '✓' : 'Set'}
                </button>
              </dd>
            </div>
            <div>
              <dt className="text-[var(--color-text-secondary)]">Size</dt>
              <dd className="font-medium text-[var(--color-text)]">
                {formatBytes(doc.file_size_bytes)}
              </dd>
            </div>
          </dl>

          <hr className="my-4 border-[var(--color-border)]" />

          {allCategories.length > 0 && (
            <>
              <div className="mb-4">
                <p className="mb-2 text-[var(--text-sm)] font-medium text-[var(--color-text)]">
                  Medical Categories
                </p>
                <CategoryPicker
                  categories={allCategories}
                  selectedIds={selectedCategoryIds}
                  onChange={(ids) => void handleCategoryChange(ids)}
                />
              </div>

              <hr className="my-4 border-[var(--color-border)]" />
            </>
          )}

          <div className="mb-4">
            <p className="mb-2 text-[var(--text-sm)] font-medium text-[var(--color-text)]">
              Linked Appointments
            </p>
            {links.length > 0 && (
              <ul className="mb-2 flex flex-col gap-1">
                {links.map((link) => {
                  const appt = allAppointments.find((a) => a.id === link.appointment_id)
                  return (
                    <li key={link.id} className="flex items-center justify-between gap-1">
                      <span className="truncate text-[var(--text-xs)] text-[var(--color-text)]">
                        {appt?.title ?? link.appointment_id}
                      </span>
                      <button
                        type="button"
                        aria-label="Unlink appointment"
                        onClick={() => void handleUnlinkAppointment(link.id)}
                        className="shrink-0 text-[var(--text-xs)] text-[var(--color-text-secondary)] hover:text-[var(--color-danger)]"
                      >
                        ✕
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
            {(() => {
              const linkedIds = new Set(links.map((l) => l.appointment_id))
              const unlinkable = allAppointments.filter((a) => !linkedIds.has(a.id))
              if (unlinkable.length === 0) return null
              return (
                <div className="flex gap-1">
                  <select
                    value={selectedApptId}
                    onChange={(e) => setSelectedApptId(e.target.value)}
                    className="min-w-0 flex-1 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-[var(--text-xs)] text-[var(--color-text)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                  >
                    <option value="">Select appointment…</option>
                    {unlinkable.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.title}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={linkingAppt || !selectedApptId}
                    onClick={() => void handleLinkAppointment()}
                    className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-2 py-1 text-[var(--text-xs)] text-[var(--color-text)] disabled:opacity-40 hover:bg-[var(--color-surface-sunken)]"
                  >
                    Link
                  </button>
                </div>
              )
            })()}
          </div>

          <div className="mb-4">
            <p className="mb-2 text-[var(--text-sm)] font-medium text-[var(--color-text)]">
              Linked Symptoms
            </p>
            {linkedSymptoms.length > 0 && (
              <ul className="mb-2 flex flex-col gap-1">
                {linkedSymptoms.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-1">
                    <span className="truncate text-[var(--text-xs)] text-[var(--color-text)]">
                      {s.name}
                    </span>
                    <button
                      type="button"
                      aria-label="Unlink symptom"
                      onClick={() => void handleUnlinkSymptom(s.id)}
                      className="shrink-0 text-[var(--text-xs)] text-[var(--color-text-secondary)] hover:text-[var(--color-danger)]"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {(() => {
              const linkedIds = new Set(linkedSymptoms.map((s) => s.id))
              const unlinkable = allSymptoms.filter((s) => !linkedIds.has(s.id))
              if (unlinkable.length === 0) return null
              return (
                <div className="flex gap-1">
                  <select
                    value={selectedSymptomId}
                    onChange={(e) => setSelectedSymptomId(e.target.value)}
                    className="min-w-0 flex-1 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-[var(--text-xs)] text-[var(--color-text)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                  >
                    <option value="">Select symptom…</option>
                    {unlinkable.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={!selectedSymptomId}
                    onClick={() => void handleLinkSymptom()}
                    className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-2 py-1 text-[var(--text-xs)] text-[var(--color-text)] disabled:opacity-40 hover:bg-[var(--color-surface-sunken)]"
                  >
                    Link
                  </button>
                </div>
              )
            })()}
          </div>

          <div className="mb-4">
            <p className="mb-2 text-[var(--text-sm)] font-medium text-[var(--color-text)]">
              Linked Medications
            </p>
            {linkedMedications.length > 0 && (
              <ul className="mb-2 flex flex-col gap-1">
                {linkedMedications.map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-1">
                    <span className="truncate text-[var(--text-xs)] text-[var(--color-text)]">
                      {m.name}
                    </span>
                    <button
                      type="button"
                      aria-label="Unlink medication"
                      onClick={() => void handleUnlinkMedication(m.id)}
                      className="shrink-0 text-[var(--text-xs)] text-[var(--color-text-secondary)] hover:text-[var(--color-danger)]"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {(() => {
              const linkedIds = new Set(linkedMedications.map((m) => m.id))
              const unlinkable = allMedications.filter((m) => !linkedIds.has(m.id))
              if (unlinkable.length === 0) return null
              return (
                <div className="flex gap-1">
                  <select
                    value={selectedMedicationId}
                    onChange={(e) => setSelectedMedicationId(e.target.value)}
                    className="min-w-0 flex-1 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-[var(--text-xs)] text-[var(--color-text)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                  >
                    <option value="">Select medication…</option>
                    {unlinkable.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={!selectedMedicationId}
                    onClick={() => void handleLinkMedication()}
                    className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-2 py-1 text-[var(--text-xs)] text-[var(--color-text)] disabled:opacity-40 hover:bg-[var(--color-surface-sunken)]"
                  >
                    Link
                  </button>
                </div>
              )
            })()}
          </div>

          {(() => {
            const linkedIds = new Set(links.map((l) => l.appointment_id))
            const visible = suggestions.filter(
              (s) => !dismissedIds.has(s.appointment_id) && !linkedIds.has(s.appointment_id)
            )
            if (visible.length === 0) return null
            return (
              <>
                <hr className="my-4 border-[var(--color-border)]" />
                <div className="mb-4">
                  <p className="mb-2 text-[var(--text-sm)] font-medium text-[var(--color-text)]">
                    Suggested Links
                  </p>
                  <ul className="flex flex-col gap-2">
                    {visible.map((s) => (
                      <li
                        key={s.appointment_id}
                        className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] p-2"
                      >
                        <p className="mb-1 truncate text-[var(--text-xs)] font-medium text-[var(--color-text)]">
                          {s.appointment_title}
                        </p>
                        <p className="mb-1 text-[var(--text-xs)] text-[var(--color-text-secondary)]">
                          Score: {s.score}
                        </p>
                        <ul className="mb-1 flex flex-wrap gap-x-2 text-[var(--text-xs)] text-[var(--color-text-secondary)]">
                          {s.reasons.map((r) => (
                            <li key={r}>{r}</li>
                          ))}
                        </ul>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            aria-label="Link suggestion"
                            onClick={() => void handleConfirmSuggestion(s)}
                            className="flex-1 rounded-[var(--radius-sm)] border border-[var(--color-primary)] px-2 py-0.5 text-[var(--text-xs)] text-[var(--color-primary)] hover:bg-[var(--color-surface-sunken)]"
                          >
                            Link
                          </button>
                          <button
                            type="button"
                            aria-label="Not Related"
                            onClick={() => handleDismissSuggestion(s.appointment_id)}
                            className="flex-1 rounded-[var(--radius-sm)] border border-[var(--color-border)] px-2 py-0.5 text-[var(--text-xs)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-sunken)]"
                          >
                            Not Related
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )
          })()}

          <hr className="my-4 border-[var(--color-border)]" />

          <div className="mb-4">
            <p className="mb-2 text-[var(--text-sm)] font-medium text-[var(--color-text)]">Tags</p>
            {tags.length > 0 && (
              <ul className="mb-2 flex flex-wrap gap-1">
                {tags.map((tag) => (
                  <li key={tag} className="flex items-center gap-1">
                    <span className="rounded-full bg-[var(--color-surface-sunken)] px-2 py-0.5 text-[var(--text-xs)] text-[var(--color-text-secondary)]">
                      #{tag}
                    </span>
                    <button
                      type="button"
                      aria-label={`Remove tag ${tag}`}
                      disabled={savingTags}
                      onClick={() => void handleRemoveTag(tag)}
                      className="text-[var(--text-xs)] text-[var(--color-text-secondary)] hover:text-[var(--color-danger)] disabled:opacity-40"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex gap-1">
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    void handleAddTag()
                  }
                }}
                placeholder="Add tag"
                className="min-w-0 flex-1 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-[var(--text-xs)] text-[var(--color-text)] placeholder:text-[var(--color-text-secondary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
              />
              <button
                type="button"
                disabled={savingTags || !newTag.trim()}
                onClick={() => void handleAddTag()}
                className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-2 py-1 text-[var(--text-xs)] text-[var(--color-text)] disabled:opacity-40 hover:bg-[var(--color-surface-sunken)]"
              >
                +
              </button>
            </div>
          </div>

          <hr className="my-4 border-[var(--color-border)]" />

          <div className="mb-4">
            <p className="mb-2 text-[var(--text-sm)] font-medium text-[var(--color-text)]">Notes</p>
            <textarea
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes…"
              className="w-full resize-none rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[var(--text-sm)] text-[var(--color-text)] placeholder:text-[var(--color-text-secondary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
            />
            <button
              type="button"
              disabled={savingNotes}
              onClick={() => void handleSaveNotes()}
              className="mt-2 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] py-1.5 text-[var(--text-sm)] text-[var(--color-text)] transition-colors duration-[var(--duration-fast)] hover:bg-[var(--color-surface-sunken)] disabled:opacity-40"
            >
              {notesSaved ? '✓ Saved' : savingNotes ? 'Saving…' : 'Save Notes'}
            </button>
          </div>

          <hr className="my-4 border-[var(--color-border)]" />

          <div className="mb-4">
            <p className="mb-2 text-[var(--text-sm)] font-medium text-[var(--color-text)]">
              Linked Notes
            </p>
            {linkedNotes.length === 0 ? (
              <div>
                <p className="mb-1 text-[var(--text-xs)] text-[var(--color-text-secondary)]">
                  No linked notes yet.
                </p>
                <Link
                  href={`/notes/new?linkedDocumentId=${id}`}
                  className="text-[var(--text-xs)] text-[var(--color-primary)] hover:underline"
                >
                  + Add Note
                </Link>
              </div>
            ) : (
              <ul className="flex flex-col gap-2">
                {linkedNotes.map((note) => {
                  const snippet = (note.content ?? '')
                    .replace(/<[^>]+>/g, ' ')
                    .replace(/\s+/g, ' ')
                    .trim()
                    .slice(0, 80)
                  return (
                    <li key={note.id}>
                      <Link
                        href={`${ENTITY_CONFIG.note.route}?id=${note.id}`}
                        className="block rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] p-2 hover:border-[var(--color-primary)] transition-colors duration-[var(--duration-fast)]"
                      >
                        <p className="truncate text-[var(--text-xs)] font-medium text-[var(--color-text)]">
                          {note.title || 'Untitled'}
                        </p>
                        {snippet && (
                          <p className="mt-0.5 line-clamp-2 text-[var(--text-xs)] text-[var(--color-text-secondary)]">
                            {snippet}
                          </p>
                        )}
                        <p className="mt-1 text-[var(--text-xs)] text-[var(--color-text-secondary)]">
                          {new Date(note.created_at).toLocaleDateString()}
                        </p>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {doc.extracted_text && (
            <>
              <hr className="my-4 border-[var(--color-border)]" />
              <details className="mb-4" data-testid="detail-extracted-text">
                <summary className="cursor-pointer text-[var(--text-sm)] font-medium text-[var(--color-text)]">
                  Extracted Text
                </summary>
                <p className="mt-2 whitespace-pre-wrap text-[var(--text-xs)] text-[var(--color-text-secondary)]">
                  {doc.extracted_text}
                </p>
              </details>
            </>
          )}

          {entities.length > 0 && (() => {
            const groups: Array<{ label: string; type: string }> = [
              { label: 'Medications', type: 'medication' },
              { label: 'Conditions', type: 'diagnosis' },
              { label: 'Lab Results', type: 'lab_value' },
              { label: 'Referrals', type: 'referral' },
            ]
            return (
              <>
                <hr className="my-4 border-[var(--color-border)]" />
                <div className="mb-4" data-testid="detail-extracted-info">
                  <p className="mb-2 text-[var(--text-sm)] font-medium text-[var(--color-text)]">
                    Extracted Info
                  </p>
                  {groups.map(({ label, type }) => {
                    const group = entities.filter((e) => e.entity_type === type)
                    if (group.length === 0) return null
                    return (
                      <div key={type} className="mb-3">
                        <p className="mb-1 text-[var(--text-xs)] font-medium text-[var(--color-text-secondary)]">
                          {label}
                        </p>
                        <ul className="flex flex-col gap-1">
                          {group.map((e) => (
                            <li key={e.id} className="text-[var(--text-xs)] text-[var(--color-text)]">
                              {e.name}
                              {e.value && (
                                <span className="text-[var(--color-text-secondary)]">
                                  {' '}— {e.value}{e.unit ? ` ${e.unit}` : ''}
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )
                  })}
                </div>
              </>
            )
          })()}

          <hr className="my-4 border-[var(--color-border)]" />

          <button
            type="button"
            onClick={() => router.push(`/notes/new?linkedDocumentId=${id}`)}
            className="mb-2 w-full rounded-[var(--radius-md)] border border-[var(--color-primary)] py-1.5 text-[var(--text-sm)] text-[var(--color-primary)] transition-colors duration-[var(--duration-fast)] hover:bg-[var(--color-surface-sunken)]"
          >
            + Add Note
          </button>

          <button
            type="button"
            data-testid="export-report-btn"
            disabled={exportingReport}
            onClick={() => void handleExportReport()}
            className="mb-2 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] py-1.5 text-[var(--text-sm)] text-[var(--color-text-secondary)] transition-colors duration-[var(--duration-fast)] hover:bg-[var(--color-surface-sunken)] disabled:opacity-40"
          >
            {exportingReport ? 'Generating…' : '↓ Export PDF Report'}
          </button>

          <button
            type="button"
            onClick={() => void handleDelete()}
            className="w-full rounded-[var(--radius-md)] border border-[var(--color-danger)] py-1.5 text-[var(--text-sm)] text-[var(--color-danger)] transition-colors duration-[var(--duration-fast)] hover:bg-[var(--color-surface-sunken)]"
          >
            Delete
          </button>
        </aside>
      </div>
      <Toast message={toastMessage} />
    </div>
  )
}

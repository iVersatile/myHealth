'use client'

import { confirm } from '@tauri-apps/plugin-dialog'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { invoke, convertFileSrc } from '@tauri-apps/api/core'
import { CATEGORY_LABELS } from '../../../../store/documentsStore'
import { ENTITY_CONFIG } from '../../../../lib/entities'
import { CategoryPicker } from '../../../../components/categories/CategoryPicker'
import { useToast } from '../../../../hooks/useToast'
import { Toast } from '../../../../components/shared/Toast'
import { useDocumentDetail } from './useDocumentDetail'

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
  const {
    doc,
    loading,
    error,
    tags,
    newTag,
    setNewTag,
    savingTags,
    handleAddTag,
    handleRemoveTag,
    notes,
    setNotes,
    savingNotes,
    notesSaved,
    handleSaveNotes,
    activityDate,
    setActivityDate,
    savingActivityDate,
    activityDateSaved,
    handleSaveActivityDate,
    allCategories,
    selectedCategoryIds,
    handleCategoryChange,
    links,
    allAppointments,
    selectedApptId,
    setSelectedApptId,
    linkingAppt,
    handleLinkAppointment,
    handleUnlinkAppointment,
    clinicEntityExists,
    savingClinic,
    clinicSaveError,
    handleSaveClinicEntity,
    suggestions,
    dismissedIds,
    handleConfirmSuggestion,
    handleDismissSuggestion,
    linkedNotes,
    entities,
    linkedSymptoms,
    allSymptoms,
    selectedSymptomId,
    setSelectedSymptomId,
    handleLinkSymptom,
    handleUnlinkSymptom,
    linkedMedications,
    allMedications,
    selectedMedicationId,
    setSelectedMedicationId,
    handleLinkMedication,
    handleUnlinkMedication,
    exportingReport,
    handleExportReport,
    icd10Tags,
  } = useDocumentDetail(id)

  async function handleDelete() {
    if (!doc) return
    if (!(await confirm(`Delete "${doc.filename}"? This can be undone from the trash.`))) return
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

          {icd10Tags.length > 0 && (
            <>
              <hr className="my-4 border-[var(--color-border)]" />
              <div className="mb-4" data-testid="icd10-section">
                <p className="mb-2 text-[var(--text-sm)] font-medium text-[var(--color-text)]">
                  ICD-10 Codes
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {icd10Tags.map((tag) => (
                    <span
                      key={tag.code}
                      data-testid="icd10-tag"
                      title={tag.description}
                      className="inline-flex items-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-2 py-0.5 text-[var(--text-xs)] text-[var(--color-text)]"
                    >
                      {tag.code}
                    </span>
                  ))}
                </div>
              </div>
            </>
          )}

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

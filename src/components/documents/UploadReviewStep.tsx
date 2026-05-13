'use client'

import { invoke } from '@tauri-apps/api/core'
import { Document, DocumentCategory, CATEGORY_LABELS } from '../../store/documentsStore'
import { CategoryPicker, Category } from '../categories/CategoryPicker'
import {
  ContactSuggestion,
  ClinicSuggestion,
  ContactPhase,
  ClinicPhase,
  DuplicateCandidate,
  buildTimelineDescription,
} from './uploadTypes'

const fieldCls =
  'rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-3 py-2 text-[var(--text-sm)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]'

interface UploadReviewStepProps {
  uploadedDoc: Document
  category: DocumentCategory
  setCategory: React.Dispatch<React.SetStateAction<DocumentCategory>>
  tags: string[]
  setTags: React.Dispatch<React.SetStateAction<string[]>>
  tagInput: string
  setTagInput: React.Dispatch<React.SetStateAction<string>>
  notes: string
  setNotes: React.Dispatch<React.SetStateAction<string>>
  allCategories: Category[]
  selectedCategoryIds: string[]
  setSelectedCategoryIds: React.Dispatch<React.SetStateAction<string[]>>
  categorySuggestion: string | null
  categorySuggestionDismissed: boolean
  setCategorySuggestionDismissed: React.Dispatch<React.SetStateAction<boolean>>
  contactSuggestions: ContactSuggestion[]
  contactPhases: Map<string, ContactPhase>
  setContactPhases: React.Dispatch<React.SetStateAction<Map<string, ContactPhase>>>
  dismissedContacts: Set<string>
  setDismissedContacts: React.Dispatch<React.SetStateAction<Set<string>>>
  clinicSuggestions: ClinicSuggestion[]
  clinicPhase: ClinicPhase
  setClinicPhase: React.Dispatch<React.SetStateAction<ClinicPhase>>
  dismissedClinics: Set<string>
  setDismissedClinics: React.Dispatch<React.SetStateAction<Set<string>>>
  timelineDescription: string
  setTimelineDescription: React.Dispatch<React.SetStateAction<string>>
  activityDate: string | null
  setActivityDate: React.Dispatch<React.SetStateAction<string | null>>
  confirming: boolean
  confirmError: string | null
  docCategories: string[]
  extractedTextPreview: string | null
  onAcceptCategorySuggestion: (suggestion: string) => void
  onSubmit: (e: React.FormEvent) => void
  addTag: (value: string) => void
}

export function UploadReviewStep({
  uploadedDoc,
  category,
  setCategory,
  tags,
  setTags,
  tagInput,
  setTagInput,
  notes,
  setNotes,
  allCategories,
  selectedCategoryIds,
  setSelectedCategoryIds,
  categorySuggestion,
  categorySuggestionDismissed,
  setCategorySuggestionDismissed,
  contactSuggestions,
  contactPhases,
  setContactPhases,
  dismissedContacts,
  setDismissedContacts,
  clinicSuggestions,
  clinicPhase,
  setClinicPhase,
  dismissedClinics,
  setDismissedClinics,
  timelineDescription,
  setTimelineDescription,
  activityDate,
  setActivityDate,
  confirming: _confirming,
  confirmError,
  docCategories,
  extractedTextPreview,
  onAcceptCategorySuggestion,
  onSubmit,
  addTag,
}: UploadReviewStepProps) {
  const visibleContacts = contactSuggestions.filter((cs) => !dismissedContacts.has(cs.name))
  const visibleClinics = clinicSuggestions.filter((c) => !dismissedClinics.has(c.name))

  return (
    <form
      id="upload-review-form"
      data-testid="upload-review-step"
      onSubmit={onSubmit}
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
            <span className="font-medium text-[var(--color-text)]">{uploadedDoc.document_date}</span>
          </p>
        )}
      </div>

      {/* Category suggestion */}
      {categorySuggestion && !categorySuggestionDismissed && (
        <div
          data-testid="category-suggestion-banner"
          className="flex items-start justify-between gap-2 rounded-[var(--radius-md)] border border-[var(--color-primary)]/30 bg-[var(--color-primary)]/5 px-3 py-2"
        >
          <div className="flex flex-col gap-0.5">
            <p className="text-[var(--text-sm)] font-medium text-[var(--color-text)]">
              {categorySuggestion.split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')}
            </p>
            <p className="text-[var(--text-xs)] text-[var(--color-text-secondary)]">
              Detected from document content
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              data-testid="category-suggestion-accept"
              onClick={() => onAcceptCategorySuggestion(categorySuggestion)}
              className="rounded-[var(--radius-sm)] bg-[var(--color-primary)] px-2 py-0.5 text-[var(--text-xs)] font-medium text-[var(--color-text-inverse)]"
            >
              Accept
            </button>
            <button
              type="button"
              data-testid="category-suggestion-dismiss"
              onClick={() => setCategorySuggestionDismissed(true)}
              className="text-[var(--text-xs)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Contact suggestions */}
      {visibleContacts.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-[var(--text-sm)] font-medium text-[var(--color-text)]">Detected contacts</p>
          {visibleContacts.map((cs) => {
            const phase = contactPhases.get(cs.name) ?? { kind: 'idle' as const }

            function setPhase(p: ContactPhase) {
              setContactPhases((prev) => new Map([...prev, [cs.name, p]]))
            }

            async function autoSaveClinic(personContactId: string) {
              if (!cs.clinic) return
              if (clinicSuggestions.some((c) => c.name === cs.clinic)) return
              setClinicPhase({ kind: 'saving' })
              try {
                const clinic = await invoke<{ id: string }>('clinics_create_if_not_exists', {
                  input: {
                    name: cs.clinic,
                    address: null,
                    phone: null,
                    company_registration_number: null,
                    addresses: [],
                  },
                })
                await invoke('clinics_link_contact', {
                  clinicId: clinic.id,
                  contactId: personContactId,
                })
                await invoke('documents_set_clinic', {
                  documentId: uploadedDoc.id,
                  clinicName: cs.clinic,
                })
                setClinicPhase({ kind: 'saved' })
              } catch {
                setClinicPhase({ kind: 'idle' })
              }
            }

            async function handleSave() {
              setPhase({ kind: 'saving' })
              try {
                const newContact = await invoke<{ id: string }>('contacts_create', {
                  input: { name: cs.name, role: 'other', specialty: cs.specialty, phone: cs.phone, email: cs.email, clinic: cs.clinic, address: cs.address, notes: null },
                })
                const dupes = await invoke<DuplicateCandidate[]>('find_duplicate_contacts', {
                  userId: '', contactId: newContact.id, threshold: 0.85,
                })
                const topDupe = dupes[0]
                if (topDupe) {
                  setPhase({ kind: 'duplicate', newId: newContact.id, match: topDupe })
                } else {
                  await invoke('documents_link_contact', { documentId: uploadedDoc.id, contactId: newContact.id })
                  setPhase({ kind: 'saved', contactId: newContact.id })
                  void autoSaveClinic(newContact.id)
                }
              } catch {
                setPhase({ kind: 'idle' })
              }
            }

            async function handleMerge(newId: string, existingId: string) {
              try {
                await invoke('merge_contacts', { userId: '', primaryId: existingId, duplicateIds: [newId] })
                await invoke('documents_link_contact', { documentId: uploadedDoc.id, contactId: existingId })
              } catch { /* non-fatal */ }
              setPhase({ kind: 'saved', contactId: existingId })
              void autoSaveClinic(existingId)
            }

            async function handleCancelDuplicate(newId: string) {
              try { await invoke('contacts_delete', { id: newId }) } catch { /* best-effort */ }
              setPhase({ kind: 'idle' })
            }

            return (
              <div
                key={cs.name}
                data-testid="contact-suggestion-card"
                className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-3 py-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-col gap-0.5 text-[var(--text-xs)]">
                    <span className="font-medium text-[var(--color-text)]">{cs.name}</span>
                    {cs.specialty && <span className="text-[var(--color-text-secondary)]">{cs.specialty}</span>}
                    {cs.clinic && <span className="text-[var(--color-text-secondary)]">{cs.clinic}</span>}
                    {cs.address && <span className="text-[var(--color-text-secondary)]">{cs.address}</span>}
                    {cs.phone && (
                      <input
                        type="text"
                        readOnly
                        data-testid="contact-suggestion-phone"
                        value={cs.phone}
                        className="bg-transparent text-[var(--color-text-secondary)] focus:outline-none"
                      />
                    )}
                    {cs.email && <span className="text-[var(--color-text-secondary)]">{cs.email}</span>}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    {phase.kind !== 'duplicate' && (
                      <button
                        type="button"
                        data-testid="contact-suggestion-save"
                        disabled={phase.kind === 'saving' || phase.kind === 'saved'}
                        onClick={() => void handleSave()}
                        className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-2 py-1 text-[var(--text-xs)] text-[var(--color-text-secondary)] transition-colors duration-[var(--duration-fast)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] disabled:cursor-default disabled:opacity-40"
                      >
                        {phase.kind === 'saved' ? 'Saved' : phase.kind === 'saving' ? 'Checking…' : 'Save as Contact'}
                      </button>
                    )}
                    {phase.kind === 'idle' && (
                      <button
                        type="button"
                        data-testid="contact-suggestion-dismiss"
                        onClick={() => setDismissedContacts((prev) => new Set([...prev, cs.name]))}
                        className="text-[var(--text-xs)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
                      >
                        Dismiss
                      </button>
                    )}
                  </div>
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
                        data-testid="contact-suggestion-merge"
                        onClick={() => void handleMerge(phase.newId, phase.match.contact.id)}
                        className="rounded-[var(--radius-sm)] bg-[var(--color-primary)] px-2 py-0.5 text-[var(--text-xs)] font-medium text-[var(--color-text-inverse)]"
                      >
                        Merge
                      </button>
                      <button
                        type="button"
                        onClick={() => setPhase({ kind: 'saved', contactId: phase.newId })}
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

      {/* Clinic suggestions */}
      {visibleClinics.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-[var(--text-sm)] font-medium text-[var(--color-text)]">Clinic detected</p>
          {visibleClinics.map((clinic) => {
            async function handleSaveClinic() {
              setClinicPhase({ kind: 'saving' })
              try {
                const result = await invoke<{ id: string }>('clinics_create_if_not_exists', {
                  input: {
                    name: clinic.name,
                    address: null,
                    phone: null,
                    company_registration_number: clinic.company_registration_number ?? null,
                    addresses: clinic.addresses,
                  },
                })
                const savedContactPhase = [...contactPhases.values()].find(
                  (p) => p.kind === 'saved'
                ) as { kind: 'saved'; contactId: string } | undefined
                if (savedContactPhase) {
                  try {
                    await invoke('clinics_link_contact', { clinicId: result.id, contactId: savedContactPhase.contactId })
                  } catch { /* link failure is non-fatal */ }
                }
                try {
                  await invoke('documents_set_clinic', {
                    documentId: uploadedDoc.id,
                    clinicName: clinic.name,
                  })
                } catch {
                  setClinicPhase({ kind: 'error', message: 'Clinic saved but could not be linked to this document' })
                  return
                }
                setClinicPhase({ kind: 'saved' })
              } catch {
                setClinicPhase({ kind: 'idle' })
              }
            }

            return (
              <div
                key={clinic.name}
                data-testid="clinic-suggestion-card"
                className="flex items-start justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-3 py-2"
              >
                <div className="flex flex-col gap-1 text-[var(--text-xs)] min-w-0 flex-1">
                  <span className="font-medium text-[var(--color-text)]">{clinic.name}</span>
                  {clinic.company_registration_number && (
                    <div className="flex items-center gap-1 text-[var(--color-text-secondary)]">
                      <span>Reg:</span>
                      <input
                        type="text"
                        readOnly
                        data-testid="clinic-suggestion-reg-number"
                        value={clinic.company_registration_number}
                        className="bg-transparent focus:outline-none"
                      />
                    </div>
                  )}
                  {clinic.addresses.map((addr, i) => (
                    <div
                      key={i}
                      data-testid="clinic-address-item"
                      className="text-[var(--color-text-secondary)]"
                    >
                      {addr.label ? `${addr.label}: ` : ''}{addr.line1}
                    </div>
                  ))}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {clinicPhase.kind === 'duplicate' ? (
                    <div data-testid="clinic-suggestion-merge" className="flex flex-col items-end gap-1">
                      <span className="text-[var(--text-xs)] text-amber-600">Already exists</span>
                      <button
                        type="button"
                        onClick={async () => {
                          if (clinicPhase.kind !== 'duplicate') return
                          try {
                            await invoke('documents_link_clinic', { documentId: uploadedDoc.id, clinicId: clinicPhase.existingId })
                          } catch { /* ignore */ }
                          setClinicPhase({ kind: 'saved' })
                        }}
                        className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-2 py-1 text-[var(--text-xs)] text-[var(--color-text-secondary)] transition-colors duration-[var(--duration-fast)] hover:border-amber-500 hover:text-amber-600"
                      >
                        Link existing
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        data-testid="clinic-suggestion-save"
                        disabled={clinicPhase.kind === 'saving' || clinicPhase.kind === 'saved'}
                        onClick={() => void handleSaveClinic()}
                        className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-2 py-1 text-[var(--text-xs)] text-[var(--color-text-secondary)] transition-colors duration-[var(--duration-fast)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] disabled:cursor-default disabled:opacity-40"
                      >
                        {clinicPhase.kind === 'saved' ? 'Saved' : clinicPhase.kind === 'saving' ? 'Saving…' : 'Save as Clinic'}
                      </button>
                      {clinicPhase.kind === 'error' && (
                        <span className="text-[var(--text-xs)] text-red-500">{clinicPhase.message}</span>
                      )}
                      {clinicPhase.kind === 'idle' && (
                        <button
                          type="button"
                          data-testid="clinic-suggestion-dismiss"
                          onClick={() => setDismissedClinics((prev) => new Set([...prev, clinic.name]))}
                          className="text-[var(--text-xs)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
                        >
                          Dismiss
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Activity date */}
      <div className="flex flex-col gap-1">
        <label
          htmlFor="upload-activity-date"
          className="text-[var(--text-sm)] font-medium text-[var(--color-text)]"
        >
          Activity date{' '}
          <span className="font-normal text-[var(--color-text-secondary)]">(optional)</span>
        </label>
        <input
          id="upload-activity-date"
          data-testid="activity-date-field"
          type="date"
          value={activityDate?.slice(0, 10) ?? ''}
          onChange={(e) => {
            const val = e.target.value || null
            setActivityDate(val)
            setTimelineDescription(buildTimelineDescription(val, contactSuggestions[0] ?? null))
          }}
          className={fieldCls}
        />
      </div>

      {/* Timeline description */}
      {(timelineDescription || activityDate) && (
        <div className="flex flex-col gap-1">
          <label
            htmlFor="upload-timeline-description"
            className="text-[var(--text-sm)] font-medium text-[var(--color-text)]"
          >
            Timeline entry{' '}
            <span className="font-normal text-[var(--color-text-secondary)]">(editable)</span>
          </label>
          <textarea
            id="upload-timeline-description"
            rows={2}
            value={timelineDescription}
            onChange={(e) => setTimelineDescription(e.target.value)}
            className={`resize-none ${fieldCls}`}
          />
        </div>
      )}

      {/* Category */}
      <div className="flex flex-col gap-1">
        <label htmlFor="upload-category" className="text-[var(--text-sm)] font-medium text-[var(--color-text)]">
          Category
        </label>
        <select
          id="upload-category"
          value={category}
          onChange={(e) => setCategory(e.target.value as DocumentCategory)}
          className={fieldCls}
        >
          {docCategories.map((cat) => (
            <option key={cat} value={cat}>{CATEGORY_LABELS[cat as DocumentCategory] ?? cat}</option>
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

      {/* Tags — chip UI */}
      <div className="flex flex-col gap-1">
        <label htmlFor="upload-tags" className="text-[var(--text-sm)] font-medium text-[var(--color-text)]">
          Tags
        </label>
        <div className="flex min-h-[2.5rem] flex-wrap items-center gap-1 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-2 py-1.5 focus-within:ring-2 focus-within:ring-[var(--color-primary)]">
          {tags.map((tag) => (
            <span
              key={tag}
              data-testid="tag-chip"
              data-value={tag}
              className="flex items-center gap-0.5 rounded-full bg-[var(--color-surface-sunken)] px-2 py-0.5 text-[var(--text-xs)] text-[var(--color-text-secondary)]"
            >
              {tag}
              <button
                type="button"
                aria-label={`Remove tag ${tag}`}
                onClick={() => setTags((prev) => prev.filter((t) => t !== tag))}
                className="ml-0.5 leading-none hover:text-[var(--color-text)]"
              >
                ×
              </button>
            </span>
          ))}
          <input
            id="upload-tags"
            data-testid="tag-input"
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault()
                addTag(tagInput)
              }
            }}
            placeholder={tags.length === 0 ? 'Type a tag and press Enter' : ''}
            className="min-w-[8rem] flex-1 bg-transparent text-[var(--text-sm)] text-[var(--color-text)] placeholder:text-[var(--color-text-secondary)] focus:outline-none"
          />
        </div>
      </div>

      {/* Notes */}
      <div className="flex flex-col gap-1">
        <label htmlFor="upload-notes" className="text-[var(--text-sm)] font-medium text-[var(--color-text)]">
          Notes{' '}
          <span className="font-normal text-[var(--color-text-secondary)]">(optional)</span>
        </label>
        <textarea
          id="upload-notes"
          data-testid="notes-textarea"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Any additional context…"
          className={`resize-none ${fieldCls}`}
        />
      </div>

      {extractedTextPreview && (
        <details
          data-testid="upload-extracted-text-preview"
          className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2"
        >
          <summary className="cursor-pointer text-[var(--text-sm)] font-medium text-[var(--color-text)]">
            Extracted Text Preview
          </summary>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)] whitespace-pre-wrap">
            {extractedTextPreview}
          </p>
        </details>
      )}

      {confirmError && (
        <p className="rounded-[var(--radius-md)] border border-[var(--color-danger)] px-3 py-2 text-[var(--text-sm)] text-[var(--color-danger)]">
          {confirmError}
        </p>
      )}
    </form>
  )
}

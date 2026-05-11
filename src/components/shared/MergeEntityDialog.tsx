'use client'
import { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import type { DraftEntityRow } from './DraftEntitySection'

interface Contact {
  id: string
  name: string
  role: string | null
  specialty: string | null
  phone: string | null
  email: string | null
  clinic: string | null
  notes: string | null
}

interface Clinic {
  id: string
  name: string
  address: string | null
  phone: string | null
  email: string | null
}

type FieldChoice = 'draft' | 'existing'

interface MergeField {
  key: string
  label: string
  draftValue: string | null
  existingValue: string | null
}

function contactFields(draft: DraftEntityRow, existing: Contact): MergeField[] {
  return [
    { key: 'name', label: 'Name', draftValue: draft.name, existingValue: existing.name },
    { key: 'role', label: 'Role', draftValue: draft.role, existingValue: existing.role },
    { key: 'specialty', label: 'Specialty', draftValue: draft.specialty, existingValue: existing.specialty },
    { key: 'phone', label: 'Phone', draftValue: draft.phone, existingValue: existing.phone },
    { key: 'email', label: 'Email', draftValue: draft.email, existingValue: existing.email },
    { key: 'clinic', label: 'Clinic', draftValue: draft.clinic, existingValue: existing.clinic },
    { key: 'notes', label: 'Notes', draftValue: draft.notes, existingValue: existing.notes },
  ]
}

function clinicFields(draft: DraftEntityRow, existing: Clinic): MergeField[] {
  return [
    { key: 'name', label: 'Name', draftValue: draft.name, existingValue: existing.name },
    { key: 'address', label: 'Address', draftValue: draft.address, existingValue: existing.address },
    { key: 'phone', label: 'Phone', draftValue: draft.phone, existingValue: existing.phone },
    { key: 'email', label: 'Email', draftValue: draft.email, existingValue: existing.email },
  ]
}

interface Props {
  draft: DraftEntityRow
  entityType: 'contact' | 'clinic'
  onClose: () => void
  onMerged: () => void
}

export function MergeEntityDialog({ draft, entityType, onClose, onMerged }: Props) {
  const [existing, setExisting] = useState<Contact | Clinic | null>(null)
  const [choices, setChoices] = useState<Record<string, FieldChoice>>({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!draft.merge_candidate_id) return
    const id = draft.merge_candidate_id
    const cmd = entityType === 'contact' ? 'contacts_get' : 'clinics_get'
    invoke<Contact | Clinic>(cmd, { id })
      .then((data) => {
        setExisting(data)
        setLoading(false)
      })
      .catch((e: unknown) => {
        setError(String(e))
        setLoading(false)
      })
  }, [draft.merge_candidate_id, entityType])

  const fields: MergeField[] =
    existing && !loading
      ? entityType === 'contact'
        ? contactFields(draft, existing as Contact)
        : clinicFields(draft, existing as Clinic)
      : []

  const getChoice = (key: string): FieldChoice => choices[key] ?? 'draft'

  const setChoice = (key: string, val: FieldChoice) =>
    setChoices((prev) => ({ ...prev, [key]: val }))

  async function handleConfirm() {
    if (!draft.merge_candidate_id) return
    setSubmitting(true)
    setError(null)
    try {
      await invoke('merge_draft_entity', {
        entityType,
        draftId: draft.id,
        existingId: draft.merge_candidate_id,
        fieldChoices: choices,
      })
      onMerged()
    } catch (e: unknown) {
      setError(String(e))
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Merge {entityType}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading && <p className="text-sm text-gray-500">Loading…</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}
          {!loading && existing && (
            <div>
              <div className="grid grid-cols-[auto_1fr_1fr] gap-x-4 gap-y-2 text-sm">
                <div />
                <div className="font-medium text-blue-700 pb-1">Draft (new)</div>
                <div className="font-medium text-gray-700 pb-1">Existing</div>
                {fields.map((f) => (
                  <>
                    <div key={`label-${f.key}`} className="text-gray-500 self-center">
                      {f.label}
                    </div>
                    <label
                      key={`draft-${f.key}`}
                      className={`flex items-start gap-2 p-2 rounded cursor-pointer ${
                        getChoice(f.key) === 'draft' ? 'bg-blue-50 ring-1 ring-blue-300' : 'hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name={f.key}
                        value="draft"
                        checked={getChoice(f.key) === 'draft'}
                        onChange={() => setChoice(f.key, 'draft')}
                        className="mt-0.5 accent-blue-600"
                      />
                      <span className="break-all">{f.draftValue ?? <span className="italic text-gray-400">—</span>}</span>
                    </label>
                    <label
                      key={`existing-${f.key}`}
                      className={`flex items-start gap-2 p-2 rounded cursor-pointer ${
                        getChoice(f.key) === 'existing' ? 'bg-gray-100 ring-1 ring-gray-400' : 'hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name={f.key}
                        value="existing"
                        checked={getChoice(f.key) === 'existing'}
                        onChange={() => setChoice(f.key, 'existing')}
                        className="mt-0.5 accent-gray-600"
                      />
                      <span className="break-all">{f.existingValue ?? <span className="italic text-gray-400">—</span>}</span>
                    </label>
                  </>
                ))}
              </div>
              <p className="mt-4 text-xs text-gray-500">
                Selected values will be applied to the existing {entityType}. The draft will be deleted.
              </p>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={submitting || loading || !existing}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? 'Merging…' : 'Confirm Merge'}
          </button>
        </div>
      </div>
    </div>
  )
}

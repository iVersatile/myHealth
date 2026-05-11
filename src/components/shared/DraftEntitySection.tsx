'use client'

import { useEffect, useState, useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { useToast } from '../../hooks/useToast'
import { Toast } from './Toast'

export interface DraftEntityRow {
  id: string
  entity_type: string
  name: string
  created_at: string
  role: string | null
  specialty: string | null
  phone: string | null
  email: string | null
  clinic: string | null
  address: string | null
  notes: string | null
  merge_candidate_id: string | null
  appt_date: string | null
  doctor_name: string | null
  clinic_name: string | null
  status: string | null
  severity: number | null
  onset_date: string | null
  dosage: string | null
  frequency: string | null
  start_date: string | null
  end_date: string | null
}

interface Props {
  entityType: 'contact' | 'clinic' | 'appointment' | 'symptom' | 'medication'
  onMerge?: (draft: DraftEntityRow) => void
}

function draftSubtitle(draft: DraftEntityRow): string {
  const parts: string[] = []
  if (draft.role) parts.push(draft.role)
  if (draft.specialty) parts.push(draft.specialty)
  if (draft.phone) parts.push(draft.phone)
  if (draft.email) parts.push(draft.email)
  if (draft.address) parts.push(draft.address)
  if (draft.appt_date) parts.push(draft.appt_date)
  if (draft.doctor_name) parts.push(draft.doctor_name)
  if (draft.dosage) parts.push(draft.dosage)
  if (draft.frequency) parts.push(draft.frequency)
  if (draft.severity != null) parts.push(`Severity ${draft.severity}`)
  return parts.join(' · ')
}

export function DraftEntitySection({ entityType, onMerge }: Props) {
  const [drafts, setDrafts] = useState<DraftEntityRow[]>([])
  const [hasSeenDrafts, setHasSeenDrafts] = useState(false)
  const { message: toast, show: showToast } = useToast()

  const loadDrafts = useCallback(() => {
    invoke<DraftEntityRow[]>('get_draft_entities', { entityType })
      .then((rows) => {
        if (rows.length > 0) setHasSeenDrafts(true)
        setDrafts(rows)
      })
      .catch(() => undefined)
  }, [entityType])

  useEffect(() => {
    loadDrafts()
  }, [loadDrafts])

  async function handleAccept(draft: DraftEntityRow) {
    setDrafts((prev) => prev.filter((d) => d.id !== draft.id))
    try {
      await invoke('accept_draft_entity', { entityType: draft.entity_type, id: draft.id })
    } catch {
      loadDrafts()
    }
  }

  async function handleReject(draft: DraftEntityRow) {
    setDrafts((prev) => prev.filter((d) => d.id !== draft.id))
    try {
      await invoke('reject_draft_entity', { entityType: draft.entity_type, id: draft.id })
      showToast('Draft rejected')
    } catch {
      loadDrafts()
    }
  }

  if (drafts.length === 0 && !hasSeenDrafts) return null

  return (
    <div data-testid="draft-review-section" className="mb-6">
      {toast && <Toast message={toast} />}
      {drafts.length === 0 ? (
        <div
          data-testid="draft-review-empty"
          className="text-xs text-[var(--color-text-muted)] py-2"
        >
          All drafts resolved.
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-semibold text-amber-600 uppercase tracking-wider">Drafts from uploads</span>
            <span className="text-xs text-[var(--color-text-muted)]">({drafts.length})</span>
          </div>
          <div className="flex flex-col gap-3">
            {drafts.map((draft) => (
              <div
                key={draft.id}
                data-testid="draft-entity-card"
                className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-700 p-4 flex items-start justify-between gap-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      data-testid="draft-badge"
                      className="inline-flex items-center rounded-full bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200 text-[10px] font-bold px-2 py-0.5 uppercase tracking-widest"
                    >
                      Draft
                    </span>
                    <span className="font-medium text-[var(--color-text)] truncate">{draft.name}</span>
                  </div>
                  {draftSubtitle(draft) && (
                    <p className="text-xs text-[var(--color-text-muted)] truncate">{draftSubtitle(draft)}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {draft.merge_candidate_id && onMerge && (
                    <button
                      data-testid="merge-draft-btn"
                      onClick={() => onMerge(draft)}
                      className="text-xs px-3 py-1.5 rounded border border-blue-400 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                    >
                      Merge
                    </button>
                  )}
                  <button
                    data-testid="accept-draft-btn"
                    onClick={() => void handleAccept(draft)}
                    className="text-xs px-3 py-1.5 rounded border border-green-400 text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
                  >
                    Accept
                  </button>
                  <button
                    data-testid="reject-draft-btn"
                    onClick={() => void handleReject(draft)}
                    className="text-xs px-3 py-1.5 rounded border border-red-300 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

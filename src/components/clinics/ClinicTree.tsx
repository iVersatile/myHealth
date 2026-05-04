'use client'

import { useState } from 'react'
import Link from 'next/link'
import { invoke } from '@tauri-apps/api/core'
import type { ClinicWithContacts } from '../../hooks/useClinics'
import { useToast } from '../../hooks/useToast'
import { Toast } from '../shared/Toast'

interface ClinicTreeProps {
  clinics: ClinicWithContacts[]
  onDeleted: () => void
}

export function ClinicTree({ clinics, onDeleted }: ClinicTreeProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(clinics.map((c) => [c.id, true]))
  )
  const [deleting, setDeleting] = useState<string | null>(null)
  const { message: toastMessage, show: showToast } = useToast()

  function toggleExpanded(id: string) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  async function handleDelete(id: string) {
    setDeleting(id)
    try {
      await invoke('clinics_delete', { id })
      onDeleted()
      showToast('Moved to Trash')
    } finally {
      setDeleting(null)
    }
  }

  if (clinics.length === 0) {
    return (
      <p className="text-[var(--color-text-muted)] text-sm">
        No clinics yet. Clinics are created automatically when uploading documents.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {clinics.map((clinic) => {
        const isExpanded = expanded[clinic.id] ?? true
        return (
          <div
            key={clinic.id}
            data-testid="clinic-row"
            className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-3">
              <button
                className="flex items-center gap-2 text-left flex-1 min-w-0"
                onClick={() => toggleExpanded(clinic.id)}
                aria-expanded={isExpanded}
                aria-label={`Toggle ${clinic.name}`}
              >
                <span className="text-[var(--color-text-muted)] text-xs select-none" aria-hidden>
                  {isExpanded ? '▾' : '▸'}
                </span>
                <span className="font-medium text-[var(--color-text)] truncate">
                  {clinic.name}
                </span>
                {clinic.company_registration_number && (
                  <span className="text-xs text-[var(--color-text-muted)] hidden sm:inline">
                    CRN {clinic.company_registration_number}
                  </span>
                )}
                {clinic.phone && (
                  <span className="text-xs text-[var(--color-text-muted)] hidden sm:inline">
                    {clinic.phone}
                  </span>
                )}
              </button>
              <div className="flex items-center gap-3 ml-3 shrink-0">
                <Link
                  href={`/clinics/edit?id=${clinic.id}`}
                  className="text-xs text-[var(--color-accent)] hover:opacity-80 transition-opacity"
                  aria-label={`Edit ${clinic.name}`}
                >
                  Edit
                </Link>
                <button
                  className="text-xs text-red-500 hover:text-red-700 disabled:opacity-40"
                  onClick={() => handleDelete(clinic.id)}
                  disabled={deleting === clinic.id}
                  aria-label={`Delete ${clinic.name}`}
                >
                  {deleting === clinic.id ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </div>

            {isExpanded && (
              <div className="border-t border-[var(--color-border)] px-4 py-2 flex flex-col gap-1">
                {clinic.linked_contacts.length === 0 ? (
                  <p className="text-xs text-[var(--color-text-muted)] py-1">No linked doctors</p>
                ) : (
                  clinic.linked_contacts.map((contact) => (
                    <div key={contact.id} className="flex items-center gap-2 py-1 pl-4">
                      <span className="text-sm text-[var(--color-text)]">{contact.name}</span>
                      {contact.role && (
                        <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-[var(--color-surface-alt,#f3f4f6)] text-[var(--color-text-muted)]">
                          {contact.role}
                        </span>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )
      })}
      <Toast message={toastMessage} />
    </div>
  )
}

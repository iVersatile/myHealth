'use client'

import { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import type { Contact } from '../../store/contactsStore'

export interface ContactSuggestion {
  name: string
  title: string | null
  specialty: string | null
  clinic: string | null
  address: string | null
  phone: string | null
  email: string | null
}

interface Props {
  candidates: ContactSuggestion[]
  onAccept: (suggestion: ContactSuggestion) => void
  onDismiss: () => void
  appointmentId?: string | null
}

export function DoctorSuggestionBanner({ candidates, onAccept, onDismiss, appointmentId }: Props) {
  const [unmatched, setUnmatched] = useState<ContactSuggestion[]>([])
  const [checked, setChecked] = useState(false)
  const [followUp, setFollowUp] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function check() {
      const results: ContactSuggestion[] = []
      for (const suggestion of candidates) {
        const existing = await invoke<Contact | null>('contacts_find_similar', { name: suggestion.name })
        if (!existing) results.push(suggestion)
      }
      if (!cancelled) {
        setUnmatched(results)
        setChecked(true)
      }
    }
    void check()
    return () => { cancelled = true }
  }, [candidates])

  if (!checked || unmatched.length === 0) return null

  const suggestion = unmatched[0]
  if (!suggestion) return null

  function handleDismiss() {
    if (appointmentId) {
      setFollowUp(true)
    } else {
      onDismiss()
    }
  }

  async function handleNoDoctor() {
    if (appointmentId) {
      try {
        await invoke('appointments_clear_doctor', { appointmentId })
      } catch {
        // best-effort
      }
    }
    onDismiss()
  }

  if (followUp) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--color-accent)] bg-[var(--color-accent)]/10 px-4 py-3 text-sm">
        <span className="text-[var(--color-text)]">
          Is there a doctor for this appointment?
        </span>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={onDismiss}
            className="px-3 py-1 rounded-[var(--radius-sm)] bg-[var(--color-accent)] text-white text-xs font-medium hover:opacity-90 transition-opacity"
          >
            Yes, keep name
          </button>
          <button
            onClick={() => void handleNoDoctor()}
            className="px-3 py-1 rounded-[var(--radius-sm)] border border-[var(--color-border)] text-[var(--color-text-muted)] text-xs hover:text-[var(--color-text)] transition-colors"
          >
            No, it&apos;s a service
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--color-accent)] bg-[var(--color-accent)]/10 px-4 py-3 text-sm">
      <span className="text-[var(--color-text)]">
        Create contact for <strong>{suggestion.name}</strong>?
      </span>
      <div className="flex gap-2 shrink-0">
        <button
          onClick={() => onAccept(suggestion)}
          className="px-3 py-1 rounded-[var(--radius-sm)] bg-[var(--color-accent)] text-white text-xs font-medium hover:opacity-90 transition-opacity"
        >
          Create
        </button>
        <button
          onClick={handleDismiss}
          className="px-3 py-1 rounded-[var(--radius-sm)] border border-[var(--color-border)] text-[var(--color-text-muted)] text-xs hover:text-[var(--color-text)] transition-colors"
        >
          Dismiss
        </button>
      </div>
    </div>
  )
}

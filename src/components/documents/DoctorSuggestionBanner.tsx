'use client'

import { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import type { Contact } from '../../store/contactsStore'
import { SuggestionBanner, bannerPrimaryBtn, bannerSecondaryBtn } from './SuggestionBanner'

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
    return () => {
      cancelled = true
    }
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
      <SuggestionBanner
        actions={
          <>
            <button onClick={onDismiss} className={bannerPrimaryBtn}>
              Yes, keep name
            </button>
            <button onClick={() => void handleNoDoctor()} className={bannerSecondaryBtn}>
              No, it&apos;s a service
            </button>
          </>
        }
      >
        <span className="text-[var(--color-text)]">Is there a doctor for this appointment?</span>
      </SuggestionBanner>
    )
  }

  return (
    <SuggestionBanner
      testId="doctor-suggestion-banner"
      actions={
        <>
          <button onClick={() => onAccept(suggestion)} className={bannerPrimaryBtn}>
            Add to contacts
          </button>
          <button onClick={handleDismiss} className={bannerSecondaryBtn}>
            Dismiss
          </button>
        </>
      }
    >
      <span className="text-[var(--color-text)]">
        Create contact for <strong data-testid="suggestion-name">{suggestion.name}</strong>?
      </span>
    </SuggestionBanner>
  )
}

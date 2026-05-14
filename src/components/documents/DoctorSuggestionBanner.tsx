'use client'

import { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import type { Contact } from '../../store/contactsStore'
import { SuggestionBanner, bannerPrimaryBtn, bannerSecondaryBtn } from './SuggestionBanner'
import { useToast } from '../../hooks/useToast'
import { Toast } from '../shared/Toast'

function extractMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err) return String((err as { message: unknown }).message)
  if (err instanceof Error) return err.message
  return 'An error occurred'
}

export interface ContactSuggestion {
  draft_id: string | null
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
  const toast = useToast()
  const [unmatched, setUnmatched] = useState<ContactSuggestion[]>([])
  const [checked, setChecked] = useState(false)
  const [followUp, setFollowUp] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function check() {
      const results: ContactSuggestion[] = []
      for (const suggestion of candidates) {
        const existing = await invoke<Contact | null>('contacts_find_similar', { name: suggestion.name })
        if (existing) {
          if (suggestion.draft_id) {
            await invoke('reject_draft_entity', { entityType: 'contact', entityId: suggestion.draft_id }).catch(() => {})
          }
        } else {
          results.push(suggestion)
        }
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

  async function rejectUnmatchedDrafts() {
    for (const s of unmatched) {
      if (s.draft_id) {
        await invoke('reject_draft_entity', { entityType: 'contact', entityId: s.draft_id }).catch(() => {})
      }
    }
  }

  function handleDismiss() {
    if (appointmentId) {
      setFollowUp(true)
    } else {
      void rejectUnmatchedDrafts().then(() => onDismiss())
    }
  }

  async function handleNoDoctor() {
    if (appointmentId) {
      try {
        await invoke('appointments_clear_doctor', { appointmentId })
      } catch (err) {
        toast.show(extractMessage(err))
      }
    }
    await rejectUnmatchedDrafts()
    onDismiss()
  }

  if (followUp) {
    return (
      <>
        <SuggestionBanner
          actions={
            <>
              <button onClick={() => void rejectUnmatchedDrafts().then(() => onDismiss())} className={bannerPrimaryBtn}>
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
        <Toast message={toast.message} />
      </>
    )
  }

  return (
    <>
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
      <Toast message={toast.message} />
    </>
  )
}

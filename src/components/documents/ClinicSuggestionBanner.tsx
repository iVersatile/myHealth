'use client'

import { useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import type { ClinicSuggestion } from './UploadDialog'
import { SuggestionBanner, bannerPrimaryBtn, bannerSecondaryBtn } from './SuggestionBanner'
import { extractTauriError } from '../../lib/ipc'

interface Props {
  suggestions: ClinicSuggestion[]
  onDismiss: () => void
}

export function ClinicSuggestionBanner({ suggestions, onDismiss }: Props) {
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (suggestions.length === 0) return null

  const clinic = suggestions[0]
  if (!clinic) return null

  async function handleSave() {
    if (!clinic) return
    setSaving(true)
    setError(null)
    try {
      await invoke('clinics_create_if_not_exists', {
        input: {
          name: clinic.name,
          address: null,
          phone: null,
          company_registration_number: clinic.company_registration_number,
          addresses: clinic.addresses,
        },
      })
      setSaved(true)
    } catch (err) {
      setError(extractTauriError(err, 'Failed to save clinic'))
    } finally {
      setSaving(false)
    }
  }

  if (saved) {
    return (
      <SuggestionBanner
        actions={
          <button onClick={onDismiss} className={bannerSecondaryBtn}>
            Dismiss
          </button>
        }
      >
        <span className="text-[var(--color-text)]">
          Clinic <strong>{clinic.name}</strong> saved.
        </span>
      </SuggestionBanner>
    )
  }

  return (
    <SuggestionBanner
      actions={
        <div className="flex flex-col items-end gap-1">
          <div className="flex gap-2">
            <button
              onClick={() => void handleSave()}
              disabled={saving}
              className={bannerPrimaryBtn}
            >
              {saving ? 'Saving…' : 'Save Clinic'}
            </button>
            <button onClick={onDismiss} className={bannerSecondaryBtn}>
              Dismiss
            </button>
          </div>
          {error && <span className="text-xs text-red-500">{error}</span>}
        </div>
      }
    >
      <span className="text-[var(--color-text)]">
        Save clinic <strong>{clinic.name}</strong>?
      </span>
    </SuggestionBanner>
  )
}

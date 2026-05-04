'use client'

import { useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import type { ClinicSuggestion } from './UploadDialog'

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
      setError(err instanceof Error ? err.message : 'Failed to save clinic')
    } finally {
      setSaving(false)
    }
  }

  if (saved) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--color-accent)] bg-[var(--color-accent)]/10 px-4 py-3 text-sm">
        <span className="text-[var(--color-text)]">
          Clinic <strong>{clinic.name}</strong> saved.
        </span>
        <button
          onClick={onDismiss}
          className="px-3 py-1 rounded-[var(--radius-sm)] border border-[var(--color-border)] text-[var(--color-text-muted)] text-xs hover:text-[var(--color-text)] transition-colors"
        >
          Dismiss
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--color-accent)] bg-[var(--color-accent)]/10 px-4 py-3 text-sm">
      <span className="text-[var(--color-text)]">
        Save clinic <strong>{clinic.name}</strong>?
      </span>
      <div className="flex flex-col items-end gap-1">
        <div className="flex gap-2">
          <button
            onClick={() => void handleSave()}
            disabled={saving}
            className="px-3 py-1 rounded-[var(--radius-sm)] bg-[var(--color-accent)] text-white text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save Clinic'}
          </button>
          <button
            onClick={onDismiss}
            className="px-3 py-1 rounded-[var(--radius-sm)] border border-[var(--color-border)] text-[var(--color-text-muted)] text-xs hover:text-[var(--color-text)] transition-colors"
          >
            Dismiss
          </button>
        </div>
        {error && <span className="text-xs text-red-500">{error}</span>}
      </div>
    </div>
  )
}

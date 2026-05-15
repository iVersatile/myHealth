'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSymptoms } from '../../../../hooks/useSymptoms'
import { extractTauriError } from '../../../../lib/ipc'

export default function NewSymptomPage() {
  const router = useRouter()
  const { createSymptom } = useSymptoms()
  const [name, setName] = useState('')
  const [severity, setSeverity] = useState<number>(5)
  const [hasSeverity, setHasSeverity] = useState(false)
  const [onsetDate, setOnsetDate] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    setError(null)
    try {
      await createSymptom({
        name: name.trim(),
        severity: hasSeverity ? severity : null,
        onset_date: onsetDate || null,
        notes: notes.trim() || null,
      })
      router.push('/symptoms')
    } catch (err: unknown) {
      setError(extractTauriError(err, 'Failed to save symptom'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-6">
      <h1 className="text-[var(--text-2xl)] font-semibold text-[var(--color-text)] mb-6">Log Symptom</h1>

      {error && <p className="mb-4 text-sm text-[var(--color-danger)]">{error}</p>}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="block text-sm font-medium text-[var(--color-text)] mb-1">
            Symptom name <span className="text-[var(--color-danger)]">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="e.g. Headache, Fatigue"
            className="w-full px-3 py-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
          />
        </div>

        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-[var(--color-text)] mb-2 cursor-pointer">
            <input
              type="checkbox"
              checked={hasSeverity}
              onChange={(e) => setHasSeverity(e.target.checked)}
              className="rounded"
            />
            Rate severity
          </label>
          {hasSeverity && (
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={1}
                max={10}
                value={severity}
                onChange={(e) => setSeverity(Number(e.target.value))}
                className="flex-1"
              />
              <span className="text-sm font-medium text-[var(--color-text)] w-8 text-center">{severity}/10</span>
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--color-text)] mb-1">Onset date</label>
          <input
            type="date"
            value={onsetDate}
            onChange={(e) => setOnsetDate(e.target.value)}
            className="w-full px-3 py-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--color-text)] mb-1">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            placeholder="Describe the symptom, triggers, context…"
            className="w-full px-3 py-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] resize-none"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={saving || !name.trim()}
            className="px-5 py-2 rounded-[var(--radius-md)] bg-[var(--color-accent)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            type="button"
            onClick={() => router.push('/symptoms')}
            className="px-5 py-2 rounded-[var(--radius-md)] border border-[var(--color-border)] text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-raised)] transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}

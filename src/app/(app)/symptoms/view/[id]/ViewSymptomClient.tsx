'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useSymptoms, type Symptom } from '../../../../../hooks/useSymptoms'
import { extractTauriError } from '../../../../../lib/ipc'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function ViewSymptomClient() {
  const router = useRouter()
  const params = useParams()
  const id = typeof params.id === 'string' ? params.id : ''
  const { symptoms, loading, updateSymptom, deleteSymptom } = useSymptoms()

  const [symptom, setSymptom] = useState<Symptom | null>(null)
  const [name, setName] = useState('')
  const [severity, setSeverity] = useState<number>(5)
  const [hasSeverity, setHasSeverity] = useState(false)
  const [onsetDate, setOnsetDate] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!loading && symptoms.length > 0) {
      const found = symptoms.find((s) => s.id === id) ?? null
      if (found) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSymptom(found)
        setName(found.name)
        if (found.severity != null) {
          setHasSeverity(true)
          setSeverity(found.severity)
        }
        setOnsetDate(found.onset_date ?? '')
        setNotes(found.notes ?? '')
      }
    }
  }, [symptoms, loading, id])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    setError(null)
    try {
      await updateSymptom(id, {
        name: name.trim(),
        severity: hasSeverity ? severity : null,
        onset_date: onsetDate || null,
        notes: notes.trim() || null,
      })
      router.push('/symptoms')
    } catch (err: unknown) {
      setError(extractTauriError(err, 'Failed to update symptom'))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!confirm('Delete this symptom?')) return
    setDeleting(true)
    setError(null)
    try {
      await deleteSymptom(id)
      router.push('/symptoms')
    } catch (err: unknown) {
      setError(extractTauriError(err, 'Failed to delete symptom'))
      setDeleting(false)
    }
  }

  if (loading && !symptom) {
    return (
      <div className="max-w-xl mx-auto px-4 py-6">
        <p className="text-sm text-[var(--color-text-muted)]">Loading…</p>
      </div>
    )
  }

  if (!loading && !symptom) {
    return (
      <div className="max-w-xl mx-auto px-4 py-6">
        <p className="text-sm text-[var(--color-danger)]">Symptom not found.</p>
        <button onClick={() => router.push('/symptoms')} className="mt-4 text-sm text-[var(--color-accent)] hover:underline">
          ← Back to Symptoms
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-[var(--text-2xl)] font-semibold text-[var(--color-text)]">Edit Symptom</h1>
        {symptom && (
          <p className="text-xs text-[var(--color-text-muted)]">Logged {formatDate(symptom.created_at)}</p>
        )}
      </div>

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
            className="w-full px-3 py-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] resize-none"
          />
        </div>

        <div className="flex items-center justify-between pt-2">
          <div className="flex gap-3">
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
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="px-4 py-2 rounded-[var(--radius-md)] text-sm text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10 disabled:opacity-50 transition-colors"
          >
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </form>
    </div>
  )
}

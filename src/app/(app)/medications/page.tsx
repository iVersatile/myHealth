'use client'

import { useRouter } from 'next/navigation'
import { useMedications, type Medication } from '../../../hooks/useMedications'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function MedicationCard({ medication, onClick }: { medication: Medication; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left p-4 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] transition-colors"
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <span className="font-medium text-[var(--color-text)] truncate">{medication.name}</span>
        {medication.dosage && (
          <span className="shrink-0 text-xs font-medium px-2 py-0.5 rounded-full text-blue-700 bg-blue-50">
            {medication.dosage}
          </span>
        )}
      </div>
      {medication.frequency && (
        <p className="text-sm text-[var(--color-text-muted)] mb-1">{medication.frequency}</p>
      )}
      <div className="flex items-center gap-3 text-xs text-[var(--color-text-muted)]">
        {medication.start_date && <span>Started: {formatDate(medication.start_date)}</span>}
        {medication.end_date && <span>Ended: {formatDate(medication.end_date)}</span>}
        <span>Added: {formatDate(medication.created_at)}</span>
      </div>
    </button>
  )
}

export default function MedicationsPage() {
  const router = useRouter()
  const { medications, loading, error } = useMedications()

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-[var(--text-2xl)] font-semibold text-[var(--color-text)]">Medications</h1>
        <button
          onClick={() => router.push('/medications/new')}
          className="px-4 py-2 rounded-[var(--radius-md)] bg-[var(--color-accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
        >
          + Add Medication
        </button>
      </div>

      {error && <p className="mb-4 text-sm text-[var(--color-danger)]">{error}</p>}

      {loading && medications.length === 0 && (
        <p className="text-sm text-[var(--color-text-muted)]">Loading…</p>
      )}

      {!loading && medications.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <p className="mb-2 text-[var(--text-base)] font-medium text-[var(--color-text)]">No medications logged</p>
          <p className="mb-6 max-w-sm text-[var(--text-sm)] text-[var(--color-text-secondary)]">
            Keep a record of your medications to share with your care team.
          </p>
          <button
            onClick={() => router.push('/medications/new')}
            className="px-5 py-2 rounded-[var(--radius-md)] bg-[var(--color-accent)] text-white text-[var(--text-sm)] font-medium hover:opacity-90 transition-opacity"
          >
            Add your first medication
          </button>
        </div>
      )}

      {medications.length > 0 && (
        <div className="flex flex-col gap-2">
          {medications.map((m) => (
            <MedicationCard key={m.id} medication={m} onClick={() => router.push(`/medications/view/${m.id}`)} />
          ))}
        </div>
      )}
    </div>
  )
}

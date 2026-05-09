'use client'

import { useRouter } from 'next/navigation'
import { useSymptoms, type Symptom } from '../../../hooks/useSymptoms'
import { ENTITY_CONFIG } from '../../../lib/entities'

function severityLabel(n: number): string {
  if (n <= 3) return 'Mild'
  if (n <= 6) return 'Moderate'
  return 'Severe'
}

function severityColor(n: number): string {
  if (n <= 3) return 'text-green-600 bg-green-50'
  if (n <= 6) return 'text-yellow-700 bg-yellow-50'
  return 'text-red-600 bg-red-50'
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function SymptomCard({ symptom, onClick }: { symptom: Symptom; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left p-4 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] transition-colors"
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <span className="font-medium text-[var(--color-text)] truncate">{symptom.name}</span>
        {symptom.severity != null && (
          <span
            className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${severityColor(symptom.severity)}`}
          >
            {symptom.severity}/10 · {severityLabel(symptom.severity)}
          </span>
        )}
      </div>
      {symptom.notes && (
        <p className="text-sm text-[var(--color-text-muted)] line-clamp-2 mb-1">{symptom.notes}</p>
      )}
      <div className="flex items-center gap-3 text-xs text-[var(--color-text-muted)]">
        {symptom.onset_date && <span>Onset: {formatDate(symptom.onset_date)}</span>}
        <span>Logged: {formatDate(symptom.created_at)}</span>
      </div>
    </button>
  )
}

export default function SymptomsPage() {
  const router = useRouter()
  const { symptoms, loading, error } = useSymptoms()

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-[var(--text-2xl)] font-semibold text-[var(--color-text)]">Symptoms</h1>
        <button
          onClick={() => router.push('/symptoms/new')}
          className="px-4 py-2 rounded-[var(--radius-md)] bg-[var(--color-accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
        >
          + Log Symptom
        </button>
      </div>

      {error && <p className="mb-4 text-sm text-[var(--color-danger)]">{error}</p>}

      {loading && symptoms.length === 0 && (
        <p className="text-sm text-[var(--color-text-muted)]">Loading…</p>
      )}

      {!loading && symptoms.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <p className="mb-2 text-[var(--text-base)] font-medium text-[var(--color-text)]">No symptoms logged</p>
          <p className="mb-6 max-w-sm text-[var(--text-sm)] text-[var(--color-text-secondary)]">
            Track symptoms over time to share accurate history with your care team.
          </p>
          <button
            onClick={() => router.push('/symptoms/new')}
            className="px-5 py-2 rounded-[var(--radius-md)] bg-[var(--color-accent)] text-white text-[var(--text-sm)] font-medium hover:opacity-90 transition-opacity"
          >
            Log your first symptom
          </button>
        </div>
      )}

      {symptoms.length > 0 && (
        <div className="flex flex-col gap-2">
          {symptoms.map((s) => (
            <SymptomCard key={s.id} symptom={s} onClick={() => router.push(`${ENTITY_CONFIG.symptom.route}/${s.id}`)} />
          ))}
        </div>
      )}
    </div>
  )
}

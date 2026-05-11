'use client'

import { useClinics } from '../../../hooks/useClinics'
import { ClinicTree } from '../../../components/clinics/ClinicTree'
import { DraftEntitySection } from '../../../components/shared/DraftEntitySection'

export default function ClinicsPage() {
  const { clinics, loading, error, reload } = useClinics()

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-[var(--text-2xl)] font-semibold text-[var(--color-text)]">Clinics</h1>
      </div>

      <DraftEntitySection entityType="clinic" />

      {loading && <p className="text-[var(--color-text-muted)] text-sm">Loading…</p>}
      {error && <p className="text-red-500 text-sm">{error}</p>}
      <ClinicTree clinics={clinics} onDeleted={reload} />
    </div>
  )
}

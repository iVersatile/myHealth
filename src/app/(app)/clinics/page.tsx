'use client'

import { useState } from 'react'
import { useClinics } from '../../../hooks/useClinics'
import { ClinicTree } from '../../../components/clinics/ClinicTree'
import { DraftEntitySection, type DraftEntityRow } from '../../../components/shared/DraftEntitySection'
import { MergeEntityDialog } from '../../../components/shared/MergeEntityDialog'

export default function ClinicsPage() {
  const { clinics, loading, error, reload } = useClinics()
  const [mergeDraft, setMergeDraft] = useState<DraftEntityRow | null>(null)

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-[var(--text-2xl)] font-semibold text-[var(--color-text)]">Clinics</h1>
      </div>

      <DraftEntitySection entityType="clinic" onMerge={(draft) => setMergeDraft(draft)} />

      {loading && <p className="text-[var(--color-text-muted)] text-sm">Loading…</p>}
      {error && <p className="text-red-500 text-sm">{error}</p>}
      <ClinicTree clinics={clinics} onDeleted={reload} />

      {mergeDraft && (
        <MergeEntityDialog
          draft={mergeDraft}
          entityType="clinic"
          onClose={() => setMergeDraft(null)}
          onMerged={() => setMergeDraft(null)}
        />
      )}
    </div>
  )
}

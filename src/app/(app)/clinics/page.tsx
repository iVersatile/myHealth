'use client'

import { useContacts } from '../../../hooks/useContacts'

export default function ClinicsPage() {
  const { contacts, loading, error } = useContacts('clinic')

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-[var(--text-2xl)] font-semibold text-[var(--color-text)]">Clinics</h1>
      </div>

      {loading && (
        <p className="text-[var(--color-text-muted)] text-sm">Loading…</p>
      )}
      {error && (
        <p className="text-red-500 text-sm">{error}</p>
      )}
      {!loading && contacts.length === 0 && (
        <p className="text-[var(--color-text-muted)] text-sm">
          No clinics yet. Clinics are created automatically when uploading documents.
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {contacts.map((clinic) => (
          <div
            key={clinic.id}
            className="p-4 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)]"
          >
            <p className="font-medium text-[var(--color-text)] mb-1">{clinic.name}</p>
            {clinic.phone && (
              <p className="text-sm text-[var(--color-text-muted)]">📞 {clinic.phone}</p>
            )}
            {clinic.email && (
              <p className="text-sm text-[var(--color-text-muted)]">✉ {clinic.email}</p>
            )}
            {clinic.address && (
              <p className="text-sm text-[var(--color-text-muted)] mt-1">{clinic.address}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

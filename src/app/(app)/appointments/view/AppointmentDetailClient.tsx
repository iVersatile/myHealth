'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { invoke } from '@tauri-apps/api/core'
import { Appointment, STATUS_LABELS } from '../../../../store/appointmentsStore'
import { CATEGORY_LABELS } from '../../../../store/documentsStore'
import { CategoryPicker, type Category } from '../../../../components/categories/CategoryPicker'

interface LinkedDocument {
  document_id: string
  filename: string
  category: string
  document_date: string | null
  score: number
  created_at: string
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatApptDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function AppointmentDetailClient() {
  const searchParams = useSearchParams()
  const id = searchParams.get('id') ?? ''
  const router = useRouter()

  const [appt, setAppt] = useState<Appointment | null>(null)
  const [linkedDocs, setLinkedDocs] = useState<LinkedDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [unlinking, setUnlinking] = useState<string | null>(null)

  const [allCategories, setAllCategories] = useState<Category[]>([])
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([])

  useEffect(() => {
    if (!id) return
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const [fetchedAppt, fetchedLinks, catRows, assignedIds] = await Promise.all([
          invoke<Appointment>('appointments_get', { id }),
          invoke<LinkedDocument[]>('get_appointment_links', { userId: '', appointmentId: id }),
          invoke<Array<{ id: string; name: string; parent_id: string | null; color_hex: string; is_system: boolean; sort_order: number }>>('categories_list'),
          invoke<string[]>('categories_for_appointment', { appointmentId: id }),
        ])
        setAppt(fetchedAppt)
        setLinkedDocs(fetchedLinks)
        setAllCategories(catRows.map(r => ({
          id: r.id,
          name: r.name,
          parentId: r.parent_id,
          colorHex: r.color_hex,
          isSystem: r.is_system,
          sortOrder: r.sort_order,
        })))
        setSelectedCategoryIds(assignedIds)
      } catch (e) {
        setError(String(e))
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [id])

  async function handleUnlink(documentId: string) {
    setUnlinking(documentId)
    try {
      await invoke('unlink_document_from_appointment', {
        userId: '',
        documentId,
        appointmentId: id,
      })
      setLinkedDocs((prev) => prev.filter((d) => d.document_id !== documentId))
    } catch (e) {
      setError(String(e))
    } finally {
      setUnlinking(null)
    }
  }

  async function handleCategoryChange(nextIds: string[]) {
    const toAdd = nextIds.filter(cid => !selectedCategoryIds.includes(cid))
    const toRemove = selectedCategoryIds.filter(cid => !nextIds.includes(cid))
    try {
      await Promise.all([
        ...toAdd.map(categoryId =>
          invoke('assign_category_to_appointment', { userId: '', appointmentId: id, categoryId })
        ),
        ...toRemove.map(categoryId =>
          invoke('unassign_category_from_appointment', { userId: '', appointmentId: id, categoryId })
        ),
      ])
      setSelectedCategoryIds(nextIds)
    } catch (e) {
      setError(String(e))
    }
  }

  if (!id) {
    return (
      <div className="p-8 text-[var(--color-text-secondary)]">
        No appointment selected.{' '}
        <Link href="/appointments" className="text-[var(--color-accent)] underline">
          Back to appointments
        </Link>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="p-8 text-[var(--color-text-secondary)]" aria-label="Loading appointment">
        Loading…
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8 text-[var(--color-danger)]" role="alert">
        {error}
      </div>
    )
  }

  if (!appt) {
    return (
      <div className="p-8 text-[var(--color-text-secondary)]">
        Appointment not found.{' '}
        <Link href="/appointments" className="text-[var(--color-accent)] underline">
          Back to appointments
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      {/* Back nav */}
      <button
        type="button"
        onClick={() => router.back()}
        className="text-[var(--text-sm)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
      >
        ← Back
      </button>

      {/* Appointment header */}
      <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-6 shadow-[var(--shadow-sm)]">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h1 className="text-[var(--text-2xl)] font-bold text-[var(--color-text)]">{appt.title}</h1>
          <span className="rounded-full bg-[var(--color-accent-muted)] px-3 py-0.5 text-[var(--text-sm)] font-medium text-[var(--color-accent)]">
            {STATUS_LABELS[appt.status]}
          </span>
        </div>

        <dl className="mt-4 grid grid-cols-1 gap-3 text-[var(--text-sm)] sm:grid-cols-2">
          <div>
            <dt className="text-[var(--color-text-secondary)]">Date &amp; Time</dt>
            <dd className="font-medium text-[var(--color-text)]">{formatApptDate(appt.appt_date)}</dd>
          </div>
          {appt.doctor_name && (
            <div>
              <dt className="text-[var(--color-text-secondary)]">Doctor</dt>
              <dd className="font-medium text-[var(--color-text)]">{appt.doctor_name}</dd>
            </div>
          )}
          {appt.clinic_name && (
            <div>
              <dt className="text-[var(--color-text-secondary)]">Clinic</dt>
              <dd className="font-medium text-[var(--color-text)]">{appt.clinic_name}</dd>
            </div>
          )}
          {appt.specialty && (
            <div>
              <dt className="text-[var(--color-text-secondary)]">Specialty</dt>
              <dd className="font-medium text-[var(--color-text)]">{appt.specialty}</dd>
            </div>
          )}
          {appt.location && (
            <div>
              <dt className="text-[var(--color-text-secondary)]">Location</dt>
              <dd className="font-medium text-[var(--color-text)]">{appt.location}</dd>
            </div>
          )}
          {appt.duration_min > 0 && (
            <div>
              <dt className="text-[var(--color-text-secondary)]">Duration</dt>
              <dd className="font-medium text-[var(--color-text)]">{appt.duration_min} min</dd>
            </div>
          )}
        </dl>

        {appt.notes && (
          <div className="mt-4">
            <p className="text-[var(--text-sm)] text-[var(--color-text-secondary)]">Notes</p>
            <p className="mt-1 whitespace-pre-wrap text-[var(--text-sm)] text-[var(--color-text)]">{appt.notes}</p>
          </div>
        )}
      </section>

      {/* Medical categories */}
      {allCategories.length > 0 && (
        <section aria-label="Medical categories">
          <h2 className="mb-3 text-[var(--text-lg)] font-semibold text-[var(--color-text)]">
            Medical Categories
          </h2>
          <CategoryPicker
            categories={allCategories}
            selectedIds={selectedCategoryIds}
            onChange={(ids) => void handleCategoryChange(ids)}
          />
        </section>
      )}

      {/* Linked documents */}
      <section aria-label="Linked documents">
        <h2 className="mb-3 text-[var(--text-lg)] font-semibold text-[var(--color-text)]">
          Linked Documents
          {linkedDocs.length > 0 && (
            <span className="ml-2 text-[var(--text-sm)] font-normal text-[var(--color-text-secondary)]">
              ({linkedDocs.length})
            </span>
          )}
        </h2>

        {linkedDocs.length === 0 ? (
          <p className="text-[var(--text-sm)] text-[var(--color-text-secondary)]">
            No documents linked yet. Open a document and link it to this appointment.
          </p>
        ) : (
          <ul className="space-y-3">
            {linkedDocs.map((doc) => (
              <li
                key={doc.document_id}
                className="flex items-start justify-between gap-4 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-4"
              >
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/documents/view?id=${doc.document_id}`}
                    className="truncate text-[var(--text-sm)] font-medium text-[var(--color-accent)] hover:underline"
                  >
                    {doc.filename}
                  </Link>
                  <p className="mt-0.5 text-[var(--text-xs)] text-[var(--color-text-secondary)]">
                    {(CATEGORY_LABELS as Record<string, string>)[doc.category] ?? doc.category}
                    {doc.document_date && ` · ${formatDate(doc.document_date)}`}
                  </p>
                  <p className="mt-0.5 text-[var(--text-xs)] text-[var(--color-text-secondary)]">
                    Score: {doc.score}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label={`Unlink ${doc.filename}`}
                  disabled={unlinking === doc.document_id}
                  onClick={() => void handleUnlink(doc.document_id)}
                  className="shrink-0 rounded-[var(--radius-sm)] border border-[var(--color-border)] px-2 py-1 text-[var(--text-xs)] text-[var(--color-danger)] transition-colors duration-[var(--duration-fast)] hover:bg-[var(--color-surface-sunken)] disabled:opacity-50"
                >
                  {unlinking === doc.document_id ? '…' : 'Unlink'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

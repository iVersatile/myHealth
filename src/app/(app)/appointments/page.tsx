'use client'

import { useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { open as openDialog, save as saveDialog } from '@tauri-apps/plugin-dialog'
import { useAppointments, AppointmentInput } from '../../../hooks/useAppointments'
import { AppointmentCard } from '../../../components/appointments/AppointmentCard'
import { AppointmentForm } from '../../../components/appointments/AppointmentForm'
import { Appointment, AppointmentStatus } from '../../../store/appointmentsStore'
import { IPC } from '../../../lib/ipc'

type FilterValue = AppointmentStatus | 'all'

const FILTER_OPTIONS: { label: string; value: FilterValue }[] = [
  { label: 'All', value: 'all' },
  { label: 'Scheduled', value: 'scheduled' },
  { label: 'Completed', value: 'completed' },
  { label: 'Cancelled', value: 'cancelled' },
  { label: 'Missed', value: 'missed' },
]

function groupByMonth(appointments: Appointment[]): [string, Appointment[]][] {
  const map = new Map<string, Appointment[]>()
  for (const appt of appointments) {
    const d = new Date(appt.appt_date)
    const key = d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
    const bucket = map.get(key)
    if (bucket) {
      bucket.push(appt)
    } else {
      map.set(key, [appt])
    }
  }
  return Array.from(map.entries())
}

export default function AppointmentsPage() {
  const {
    appointments,
    statusFilter,
    loading,
    error,
    createAppointment,
    deleteAppointment,
    filterByStatus,
    refresh,
  } = useAppointments()

  const [showForm, setShowForm] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [icsMessage, setIcsMessage] = useState<string | null>(null)

  type RecurrenceDeleteModal = { apptId: string; apptDate: string; seriesId: string } | null
  const [recurDeleteModal, setRecurDeleteModal] = useState<RecurrenceDeleteModal>(null)

  const groups = groupByMonth(appointments)

  async function handleSave(input: AppointmentInput) {
    const saved = await createAppointment(input)
    const offsets = input.reminder_offsets
    const anyEnabled = offsets && (offsets.min15 || offsets.hr1 || offsets.day1)
    if (anyEnabled) {
      await invoke(IPC.remindersSchedule, {
        appointmentId: saved.id,
        appointmentDatetime: saved.appt_date,
      }).catch(() => {})
    } else {
      await invoke(IPC.remindersCancel, { appointmentId: saved.id }).catch(() => {})
    }
    if (input.recurrence) {
      await invoke(IPC.recurrenceCreate, {
        baseAppointmentId: saved.id,
        rule: input.recurrence.rule,
        intervalN: input.recurrence.intervalN,
        untilDate: input.recurrence.untilDate ?? null,
        occurrences: input.recurrence.occurrences,
      }).catch(() => {})
    }
    setShowForm(false)
  }

  async function handleDelete(id: string) {
    const appt = appointments.find((a) => a.id === id)
    if (appt?.recurrence_series_id) {
      setRecurDeleteModal({ apptId: id, apptDate: appt.appt_date, seriesId: appt.recurrence_series_id })
      return
    }
    if (deleteConfirm === id) {
      await deleteAppointment(id)
      setDeleteConfirm(null)
    } else {
      setDeleteConfirm(id)
    }
  }

  async function handleSeriesDelete(mode: 'one' | 'following' | 'all') {
    if (!recurDeleteModal) return
    const { apptId, apptDate, seriesId } = recurDeleteModal
    setRecurDeleteModal(null)
    if (mode === 'one') {
      await deleteAppointment(apptId)
    } else {
      await invoke(IPC.recurrenceDeleteSeries, {
        seriesId,
        fromOccurrence: mode === 'following' ? apptDate : null,
      })
      await refresh()
    }
  }

  function handleCancelForm() {
    setShowForm(false)
  }

  async function handleIcsImport() {
    try {
      const filePath = await openDialog({
        multiple: false,
        filters: [{ name: 'iCalendar', extensions: ['ics'] }],
      })
      if (!filePath) return
      const count = await invoke<number>(IPC.icalendarImport, { filePath })
      setIcsMessage(`Imported ${count} appointment${count === 1 ? '' : 's'}.`)
    } catch (e) {
      setIcsMessage(`Import failed: ${e}`)
    }
  }

  async function handleIcsExport() {
    try {
      const filePath = await saveDialog({
        defaultPath: 'appointments.ics',
        filters: [{ name: 'iCalendar', extensions: ['ics'] }],
      })
      if (!filePath) return
      const ids = appointments.map((a) => a.id)
      await invoke(IPC.icalendarExport, { appointmentIds: ids, filePath })
      setIcsMessage('Exported successfully.')
    } catch (e) {
      setIcsMessage(`Export failed: ${e}`)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-[var(--text-2xl)] font-semibold text-[var(--color-text)]">
          Appointments
        </h1>
        {!showForm && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleIcsImport}
              className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2 text-[var(--text-sm)] font-medium text-[var(--color-text-secondary)] transition-colors duration-[var(--duration-fast)] hover:bg-[var(--color-surface-sunken)]"
            >
              Import .ics
            </button>
            <button
              type="button"
              onClick={handleIcsExport}
              className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2 text-[var(--text-sm)] font-medium text-[var(--color-text-secondary)] transition-colors duration-[var(--duration-fast)] hover:bg-[var(--color-surface-sunken)]"
            >
              Export .ics
            </button>
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="rounded-[var(--radius-md)] bg-[var(--color-accent)] px-4 py-2 text-[var(--text-sm)] font-medium text-white transition-opacity duration-[var(--duration-fast)] hover:opacity-90"
            >
              + New
            </button>
          </div>
        )}
      </div>

      {/* ICS feedback */}
      {icsMessage && (
        <div className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-4 py-2">
          <p className="text-[var(--text-sm)] text-[var(--color-text-secondary)]">{icsMessage}</p>
          <button
            type="button"
            onClick={() => setIcsMessage(null)}
            className="ml-4 text-[var(--text-sm)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
          >
            ✕
          </button>
        </div>
      )}

      {/* Form panel */}
      {showForm && (
        <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-6 shadow-[var(--shadow-md)]">
          <h2 className="mb-4 text-[var(--text-lg)] font-semibold text-[var(--color-text)]">
            New Appointment
          </h2>
          <AppointmentForm
            onSave={handleSave}
            onCancel={handleCancelForm}
          />
        </section>
      )}

      {/* Status filter chips */}
      {!showForm && (
        <div className="flex flex-wrap gap-2">
          {FILTER_OPTIONS.map(({ label, value }) => (
            <button
              key={value}
              type="button"
              onClick={() => filterByStatus(value)}
              className={`rounded-full px-3 py-1 text-[var(--text-sm)] font-medium transition-colors duration-[var(--duration-fast)] ${
                statusFilter === value
                  ? 'bg-[var(--color-accent)] text-white'
                  : 'border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-sunken)]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="rounded-[var(--radius-md)] bg-[var(--color-danger-muted)] px-3 py-2 text-[var(--text-sm)] text-[var(--color-danger)]">
          {error}
        </p>
      )}

      {/* Loading */}
      {loading && (
        <p className="text-[var(--text-sm)] text-[var(--color-text-secondary)]">Loading…</p>
      )}

      {/* Delete confirmation banner */}
      {deleteConfirm && (
        <div className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--color-danger)] bg-[var(--color-danger-muted)] px-4 py-3">
          <p className="text-[var(--text-sm)] text-[var(--color-danger)]">
            Click ✕ again on the same appointment to confirm deletion.
          </p>
          <button
            type="button"
            onClick={() => setDeleteConfirm(null)}
            className="text-[var(--text-sm)] text-[var(--color-danger)] underline"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Empty state */}
      {!loading && !showForm && groups.length === 0 && (
        <p className="text-[var(--text-sm)] text-[var(--color-text-secondary)]">
          No appointments yet. Click &quot;+ New&quot; to add one.
        </p>
      )}

      {/* Recurrence delete modal */}
      {recurDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-lg)]">
            <h3 className="mb-2 text-[var(--text-base)] font-semibold text-[var(--color-text)]">
              Delete recurring appointment
            </h3>
            <p className="mb-5 text-[var(--text-sm)] text-[var(--color-text-secondary)]">
              This appointment is part of a series. What would you like to delete?
            </p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => handleSeriesDelete('one')}
                className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-4 py-2 text-left text-[var(--text-sm)] text-[var(--color-text)] transition-colors duration-[var(--duration-fast)] hover:bg-[var(--color-surface-sunken)]"
              >
                Delete this occurrence only
              </button>
              <button
                type="button"
                onClick={() => handleSeriesDelete('following')}
                className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-4 py-2 text-left text-[var(--text-sm)] text-[var(--color-text)] transition-colors duration-[var(--duration-fast)] hover:bg-[var(--color-surface-sunken)]"
              >
                Delete this and all following
              </button>
              <button
                type="button"
                onClick={() => handleSeriesDelete('all')}
                className="rounded-[var(--radius-md)] border border-[var(--color-danger)] bg-[var(--color-danger-muted)] px-4 py-2 text-left text-[var(--text-sm)] text-[var(--color-danger)] transition-colors duration-[var(--duration-fast)] hover:opacity-80"
              >
                Delete all in series
              </button>
              <button
                type="button"
                onClick={() => setRecurDeleteModal(null)}
                className="mt-1 text-center text-[var(--text-sm)] text-[var(--color-text-secondary)] underline"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Grouped list */}
      {!showForm && groups.map(([month, appts]) => (
        <section key={month}>
          <h2 className="mb-3 text-[var(--text-xs)] font-semibold uppercase tracking-widest text-[var(--color-text-secondary)]">
            ── {month} ──
          </h2>
          <ul className="space-y-3">
            {appts.map((appt) => (
              <li key={appt.id}>
                <AppointmentCard
                  appointment={appt}
                  onDelete={handleDelete}
                />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

'use client'

import { useState } from 'react'
import {
  Appointment,
  SPECIALTY_OPTIONS,
  REMINDER_OPTIONS,
  STATUS_LABELS,
  AppointmentStatus,
} from '../../store/appointmentsStore'
import { AppointmentInput } from '../../hooks/useAppointments'

interface AppointmentFormProps {
  initial?: Appointment
  onSave: (input: AppointmentInput) => Promise<void>
  onCancel: () => void
}

function isoToDatetimeLocal(iso: string): string {
  return iso.slice(0, 16)
}

function datetimeLocalToIso(local: string): string {
  return local.length === 16 ? `${local}:00` : local
}

const STATUS_OPTIONS: AppointmentStatus[] = ['scheduled', 'completed', 'cancelled', 'missed']

export function AppointmentForm({ initial, onSave, onCancel }: AppointmentFormProps) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [doctorName, setDoctorName] = useState(initial?.doctor_name ?? '')
  const [clinicName, setClinicName] = useState(initial?.clinic_name ?? '')
  const [specialty, setSpecialty] = useState(initial?.specialty ?? '')
  const [apptDate, setApptDate] = useState(
    initial?.appt_date ? isoToDatetimeLocal(initial.appt_date) : ''
  )
  const [durationMin, setDurationMin] = useState(String(initial?.duration_min ?? 30))
  const [location, setLocation] = useState(initial?.location ?? '')
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [status, setStatus] = useState<AppointmentStatus>(initial?.status ?? 'scheduled')
  const [reminderMin, setReminderMin] = useState(String(initial?.reminder_min ?? 60))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) {
      setError('Title is required.')
      return
    }
    if (!apptDate) {
      setError('Date and time are required.')
      return
    }
    setError(null)
    setSaving(true)
    try {
      await onSave({
        title: title.trim(),
        doctor_name: doctorName.trim() || null,
        clinic_name: clinicName.trim() || null,
        specialty: specialty || null,
        appt_date: datetimeLocalToIso(apptDate),
        duration_min: parseInt(durationMin, 10) || null,
        location: location.trim() || null,
        notes: notes.trim() || null,
        status,
        reminder_min: parseInt(reminderMin, 10) || null,
      })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
      setSaving(false)
    }
  }

  const labelClass = 'block text-[var(--text-sm)] font-medium text-[var(--color-text)] mb-1'
  const inputClass =
    'w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[var(--text-sm)] text-[var(--color-text)] placeholder-[var(--color-text-secondary)] outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]'

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <p className="rounded-[var(--radius-md)] bg-[var(--color-danger-muted)] px-3 py-2 text-[var(--text-sm)] text-[var(--color-danger)]">
          {error}
        </p>
      )}

      <div>
        <label htmlFor="appt-title" className={labelClass}>
          Title <span aria-hidden="true" className="text-[var(--color-danger)]">*</span>
        </label>
        <input
          id="appt-title"
          type="text"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Annual checkup"
          className={inputClass}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="appt-date" className={labelClass}>
            Date &amp; Time <span aria-hidden="true" className="text-[var(--color-danger)]">*</span>
          </label>
          <input
            id="appt-date"
            type="datetime-local"
            required
            value={apptDate}
            onChange={(e) => setApptDate(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="appt-duration" className={labelClass}>Duration (mins)</label>
          <input
            id="appt-duration"
            type="number"
            min="0"
            step="5"
            value={durationMin}
            onChange={(e) => setDurationMin(e.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="appt-doctor" className={labelClass}>Doctor</label>
          <input
            id="appt-doctor"
            type="text"
            value={doctorName}
            onChange={(e) => setDoctorName(e.target.value)}
            placeholder="Dr. Smith"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="appt-clinic" className={labelClass}>Clinic / Hospital</label>
          <input
            id="appt-clinic"
            type="text"
            value={clinicName}
            onChange={(e) => setClinicName(e.target.value)}
            placeholder="City Medical Centre"
            className={inputClass}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="appt-specialty" className={labelClass}>Specialty</label>
          <select
            id="appt-specialty"
            value={specialty}
            onChange={(e) => setSpecialty(e.target.value)}
            className={inputClass}
          >
            <option value="">— Select —</option>
            {SPECIALTY_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="appt-status" className={labelClass}>Status</label>
          <select
            id="appt-status"
            value={status}
            onChange={(e) => setStatus(e.target.value as AppointmentStatus)}
            className={inputClass}
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="appt-location" className={labelClass}>Location</label>
        <input
          id="appt-location"
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Room 4, Building A"
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="appt-reminder" className={labelClass}>Reminder</label>
        <select
          id="appt-reminder"
          value={reminderMin}
          onChange={(e) => setReminderMin(e.target.value)}
          className={inputClass}
        >
          {REMINDER_OPTIONS.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="appt-notes" className={labelClass}>Notes</label>
        <textarea
          id="appt-notes"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Bring fasting blood test results…"
          className={`${inputClass} resize-y`}
        />
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-4 py-2 text-[var(--text-sm)] text-[var(--color-text)] transition-colors duration-[var(--duration-fast)] hover:bg-[var(--color-surface-sunken)]"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="rounded-[var(--radius-md)] bg-[var(--color-accent)] px-4 py-2 text-[var(--text-sm)] font-medium text-white transition-opacity duration-[var(--duration-fast)] hover:opacity-90 disabled:opacity-50"
        >
          {saving ? 'Saving…' : initial ? 'Save Changes' : 'Save Appointment'}
        </button>
      </div>
    </form>
  )
}

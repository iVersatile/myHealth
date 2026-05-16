'use client'

import { useState, useEffect, useRef } from 'react'
import { invoke } from '@tauri-apps/api/core'
import {
  Appointment,
  SPECIALTY_OPTIONS,
  REMINDER_OPTIONS,
  STATUS_LABELS,
  AppointmentStatus,
} from '../../store/appointmentsStore'
import { AppointmentInput } from '../../hooks/useAppointments'
import { CategoryPicker, type Category } from '../categories/CategoryPicker'
import { Contact, DOCTOR_ROLES, CLINIC_ROLES } from '../../store/contactsStore'
import { extractTauriError } from '@/lib/ipc'

interface AppointmentFormProps {
  initial?: Appointment
  onSave: (input: AppointmentInput) => Promise<void>
  onCancel: () => void
  onCategoriesChange?: (ids: string[]) => void
}

function isoToDatetimeLocal(iso: string): string {
  const normalised = iso.length === 10 ? `${iso}T00:00` : iso
  return normalised.slice(0, 16)
}

function datetimeLocalToIso(local: string): string {
  return local.length === 16 ? `${local}:00` : local
}

const STATUS_OPTIONS: AppointmentStatus[] = ['scheduled', 'completed', 'cancelled', 'missed']

export function AppointmentForm({ initial, onSave, onCancel, onCategoriesChange }: AppointmentFormProps) {
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
  const isFutureAppt = apptDate ? new Date(datetimeLocalToIso(apptDate)) > new Date() : false
  const [remMin15, setRemMin15] = useState(isFutureAppt)
  const [remHr1, setRemHr1] = useState(isFutureAppt)
  const [remDay1, setRemDay1] = useState(isFutureAppt)
  const [repeatRule, setRepeatRule] = useState<'none' | 'weekly' | 'monthly'>('none')
  const [repeatInterval, setRepeatInterval] = useState(1)
  const [repeatOccurrences, setRepeatOccurrences] = useState(4)
  const [repeatUntil, setRepeatUntil] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [allCategories, setAllCategories] = useState<Category[]>([])
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([])
  const [allContacts, setAllContacts] = useState<Contact[]>([])
  const [linkedDoctorContactId, setLinkedDoctorContactId] = useState<string | null>(null)
  const [linkedClinicContactId, setLinkedClinicContactId] = useState<string | null>(null)
  const [allClinics, setAllClinics] = useState<Array<{ id: string; name: string }>>([])
  const [selectedClinicId, setSelectedClinicId] = useState<string | null>(null)
  const initContactsResolved = useRef(false)

  useEffect(() => {
    const loads: Promise<void>[] = [
      invoke<Array<{ id: string; name: string; parent_id: string | null; color_hex: string; is_system: boolean; sort_order: number }>>('categories_list')
        .then((rows) =>
          setAllCategories(
            rows.map((r) => ({
              id: r.id,
              name: r.name,
              parentId: r.parent_id,
              colorHex: r.color_hex,
              isSystem: r.is_system,
              sortOrder: r.sort_order,
            }))
          )
        )
        .catch(() => {}),
      invoke<Contact[]>('contacts_list')
        .then((contacts) => {
          setAllContacts(contacts)
          if (!initContactsResolved.current && initial?.contact_ids?.length) {
            initContactsResolved.current = true
            const doctorContact = contacts.find(
              (c) => initial.contact_ids.includes(c.id) && DOCTOR_ROLES.has(c.role)
            )
            const clinicContact = contacts.find(
              (c) => initial.contact_ids.includes(c.id) && CLINIC_ROLES.has(c.role)
            )
            if (doctorContact) setLinkedDoctorContactId(doctorContact.id)
            if (clinicContact) setLinkedClinicContactId(clinicContact.id)
          }
        })
        .catch(() => {}),
      invoke<Array<{ id: string; name: string }>>('clinics_list')
        .then((clinics) => {
          setAllClinics(clinics)
          if (initial?.clinic_name) {
            const match = clinics.find((c) => c.name === initial.clinic_name)
            if (match) setSelectedClinicId(match.id)
          }
        })
        .catch(() => {}),
    ]
    if (initial?.id) {
      loads.push(
        invoke<string[]>('categories_for_appointment', { appointmentId: initial.id })
          .then(setSelectedCategoryIds)
          .catch(() => {})
      )
    }
    void Promise.all(loads)
  }, [initial?.id])

  async function handleCategoryChange(nextIds: string[]) {
    if (!initial?.id) {
      setSelectedCategoryIds(nextIds)
      onCategoriesChange?.(nextIds)
      return
    }
    const toAdd = nextIds.filter((id) => !selectedCategoryIds.includes(id))
    const toRemove = selectedCategoryIds.filter((id) => !nextIds.includes(id))
    try {
      await Promise.all([
        ...toAdd.map((categoryId) =>
          invoke('categories_assign_appointment', { appointmentId: initial.id, categoryId })
        ),
        ...toRemove.map((categoryId) =>
          invoke('categories_unassign', { entityId: initial.id, categoryId, entityType: 'appointment' })
        ),
      ])
      setSelectedCategoryIds(nextIds)
      onCategoriesChange?.(nextIds)
    } catch (err: unknown) {
      setError(extractTauriError(err))
    }
  }

  async function handleDoctorContactSelect(contactId: string) {
    const contact = allContacts.find((c) => c.id === contactId)
    if (!contact) return
    if (linkedDoctorContactId && linkedDoctorContactId !== contactId && initial?.id) {
      await invoke('appointment_unlink_contact', { appointmentId: initial.id, contactId: linkedDoctorContactId }).catch(() => {})
    }
    setLinkedDoctorContactId(contactId)
    setDoctorName(contact.name)
    if (initial?.id) {
      await invoke('appointment_link_contact', { appointmentId: initial.id, contactId }).catch(() => {})
    }
  }

  async function handleDoctorContactClear() {
    if (linkedDoctorContactId && initial?.id) {
      await invoke('appointment_unlink_contact', { appointmentId: initial.id, contactId: linkedDoctorContactId }).catch(() => {})
    }
    setLinkedDoctorContactId(null)
  }

  async function handleClinicContactSelect(contactId: string) {
    const contact = allContacts.find((c) => c.id === contactId)
    if (!contact) return
    if (linkedClinicContactId && linkedClinicContactId !== contactId && initial?.id) {
      await invoke('appointment_unlink_contact', { appointmentId: initial.id, contactId: linkedClinicContactId }).catch(() => {})
    }
    setLinkedClinicContactId(contactId)
    setClinicName(contact.name)
    if (initial?.id) {
      await invoke('appointment_link_contact', { appointmentId: initial.id, contactId }).catch(() => {})
    }
  }

  async function handleClinicContactClear() {
    if (linkedClinicContactId && initial?.id) {
      await invoke('appointment_unlink_contact', { appointmentId: initial.id, contactId: linkedClinicContactId }).catch(() => {})
    }
    setLinkedClinicContactId(null)
  }

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
      const linkedContactIds = [linkedDoctorContactId, linkedClinicContactId].filter((id): id is string => id !== null)
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
        reminder_offsets: { min15: remMin15, hr1: remHr1, day1: remDay1 },
        recurrence: repeatRule !== 'none' ? {
          rule: repeatRule,
          intervalN: repeatInterval,
          untilDate: repeatUntil ? `${repeatUntil}T00:00:00` : undefined,
          occurrences: repeatOccurrences,
        } : undefined,
        linked_contact_ids: linkedContactIds.length > 0 ? linkedContactIds : undefined,
      })
    } catch (err: unknown) {
      setError(extractTauriError(err))
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
          {allContacts.some((c) => DOCTOR_ROLES.has(c.role)) ? (
            <div className="space-y-1">
              <select
                id="appt-doctor-picker"
                value={linkedDoctorContactId ?? ''}
                onChange={(e) => {
                  if (e.target.value) void handleDoctorContactSelect(e.target.value)
                  else void handleDoctorContactClear()
                }}
                className={inputClass}
                aria-label="Select doctor from contacts"
              >
                <option value="">— Select from contacts —</option>
                {allContacts
                  .filter((c) => DOCTOR_ROLES.has(c.role))
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}{c.specialty ? ` (${c.specialty})` : ''}
                    </option>
                  ))}
              </select>
              <input
                id="appt-doctor"
                type="text"
                value={doctorName}
                onChange={(e) => setDoctorName(e.target.value)}
                placeholder="Or type a name"
                className={inputClass}
                aria-label="Doctor name (free text)"
              />
            </div>
          ) : (
            <input
              id="appt-doctor"
              type="text"
              value={doctorName}
              onChange={(e) => setDoctorName(e.target.value)}
              placeholder="Dr. Smith"
              className={inputClass}
            />
          )}
        </div>
        <div>
          <label htmlFor="appt-clinic" className={labelClass}>Clinic / Hospital</label>
          {allClinics.length > 0 ? (
            <div className="space-y-1">
              <select
                id="appt-clinic-picker"
                value={selectedClinicId ?? ''}
                onChange={(e) => {
                  const id = e.target.value
                  if (id) {
                    const clinic = allClinics.find((c) => c.id === id)
                    if (clinic) {
                      setSelectedClinicId(id)
                      setClinicName(clinic.name)
                    }
                  } else {
                    setSelectedClinicId(null)
                  }
                }}
                className={inputClass}
                aria-label="Select clinic"
              >
                <option value="">— Select clinic —</option>
                {allClinics.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <input
                id="appt-clinic"
                type="text"
                value={clinicName}
                onChange={(e) => {
                  setClinicName(e.target.value)
                  setSelectedClinicId(null)
                }}
                placeholder="Or type a name"
                className={inputClass}
                aria-label="Clinic name (free text)"
              />
            </div>
          ) : (
            <input
              id="appt-clinic"
              type="text"
              value={clinicName}
              onChange={(e) => setClinicName(e.target.value)}
              placeholder="City Medical Centre"
              className={inputClass}
            />
          )}
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
        <fieldset>
          <legend className={labelClass}>Reminders</legend>
          <div className="flex flex-wrap gap-4 mt-1">
            {([
              { id: 'rem-day1', label: '1 day before', checked: remDay1, set: setRemDay1 },
              { id: 'rem-hr1', label: '1 hour before', checked: remHr1, set: setRemHr1 },
              { id: 'rem-min15', label: '15 min before', checked: remMin15, set: setRemMin15 },
            ] as const).map(({ id, label, checked, set }) => (
              <label key={id} htmlFor={id} className="flex items-center gap-2 cursor-pointer text-[var(--text-sm)] text-[var(--color-text)]">
                <input
                  id={id}
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => set(e.target.checked)}
                  className="rounded border-[var(--color-border)] accent-[var(--color-accent)]"
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      <div>
        <label htmlFor="appt-repeat" className={labelClass}>Repeat</label>
        <select
          id="appt-repeat"
          value={repeatRule}
          onChange={(e) => setRepeatRule(e.target.value as 'none' | 'weekly' | 'monthly')}
          className={inputClass}
        >
          <option value="none">Does not repeat</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
        </select>
      </div>

      {repeatRule !== 'none' && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="appt-repeat-interval" className={labelClass}>
              Every
            </label>
            <div className="flex items-center gap-2">
              <input
                id="appt-repeat-interval"
                type="number"
                min="1"
                max="52"
                value={repeatInterval}
                onChange={(e) => setRepeatInterval(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className={`${inputClass} w-20`}
              />
              <span className="text-[var(--text-sm)] text-[var(--color-text-secondary)]">
                {repeatRule === 'weekly' ? 'week(s)' : 'month(s)'}
              </span>
            </div>
          </div>
          <div>
            <label htmlFor="appt-repeat-occurrences" className={labelClass}>
              Occurrences (max 104)
            </label>
            <input
              id="appt-repeat-occurrences"
              type="number"
              min="1"
              max="104"
              value={repeatOccurrences}
              onChange={(e) =>
                setRepeatOccurrences(Math.min(104, Math.max(1, parseInt(e.target.value, 10) || 1)))
              }
              className={inputClass}
            />
          </div>
          <div className="col-span-2">
            <label htmlFor="appt-repeat-until" className={labelClass}>
              End date <span className="text-[var(--color-text-secondary)]">(optional)</span>
            </label>
            <input
              id="appt-repeat-until"
              type="date"
              value={repeatUntil}
              onChange={(e) => setRepeatUntil(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>
      )}

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

      <div>
        <label className={labelClass}>Categories</label>
        <CategoryPicker
          categories={allCategories}
          selectedIds={selectedCategoryIds}
          onChange={handleCategoryChange}
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

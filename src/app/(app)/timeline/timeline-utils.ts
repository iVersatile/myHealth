import type { Appointment } from '../../../store/appointmentsStore'

export interface TimelineEvent {
  id: string
  type: 'document' | 'appointment' | 'note'
  date: Date
  title: string
  subtitle: string | null
  badge: string
  href: string
  rawId: string
}

export function apptToEvent(a: Appointment): TimelineEvent {
  const parts = [a.doctor_name, a.clinic_name].filter(Boolean)
  return {
    id: `appt-${a.id}`,
    rawId: a.id,
    type: 'appointment',
    date: new Date(a.appt_date),
    title: `${a.title} — ${a.status.charAt(0).toUpperCase() + a.status.slice(1)}`,
    subtitle: parts.length > 0 ? parts.join(' · ') : null,
    badge: '🗓',
    href: `/appointments`,
  }
}

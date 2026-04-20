import { create } from 'zustand'

export interface Appointment {
  id: string
  title: string
  doctor_name: string | null
  clinic_name: string | null
  specialty: string | null
  appt_date: string
  duration_min: number
  location: string | null
  notes: string | null
  status: AppointmentStatus
  reminder_min: number
  created_at: string
  updated_at: string
  document_ids: string[]
}

export type AppointmentStatus = 'scheduled' | 'completed' | 'cancelled' | 'missed'

export const STATUS_LABELS: Record<AppointmentStatus, string> = {
  scheduled: 'Scheduled',
  completed: 'Completed',
  cancelled: 'Cancelled',
  missed: 'Missed',
}

export const SPECIALTY_OPTIONS = [
  'General Practice',
  'Cardiology',
  'Dermatology',
  'Endocrinology',
  'Gastroenterology',
  'Neurology',
  'Oncology',
  'Ophthalmology',
  'Orthopaedics',
  'Physiotherapy',
  'Psychiatry',
  'Radiology',
  'Rheumatology',
  'Urology',
  'Other',
]

export const REMINDER_OPTIONS: { label: string; value: number }[] = [
  { label: '15 minutes', value: 15 },
  { label: '30 minutes', value: 30 },
  { label: '1 hour', value: 60 },
  { label: '2 hours', value: 120 },
  { label: '1 day', value: 1440 },
  { label: '2 days', value: 2880 },
]

interface AppointmentsState {
  appointments: Appointment[]
  statusFilter: AppointmentStatus | 'all'
  loading: boolean
  error: string | null
  setAppointments: (appointments: Appointment[]) => void
  setStatusFilter: (filter: AppointmentStatus | 'all') => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  upsertAppointment: (appointment: Appointment) => void
  removeAppointment: (id: string) => void
}

export const useAppointmentsStore = create<AppointmentsState>((set) => ({
  appointments: [],
  statusFilter: 'all',
  loading: false,
  error: null,

  setAppointments: (appointments) => set({ appointments }),
  setStatusFilter: (statusFilter) => set({ statusFilter }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  upsertAppointment: (appointment) =>
    set((s) => {
      const idx = s.appointments.findIndex((a) => a.id === appointment.id)
      if (idx === -1) {
        return { appointments: [appointment, ...s.appointments] }
      }
      const next = [...s.appointments]
      next[idx] = appointment
      return { appointments: next }
    }),
  removeAppointment: (id) =>
    set((s) => ({ appointments: s.appointments.filter((a) => a.id !== id) })),
}))

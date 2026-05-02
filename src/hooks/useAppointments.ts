import { useCallback, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import {
  Appointment,
  AppointmentStatus,
  useAppointmentsStore,
} from '../store/appointmentsStore'

export interface RecurrenceInput {
  rule: 'weekly' | 'monthly'
  intervalN: number
  untilDate?: string
  occurrences: number
}

export interface AppointmentInput {
  title: string
  doctor_name: string | null
  clinic_name: string | null
  specialty: string | null
  appt_date: string
  duration_min: number | null
  location: string | null
  notes: string | null
  status: string | null
  reminder_min: number | null
  reminder_offsets?: { min15: boolean; hr1: boolean; day1: boolean }
  recurrence?: RecurrenceInput
}

export function useAppointments() {
  const appointments = useAppointmentsStore(s => s.appointments)
  const statusFilter = useAppointmentsStore(s => s.statusFilter)
  const loading = useAppointmentsStore(s => s.loading)
  const error = useAppointmentsStore(s => s.error)
  const setAppointments = useAppointmentsStore(s => s.setAppointments)
  const setStatusFilter = useAppointmentsStore(s => s.setStatusFilter)
  const setLoading = useAppointmentsStore(s => s.setLoading)
  const setError = useAppointmentsStore(s => s.setError)
  const upsertAppointment = useAppointmentsStore(s => s.upsertAppointment)
  const removeAppointment = useAppointmentsStore(s => s.removeAppointment)

  const fetchAppointments = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const status = statusFilter === 'all' ? null : statusFilter
      const appts = await invoke<Appointment[]>('appointments_list', {
        month: null,
        status,
      })
      setAppointments(appts)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [statusFilter, setAppointments, setLoading, setError])

  useEffect(() => {
    void fetchAppointments()
  }, [fetchAppointments])

  async function createAppointment(input: AppointmentInput): Promise<Appointment> {
    const appt = await invoke<Appointment>('appointments_create', { input })
    upsertAppointment(appt)
    return appt
  }

  async function updateAppointment(id: string, input: AppointmentInput): Promise<Appointment> {
    const appt = await invoke<Appointment>('appointments_update', { id, input })
    upsertAppointment(appt)
    return appt
  }

  async function deleteAppointment(id: string): Promise<void> {
    await invoke('appointments_delete', { id })
    removeAppointment(id)
  }

  async function linkContact(appointmentId: string, contactId: string): Promise<void> {
    await invoke('appointment_link_contact', { appointmentId, contactId })
    const appt = await invoke<Appointment>('appointments_get', { id: appointmentId })
    upsertAppointment(appt)
  }

  async function unlinkContact(appointmentId: string, contactId: string): Promise<void> {
    await invoke('appointment_unlink_contact', { appointmentId, contactId })
    const appt = await invoke<Appointment>('appointments_get', { id: appointmentId })
    upsertAppointment(appt)
  }

  function filterByStatus(status: AppointmentStatus | 'all'): void {
    setStatusFilter(status)
  }

  return {
    appointments,
    statusFilter,
    loading,
    error,
    createAppointment,
    updateAppointment,
    deleteAppointment,
    linkContact,
    unlinkContact,
    filterByStatus,
    refresh: fetchAppointments,
  }
}

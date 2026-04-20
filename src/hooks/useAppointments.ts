import { useCallback, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import {
  Appointment,
  AppointmentStatus,
  useAppointmentsStore,
} from '../store/appointmentsStore'

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
}

export function useAppointments() {
  const {
    appointments,
    statusFilter,
    loading,
    error,
    setAppointments,
    setStatusFilter,
    setLoading,
    setError,
    upsertAppointment,
    removeAppointment,
  } = useAppointmentsStore()

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
    filterByStatus,
    refresh: fetchAppointments,
  }
}

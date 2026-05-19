import { describe, it, expect, beforeEach } from 'vitest'
import { useAppointmentsStore } from '../appointmentsStore'
import type { Appointment } from '../appointmentsStore'

const makeAppt = (overrides: Partial<Appointment> = {}): Appointment => ({
  id: 'a1',
  title: 'Checkup',
  doctor_name: 'Dr. Smith',
  clinic_name: 'City Clinic',
  specialty: 'General Practice',
  appt_date: '2026-04-20T10:00:00',
  duration_min: 30,
  location: 'Room 1',
  notes: null,
  status: 'scheduled',
  reminder_min: 60,
  created_at: '2026-04-01T00:00:00',
  updated_at: '2026-04-01T00:00:00',
  document_ids: [],
  contact_ids: [],
  recurrence_series_id: null,
  ...overrides,
})

beforeEach(() => {
  useAppointmentsStore.setState({
    appointments: [],
    statusFilter: 'all',
    loading: false,
    error: null,
  })
})

describe('useAppointmentsStore', () => {
  it('starts with empty appointments', () => {
    const { appointments } = useAppointmentsStore.getState()
    expect(appointments).toEqual([])
  })

  it('starts with statusFilter all', () => {
    expect(useAppointmentsStore.getState().statusFilter).toBe('all')
  })

  it('setAppointments replaces the list', () => {
    const appts = [makeAppt(), makeAppt({ id: 'a2', title: 'Dental' })]
    useAppointmentsStore.getState().setAppointments(appts)
    expect(useAppointmentsStore.getState().appointments).toEqual(appts)
  })

  it('setStatusFilter updates filter', () => {
    useAppointmentsStore.getState().setStatusFilter('completed')
    expect(useAppointmentsStore.getState().statusFilter).toBe('completed')
  })

  it('setLoading toggles loading flag', () => {
    useAppointmentsStore.getState().setLoading(true)
    expect(useAppointmentsStore.getState().loading).toBe(true)
    useAppointmentsStore.getState().setLoading(false)
    expect(useAppointmentsStore.getState().loading).toBe(false)
  })

  it('setError stores error message', () => {
    useAppointmentsStore.getState().setError('Network failure')
    expect(useAppointmentsStore.getState().error).toBe('Network failure')
  })

  it('setError clears error when null', () => {
    useAppointmentsStore.getState().setError('err')
    useAppointmentsStore.getState().setError(null)
    expect(useAppointmentsStore.getState().error).toBeNull()
  })

  it('upsertAppointment prepends new appointment', () => {
    const existing = makeAppt({ id: 'a1' })
    useAppointmentsStore.getState().setAppointments([existing])
    const newAppt = makeAppt({ id: 'a2', title: 'Dental' })
    useAppointmentsStore.getState().upsertAppointment(newAppt)
    const { appointments } = useAppointmentsStore.getState()
    expect(appointments[0]).toEqual(newAppt)
    expect(appointments).toHaveLength(2)
  })

  it('upsertAppointment updates existing appointment in place', () => {
    const original = makeAppt({ id: 'a1', title: 'Checkup' })
    useAppointmentsStore.getState().setAppointments([original])
    const updated = makeAppt({ id: 'a1', title: 'Updated Checkup' })
    useAppointmentsStore.getState().upsertAppointment(updated)
    const { appointments } = useAppointmentsStore.getState()
    expect(appointments).toHaveLength(1)
    expect(appointments[0]!.title).toBe('Updated Checkup')
  })

  it('removeAppointment removes by id', () => {
    useAppointmentsStore.getState().setAppointments([makeAppt({ id: 'a1' }), makeAppt({ id: 'a2' })])
    useAppointmentsStore.getState().removeAppointment('a1')
    const { appointments } = useAppointmentsStore.getState()
    expect(appointments).toHaveLength(1)
    expect(appointments[0]!.id).toBe('a2')
  })

  it('removeAppointment is a no-op for unknown id', () => {
    useAppointmentsStore.getState().setAppointments([makeAppt({ id: 'a1' })])
    useAppointmentsStore.getState().removeAppointment('unknown')
    expect(useAppointmentsStore.getState().appointments).toHaveLength(1)
  })
})

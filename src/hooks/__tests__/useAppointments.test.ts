import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import type { Appointment } from '../../store/appointmentsStore'
import { useAppointmentsStore } from '../../store/appointmentsStore'

const mockInvoke = vi.fn()

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}))

const makeAppt = (overrides: Partial<Appointment> = {}): Appointment => ({
  id: 'a1',
  title: 'Checkup',
  doctor_name: null,
  clinic_name: null,
  specialty: null,
  appt_date: '2026-04-20T10:00:00',
  duration_min: 30,
  location: null,
  notes: null,
  status: 'scheduled',
  reminder_min: 60,
  created_at: '2026-04-01T00:00:00',
  updated_at: '2026-04-01T00:00:00',
  document_ids: [],
  ...overrides,
})

beforeEach(() => {
  vi.clearAllMocks()
  useAppointmentsStore.setState({
    appointments: [],
    statusFilter: 'all',
    loading: false,
    error: null,
  })
})

describe('useAppointments', () => {
  it('fetches appointments on mount', async () => {
    const { useAppointments } = await import('../useAppointments')
    const appts = [makeAppt()]
    mockInvoke.mockResolvedValueOnce(appts)

    const { result } = renderHook(() => useAppointments())

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(mockInvoke).toHaveBeenCalledWith('appointments_list', { month: null, status: null })
    expect(result.current.appointments).toEqual(appts)
  })

  it('sets error when fetch fails', async () => {
    const { useAppointments } = await import('../useAppointments')
    mockInvoke.mockRejectedValueOnce(new Error('DB error'))

    const { result } = renderHook(() => useAppointments())

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe('DB error')
  })

  it('sets error string when fetch fails with non-Error value', async () => {
    const { useAppointments } = await import('../useAppointments')
    mockInvoke.mockRejectedValueOnce('raw string error')

    const { result } = renderHook(() => useAppointments())

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe('raw string error')
  })

  it('passes status filter to invoke when not all', async () => {
    const { useAppointments } = await import('../useAppointments')
    useAppointmentsStore.setState({ statusFilter: 'completed' })
    mockInvoke.mockResolvedValueOnce([])

    renderHook(() => useAppointments())

    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith('appointments_list', { month: null, status: 'completed' })
    )
  })

  it('createAppointment calls invoke and upserts', async () => {
    const { useAppointments } = await import('../useAppointments')
    mockInvoke.mockResolvedValueOnce([])
    const newAppt = makeAppt({ id: 'a2', title: 'Dental' })
    mockInvoke.mockResolvedValueOnce(newAppt)

    const { result } = renderHook(() => useAppointments())
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.createAppointment({
        title: 'Dental',
        doctor_name: null,
        clinic_name: null,
        specialty: null,
        appt_date: '2026-05-01T09:00:00',
        duration_min: null,
        location: null,
        notes: null,
        status: null,
        reminder_min: null,
      })
    })

    expect(mockInvoke).toHaveBeenCalledWith(
      'appointments_create',
      expect.objectContaining({ input: expect.objectContaining({ title: 'Dental' }) })
    )
    expect(result.current.appointments.some((a) => a.id === 'a2')).toBe(true)
  })

  it('updateAppointment calls invoke and upserts', async () => {
    const { useAppointments } = await import('../useAppointments')
    const original = makeAppt({ id: 'a1' })
    useAppointmentsStore.setState({ appointments: [original] })
    mockInvoke.mockResolvedValueOnce([original])

    const updated = makeAppt({ id: 'a1', title: 'Updated' })
    mockInvoke.mockResolvedValueOnce(updated)

    const { result } = renderHook(() => useAppointments())
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.updateAppointment('a1', {
        title: 'Updated',
        doctor_name: null,
        clinic_name: null,
        specialty: null,
        appt_date: '2026-04-20T10:00:00',
        duration_min: null,
        location: null,
        notes: null,
        status: null,
        reminder_min: null,
      })
    })

    expect(mockInvoke).toHaveBeenCalledWith(
      'appointments_update',
      expect.objectContaining({ id: 'a1' })
    )
    expect(result.current.appointments.find((a) => a.id === 'a1')?.title).toBe('Updated')
  })

  it('deleteAppointment calls invoke and removes', async () => {
    const { useAppointments } = await import('../useAppointments')
    const appt = makeAppt({ id: 'a1' })
    useAppointmentsStore.setState({ appointments: [appt] })
    mockInvoke.mockResolvedValueOnce([appt])
    mockInvoke.mockResolvedValueOnce(undefined)

    const { result } = renderHook(() => useAppointments())
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.deleteAppointment('a1')
    })

    expect(mockInvoke).toHaveBeenCalledWith('appointments_delete', { id: 'a1' })
    expect(result.current.appointments).toHaveLength(0)
  })

  it('filterByStatus updates the store filter', async () => {
    const { useAppointments } = await import('../useAppointments')
    mockInvoke.mockResolvedValue([])

    const { result } = renderHook(() => useAppointments())
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => {
      result.current.filterByStatus('cancelled')
    })

    expect(useAppointmentsStore.getState().statusFilter).toBe('cancelled')
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import type { Medication } from '../useMedications'

const mockInvoke = vi.fn()

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}))

const makeMedication = (overrides: Partial<Medication> = {}): Medication => ({
  id: 'm1',
  name: 'Ibuprofen',
  dosage: '400mg',
  frequency: 'Twice daily',
  start_date: '2026-01-01',
  end_date: null,
  notes: null,
  deleted_at: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...overrides,
})

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useMedications', () => {
  it('fetches medications on mount', async () => {
    const { useMedications } = await import('../useMedications')
    const list = [makeMedication({ id: 'a' }), makeMedication({ id: 'b' })]
    mockInvoke.mockResolvedValueOnce(list)

    const { result } = renderHook(() => useMedications())

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(mockInvoke).toHaveBeenCalledWith('medications_list')
    expect(result.current.medications).toEqual(list)
  })

  it('sets error when fetch fails with Error object', async () => {
    const { useMedications } = await import('../useMedications')
    mockInvoke.mockRejectedValueOnce(new Error('DB error'))

    const { result } = renderHook(() => useMedications())

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe('DB error')
  })

  it('sets error when fetch fails with non-Error value', async () => {
    const { useMedications } = await import('../useMedications')
    mockInvoke.mockRejectedValueOnce('network failure')

    const { result } = renderHook(() => useMedications())

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe('network failure')
  })

  it('createMedication invokes medications_create and reloads list', async () => {
    const { useMedications } = await import('../useMedications')
    const created = makeMedication({ id: 'new', name: 'Aspirin' })
    mockInvoke.mockResolvedValueOnce([])
    mockInvoke.mockResolvedValueOnce(created)
    mockInvoke.mockResolvedValueOnce([created])

    const { result } = renderHook(() => useMedications())
    await waitFor(() => expect(result.current.loading).toBe(false))

    let returned: Medication | undefined
    await act(async () => {
      returned = await result.current.createMedication({ name: 'Aspirin', dosage: '100mg' })
    })

    expect(mockInvoke).toHaveBeenCalledWith('medications_create', { input: { name: 'Aspirin', dosage: '100mg' } })
    expect(returned?.id).toBe('new')
    await waitFor(() => expect(result.current.medications).toEqual([created]))
  })

  it('updateMedication invokes medications_update and reloads list', async () => {
    const { useMedications } = await import('../useMedications')
    const original = makeMedication({ id: 'm1', name: 'Ibuprofen' })
    const updated = makeMedication({ id: 'm1', name: 'Ibuprofen', dosage: '800mg' })
    mockInvoke.mockResolvedValueOnce([original])
    mockInvoke.mockResolvedValueOnce(updated)
    mockInvoke.mockResolvedValueOnce([updated])

    const { result } = renderHook(() => useMedications())
    await waitFor(() => expect(result.current.loading).toBe(false))

    let returned: Medication | undefined
    await act(async () => {
      returned = await result.current.updateMedication('m1', { dosage: '800mg' })
    })

    expect(mockInvoke).toHaveBeenCalledWith('medications_update', { id: 'm1', input: { dosage: '800mg' } })
    expect(returned?.dosage).toBe('800mg')
    await waitFor(() => expect(result.current.medications[0]?.dosage).toBe('800mg'))
  })

  it('deleteMedication invokes medications_delete and reloads list', async () => {
    const { useMedications } = await import('../useMedications')
    const medication = makeMedication({ id: 'm1' })
    mockInvoke.mockResolvedValueOnce([medication])
    mockInvoke.mockResolvedValueOnce(undefined)
    mockInvoke.mockResolvedValueOnce([])

    const { result } = renderHook(() => useMedications())
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.deleteMedication('m1')
    })

    expect(mockInvoke).toHaveBeenCalledWith('medications_delete', { id: 'm1' })
    await waitFor(() => expect(result.current.medications).toEqual([]))
  })
})

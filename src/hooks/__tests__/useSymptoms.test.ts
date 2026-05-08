import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import type { Symptom } from '../useSymptoms'

const mockInvoke = vi.fn()

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}))

const makeSymptom = (overrides: Partial<Symptom> = {}): Symptom => ({
  id: 's1',
  name: 'Headache',
  severity: 5,
  onset_date: '2026-01-01',
  notes: null,
  deleted_at: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...overrides,
})

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useSymptoms', () => {
  it('fetches symptoms on mount', async () => {
    const { useSymptoms } = await import('../useSymptoms')
    const list = [makeSymptom({ id: 'a' }), makeSymptom({ id: 'b' })]
    mockInvoke.mockResolvedValueOnce(list)

    const { result } = renderHook(() => useSymptoms())

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(mockInvoke).toHaveBeenCalledWith('symptoms_list')
    expect(result.current.symptoms).toEqual(list)
  })

  it('sets error when fetch fails with Error object', async () => {
    const { useSymptoms } = await import('../useSymptoms')
    mockInvoke.mockRejectedValueOnce(new Error('DB error'))

    const { result } = renderHook(() => useSymptoms())

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe('DB error')
  })

  it('sets error when fetch fails with non-Error value', async () => {
    const { useSymptoms } = await import('../useSymptoms')
    mockInvoke.mockRejectedValueOnce('network failure')

    const { result } = renderHook(() => useSymptoms())

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe('Failed to load symptoms')
  })

  it('createSymptom invokes symptoms_create and reloads list', async () => {
    const { useSymptoms } = await import('../useSymptoms')
    const created = makeSymptom({ id: 'new', name: 'Fatigue' })
    mockInvoke.mockResolvedValueOnce([])
    mockInvoke.mockResolvedValueOnce(created)
    mockInvoke.mockResolvedValueOnce([created])

    const { result } = renderHook(() => useSymptoms())
    await waitFor(() => expect(result.current.loading).toBe(false))

    let returned: Symptom | undefined
    await act(async () => {
      returned = await result.current.createSymptom({ name: 'Fatigue', severity: 3 })
    })

    expect(mockInvoke).toHaveBeenCalledWith('symptoms_create', { input: { name: 'Fatigue', severity: 3 } })
    expect(returned?.id).toBe('new')
    await waitFor(() => expect(result.current.symptoms).toEqual([created]))
  })

  it('updateSymptom invokes symptoms_update and reloads list', async () => {
    const { useSymptoms } = await import('../useSymptoms')
    const original = makeSymptom({ id: 's1', name: 'Headache' })
    const updated = makeSymptom({ id: 's1', name: 'Migraine' })
    mockInvoke.mockResolvedValueOnce([original])
    mockInvoke.mockResolvedValueOnce(updated)
    mockInvoke.mockResolvedValueOnce([updated])

    const { result } = renderHook(() => useSymptoms())
    await waitFor(() => expect(result.current.loading).toBe(false))

    let returned: Symptom | undefined
    await act(async () => {
      returned = await result.current.updateSymptom('s1', { name: 'Migraine' })
    })

    expect(mockInvoke).toHaveBeenCalledWith('symptoms_update', { id: 's1', input: { name: 'Migraine' } })
    expect(returned?.name).toBe('Migraine')
    await waitFor(() => expect(result.current.symptoms[0]?.name).toBe('Migraine'))
  })

  it('deleteSymptom invokes symptoms_delete and reloads list', async () => {
    const { useSymptoms } = await import('../useSymptoms')
    const symptom = makeSymptom({ id: 's1' })
    mockInvoke.mockResolvedValueOnce([symptom])
    mockInvoke.mockResolvedValueOnce(undefined)
    mockInvoke.mockResolvedValueOnce([])

    const { result } = renderHook(() => useSymptoms())
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.deleteSymptom('s1')
    })

    expect(mockInvoke).toHaveBeenCalledWith('symptoms_delete', { id: 's1' })
    await waitFor(() => expect(result.current.symptoms).toEqual([]))
  })
})

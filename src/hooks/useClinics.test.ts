import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { useClinics } from './useClinics'
import type { ClinicWithContacts } from './useClinics'

const mockInvoke = vi.fn()
vi.mock('@tauri-apps/api/core', () => ({ invoke: (...args: unknown[]) => mockInvoke(...args) }))

const fakeClinic: ClinicWithContacts = {
  id: 'c-1',
  name: 'Test Clinic',
  address: null,
  phone: null,
  created_at: '2026-05-01T10:00:00Z',
  company_registration_number: null,
  linked_contacts: [{ id: 'ct-1', name: 'Dr Test', role: 'gp' }],
}

describe('useClinics', () => {
  beforeEach(() => {
    mockInvoke.mockReset()
  })

  it('starts with loading=true and empty clinics', () => {
    mockInvoke.mockReturnValue(new Promise(() => {}))
    const { result } = renderHook(() => useClinics())
    expect(result.current.loading).toBe(true)
    expect(result.current.clinics).toEqual([])
    expect(result.current.error).toBeNull()
  })

  // TC-F8-01: list returns clinics with linked contacts
  it('populates clinics on successful invoke', async () => {
    mockInvoke.mockResolvedValue([fakeClinic])
    const { result } = renderHook(() => useClinics())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(mockInvoke).toHaveBeenCalledWith('clinics_list_with_contacts')
    expect(result.current.clinics).toEqual([fakeClinic])
    expect(result.current.error).toBeNull()
  })

  // TC-F8-01: empty list
  it('handles empty list from invoke', async () => {
    mockInvoke.mockResolvedValue([])
    const { result } = renderHook(() => useClinics())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.clinics).toEqual([])
  })

  it('sets error when invoke rejects', async () => {
    mockInvoke.mockRejectedValue(new Error('DB error'))
    const { result } = renderHook(() => useClinics())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe('DB error')
    expect(result.current.clinics).toEqual([])
  })

  it('sets raw string error when non-Error is thrown', async () => {
    mockInvoke.mockRejectedValue('string error')
    const { result } = renderHook(() => useClinics())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe('string error')
  })

  it('reload re-fetches data', async () => {
    mockInvoke.mockResolvedValue([fakeClinic])
    const { result } = renderHook(() => useClinics())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.clinics).toHaveLength(1)

    mockInvoke.mockResolvedValue([])
    await act(async () => {
      result.current.reload()
    })
    expect(result.current.clinics).toHaveLength(0)
    expect(result.current.loading).toBe(false)
  })
})

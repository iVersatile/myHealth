import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useContactsStore } from '../../store/contactsStore'
import type { Contact } from '../../store/contactsStore'

const mockInvoke = vi.fn()

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}))

const makeContact = (overrides: Partial<Contact> = {}): Contact => ({
  id: 'c1',
  name: 'Dr. Smith',
  role: 'gp',
  specialty: null,
  phone: null,
  email: null,
  clinic: null,
  address: null,
  notes: null,
  created_at: '2026-04-20T10:00:00Z',
  updated_at: '2026-04-20T10:00:00Z',
  ...overrides,
})

beforeEach(() => {
  vi.clearAllMocks()
  useContactsStore.setState({ contacts: [], loading: false, error: null })
})

async function getHook(roleFilter?: string) {
  const { useContacts } = await import('../useContacts')
  return renderHook(() => useContacts(roleFilter))
}

describe('fetch on mount', () => {
  it('calls contacts_list and populates store', async () => {
    const contacts = [makeContact({ id: 'c1' }), makeContact({ id: 'c2', name: 'Dr. Jones', role: 'specialist' })]
    mockInvoke.mockResolvedValueOnce(contacts)

    const { result } = await getHook()
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(mockInvoke).toHaveBeenCalledWith('contacts_list', {})
    expect(result.current.contacts).toEqual(contacts)
  })

  it('passes role filter to contacts_list', async () => {
    mockInvoke.mockResolvedValueOnce([])

    const { result } = await getHook('specialist')
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(mockInvoke).toHaveBeenCalledWith('contacts_list', { role: 'specialist' })
  })

  it('sets error state on fetch failure', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('DB locked'))

    const { result } = await getHook()
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.error).toBe('DB locked')
    expect(result.current.contacts).toEqual([])
  })
})

describe('createContact', () => {
  it('invokes contacts_create and upserts into store', async () => {
    mockInvoke.mockResolvedValueOnce([])
    const { result } = await getHook()
    await waitFor(() => expect(result.current.loading).toBe(false))

    const created = makeContact({ id: 'c99', name: 'New Doctor' })
    mockInvoke.mockResolvedValueOnce(created)

    let returned: Contact | undefined
    await act(async () => {
      returned = await result.current.createContact({
        name: 'New Doctor',
        role: 'gp',
      })
    })

    expect(mockInvoke).toHaveBeenCalledWith('contacts_create', {
      input: { name: 'New Doctor', role: 'gp' },
    })
    expect(returned).toEqual(created)
    expect(useContactsStore.getState().contacts).toContainEqual(created)
  })

  it('throws on contacts_create failure', async () => {
    mockInvoke.mockResolvedValueOnce([])
    const { result } = await getHook()
    await waitFor(() => expect(result.current.loading).toBe(false))

    mockInvoke.mockRejectedValueOnce(new Error('write failed'))

    await expect(
      act(async () => {
        await result.current.createContact({ name: 'X', role: 'gp' })
      }),
    ).rejects.toThrow('write failed')
  })
})

describe('updateContact', () => {
  it('invokes contacts_update and upserts into store', async () => {
    const original = makeContact({ id: 'c1', name: 'Old Name' })
    mockInvoke.mockResolvedValueOnce([original])

    const { result } = await getHook()
    await waitFor(() => expect(result.current.loading).toBe(false))

    const updated = makeContact({ id: 'c1', name: 'New Name' })
    mockInvoke.mockResolvedValueOnce(updated)

    let returned: Contact | undefined
    await act(async () => {
      returned = await result.current.updateContact({ id: 'c1', name: 'New Name' })
    })

    expect(mockInvoke).toHaveBeenCalledWith('contacts_update', {
      input: { id: 'c1', name: 'New Name' },
    })
    expect(returned).toEqual(updated)
    expect(useContactsStore.getState().contacts[0]?.name).toBe('New Name')
  })
})

describe('deleteContact', () => {
  it('invokes contacts_delete and removes from store', async () => {
    const c = makeContact({ id: 'c1' })
    mockInvoke.mockResolvedValueOnce([c])

    const { result } = await getHook()
    await waitFor(() => expect(result.current.loading).toBe(false))

    mockInvoke.mockResolvedValueOnce(undefined)

    await act(async () => {
      await result.current.deleteContact('c1')
    })

    expect(mockInvoke).toHaveBeenCalledWith('contacts_delete', { id: 'c1' })
    expect(useContactsStore.getState().contacts).toHaveLength(0)
  })

  it('throws on contacts_delete failure', async () => {
    mockInvoke.mockResolvedValueOnce([makeContact()])
    const { result } = await getHook()
    await waitFor(() => expect(result.current.loading).toBe(false))

    mockInvoke.mockRejectedValueOnce(new Error('delete failed'))

    await expect(
      act(async () => {
        await result.current.deleteContact('c1')
      }),
    ).rejects.toThrow('delete failed')
  })
})

describe('refresh', () => {
  it('re-fetches contacts', async () => {
    mockInvoke.mockResolvedValueOnce([])
    const { result } = await getHook()
    await waitFor(() => expect(result.current.loading).toBe(false))

    const freshContacts = [makeContact({ id: 'c10', name: 'Dr. Refresh' })]
    mockInvoke.mockResolvedValueOnce(freshContacts)

    await act(async () => {
      await result.current.refresh()
    })

    expect(result.current.contacts).toEqual(freshContacts)
  })
})

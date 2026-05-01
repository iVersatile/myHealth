import { describe, it, expect, beforeEach } from 'vitest'
import { useContactsStore, type Contact } from '../contactsStore'

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
  contact_clinic_id: null,
  created_at: '2026-04-20T10:00:00Z',
  updated_at: '2026-04-20T10:00:00Z',
  ...overrides,
})

beforeEach(() => {
  useContactsStore.setState({ contacts: [], loading: false, error: null })
})

describe('initial state', () => {
  it('starts empty', () => {
    const { contacts, loading, error } = useContactsStore.getState()
    expect(contacts).toEqual([])
    expect(loading).toBe(false)
    expect(error).toBeNull()
  })
})

describe('setContacts', () => {
  it('replaces contacts list', () => {
    const c = makeContact()
    useContactsStore.getState().setContacts([c])
    expect(useContactsStore.getState().contacts).toEqual([c])
  })

  it('overwrites previous list', () => {
    useContactsStore.getState().setContacts([makeContact({ id: 'c1' })])
    useContactsStore.getState().setContacts([makeContact({ id: 'c2' })])
    expect(useContactsStore.getState().contacts).toHaveLength(1)
    expect(useContactsStore.getState().contacts[0]?.id).toBe('c2')
  })
})

describe('setLoading', () => {
  it('sets loading true', () => {
    useContactsStore.getState().setLoading(true)
    expect(useContactsStore.getState().loading).toBe(true)
  })

  it('sets loading false', () => {
    useContactsStore.setState({ loading: true })
    useContactsStore.getState().setLoading(false)
    expect(useContactsStore.getState().loading).toBe(false)
  })
})

describe('setError', () => {
  it('sets error message', () => {
    useContactsStore.getState().setError('network error')
    expect(useContactsStore.getState().error).toBe('network error')
  })

  it('clears error', () => {
    useContactsStore.setState({ error: 'stale error' })
    useContactsStore.getState().setError(null)
    expect(useContactsStore.getState().error).toBeNull()
  })
})

describe('upsertContact', () => {
  it('prepends a new contact', () => {
    const existing = makeContact({ id: 'c1' })
    useContactsStore.getState().setContacts([existing])
    const newC = makeContact({ id: 'c2', name: 'Dr. Jones' })
    useContactsStore.getState().upsertContact(newC)
    const { contacts } = useContactsStore.getState()
    expect(contacts).toHaveLength(2)
    expect(contacts[0]?.id).toBe('c2')
  })

  it('updates an existing contact in place', () => {
    const original = makeContact({ id: 'c1', name: 'Old Name' })
    useContactsStore.getState().setContacts([original])
    const updated = makeContact({ id: 'c1', name: 'New Name' })
    useContactsStore.getState().upsertContact(updated)
    const { contacts } = useContactsStore.getState()
    expect(contacts).toHaveLength(1)
    expect(contacts[0]?.name).toBe('New Name')
  })

  it('does not mutate the original array', () => {
    const before = useContactsStore.getState().contacts
    useContactsStore.getState().upsertContact(makeContact())
    expect(useContactsStore.getState().contacts).not.toBe(before)
  })

  it('preserves optional fields when updating', () => {
    const c = makeContact({ id: 'c1', specialty: 'Cardiology', phone: '555-1234', email: 'dr@example.com', clinic: 'City Clinic', address: '1 Main St', notes: 'prefers email' })
    useContactsStore.getState().upsertContact(c)
    const stored = useContactsStore.getState().contacts[0]
    expect(stored?.specialty).toBe('Cardiology')
    expect(stored?.phone).toBe('555-1234')
    expect(stored?.email).toBe('dr@example.com')
    expect(stored?.clinic).toBe('City Clinic')
    expect(stored?.address).toBe('1 Main St')
    expect(stored?.notes).toBe('prefers email')
  })
})

describe('removeContact', () => {
  it('removes a contact by id', () => {
    useContactsStore.getState().setContacts([makeContact({ id: 'c1' }), makeContact({ id: 'c2' })])
    useContactsStore.getState().removeContact('c1')
    const { contacts } = useContactsStore.getState()
    expect(contacts).toHaveLength(1)
    expect(contacts[0]?.id).toBe('c2')
  })

  it('is a no-op for unknown id', () => {
    useContactsStore.getState().setContacts([makeContact({ id: 'c1' })])
    useContactsStore.getState().removeContact('unknown')
    expect(useContactsStore.getState().contacts).toHaveLength(1)
  })

  it('does not mutate the original array', () => {
    useContactsStore.getState().setContacts([makeContact({ id: 'c1' })])
    const before = useContactsStore.getState().contacts
    useContactsStore.getState().removeContact('c1')
    expect(useContactsStore.getState().contacts).not.toBe(before)
  })
})

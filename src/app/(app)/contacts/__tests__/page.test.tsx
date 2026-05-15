import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const mockConfirm = vi.fn()
vi.mock('@tauri-apps/plugin-dialog', () => ({ confirm: (...a: unknown[]) => mockConfirm(...a) }))

vi.mock('../../../../components/contacts/ContactForm', () => ({
  ContactForm: ({
    onSave,
    onCancel,
    initial,
  }: {
    onSave: (d: unknown) => void
    onCancel: () => void
    initial: { name: string } | null
  }) => (
    <div data-testid="contact-form">
      {initial ? <span>editing:{initial.name}</span> : <span>new-form</span>}
      <button onClick={() => onSave(initial ?? { name: 'New', role: 'gp' })}>Save Contact</button>
      <button onClick={onCancel}>Cancel Form</button>
    </div>
  ),
}))

const CONTACT_A = {
  id: 'c1',
  name: 'Dr. John Smith',
  role: 'gp',
  specialty: 'General Practice',
  phone: '555-1111',
  email: 'john@clinic.com',
  clinic: 'City Clinic',
  address: null,
  notes: null,
  contact_clinic_id: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

const CONTACT_B = {
  id: 'c2',
  name: 'Dr. Jon Smyth',
  role: 'gp',
  specialty: null,
  phone: null,
  email: null,
  clinic: null,
  address: null,
  notes: null,
  contact_clinic_id: null,
  created_at: '2026-01-02T00:00:00Z',
  updated_at: '2026-01-02T00:00:00Z',
}

const CONTACT_WITH_CLINIC = {
  id: 'c3',
  name: 'John Green',
  role: 'physiotherapist',
  specialty: null,
  phone: null,
  email: null,
  clinic: null,
  address: null,
  notes: null,
  contact_clinic_id: 'clinic-linked-99',
  created_at: '2026-01-03T00:00:00Z',
  updated_at: '2026-01-03T00:00:00Z',
}

const DUPLICATE_CANDIDATE = {
  primary_contact_id: 'c1',
  contact: CONTACT_B,
  similarity_score: 0.92,
  match_reason: 'name similarity',
}

const mockInvoke = vi.fn()
vi.mock('@tauri-apps/api/core', () => ({ invoke: (...a: unknown[]) => mockInvoke(...a) }))

async function renderPage() {
  vi.resetModules()
  const { default: ContactsPage } = await import('../page')
  return render(<ContactsPage />)
}

beforeEach(() => {
  vi.clearAllMocks()
  mockInvoke.mockImplementation((cmd: string) => {
    if (cmd === 'contacts_list') return Promise.resolve([CONTACT_A, CONTACT_B])
    if (cmd === 'find_duplicate_contacts') return Promise.resolve([DUPLICATE_CANDIDATE])
    if (cmd === 'merge_contacts') return Promise.resolve({ ...CONTACT_A })
    if (cmd === 'contacts_delete') return Promise.resolve(null)
    return Promise.resolve([])
  })
})

describe('ContactsPage', () => {
  it('renders contacts list after load', async () => {
    await renderPage()
    await waitFor(() => expect(screen.getByText('Dr. John Smith')).toBeInTheDocument())
    expect(screen.getByText('Dr. Jon Smyth')).toBeInTheDocument()
  })

  it('filters contacts by search input', async () => {
    await renderPage()
    await waitFor(() => expect(screen.getByText('Dr. John Smith')).toBeInTheDocument())
    fireEvent.change(screen.getByPlaceholderText('Search contacts…'), { target: { value: 'Jon' } })
    expect(screen.queryByText('Dr. John Smith')).not.toBeInTheDocument()
    expect(screen.getByText('Dr. Jon Smyth')).toBeInTheDocument()
  })

  it('shows scanning state while finding duplicates', async () => {
    let resolve: (v: unknown) => void
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'contacts_list') return Promise.resolve([CONTACT_A, CONTACT_B])
      if (cmd === 'find_duplicate_contacts') return new Promise((r) => { resolve = r })
      return Promise.resolve([])
    })
    await renderPage()
    await waitFor(() => expect(screen.getByText('Find Duplicates')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Find Duplicates'))
    await waitFor(() => expect(screen.getByText('Scanning…')).toBeInTheDocument())
    resolve!([])
  })

  it('shows duplicate panel with match info after scan', async () => {
    await renderPage()
    await waitFor(() => expect(screen.getByText('Find Duplicates')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Find Duplicates'))
    await waitFor(() => expect(screen.getByText('92% match')).toBeInTheDocument())
    expect(screen.getByText('name similarity')).toBeInTheDocument()
    expect(screen.getByText('Keep (primary)')).toBeInTheDocument()
    expect(screen.getByText('Duplicate')).toBeInTheDocument()
  })

  it('shows no-duplicates message when scan finds none', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'contacts_list') return Promise.resolve([CONTACT_A])
      if (cmd === 'find_duplicate_contacts') return Promise.resolve([])
      return Promise.resolve([])
    })
    await renderPage()
    await waitFor(() => expect(screen.getByText('Find Duplicates')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Find Duplicates'))
    await waitFor(() =>
      expect(screen.getByText(/No duplicates found/)).toBeInTheDocument()
    )
  })

  it('keep both removes the candidate from the list', async () => {
    await renderPage()
    await waitFor(() => expect(screen.getByText('Find Duplicates')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Find Duplicates'))
    await waitFor(() => expect(screen.getByText('Keep both')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Keep both'))
    await waitFor(() => expect(screen.queryByText('92% match')).not.toBeInTheDocument())
  })

  it('merge calls merge_contacts and removes duplicate from list', async () => {
    await renderPage()
    await waitFor(() => expect(screen.getByText('Find Duplicates')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Find Duplicates'))
    await waitFor(() => expect(screen.getByText('Merge into primary')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Merge into primary'))
    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith('merge_contacts', {
        userId: '',
        primaryId: 'c1',
        duplicateIds: ['c2'],
      })
    )
    await waitFor(() => expect(screen.queryByText('92% match')).not.toBeInTheDocument())
  })

  it('back button hides duplicate panel', async () => {
    await renderPage()
    await waitFor(() => expect(screen.getByText('Find Duplicates')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Find Duplicates'))
    await waitFor(() => expect(screen.getByText('← Back')).toBeInTheDocument())
    fireEvent.click(screen.getByText('← Back'))
    await waitFor(() => expect(screen.getByText('Find Duplicates')).toBeInTheDocument())
    expect(screen.getByText('Dr. John Smith')).toBeInTheDocument()
  })

  it('shows error message when find_duplicate_contacts rejects', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'contacts_list') return Promise.resolve([CONTACT_A])
      if (cmd === 'find_duplicate_contacts') return Promise.reject(new Error('db error'))
      return Promise.resolve([])
    })
    await renderPage()
    await waitFor(() => expect(screen.getByText('Find Duplicates')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Find Duplicates'))
    await waitFor(() => expect(screen.getByText('db error')).toBeInTheDocument())
  })

  it('hides New button and shows Back button in duplicates view', async () => {
    await renderPage()
    await waitFor(() => expect(screen.getByText('+ New')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Find Duplicates'))
    await waitFor(() => expect(screen.getByText('← Back')).toBeInTheDocument())
    expect(screen.queryByText('+ New')).not.toBeInTheDocument()
  })

  it('role chip passes role filter to contacts_list', async () => {
    await renderPage()
    await waitFor(() => expect(screen.getByText('Dr. John Smith')).toBeInTheDocument())
    const callsBefore = mockInvoke.mock.calls.length
    fireEvent.click(screen.getByRole('button', { name: 'Specialist' }))
    await waitFor(() => expect(mockInvoke.mock.calls.length).toBeGreaterThan(callsBefore))
    const listCalls = mockInvoke.mock.calls.filter(([cmd]) => cmd === 'contacts_list')
    const lastCall = listCalls[listCalls.length - 1]
    expect(lastCall![1]).toMatchObject({ role: 'specialist' })
  })

  it('active role chip has accent background class', async () => {
    await renderPage()
    await waitFor(() => expect(screen.getByText('Dr. John Smith')).toBeInTheDocument())
    const gpChip = screen.getByRole('button', { name: 'GP' })
    fireEvent.click(gpChip)
    expect(gpChip.className).toContain('bg-[var(--color-accent)]')
  })

  it('confirmed delete calls contacts_delete', async () => {
    mockConfirm.mockResolvedValue(true)
    await renderPage()
    await waitFor(() => expect(screen.getByText('Dr. John Smith')).toBeInTheDocument())
    fireEvent.click(screen.getAllByRole('button', { name: /delete/i })[0]!)
    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith('contacts_delete', expect.objectContaining({ id: 'c1' }))
    )
  })


  it('+ New button opens ContactForm in new mode', async () => {
    await renderPage()
    await waitFor(() => expect(screen.getByText('+ New')).toBeInTheDocument())
    fireEvent.click(screen.getByText('+ New'))
    expect(screen.getByTestId('contact-form')).toBeInTheDocument()
    expect(screen.getByText('new-form')).toBeInTheDocument()
  })

  it('Cancel Form button closes ContactForm', async () => {
    await renderPage()
    await waitFor(() => expect(screen.getByText('+ New')).toBeInTheDocument())
    fireEvent.click(screen.getByText('+ New'))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel Form' }))
    await waitFor(() => expect(screen.queryByTestId('contact-form')).not.toBeInTheDocument())
  })

  it('edit button opens ContactForm pre-filled with contact name', async () => {
    await renderPage()
    await waitFor(() => expect(screen.getByText('Dr. John Smith')).toBeInTheDocument())
    fireEvent.click(screen.getAllByRole('button', { name: /edit/i })[0]!)
    expect(screen.getByTestId('contact-form')).toBeInTheDocument()
    expect(screen.getByText('editing:Dr. John Smith')).toBeInTheDocument()
  })

  it('Save Contact in edit mode calls contacts_update', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'contacts_list') return Promise.resolve([CONTACT_A, CONTACT_B])
      if (cmd === 'contacts_update') return Promise.resolve({ ...CONTACT_A, name: 'Updated Name' })
      return Promise.resolve([])
    })
    await renderPage()
    await waitFor(() => expect(screen.getByText('Dr. John Smith')).toBeInTheDocument())
    fireEvent.click(screen.getAllByRole('button', { name: /edit/i })[0]!)
    fireEvent.click(screen.getByRole('button', { name: 'Save Contact' }))
    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith('contacts_update', expect.anything())
    )
    await waitFor(() => expect(screen.queryByTestId('contact-form')).not.toBeInTheDocument())
  })

  it('Save Contact in new mode calls contacts_create', async () => {
    const created = { ...CONTACT_A, id: 'c-new', name: 'New' }
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'contacts_list') return Promise.resolve([CONTACT_A])
      if (cmd === 'contacts_create') return Promise.resolve(created)
      return Promise.resolve([])
    })
    await renderPage()
    await waitFor(() => expect(screen.getByText('+ New')).toBeInTheDocument())
    fireEvent.click(screen.getByText('+ New'))
    fireEvent.click(screen.getByRole('button', { name: 'Save Contact' }))
    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith('contacts_create', expect.anything())
    )
    await waitFor(() => expect(screen.queryByTestId('contact-form')).not.toBeInTheDocument())
  })
})

describe('ContactsPage — address routing', () => {
  it('toggles addresses for a plain contact using contact_addresses_list', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'contacts_list') return Promise.resolve([CONTACT_A])
      if (cmd === 'contact_addresses_list') return Promise.resolve([])
      return Promise.resolve([])
    })
    await renderPage()
    await waitFor(() => expect(screen.getByText('Dr. John Smith')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Addresses' }))
    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith('contact_addresses_list', { contactId: 'c1' })
    )
    const clinicAddressCalls = mockInvoke.mock.calls.filter(([cmd]) => cmd === 'clinic_addresses_list')
    expect(clinicAddressCalls).toHaveLength(0)
  })

  it('toggles addresses for a clinic-linked contact using clinic_addresses_list', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'contacts_list') return Promise.resolve([CONTACT_WITH_CLINIC])
      if (cmd === 'clinics_get') return Promise.resolve(null)
      if (cmd === 'clinic_addresses_list') return Promise.resolve([])
      return Promise.resolve([])
    })
    await renderPage()
    await waitFor(() => expect(screen.getByText('John Green')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Addresses' }))
    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith('clinic_addresses_list', { clinicId: 'clinic-linked-99' })
    )
    const contactAddressCalls = mockInvoke.mock.calls.filter(([cmd]) => cmd === 'contact_addresses_list')
    expect(contactAddressCalls).toHaveLength(0)
  })
})

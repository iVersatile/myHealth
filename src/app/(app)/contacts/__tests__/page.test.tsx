import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

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
  created_at: '2026-01-02T00:00:00Z',
  updated_at: '2026-01-02T00:00:00Z',
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
})

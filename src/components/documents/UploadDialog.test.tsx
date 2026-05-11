import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UploadDialog } from './UploadDialog'
import type { Document } from '../../store/documentsStore'

const mockInvoke = vi.fn()
const mockOpen = vi.fn()
const mockListen = vi.fn()

vi.mock('@tauri-apps/api/core', () => ({ invoke: (...args: unknown[]) => mockInvoke(...args) }))
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: (...args: unknown[]) => mockOpen(...args) }))
vi.mock('@tauri-apps/api/event', () => ({ listen: (...args: unknown[]) => mockListen(...args) }))

const fakeDoc: Document = {
  id: 'new-doc',
  filename: 'report.pdf',
  file_path: '/files/new-doc.pdf',
  mime_type: 'application/pdf',
  file_size_bytes: 4096,
  category: 'lab',
  thumbnail_path: null,
  notes: null,
  created_at: '2026-04-14T09:00:00Z',
  updated_at: '2026-04-14T09:00:00Z',
  is_deleted: false,
  document_date: null,
  activity_date: null,
  tags: [],
  clinic_name: null,
}

const VALID_CATEGORIES = ['diagnosis', 'lab', 'imaging', 'prescription', 'letter', 'other']

function setupInvoke() {
  mockInvoke.mockImplementation((cmd: string) => {
    if (cmd === 'categories_list') return Promise.resolve([])
    if (cmd === 'documents_valid_categories') return Promise.resolve(VALID_CATEGORIES)
    if (cmd === 'documents_upload') return Promise.resolve(fakeDoc)
    if (cmd === 'documents_run_extraction') return Promise.resolve({ doctor_candidates: [], category_suggestion: null, document_tags: [], auto_tags: [], contact_suggestions: [] })
    if (cmd === 'documents_update') return Promise.resolve(fakeDoc)
    if (cmd === 'documents_tags_set') return Promise.resolve(undefined)
    if (cmd === 'documents_get') return Promise.resolve(fakeDoc)
    if (cmd === 'documents_delete') return Promise.resolve(undefined)
    return Promise.resolve(undefined)
  })
}

async function pickFileAndReachReview() {
  mockOpen.mockResolvedValue('/home/user/report.pdf')
  await userEvent.click(screen.getByRole('button', { name: /select files/i }))
  await waitFor(() => expect(screen.getByText('report.pdf')).toBeTruthy())
}

describe('UploadDialog', () => {
  beforeEach(() => {
    mockInvoke.mockReset()
    mockOpen.mockReset()
    mockListen.mockReset()
    mockListen.mockResolvedValue(() => {})
    setupInvoke()
  })

  it('renders Upload Document title in pick step', () => {
    render(<UploadDialog onClose={vi.fn()} onUploaded={vi.fn()} />)
    expect(screen.getByText('Upload Document')).toBeTruthy()
  })

  it('shows Select Files and Select Folder buttons in pick step', () => {
    render(<UploadDialog onClose={vi.fn()} onUploaded={vi.fn()} />)
    expect(screen.getByRole('button', { name: /select files/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /select folder/i })).toBeTruthy()
  })

  it('calls onClose when close (✕) button clicked in pick step', async () => {
    const onClose = vi.fn()
    render(<UploadDialog onClose={onClose} onUploaded={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /close dialog/i }))
    expect(onClose).toHaveBeenCalled()
  })

  it('calls open() when drop zone clicked', async () => {
    mockOpen.mockResolvedValue(null)
    render(<UploadDialog onClose={vi.fn()} onUploaded={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /select files/i }))
    expect(mockOpen).toHaveBeenCalled()
  })

  it('shows filename in review step after file picked', async () => {
    render(<UploadDialog onClose={vi.fn()} onUploaded={vi.fn()} />)
    await pickFileAndReachReview()
    expect(screen.getByText('report.pdf')).toBeTruthy()
  })

  it('renders category select with lab as default in review step', async () => {
    render(<UploadDialog onClose={vi.fn()} onUploaded={vi.fn()} />)
    await pickFileAndReachReview()
    const select = screen.getByLabelText(/category/i) as HTMLSelectElement
    expect(select.value).toBe('lab')
  })

  it('calls onClose when Cancel clicked in review step', async () => {
    const onClose = vi.fn()
    render(<UploadDialog onClose={onClose} onUploaded={vi.fn()} />)
    await pickFileAndReachReview()
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onClose).toHaveBeenCalled()
  })

  it('confirms upload and calls onUploaded with final doc', async () => {
    const onUploaded = vi.fn()
    const onClose = vi.fn()
    render(<UploadDialog onClose={onClose} onUploaded={onUploaded} />)
    await pickFileAndReachReview()
    await userEvent.click(screen.getByRole('button', { name: /confirm upload/i }))
    await waitFor(() => expect(onUploaded).toHaveBeenCalledWith(fakeDoc, [], []))
    expect(onClose).toHaveBeenCalled()
  })

  it('calls documents_tags_set with entered tags on confirm', async () => {
    render(<UploadDialog onClose={vi.fn()} onUploaded={vi.fn()} />)
    await pickFileAndReachReview()
    const tagsInput = screen.getByLabelText(/tags/i)
    await userEvent.clear(tagsInput)
    await userEvent.type(tagsInput, 'blood, annual')
    await userEvent.click(screen.getByRole('button', { name: /confirm upload/i }))
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('documents_tags_set', {
        id: 'new-doc',
        tags: ['blood', 'annual'],
      })
    })
  })

  it('shows error message in pick step when upload fails', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'categories_list') return Promise.resolve([])
      if (cmd === 'documents_valid_categories') return Promise.resolve(VALID_CATEGORIES)
      if (cmd === 'documents_upload') return Promise.reject(new Error('disk full'))
      return Promise.resolve(undefined)
    })
    mockOpen.mockResolvedValue('/home/user/report.pdf')
    render(<UploadDialog onClose={vi.fn()} onUploaded={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /select files/i }))
    await waitFor(() => expect(screen.getByText('disk full')).toBeTruthy())
  })

  it('passes notes via documents_update on confirm', async () => {
    render(<UploadDialog onClose={vi.fn()} onUploaded={vi.fn()} />)
    await pickFileAndReachReview()
    await userEvent.type(screen.getByLabelText(/notes/i), 'Annual checkup')
    await userEvent.click(screen.getByRole('button', { name: /confirm upload/i }))
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('documents_update', {
        id: 'new-doc',
        category: 'lab',
        notes: 'Annual checkup',
        activityDate: null,
      })
    })
  })

  it('includes document_date in tags when doc has one', async () => {
    const docWithDate = { ...fakeDoc, document_date: '2026-03-15' }
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'categories_list') return Promise.resolve([])
      if (cmd === 'documents_valid_categories') return Promise.resolve(VALID_CATEGORIES)
      if (cmd === 'documents_upload') return Promise.resolve(docWithDate)
      if (cmd === 'documents_run_extraction') return Promise.resolve({ doctor_candidates: [], category_suggestion: null, document_tags: [], auto_tags: [], contact_suggestions: [] })
      if (cmd === 'documents_update') return Promise.resolve(docWithDate)
      if (cmd === 'documents_tags_set') return Promise.resolve(undefined)
      if (cmd === 'documents_get') return Promise.resolve(docWithDate)
      if (cmd === 'documents_delete') return Promise.resolve(undefined)
      return Promise.resolve(undefined)
    })
    render(<UploadDialog onClose={vi.fn()} onUploaded={vi.fn()} />)
    await pickFileAndReachReview()
    await waitFor(() => {
      const chips = screen.getAllByTestId('tag-chip')
      expect(chips.some((chip) => chip.getAttribute('data-value') === '2026-03-15')).toBe(true)
    })
  })

  it('shows contact suggestions from extraction and saves one (no duplicate)', async () => {
    const contactSugg = { name: 'Dr. House', specialty: 'Diagnostics', clinic: 'PPTH', address: null, phone: '555-9999', email: null }
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'categories_list') return Promise.resolve([])
      if (cmd === 'documents_valid_categories') return Promise.resolve(VALID_CATEGORIES)
      if (cmd === 'documents_upload') return Promise.resolve(fakeDoc)
      if (cmd === 'documents_run_extraction') return Promise.resolve({ doctor_candidates: ['Dr. House'], category_suggestion: null, document_tags: [], contact_suggestions: [contactSugg] })
      if (cmd === 'documents_update') return Promise.resolve(fakeDoc)
      if (cmd === 'documents_tags_set') return Promise.resolve(undefined)
      if (cmd === 'documents_get') return Promise.resolve(fakeDoc)
      if (cmd === 'documents_delete') return Promise.resolve(undefined)
      if (cmd === 'contacts_create') return Promise.resolve({ id: 'new-c1' })
      if (cmd === 'find_duplicate_contacts') return Promise.resolve([])
      return Promise.resolve(undefined)
    })
    render(<UploadDialog onClose={vi.fn()} onUploaded={vi.fn()} />)
    await pickFileAndReachReview()
    await waitFor(() => expect(screen.getAllByText('Dr. House').length).toBeGreaterThan(0))
    expect(screen.getByText('Diagnostics')).toBeTruthy()
    expect(screen.getByText('PPTH')).toBeTruthy()
    const saveBtn = screen.getByRole('button', { name: /save as contact/i })
    await userEvent.click(saveBtn)
    await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith('contacts_create', expect.objectContaining({ input: expect.objectContaining({ name: 'Dr. House' }) })))
    await waitFor(() => expect(screen.getByRole('button', { name: /saved/i })).toBeTruthy())
  })

  it('shows duplicate merge prompt when similar contact found on save', async () => {
    const contactSugg = { name: 'Dr. House', specialty: 'Diagnostics', clinic: 'PPTH', address: null, phone: '555-9999', email: null }
    const existingContact = { id: 'existing-c1', name: 'Dr. Greg House' }
    const dupCandidate = { primary_contact_id: 'new-c1', contact: existingContact, similarity_score: 0.92, match_reason: 'name similarity' }
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'categories_list') return Promise.resolve([])
      if (cmd === 'documents_valid_categories') return Promise.resolve(VALID_CATEGORIES)
      if (cmd === 'documents_upload') return Promise.resolve(fakeDoc)
      if (cmd === 'documents_run_extraction') return Promise.resolve({ doctor_candidates: ['Dr. House'], category_suggestion: null, document_tags: [], contact_suggestions: [contactSugg] })
      if (cmd === 'documents_update') return Promise.resolve(fakeDoc)
      if (cmd === 'documents_tags_set') return Promise.resolve(undefined)
      if (cmd === 'documents_get') return Promise.resolve(fakeDoc)
      if (cmd === 'documents_delete') return Promise.resolve(undefined)
      if (cmd === 'contacts_create') return Promise.resolve({ id: 'new-c1' })
      if (cmd === 'find_duplicate_contacts') return Promise.resolve([dupCandidate])
      if (cmd === 'merge_contacts') return Promise.resolve(existingContact)
      return Promise.resolve(undefined)
    })
    render(<UploadDialog onClose={vi.fn()} onUploaded={vi.fn()} />)
    await pickFileAndReachReview()
    await waitFor(() => expect(screen.getByRole('button', { name: /save as contact/i })).toBeTruthy())
    await userEvent.click(screen.getByRole('button', { name: /save as contact/i }))
    await waitFor(() => expect(screen.getByText(/Possible duplicate/i)).toBeTruthy())
    expect(screen.getByText('Dr. Greg House')).toBeTruthy()
    expect(screen.getByText(/92%/)).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: /^merge$/i }))
    await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith('merge_contacts', {
      userId: '',
      primaryId: 'existing-c1',
      duplicateIds: ['new-c1'],
    }))
    await waitFor(() => expect(screen.getByRole('button', { name: /saved/i })).toBeTruthy())
  })

  it('keep both on duplicate prompt marks contact saved without merging', async () => {
    const contactSugg = { name: 'Dr. House', specialty: null, clinic: null, address: null, phone: null, email: null }
    const dupCandidate = { primary_contact_id: 'new-c1', contact: { id: 'existing-c1', name: 'Dr. Greg House' }, similarity_score: 0.9, match_reason: 'name similarity' }
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'categories_list') return Promise.resolve([])
      if (cmd === 'documents_valid_categories') return Promise.resolve(VALID_CATEGORIES)
      if (cmd === 'documents_upload') return Promise.resolve(fakeDoc)
      if (cmd === 'documents_run_extraction') return Promise.resolve({ doctor_candidates: [], category_suggestion: null, document_tags: [], contact_suggestions: [contactSugg] })
      if (cmd === 'documents_update') return Promise.resolve(fakeDoc)
      if (cmd === 'documents_tags_set') return Promise.resolve(undefined)
      if (cmd === 'documents_get') return Promise.resolve(fakeDoc)
      if (cmd === 'documents_delete') return Promise.resolve(undefined)
      if (cmd === 'contacts_create') return Promise.resolve({ id: 'new-c1' })
      if (cmd === 'find_duplicate_contacts') return Promise.resolve([dupCandidate])
      return Promise.resolve(undefined)
    })
    render(<UploadDialog onClose={vi.fn()} onUploaded={vi.fn()} />)
    await pickFileAndReachReview()
    await waitFor(() => expect(screen.getByRole('button', { name: /save as contact/i })).toBeTruthy())
    await userEvent.click(screen.getByRole('button', { name: /save as contact/i }))
    await waitFor(() => expect(screen.getByText(/Possible duplicate/i)).toBeTruthy())
    await userEvent.click(screen.getByRole('button', { name: /keep both/i }))
    await waitFor(() => expect(screen.getByRole('button', { name: /saved/i })).toBeTruthy())
    expect(mockInvoke).not.toHaveBeenCalledWith('merge_contacts', expect.anything())
  })

  it('shows category suggestion banner with detected label and dismisses', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'categories_list') return Promise.resolve([])
      if (cmd === 'documents_valid_categories') return Promise.resolve(VALID_CATEGORIES)
      if (cmd === 'documents_upload') return Promise.resolve(fakeDoc)
      if (cmd === 'documents_run_extraction') return Promise.resolve({ doctor_candidates: [], category_suggestion: 'prescription', document_tags: [], auto_tags: [], contact_suggestions: [] })
      if (cmd === 'documents_update') return Promise.resolve(fakeDoc)
      if (cmd === 'documents_tags_set') return Promise.resolve(undefined)
      if (cmd === 'documents_get') return Promise.resolve(fakeDoc)
      if (cmd === 'documents_delete') return Promise.resolve(undefined)
      return Promise.resolve(undefined)
    })
    render(<UploadDialog onClose={vi.fn()} onUploaded={vi.fn()} />)
    await pickFileAndReachReview()
    await waitFor(() => expect(screen.getByText('Prescription', { selector: 'p' })).toBeTruthy())
    expect(screen.getByText(/detected from document content/i)).toBeTruthy()
    const dismissBtn = screen.getByRole('button', { name: /dismiss/i })
    await userEvent.click(dismissBtn)
    await waitFor(() => expect(screen.queryByText('Prescription', { selector: 'p' })).toBeNull())
  })

  it('Accept on category suggestion calls categories_create_if_not_exists and assigns category', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'categories_list') return Promise.resolve([])
      if (cmd === 'documents_valid_categories') return Promise.resolve(VALID_CATEGORIES)
      if (cmd === 'documents_upload') return Promise.resolve(fakeDoc)
      if (cmd === 'documents_run_extraction') return Promise.resolve({ doctor_candidates: [], category_suggestion: 'physiotherapy', document_tags: [], auto_tags: [], contact_suggestions: [] })
      if (cmd === 'categories_create_if_not_exists') return Promise.resolve('cat-physio')
      if (cmd === 'documents_update') return Promise.resolve(fakeDoc)
      if (cmd === 'documents_tags_set') return Promise.resolve(undefined)
      if (cmd === 'categories_assign_document') return Promise.resolve(undefined)
      if (cmd === 'documents_get') return Promise.resolve(fakeDoc)
      if (cmd === 'documents_delete') return Promise.resolve(undefined)
      return Promise.resolve(undefined)
    })
    render(<UploadDialog onClose={vi.fn()} onUploaded={vi.fn()} />)
    await pickFileAndReachReview()
    await waitFor(() => expect(screen.getByRole('button', { name: /accept/i })).toBeTruthy())
    await userEvent.click(screen.getByRole('button', { name: /accept/i }))
    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith('categories_create_if_not_exists', { name: 'physiotherapy' })
    )
    // Banner should be dismissed after accept
    await waitFor(() => expect(screen.queryByText('Physiotherapy')).toBeNull())
    // Confirm should assign the created category
    await userEvent.click(screen.getByRole('button', { name: /confirm upload/i }))
    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith('categories_assign_document', {
        documentId: 'new-doc',
        categoryId: 'cat-physio',
      })
    )
  })

  it('cancel on duplicate prompt deletes new contact and returns to idle', async () => {
    const contactSugg = { name: 'Dr. House', specialty: null, clinic: null, address: null, phone: null, email: null }
    const dupCandidate = { primary_contact_id: 'new-c1', contact: { id: 'existing-c1', name: 'Dr. Greg House' }, similarity_score: 0.92, match_reason: 'name similarity' }
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'categories_list') return Promise.resolve([])
      if (cmd === 'documents_valid_categories') return Promise.resolve(VALID_CATEGORIES)
      if (cmd === 'documents_upload') return Promise.resolve(fakeDoc)
      if (cmd === 'documents_run_extraction') return Promise.resolve({ doctor_candidates: [], category_suggestion: null, document_tags: [], contact_suggestions: [contactSugg] })
      if (cmd === 'documents_update') return Promise.resolve(fakeDoc)
      if (cmd === 'documents_tags_set') return Promise.resolve(undefined)
      if (cmd === 'documents_get') return Promise.resolve(fakeDoc)
      if (cmd === 'documents_delete') return Promise.resolve(undefined)
      if (cmd === 'contacts_create') return Promise.resolve({ id: 'new-c1' })
      if (cmd === 'find_duplicate_contacts') return Promise.resolve([dupCandidate])
      if (cmd === 'contacts_delete') return Promise.resolve(undefined)
      return Promise.resolve(undefined)
    })
    render(<UploadDialog onClose={vi.fn()} onUploaded={vi.fn()} />)
    await pickFileAndReachReview()
    await waitFor(() => expect(screen.getByRole('button', { name: /save as contact/i })).toBeTruthy())
    await userEvent.click(screen.getByRole('button', { name: /save as contact/i }))
    await waitFor(() => expect(screen.getByText(/Possible duplicate/i)).toBeTruthy())
    const cancelBtns = screen.getAllByRole('button', { name: /^cancel$/i })
    await userEvent.click(cancelBtns[0]!)
    await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith('contacts_delete', { id: 'new-c1' }))
    await waitFor(() => expect(screen.getByRole('button', { name: /save as contact/i })).toBeTruthy())
  })

  it('calls documents_link_contact after no-duplicate contact save', async () => {
    const contactSugg = { name: 'Dr. House', specialty: 'Diagnostics', clinic: 'PPTH', address: null, phone: null, email: null }
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'categories_list') return Promise.resolve([])
      if (cmd === 'documents_valid_categories') return Promise.resolve(VALID_CATEGORIES)
      if (cmd === 'documents_upload') return Promise.resolve(fakeDoc)
      if (cmd === 'documents_run_extraction') return Promise.resolve({ doctor_candidates: [], category_suggestion: null, document_tags: [], contact_suggestions: [contactSugg] })
      if (cmd === 'documents_update') return Promise.resolve(fakeDoc)
      if (cmd === 'documents_tags_set') return Promise.resolve(undefined)
      if (cmd === 'documents_get') return Promise.resolve(fakeDoc)
      if (cmd === 'documents_delete') return Promise.resolve(undefined)
      if (cmd === 'contacts_create') return Promise.resolve({ id: 'new-c1' })
      if (cmd === 'find_duplicate_contacts') return Promise.resolve([])
      if (cmd === 'documents_link_contact') return Promise.resolve(undefined)
      return Promise.resolve(undefined)
    })
    render(<UploadDialog onClose={vi.fn()} onUploaded={vi.fn()} />)
    await pickFileAndReachReview()
    await waitFor(() => expect(screen.getByRole('button', { name: /save as contact/i })).toBeTruthy())
    await userEvent.click(screen.getByRole('button', { name: /save as contact/i }))
    await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith('documents_link_contact', {
      documentId: 'new-doc',
      contactId: 'new-c1',
    }))
    await waitFor(() => expect(screen.getByRole('button', { name: /saved/i })).toBeTruthy())
  })

  it('calls documents_link_contact with primary contact id after merge', async () => {
    const contactSugg = { name: 'Dr. House', specialty: 'Diagnostics', clinic: 'PPTH', address: null, phone: null, email: null }
    const existingContact = { id: 'existing-c1', name: 'Dr. Greg House' }
    const dupCandidate = { primary_contact_id: 'new-c1', contact: existingContact, similarity_score: 0.92, match_reason: 'name similarity' }
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'categories_list') return Promise.resolve([])
      if (cmd === 'documents_valid_categories') return Promise.resolve(VALID_CATEGORIES)
      if (cmd === 'documents_upload') return Promise.resolve(fakeDoc)
      if (cmd === 'documents_run_extraction') return Promise.resolve({ doctor_candidates: [], category_suggestion: null, document_tags: [], contact_suggestions: [contactSugg] })
      if (cmd === 'documents_update') return Promise.resolve(fakeDoc)
      if (cmd === 'documents_tags_set') return Promise.resolve(undefined)
      if (cmd === 'documents_get') return Promise.resolve(fakeDoc)
      if (cmd === 'documents_delete') return Promise.resolve(undefined)
      if (cmd === 'contacts_create') return Promise.resolve({ id: 'new-c1' })
      if (cmd === 'find_duplicate_contacts') return Promise.resolve([dupCandidate])
      if (cmd === 'merge_contacts') return Promise.resolve(existingContact)
      if (cmd === 'documents_link_contact') return Promise.resolve(undefined)
      return Promise.resolve(undefined)
    })
    render(<UploadDialog onClose={vi.fn()} onUploaded={vi.fn()} />)
    await pickFileAndReachReview()
    await waitFor(() => expect(screen.getByRole('button', { name: /save as contact/i })).toBeTruthy())
    await userEvent.click(screen.getByRole('button', { name: /save as contact/i }))
    await waitFor(() => expect(screen.getByText(/Possible duplicate/i)).toBeTruthy())
    await userEvent.click(screen.getByRole('button', { name: /^merge$/i }))
    await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith('documents_link_contact', {
      documentId: 'new-doc',
      contactId: 'existing-c1',
    }))
    await waitFor(() => expect(screen.getByRole('button', { name: /saved/i })).toBeTruthy())
  })

  it('cancel on duplicate prompt returns to idle even if delete fails', async () => {
    const contactSugg = { name: 'Dr. House', specialty: null, clinic: null, address: null, phone: null, email: null }
    const dupCandidate = { primary_contact_id: 'new-c1', contact: { id: 'existing-c1', name: 'Dr. Greg House' }, similarity_score: 0.92, match_reason: 'name similarity' }
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'categories_list') return Promise.resolve([])
      if (cmd === 'documents_valid_categories') return Promise.resolve(VALID_CATEGORIES)
      if (cmd === 'documents_upload') return Promise.resolve(fakeDoc)
      if (cmd === 'documents_run_extraction') return Promise.resolve({ doctor_candidates: [], category_suggestion: null, document_tags: [], contact_suggestions: [contactSugg] })
      if (cmd === 'documents_update') return Promise.resolve(fakeDoc)
      if (cmd === 'documents_tags_set') return Promise.resolve(undefined)
      if (cmd === 'documents_get') return Promise.resolve(fakeDoc)
      if (cmd === 'documents_delete') return Promise.resolve(undefined)
      if (cmd === 'contacts_create') return Promise.resolve({ id: 'new-c1' })
      if (cmd === 'find_duplicate_contacts') return Promise.resolve([dupCandidate])
      if (cmd === 'contacts_delete') return Promise.reject(new Error('delete failed'))
      return Promise.resolve(undefined)
    })
    render(<UploadDialog onClose={vi.fn()} onUploaded={vi.fn()} />)
    await pickFileAndReachReview()
    await waitFor(() => expect(screen.getByRole('button', { name: /save as contact/i })).toBeTruthy())
    await userEvent.click(screen.getByRole('button', { name: /save as contact/i }))
    await waitFor(() => expect(screen.getByText(/Possible duplicate/i)).toBeTruthy())
    const cancelBtns = screen.getAllByRole('button', { name: /^cancel$/i })
    await userEvent.click(cancelBtns[0]!)
    await waitFor(() => expect(screen.getByRole('button', { name: /save as contact/i })).toBeTruthy())
  })

  it('shows clinic card with name, reg no, and address count from extraction', async () => {
    const clinicSugg = { name: 'John Green Physiotherapy Ltd', company_registration_number: '6780032', addresses: ['1 Clinic Rd, London, SW1A 1AA', '2 Health St, Manchester, M1 1AE', '3 Physio Ave, Birmingham, B1 1BB'] }
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'categories_list') return Promise.resolve([])
      if (cmd === 'documents_valid_categories') return Promise.resolve(VALID_CATEGORIES)
      if (cmd === 'clinics_list') return Promise.resolve([])
      if (cmd === 'documents_upload') return Promise.resolve(fakeDoc)
      if (cmd === 'documents_run_extraction') return Promise.resolve({ doctor_candidates: [], category_suggestion: null, document_tags: [], auto_tags: [], contact_suggestions: [], clinic_suggestions: [clinicSugg] })
      if (cmd === 'documents_update') return Promise.resolve(fakeDoc)
      if (cmd === 'documents_tags_set') return Promise.resolve(undefined)
      if (cmd === 'documents_get') return Promise.resolve(fakeDoc)
      if (cmd === 'documents_delete') return Promise.resolve(undefined)
      return Promise.resolve(undefined)
    })
    render(<UploadDialog onClose={vi.fn()} onUploaded={vi.fn()} />)
    await pickFileAndReachReview()
    await waitFor(() => expect(screen.getByTestId('clinic-suggestion-card')).toBeTruthy())
    expect(screen.getByText('John Green Physiotherapy Ltd')).toBeTruthy()
    const regInput = screen.getByTestId('clinic-suggestion-reg-number') as HTMLInputElement
    expect(regInput.value).toBe('6780032')
    const addressItems = screen.getAllByTestId('clinic-address-item')
    expect(addressItems).toHaveLength(3)
    expect(screen.getByRole('button', { name: /save as clinic/i })).toBeTruthy()
  })

  it('clicking Save as Clinic calls clinics_create_if_not_exists and shows Saved', async () => {
    const clinicSugg = { name: 'John Green Physiotherapy Ltd', company_registration_number: '6780032', addresses: ['1 Clinic Rd, London, SW1A 1AA'] }
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'categories_list') return Promise.resolve([])
      if (cmd === 'documents_valid_categories') return Promise.resolve(VALID_CATEGORIES)
      if (cmd === 'clinics_list') return Promise.resolve([])
      if (cmd === 'documents_upload') return Promise.resolve(fakeDoc)
      if (cmd === 'documents_run_extraction') return Promise.resolve({ doctor_candidates: [], category_suggestion: null, document_tags: [], auto_tags: [], contact_suggestions: [], clinic_suggestions: [clinicSugg] })
      if (cmd === 'documents_update') return Promise.resolve(fakeDoc)
      if (cmd === 'documents_tags_set') return Promise.resolve(undefined)
      if (cmd === 'documents_get') return Promise.resolve(fakeDoc)
      if (cmd === 'documents_delete') return Promise.resolve(undefined)
      if (cmd === 'clinics_create_if_not_exists') return Promise.resolve({ id: 'clinic-1' })
      return Promise.resolve(undefined)
    })
    render(<UploadDialog onClose={vi.fn()} onUploaded={vi.fn()} />)
    await pickFileAndReachReview()
    await waitFor(() => expect(screen.getByRole('button', { name: /save as clinic/i })).toBeTruthy())
    await userEvent.click(screen.getByRole('button', { name: /save as clinic/i }))
    await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith('clinics_create_if_not_exists', {
      input: {
        name: 'John Green Physiotherapy Ltd',
        address: null,
        phone: null,
        company_registration_number: '6780032',
        addresses: ['1 Clinic Rd, London, SW1A 1AA'],
      },
    }))
    await waitFor(() => expect(screen.getByRole('button', { name: /^saved$/i })).toBeTruthy())
  })

  it('auto-links saved contact to clinic when contact was saved in the same session', async () => {
    const contactSugg = { name: 'Dr. John Green', specialty: 'Physiotherapy', clinic: 'John Green Physiotherapy Ltd', address: null, phone: null, email: null }
    const clinicSugg = { name: 'John Green Physiotherapy Ltd', company_registration_number: '6780032', addresses: ['1 Clinic Rd, London, SW1A 1AA'] }
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'categories_list') return Promise.resolve([])
      if (cmd === 'documents_valid_categories') return Promise.resolve(VALID_CATEGORIES)
      if (cmd === 'clinics_list') return Promise.resolve([])
      if (cmd === 'documents_upload') return Promise.resolve(fakeDoc)
      if (cmd === 'documents_run_extraction') return Promise.resolve({ doctor_candidates: [], category_suggestion: null, document_tags: [], auto_tags: [], contact_suggestions: [contactSugg], clinic_suggestions: [clinicSugg] })
      if (cmd === 'documents_update') return Promise.resolve(fakeDoc)
      if (cmd === 'documents_tags_set') return Promise.resolve(undefined)
      if (cmd === 'documents_get') return Promise.resolve(fakeDoc)
      if (cmd === 'documents_delete') return Promise.resolve(undefined)
      if (cmd === 'contacts_create') return Promise.resolve({ id: 'contact-1' })
      if (cmd === 'find_duplicate_contacts') return Promise.resolve([])
      if (cmd === 'documents_link_contact') return Promise.resolve(undefined)
      if (cmd === 'clinics_create_if_not_exists') return Promise.resolve({ id: 'clinic-1' })
      if (cmd === 'clinics_link_contact') return Promise.resolve(undefined)
      return Promise.resolve(undefined)
    })
    render(<UploadDialog onClose={vi.fn()} onUploaded={vi.fn()} />)
    await pickFileAndReachReview()
    // Save contact first
    await waitFor(() => expect(screen.getByRole('button', { name: /save as contact/i })).toBeTruthy())
    await userEvent.click(screen.getByRole('button', { name: /save as contact/i }))
    await waitFor(() => expect(screen.getAllByRole('button', { name: /saved/i })).toBeTruthy())
    // Now save clinic — should auto-link contact
    await waitFor(() => expect(screen.getByRole('button', { name: /save as clinic/i })).toBeTruthy())
    await userEvent.click(screen.getByRole('button', { name: /save as clinic/i }))
    await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith('clinics_link_contact', {
      clinicId: 'clinic-1',
      contactId: 'contact-1',
    }))
  })

  it('processes file via drag and drop', async () => {
    render(<UploadDialog onClose={vi.fn()} onUploaded={vi.fn()} />)
    const dropZone = screen.getByTestId('batch-upload-zone')
    const fakeFile = Object.assign(new File(['data'], 'dropped.pdf', { type: 'application/pdf' }), { path: '/tmp/dropped.pdf' })
    const dataTransfer = { files: [fakeFile] }
    fireEvent.drop(dropZone, { dataTransfer })
    await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith('documents_upload', expect.objectContaining({ filePath: '/tmp/dropped.pdf' })))
  })

  it('shows OCR progressbar with page/total/elapsed when ocr_progress event fires', async () => {
    let ocrCallback: ((e: { payload: unknown }) => void) | null = null
    mockListen.mockReset()
    mockListen.mockImplementation(async (_event: string, cb: (e: { payload: unknown }) => void) => {
      ocrCallback = cb
      return () => {}
    })

    render(<UploadDialog onClose={vi.fn()} onUploaded={vi.fn()} />)
    mockOpen.mockResolvedValue('/home/user/scan.pdf')

    // Delay extraction so progress event fires while still in analyzing step
    let resolveExtraction!: (v: unknown) => void
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'categories_list') return Promise.resolve([])
      if (cmd === 'documents_valid_categories') return Promise.resolve(VALID_CATEGORIES)
      if (cmd === 'documents_upload') return Promise.resolve(fakeDoc)
      if (cmd === 'documents_run_extraction') return new Promise((res) => { resolveExtraction = res })
      return Promise.resolve(undefined)
    })

    await userEvent.click(screen.getByRole('button', { name: /select files/i }))

    // Wait for listen to be registered
    await waitFor(() => expect(ocrCallback).not.toBeNull())

    // Fire a progress event
    ocrCallback!({ payload: { page: 3, total: 8, elapsed_ms: 4000 } })

    await waitFor(() => expect(screen.getByRole('progressbar')).toBeTruthy())
    const bar = screen.getByRole('progressbar')
    expect(bar.getAttribute('aria-valuenow')).toBe('3')
    expect(bar.getAttribute('aria-valuemax')).toBe('8')
    expect(screen.getByText(/page 3 of 8/i)).toBeTruthy()
    expect(screen.getByText(/4s elapsed/i)).toBeTruthy()

    // Finish extraction so component doesn't hang
    resolveExtraction({ doctor_candidates: [], category_suggestion: null, document_tags: [], auto_tags: [], contact_suggestions: [] })
  })

  it('pre-populates tags from auto_tags with case-insensitive dedup', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'categories_list') return Promise.resolve([])
      if (cmd === 'documents_valid_categories') return Promise.resolve(VALID_CATEGORIES)
      if (cmd === 'documents_upload') return Promise.resolve(fakeDoc)
      if (cmd === 'documents_run_extraction') return Promise.resolve({
        doctor_candidates: ['John Green'],
        category_suggestion: null,
        document_tags: ['Invoice'],
        auto_tags: ['invoice', 'PHYSIOTHERAPY', '2023-03-09'],
        contact_suggestions: [],
      })
      if (cmd === 'documents_update') return Promise.resolve(fakeDoc)
      if (cmd === 'documents_tags_set') return Promise.resolve(undefined)
      if (cmd === 'documents_get') return Promise.resolve(fakeDoc)
      if (cmd === 'documents_delete') return Promise.resolve(undefined)
      return Promise.resolve(undefined)
    })
    render(<UploadDialog onClose={vi.fn()} onUploaded={vi.fn()} />)
    await pickFileAndReachReview()
    await waitFor(() => {
      const chips = screen.getAllByTestId('tag-chip')
      expect(chips.length).toBeGreaterThan(0)
    })
    const chips = screen.getAllByTestId('tag-chip')
    const tagValues = chips.map((el) => el.getAttribute('data-value') ?? '')
    // 'invoice' from auto_tags and 'Invoice' from document_tags → only one should appear
    const invoiceTags = tagValues.filter((t) => t.toLowerCase() === 'invoice')
    expect(invoiceTags).toHaveLength(1)
    // All four unique tags should be present
    expect(tagValues.some((t) => t === 'John Green')).toBe(true)
    expect(tagValues.some((t) => t === 'PHYSIOTHERAPY')).toBe(true)
    expect(tagValues.some((t) => t === '2023-03-09')).toBe(true)
  })

  it('hides OCR progressbar after extraction completes', async () => {
    let ocrCallback: ((e: { payload: unknown }) => void) | null = null
    mockListen.mockReset()
    mockListen.mockImplementation(async (_event: string, cb: (e: { payload: unknown }) => void) => {
      ocrCallback = cb
      return () => {}
    })

    render(<UploadDialog onClose={vi.fn()} onUploaded={vi.fn()} />)
    mockOpen.mockResolvedValue('/home/user/scan.pdf')

    let resolveExtraction!: (v: unknown) => void
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'categories_list') return Promise.resolve([])
      if (cmd === 'documents_valid_categories') return Promise.resolve(VALID_CATEGORIES)
      if (cmd === 'documents_upload') return Promise.resolve(fakeDoc)
      if (cmd === 'documents_run_extraction') return new Promise((res) => { resolveExtraction = res })
      if (cmd === 'documents_update') return Promise.resolve(fakeDoc)
      if (cmd === 'documents_tags_set') return Promise.resolve(undefined)
      if (cmd === 'documents_get') return Promise.resolve(fakeDoc)
      return Promise.resolve(undefined)
    })

    await userEvent.click(screen.getByRole('button', { name: /select files/i }))
    await waitFor(() => expect(ocrCallback).not.toBeNull())

    ocrCallback!({ payload: { page: 1, total: 3, elapsed_ms: 1000 } })
    await waitFor(() => expect(screen.getByRole('progressbar')).toBeTruthy())

    resolveExtraction({ doctor_candidates: [], category_suggestion: null, document_tags: [], auto_tags: [], contact_suggestions: [] })

    await waitFor(() => expect(screen.queryByRole('progressbar')).toBeNull())
    // Component should now be in review step
    await waitFor(() => expect(screen.getByText('report.pdf')).toBeTruthy())
  })

  it('pre-fills timeline entry from physio extraction with title prefix', async () => {
    const contactSugg = { name: 'John Green', title: 'Mr', specialty: 'Physiotherapy', clinic: null, address: null, phone: null, email: null }
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'categories_list') return Promise.resolve([])
      if (cmd === 'documents_valid_categories') return Promise.resolve(VALID_CATEGORIES)
      if (cmd === 'documents_upload') return Promise.resolve(fakeDoc)
      if (cmd === 'documents_run_extraction') return Promise.resolve({
        doctor_candidates: [],
        category_suggestion: null,
        document_tags: [],
        auto_tags: [],
        contact_suggestions: [contactSugg],
        activity_date: '2023-03-09',
      })
      if (cmd === 'documents_update') return Promise.resolve(fakeDoc)
      if (cmd === 'documents_tags_set') return Promise.resolve(undefined)
      if (cmd === 'documents_get') return Promise.resolve(fakeDoc)
      if (cmd === 'documents_delete') return Promise.resolve(undefined)
      return Promise.resolve(undefined)
    })
    render(<UploadDialog onClose={vi.fn()} onUploaded={vi.fn()} />)
    await pickFileAndReachReview()
    const textarea = screen.getByLabelText(/timeline entry/i) as HTMLTextAreaElement
    expect(textarea.value).toBe('2023-03-09 PHYSIOTHERAPY with Mr John Green')
  })

  it('timeline entry field is editable after pre-fill', async () => {
    const contactSugg = { name: 'John Green', title: 'Mr', specialty: 'Physiotherapy', clinic: null, address: null, phone: null, email: null }
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'categories_list') return Promise.resolve([])
      if (cmd === 'documents_valid_categories') return Promise.resolve(VALID_CATEGORIES)
      if (cmd === 'documents_upload') return Promise.resolve(fakeDoc)
      if (cmd === 'documents_run_extraction') return Promise.resolve({
        doctor_candidates: [],
        category_suggestion: null,
        document_tags: [],
        auto_tags: [],
        contact_suggestions: [contactSugg],
        activity_date: '2023-03-09',
      })
      if (cmd === 'documents_update') return Promise.resolve(fakeDoc)
      if (cmd === 'documents_tags_set') return Promise.resolve(undefined)
      if (cmd === 'documents_get') return Promise.resolve(fakeDoc)
      if (cmd === 'documents_delete') return Promise.resolve(undefined)
      return Promise.resolve(undefined)
    })
    render(<UploadDialog onClose={vi.fn()} onUploaded={vi.fn()} />)
    await pickFileAndReachReview()
    const textarea = screen.getByLabelText(/timeline entry/i) as HTMLTextAreaElement
    await userEvent.clear(textarea)
    await userEvent.type(textarea, 'Edited description')
    expect(textarea.value).toBe('Edited description')
  })

  it('does not show timeline entry field when no activity_date extracted', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'categories_list') return Promise.resolve([])
      if (cmd === 'documents_valid_categories') return Promise.resolve(VALID_CATEGORIES)
      if (cmd === 'documents_upload') return Promise.resolve(fakeDoc)
      if (cmd === 'documents_run_extraction') return Promise.resolve({
        doctor_candidates: [],
        category_suggestion: null,
        document_tags: [],
        auto_tags: [],
        contact_suggestions: [],
        activity_date: null,
      })
      if (cmd === 'documents_update') return Promise.resolve(fakeDoc)
      if (cmd === 'documents_tags_set') return Promise.resolve(undefined)
      if (cmd === 'documents_get') return Promise.resolve(fakeDoc)
      if (cmd === 'documents_delete') return Promise.resolve(undefined)
      return Promise.resolve(undefined)
    })
    render(<UploadDialog onClose={vi.fn()} onUploaded={vi.fn()} />)
    await pickFileAndReachReview()
    expect(screen.queryByLabelText(/timeline entry/i)).toBeNull()
  })

  it('shows OCR extracted text preview block when extraction returns text', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'categories_list') return Promise.resolve([])
      if (cmd === 'documents_valid_categories') return Promise.resolve(VALID_CATEGORIES)
      if (cmd === 'documents_upload') return Promise.resolve(fakeDoc)
      if (cmd === 'documents_run_extraction') return Promise.resolve({
        doctor_candidates: [],
        category_suggestion: null,
        document_tags: [],
        auto_tags: [],
        contact_suggestions: [],
        extracted_text_preview: 'Blood pressure: 130/85',
      })
      if (cmd === 'documents_update') return Promise.resolve(fakeDoc)
      if (cmd === 'documents_tags_set') return Promise.resolve(undefined)
      if (cmd === 'documents_get') return Promise.resolve(fakeDoc)
      if (cmd === 'documents_delete') return Promise.resolve(undefined)
      return Promise.resolve(undefined)
    })
    render(<UploadDialog onClose={vi.fn()} onUploaded={vi.fn()} />)
    await pickFileAndReachReview()
    await waitFor(() => expect(screen.getByTestId('upload-extracted-text-preview')).toBeTruthy())
    expect(screen.getByText('Blood pressure: 130/85')).toBeTruthy()
    const notesTextarea = screen.getByLabelText(/notes/i) as HTMLTextAreaElement
    expect(notesTextarea.value).toBe('')
  })

  it('does not show OCR extracted text preview block when extraction returns null', async () => {
    render(<UploadDialog onClose={vi.fn()} onUploaded={vi.fn()} />)
    await pickFileAndReachReview()
    expect(screen.queryByTestId('upload-extracted-text-preview')).toBeNull()
  })
})

describe('UploadDialog — batch mode', () => {
  beforeEach(() => {
    mockInvoke.mockReset()
    mockOpen.mockReset()
    mockListen.mockReset()
    mockListen.mockResolvedValue(() => {})
  })

  it('shows file rows with done/error status after batch processing 3 files (2 ok, 1 fail)', async () => {
    const fakeDoc1 = { ...fakeDoc, id: 'doc-1', filename: 'file1.pdf', file_path: '/f/file1.pdf' }
    const fakeDoc2 = { ...fakeDoc, id: 'doc-2', filename: 'file2.pdf', file_path: '/f/file2.pdf' }

    mockInvoke.mockImplementation((cmd: string, args?: Record<string, unknown>) => {
      if (cmd === 'categories_list') return Promise.resolve([])
      if (cmd === 'documents_valid_categories') return Promise.resolve(VALID_CATEGORIES)
      if (cmd === 'documents_run_extraction') return Promise.resolve({ doctor_candidates: [], category_suggestion: null, document_tags: [], auto_tags: [], contact_suggestions: [] })
      if (cmd === 'documents_upload') {
        const path = (args as { filePath: string }).filePath
        if (path === '/f/file1.pdf') return Promise.resolve(fakeDoc1)
        if (path === '/f/file2.pdf') return Promise.resolve(fakeDoc2)
        return Promise.reject(new Error('upload failed'))
      }
      if (cmd === 'get_pending_review_count') return Promise.resolve(3)
      return Promise.resolve(undefined)
    })

    mockOpen.mockResolvedValue(['/f/file1.pdf', '/f/file2.pdf', '/f/file3.pdf'])
    render(<UploadDialog onClose={vi.fn()} onUploaded={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /select files/i }))

    await waitFor(() => {
      const rows = screen.getAllByTestId('upload-file-row')
      expect(rows).toHaveLength(3)
      const statuses = rows.map((r) => r.getAttribute('data-status'))
      expect(statuses).toContain('done')
      expect(statuses).toContain('error')
    })
  })

  it('shows toast with document count and pending entity count after batch completes', async () => {
    const fakeDoc1 = { ...fakeDoc, id: 'doc-1', filename: 'a.pdf', file_path: '/f/a.pdf' }
    const fakeDoc2 = { ...fakeDoc, id: 'doc-2', filename: 'b.pdf', file_path: '/f/b.pdf' }

    mockInvoke.mockImplementation((cmd: string, args?: Record<string, unknown>) => {
      if (cmd === 'categories_list') return Promise.resolve([])
      if (cmd === 'documents_valid_categories') return Promise.resolve(VALID_CATEGORIES)
      if (cmd === 'documents_run_extraction') return Promise.resolve({ doctor_candidates: [], category_suggestion: null, document_tags: [], auto_tags: [], contact_suggestions: [] })
      if (cmd === 'documents_upload') {
        const path = (args as { filePath: string }).filePath
        if (path === '/f/a.pdf') return Promise.resolve(fakeDoc1)
        return Promise.resolve(fakeDoc2)
      }
      if (cmd === 'get_pending_review_count') return Promise.resolve(5)
      return Promise.resolve(undefined)
    })

    mockOpen.mockResolvedValue(['/f/a.pdf', '/f/b.pdf'])
    render(<UploadDialog onClose={vi.fn()} onUploaded={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /select files/i }))

    await waitFor(() => {
      expect(screen.getByText(/2 documents uploaded/i)).toBeTruthy()
      expect(screen.getByText(/5 entities pending review/i)).toBeTruthy()
    })
  })

  it('shows toast without entity suffix when get_pending_review_count returns 0', async () => {
    const fakeDoc1 = { ...fakeDoc, id: 'doc-x', filename: 'x.pdf', file_path: '/f/x.pdf' }

    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'categories_list') return Promise.resolve([])
      if (cmd === 'documents_valid_categories') return Promise.resolve(VALID_CATEGORIES)
      if (cmd === 'documents_run_extraction') return Promise.resolve({ doctor_candidates: [], category_suggestion: null, document_tags: [], auto_tags: [], contact_suggestions: [] })
      if (cmd === 'documents_upload') return Promise.resolve(fakeDoc1)
      if (cmd === 'get_pending_review_count') return Promise.resolve(0)
      return Promise.resolve(undefined)
    })

    mockOpen.mockResolvedValue(['/f/x.pdf', '/f/y.pdf'])
    render(<UploadDialog onClose={vi.fn()} onUploaded={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /select files/i }))

    await waitFor(() => {
      expect(screen.getByText(/documents uploaded/i)).toBeTruthy()
      expect(screen.queryByText(/entities pending review/i)).toBeNull()
    })
  })
})

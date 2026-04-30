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
}

function setupInvoke() {
  mockInvoke.mockImplementation((cmd: string) => {
    if (cmd === 'categories_list') return Promise.resolve([])
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
  await userEvent.click(screen.getByRole('button', { name: /drop file here/i }))
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

  it('shows drop zone button in initial step', () => {
    render(<UploadDialog onClose={vi.fn()} onUploaded={vi.fn()} />)
    expect(screen.getByRole('button', { name: /drop file here/i })).toBeTruthy()
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
    await userEvent.click(screen.getByRole('button', { name: /drop file here/i }))
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
    await waitFor(() => expect(onUploaded).toHaveBeenCalledWith(fakeDoc))
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
      if (cmd === 'documents_upload') return Promise.reject(new Error('disk full'))
      return Promise.resolve(undefined)
    })
    mockOpen.mockResolvedValue('/home/user/report.pdf')
    render(<UploadDialog onClose={vi.fn()} onUploaded={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /drop file here/i }))
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
      })
    })
  })

  it('includes document_date in tags when doc has one', async () => {
    const docWithDate = { ...fakeDoc, document_date: '2026-03-15' }
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'categories_list') return Promise.resolve([])
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
    const tagsInput = screen.getByLabelText(/tags/i) as HTMLInputElement
    expect(tagsInput.value).toContain('2026-03-15')
  })

  it('shows contact suggestions from extraction and saves one (no duplicate)', async () => {
    const contactSugg = { name: 'Dr. House', specialty: 'Diagnostics', clinic: 'PPTH', address: null, phone: '555-9999', email: null }
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'categories_list') return Promise.resolve([])
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
    await waitFor(() => expect(screen.getByText('Dr. House')).toBeTruthy())
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

  it('shows and dismisses category suggestion', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'categories_list') return Promise.resolve([])
      if (cmd === 'documents_upload') return Promise.resolve(fakeDoc)
      if (cmd === 'documents_run_extraction') return Promise.resolve({ doctor_candidates: [], category_suggestion: 'prescription', document_tags: [], contact_suggestions: [] })
      if (cmd === 'documents_update') return Promise.resolve(fakeDoc)
      if (cmd === 'documents_tags_set') return Promise.resolve(undefined)
      if (cmd === 'documents_get') return Promise.resolve(fakeDoc)
      if (cmd === 'documents_delete') return Promise.resolve(undefined)
      return Promise.resolve(undefined)
    })
    render(<UploadDialog onClose={vi.fn()} onUploaded={vi.fn()} />)
    await pickFileAndReachReview()
    await waitFor(() => expect(screen.getByText(/suggested category/i)).toBeTruthy())
    const dismissBtn = screen.getByRole('button', { name: /dismiss/i })
    await userEvent.click(dismissBtn)
    await waitFor(() => expect(screen.queryByText(/suggested category/i)).toBeNull())
  })

  it('cancel on duplicate prompt deletes new contact and returns to idle', async () => {
    const contactSugg = { name: 'Dr. House', specialty: null, clinic: null, address: null, phone: null, email: null }
    const dupCandidate = { primary_contact_id: 'new-c1', contact: { id: 'existing-c1', name: 'Dr. Greg House' }, similarity_score: 0.92, match_reason: 'name similarity' }
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'categories_list') return Promise.resolve([])
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

  it('cancel on duplicate prompt returns to idle even if delete fails', async () => {
    const contactSugg = { name: 'Dr. House', specialty: null, clinic: null, address: null, phone: null, email: null }
    const dupCandidate = { primary_contact_id: 'new-c1', contact: { id: 'existing-c1', name: 'Dr. Greg House' }, similarity_score: 0.92, match_reason: 'name similarity' }
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'categories_list') return Promise.resolve([])
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

  it('processes file via drag and drop', async () => {
    render(<UploadDialog onClose={vi.fn()} onUploaded={vi.fn()} />)
    const dropZone = screen.getByRole('button', { name: /drop file here/i })
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
      if (cmd === 'documents_upload') return Promise.resolve(fakeDoc)
      if (cmd === 'documents_run_extraction') return new Promise((res) => { resolveExtraction = res })
      return Promise.resolve(undefined)
    })

    await userEvent.click(screen.getByRole('button', { name: /drop file here/i }))

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
    const tagsInput = screen.getByLabelText(/tags/i) as HTMLInputElement
    const tagValues = tagsInput.value.split(',').map((t) => t.trim()).filter(Boolean)
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
      if (cmd === 'documents_upload') return Promise.resolve(fakeDoc)
      if (cmd === 'documents_run_extraction') return new Promise((res) => { resolveExtraction = res })
      if (cmd === 'documents_update') return Promise.resolve(fakeDoc)
      if (cmd === 'documents_tags_set') return Promise.resolve(undefined)
      if (cmd === 'documents_get') return Promise.resolve(fakeDoc)
      return Promise.resolve(undefined)
    })

    await userEvent.click(screen.getByRole('button', { name: /drop file here/i }))
    await waitFor(() => expect(ocrCallback).not.toBeNull())

    ocrCallback!({ payload: { page: 1, total: 3, elapsed_ms: 1000 } })
    await waitFor(() => expect(screen.getByRole('progressbar')).toBeTruthy())

    resolveExtraction({ doctor_candidates: [], category_suggestion: null, document_tags: [], auto_tags: [], contact_suggestions: [] })

    await waitFor(() => expect(screen.queryByRole('progressbar')).toBeNull())
    // Component should now be in review step
    await waitFor(() => expect(screen.getByText('report.pdf')).toBeTruthy())
  })
})

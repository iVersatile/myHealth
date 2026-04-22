import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UploadDialog } from './UploadDialog'
import type { Document } from '../../store/documentsStore'

const mockInvoke = vi.fn()
const mockOpen = vi.fn()

vi.mock('@tauri-apps/api/core', () => ({ invoke: (...args: unknown[]) => mockInvoke(...args) }))
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: (...args: unknown[]) => mockOpen(...args) }))

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
  tags: [],
}

function setupInvoke() {
  mockInvoke.mockImplementation((cmd: string) => {
    if (cmd === 'categories_list') return Promise.resolve([])
    if (cmd === 'documents_upload') return Promise.resolve(fakeDoc)
    if (cmd === 'documents_run_extraction') return Promise.resolve([])
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
})

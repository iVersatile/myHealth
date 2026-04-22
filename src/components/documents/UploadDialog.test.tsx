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

describe('UploadDialog', () => {
  beforeEach(() => {
    mockInvoke.mockReset()
    mockOpen.mockReset()
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'categories_list') return Promise.resolve([])
      return Promise.resolve(undefined)
    })
  })

  it('renders dialog title', () => {
    render(<UploadDialog onClose={vi.fn()} onUploaded={vi.fn()} />)
    expect(screen.getByText('Upload Document')).toBeTruthy()
  })

  it('calls onClose when Cancel button clicked', async () => {
    const onClose = vi.fn()
    render(<UploadDialog onClose={onClose} onUploaded={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onClose).toHaveBeenCalled()
  })

  it('calls onClose when close button clicked', async () => {
    const onClose = vi.fn()
    render(<UploadDialog onClose={onClose} onUploaded={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /close dialog/i }))
    expect(onClose).toHaveBeenCalled()
  })

  it('Upload button is disabled when no file selected', () => {
    render(<UploadDialog onClose={vi.fn()} onUploaded={vi.fn()} />)
    const uploadBtn = screen.getByRole('button', { name: /^upload$/i }) as HTMLButtonElement
    expect(uploadBtn.disabled).toBe(true)
  })

  it('calls open() when drop zone button clicked', async () => {
    mockOpen.mockResolvedValue(null)
    render(<UploadDialog onClose={vi.fn()} onUploaded={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /drop file here/i }))
    expect(mockOpen).toHaveBeenCalled()
  })

  it('shows picked filename after file selection via picker', async () => {
    mockOpen.mockResolvedValue('/home/user/report.pdf')
    render(<UploadDialog onClose={vi.fn()} onUploaded={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /drop file here/i }))
    await waitFor(() => expect(screen.getByText('report.pdf')).toBeTruthy())
  })

  it('uploads file and calls onUploaded on success without tags', async () => {
    mockOpen.mockResolvedValue('/home/user/report.pdf')
    mockInvoke.mockResolvedValue(fakeDoc)
    const onUploaded = vi.fn()
    const onClose = vi.fn()
    render(<UploadDialog onClose={onClose} onUploaded={onUploaded} />)
    await userEvent.click(screen.getByRole('button', { name: /drop file here/i }))
    await waitFor(() => screen.getByText('report.pdf'))
    await userEvent.click(screen.getByRole('button', { name: /^upload$/i }))
    await waitFor(() => expect(onUploaded).toHaveBeenCalledWith(fakeDoc))
    expect(onClose).toHaveBeenCalled()
  })

  it('calls documents_tags_set and passes merged doc to onUploaded when tags provided', async () => {
    mockOpen.mockResolvedValue('/home/user/report.pdf')
    mockInvoke.mockResolvedValue(fakeDoc)
    const onUploaded = vi.fn()
    render(<UploadDialog onClose={vi.fn()} onUploaded={onUploaded} />)
    await userEvent.click(screen.getByRole('button', { name: /drop file here/i }))
    await waitFor(() => screen.getByText('report.pdf'))
    await userEvent.type(screen.getByLabelText(/tags/i), 'blood, annual')
    await userEvent.click(screen.getByRole('button', { name: /^upload$/i }))
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('documents_tags_set', {
        id: 'new-doc',
        tags: ['blood', 'annual'],
      })
    })
    expect(onUploaded).toHaveBeenCalledWith({ ...fakeDoc, tags: ['blood', 'annual'] })
  })

  it('shows error message when upload fails', async () => {
    mockOpen.mockResolvedValue('/home/user/report.pdf')
    mockInvoke.mockRejectedValue(new Error('disk full'))
    render(<UploadDialog onClose={vi.fn()} onUploaded={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /drop file here/i }))
    await waitFor(() => screen.getByText('report.pdf'))
    await userEvent.click(screen.getByRole('button', { name: /^upload$/i }))
    await waitFor(() => expect(screen.getByText('disk full')).toBeTruthy())
  })

  it('renders category select with lab as default', () => {
    render(<UploadDialog onClose={vi.fn()} onUploaded={vi.fn()} />)
    const select = screen.getByLabelText(/category/i) as HTMLSelectElement
    expect(select.value).toBe('lab')
  })

  it('passes notes to documents_upload', async () => {
    mockOpen.mockResolvedValue('/home/user/report.pdf')
    mockInvoke.mockResolvedValue(fakeDoc)
    render(<UploadDialog onClose={vi.fn()} onUploaded={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /drop file here/i }))
    await waitFor(() => screen.getByText('report.pdf'))
    await userEvent.type(screen.getByLabelText(/notes/i), 'Annual checkup')
    await userEvent.click(screen.getByRole('button', { name: /^upload$/i }))
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('documents_upload', {
        filePath: '/home/user/report.pdf',
        category: 'lab',
        notes: 'Annual checkup',
      })
    })
  })
})

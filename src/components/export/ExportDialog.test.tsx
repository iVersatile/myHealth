import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useDocumentsStore } from '../../store/documentsStore'
import type { Document } from '../../store/documentsStore'

const mockExportBundle = vi.fn()
const mockPickOutputPath = vi.fn()

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))
vi.mock('@tauri-apps/plugin-dialog', () => ({ save: vi.fn() }))
vi.mock('../../hooks/useExport', () => ({
  useExport: () => ({
    exporting: false,
    error: null,
    exportBundle: mockExportBundle,
    pickOutputPath: mockPickOutputPath,
  }),
}))

const makeDoc = (overrides: Partial<Document> = {}): Document => ({
  id: 'd1',
  filename: 'blood-test.pdf',
  file_path: '/files/d1.pdf',
  mime_type: 'application/pdf',
  file_size_bytes: 2048,
  category: 'lab',
  thumbnail_path: null,
  notes: null,
  created_at: '2026-04-20T10:00:00Z',
  updated_at: '2026-04-20T10:00:00Z',
  is_deleted: false,
  document_date: null,
  tags: [],
  ...overrides,
})

beforeEach(() => {
  vi.clearAllMocks()
  useDocumentsStore.setState({
    documents: [],
    total: 0,
    page: 1,
    limit: 20,
    category: 'all',
    loading: false,
    error: null,
  })
})

describe('ExportDialog', () => {
  it('renders dialog title', async () => {
    const { ExportDialog } = await import('./ExportDialog')
    render(<ExportDialog onClose={vi.fn()} />)
    expect(screen.getByText('Export PDF Bundle')).toBeTruthy()
  })

  it('calls onClose when Cancel is clicked', async () => {
    const { ExportDialog } = await import('./ExportDialog')
    const onClose = vi.fn()
    render(<ExportDialog onClose={onClose} />)
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onClose).toHaveBeenCalled()
  })

  it('calls onClose when ✕ button is clicked', async () => {
    const { ExportDialog } = await import('./ExportDialog')
    const onClose = vi.fn()
    render(<ExportDialog onClose={onClose} />)
    await userEvent.click(screen.getByRole('button', { name: /close dialog/i }))
    expect(onClose).toHaveBeenCalled()
  })

  it('shows empty-state message when no documents', async () => {
    const { ExportDialog } = await import('./ExportDialog')
    render(<ExportDialog onClose={vi.fn()} />)
    expect(screen.getByText('No documents available.')).toBeTruthy()
  })

  it('lists documents when store has items', async () => {
    const { ExportDialog } = await import('./ExportDialog')
    useDocumentsStore.setState({
      documents: [makeDoc({ id: 'd1', filename: 'report.pdf' })],
      total: 1,
      page: 1,
      limit: 20,
      category: 'all',
      loading: false,
      error: null,
    })
    render(<ExportDialog onClose={vi.fn()} />)
    expect(screen.getByText('report.pdf')).toBeTruthy()
  })

  it('Export PDF button is disabled when nothing selected', async () => {
    const { ExportDialog } = await import('./ExportDialog')
    useDocumentsStore.setState({
      documents: [makeDoc()],
      total: 1,
      page: 1,
      limit: 20,
      category: 'all',
      loading: false,
      error: null,
    })
    render(<ExportDialog onClose={vi.fn()} />)
    const btn = screen.getByRole('button', { name: /export pdf/i })
    expect((btn as HTMLButtonElement).disabled).toBe(true)
  })

  it('Export PDF button is disabled when no output path is set', async () => {
    const { ExportDialog } = await import('./ExportDialog')
    useDocumentsStore.setState({
      documents: [makeDoc()],
      total: 1,
      page: 1,
      limit: 20,
      category: 'all',
      loading: false,
      error: null,
    })
    render(<ExportDialog onClose={vi.fn()} />)
    await userEvent.click(screen.getByRole('checkbox'))
    const btn = screen.getByRole('button', { name: /export pdf/i })
    expect((btn as HTMLButtonElement).disabled).toBe(true)
  })

  it('Select all toggles all checkboxes', async () => {
    const { ExportDialog } = await import('./ExportDialog')
    useDocumentsStore.setState({
      documents: [makeDoc({ id: 'd1' }), makeDoc({ id: 'd2', filename: 'xray.png' })],
      total: 2,
      page: 1,
      limit: 20,
      category: 'all',
      loading: false,
      error: null,
    })
    render(<ExportDialog onClose={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: /select all/i }))
    expect(screen.getByText(/2 selected/)).toBeTruthy()

    await userEvent.click(screen.getByRole('button', { name: /deselect all/i }))
    expect(screen.getByText(/0 selected/)).toBeTruthy()
  })

  it('Browse button calls pickOutputPath and displays returned path', async () => {
    const { ExportDialog } = await import('./ExportDialog')
    mockPickOutputPath.mockResolvedValueOnce('/home/user/bundle.pdf')
    render(<ExportDialog onClose={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: /browse/i }))

    await waitFor(() => {
      const input = screen.getByPlaceholderText(/click browse/i) as HTMLInputElement
      expect(input.value).toBe('/home/user/bundle.pdf')
    })
  })

  it('calls exportBundle with selected ids, title, and path', async () => {
    const { ExportDialog } = await import('./ExportDialog')
    mockPickOutputPath.mockResolvedValueOnce('/home/user/bundle.pdf')
    mockExportBundle.mockResolvedValueOnce(true)
    useDocumentsStore.setState({
      documents: [makeDoc({ id: 'd1' })],
      total: 1,
      page: 1,
      limit: 20,
      category: 'all',
      loading: false,
      error: null,
    })

    render(<ExportDialog onClose={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: /browse/i }))
    await waitFor(() =>
      expect((screen.getByPlaceholderText(/click browse/i) as HTMLInputElement).value).toBe(
        '/home/user/bundle.pdf',
      ),
    )

    await userEvent.click(screen.getByRole('checkbox'))
    await userEvent.click(screen.getByRole('button', { name: /export pdf/i }))

    await waitFor(() => {
      expect(mockExportBundle).toHaveBeenCalledWith(
        ['d1'],
        expect.any(String),
        '/home/user/bundle.pdf',
      )
    })
  })

  it('shows success state after export completes', async () => {
    const { ExportDialog } = await import('./ExportDialog')
    mockPickOutputPath.mockResolvedValueOnce('/home/user/bundle.pdf')
    mockExportBundle.mockResolvedValueOnce(true)
    useDocumentsStore.setState({
      documents: [makeDoc({ id: 'd1' })],
      total: 1,
      page: 1,
      limit: 20,
      category: 'all',
      loading: false,
      error: null,
    })

    render(<ExportDialog onClose={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: /browse/i }))
    await waitFor(() =>
      expect((screen.getByPlaceholderText(/click browse/i) as HTMLInputElement).value).toBe(
        '/home/user/bundle.pdf',
      ),
    )
    await userEvent.click(screen.getByRole('checkbox'))
    await userEvent.click(screen.getByRole('button', { name: /export pdf/i }))

    await waitFor(() => expect(screen.getByText('PDF exported successfully.')).toBeTruthy())
  })
})

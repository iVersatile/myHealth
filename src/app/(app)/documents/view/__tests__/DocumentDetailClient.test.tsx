import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import DocumentDetailClient from '../DocumentDetailClient'

const mockInvoke = vi.fn()
const mockConvertFileSrc = vi.fn((path: string) => `asset://localhost${path}`)

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
  convertFileSrc: (path: string) => mockConvertFileSrc(path),
}))

vi.mock('next/navigation', () => ({
  useSearchParams: () => ({ get: () => 'doc-1' }),
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('../../../../components/categories/CategoryPicker', () => ({
  CategoryPicker: () => null,
}))

const makeDoc = (overrides = {}) => ({
  id: 'doc-1',
  filename: 'report.pdf',
  file_path: '/Users/test/.myHealth/files/documents/doc-1/original.pdf',
  mime_type: 'application/pdf',
  file_size_bytes: 102400,
  category: 'lab',
  thumbnail_path: null,
  notes: null,
  created_at: '2026-04-22T10:00:00Z',
  updated_at: '2026-04-22T10:00:00Z',
  is_deleted: false,
  document_date: null,
  tags: [],
  ...overrides,
})

function setupInvoke(docOverrides = {}) {
  mockInvoke.mockImplementation((cmd: string) => {
    if (cmd === 'documents_get') return Promise.resolve(makeDoc(docOverrides))
    if (cmd === 'categories_list') return Promise.resolve([])
    if (cmd === 'categories_for_document') return Promise.resolve([])
    if (cmd === 'links_list_for_document') return Promise.resolve([])
    if (cmd === 'appointments_list') return Promise.resolve([])
    return Promise.resolve(undefined)
  })
}

describe('DocumentDetailClient — document preview (AC-F1.6)', () => {
  beforeEach(() => {
    mockInvoke.mockReset()
    mockConvertFileSrc.mockClear()
  })

  it('renders iframe with asset URL for PDF documents', async () => {
    setupInvoke()
    const { container } = render(<DocumentDetailClient />)
    await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull())
    const iframe = container.querySelector('iframe')
    expect(iframe).toBeTruthy()
    expect(iframe?.getAttribute('src')).toContain('original.pdf')
  })

  it('passes file_path to convertFileSrc for PDF documents', async () => {
    setupInvoke()
    render(<DocumentDetailClient />)
    await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull())
    expect(mockConvertFileSrc).toHaveBeenCalledWith(
      '/Users/test/.myHealth/files/documents/doc-1/original.pdf'
    )
  })

  it('renders img with asset URL for image documents', async () => {
    setupInvoke({ mime_type: 'image/jpeg', filename: 'scan.jpg' })
    const { container } = render(<DocumentDetailClient />)
    await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull())
    const img = container.querySelector('img[alt="scan.jpg"]')
    expect(img).toBeTruthy()
    expect(img?.getAttribute('src')).toContain('original.pdf')
  })

  it('shows fallback for unsupported file types', async () => {
    setupInvoke({ mime_type: 'text/plain', filename: 'note.txt' })
    render(<DocumentDetailClient />)
    await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull())
    expect(screen.getByText('Preview not available for this file type.')).toBeTruthy()
  })

  it('does not render iframe for image documents', async () => {
    setupInvoke({ mime_type: 'image/jpeg', filename: 'scan.jpg' })
    const { container } = render(<DocumentDetailClient />)
    await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull())
    expect(container.querySelector('iframe')).toBeNull()
  })
})

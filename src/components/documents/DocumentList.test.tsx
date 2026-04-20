import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DocumentList } from './DocumentList'
import type { Document } from '../../store/documentsStore'

const mockDeleteDocument = vi.fn()
const mockGoToPage = vi.fn()
const mockFilterByCategory = vi.fn()

let mockHookReturn = {
  documents: [] as Document[],
  total: 0,
  page: 1,
  limit: 20,
  category: 'all' as const,
  loading: false,
  error: null as string | null,
  deleteDocument: mockDeleteDocument,
  goToPage: mockGoToPage,
  filterByCategory: mockFilterByCategory,
  refresh: vi.fn(),
}

vi.mock('../../hooks/useDocuments', () => ({
  useDocuments: () => mockHookReturn,
}))

vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}))

const makeDoc = (id: string): Document => ({
  id,
  filename: `${id}.pdf`,
  file_path: `/files/${id}.pdf`,
  mime_type: 'application/pdf',
  file_size_bytes: 1024,
  category: 'lab',
  thumbnail_path: null,
  notes: null,
  created_at: '2026-04-14T09:00:00Z',
  updated_at: '2026-04-14T09:00:00Z',
  is_deleted: false,
  tags: [],
})

describe('DocumentList', () => {
  beforeEach(() => {
    mockHookReturn = {
      documents: [],
      total: 0,
      page: 1,
      limit: 20,
      category: 'all',
      loading: false,
      error: null,
      deleteDocument: mockDeleteDocument,
      goToPage: mockGoToPage,
      filterByCategory: mockFilterByCategory,
      refresh: vi.fn(),
    }
    mockDeleteDocument.mockReset()
    mockGoToPage.mockReset()
    mockFilterByCategory.mockReset()
  })

  it('shows loading state', () => {
    mockHookReturn.loading = true
    render(<DocumentList />)
    expect(screen.getByText(/loading/i)).toBeTruthy()
  })

  it('shows error message', () => {
    mockHookReturn.error = 'Failed to load'
    render(<DocumentList />)
    expect(screen.getByText('Failed to load')).toBeTruthy()
  })

  it('shows empty state when no documents', () => {
    render(<DocumentList />)
    expect(screen.getByText(/no documents yet/i)).toBeTruthy()
  })

  it('renders a document card for each document', () => {
    mockHookReturn.documents = [makeDoc('a'), makeDoc('b')]
    mockHookReturn.total = 2
    render(<DocumentList />)
    expect(screen.getByText('a.pdf')).toBeTruthy()
    expect(screen.getByText('b.pdf')).toBeTruthy()
  })

  it('renders category filter chips', () => {
    render(<DocumentList />)
    expect(screen.getByRole('button', { name: 'All' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Lab' })).toBeTruthy()
  })

  it('calls filterByCategory when chip clicked', async () => {
    render(<DocumentList />)
    await userEvent.click(screen.getByRole('button', { name: 'Lab' }))
    expect(mockFilterByCategory).toHaveBeenCalledWith('lab')
  })

  it('does not show pagination when total fits on one page', () => {
    mockHookReturn.documents = [makeDoc('x')]
    mockHookReturn.total = 1
    render(<DocumentList />)
    expect(screen.queryByRole('navigation', { name: /document pages/i })).toBeNull()
  })

  it('shows pagination when multiple pages exist', () => {
    mockHookReturn.documents = Array.from({ length: 20 }, (_, i) => makeDoc(`d${i}`))
    mockHookReturn.total = 25
    mockHookReturn.page = 1
    render(<DocumentList />)
    expect(screen.getByRole('navigation', { name: /document pages/i })).toBeTruthy()
    expect(screen.getByText('Page 1 of 2')).toBeTruthy()
  })

  it('calls goToPage(2) when next page clicked', async () => {
    mockHookReturn.documents = Array.from({ length: 20 }, (_, i) => makeDoc(`d${i}`))
    mockHookReturn.total = 25
    mockHookReturn.page = 1
    render(<DocumentList />)
    await userEvent.click(screen.getByRole('button', { name: /next page/i }))
    expect(mockGoToPage).toHaveBeenCalledWith(2)
  })

  it('previous page button is disabled on first page', () => {
    mockHookReturn.documents = Array.from({ length: 20 }, (_, i) => makeDoc(`d${i}`))
    mockHookReturn.total = 25
    mockHookReturn.page = 1
    render(<DocumentList />)
    const prevBtn = screen.getByRole('button', { name: /previous page/i }) as HTMLButtonElement
    expect(prevBtn.disabled).toBe(true)
  })
})

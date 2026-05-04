import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DocumentList } from './DocumentList'
import type { Document } from '../../store/documentsStore'

const { mockInvoke } = vi.hoisted(() => ({ mockInvoke: vi.fn() }))
vi.mock('@tauri-apps/api/core', () => ({ invoke: mockInvoke }))

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
  document_date: null,
  activity_date: null,
  tags: [],
  clinic_name: null,
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
    mockInvoke.mockResolvedValue([])
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

  it('renders category filter chips from categories_list', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'categories_list')
        return Promise.resolve([
          { id: 'cat-1', name: 'Lab', parent_id: null, color_hex: '#6366f1', is_system: false, sort_order: 0 },
        ])
      return Promise.resolve([])
    })
    render(<DocumentList />)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Lab' })).toBeTruthy())
  })

  it('toggles category filter chip on click', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'categories_list')
        return Promise.resolve([
          { id: 'cat-1', name: 'Lab', parent_id: null, color_hex: '#6366f1', is_system: false, sort_order: 0 },
        ])
      return Promise.resolve({ items: [], total: 0 })
    })
    const user = userEvent.setup()
    render(<DocumentList />)
    await waitFor(() => screen.getByRole('button', { name: 'Lab' }))
    await user.click(screen.getByRole('button', { name: 'Lab' }))
    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith('documents_search_filtered', expect.objectContaining({
        categoryIds: ['cat-1'],
      })),
    )
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

  it('renders a checkbox for each document', () => {
    mockHookReturn.documents = [makeDoc('a'), makeDoc('b')]
    mockHookReturn.total = 2
    render(<DocumentList />)
    expect(screen.getByRole('checkbox', { name: /select a\.pdf/i })).toBeTruthy()
    expect(screen.getByRole('checkbox', { name: /select b\.pdf/i })).toBeTruthy()
  })

  it('shows action bar when a document is selected', async () => {
    const user = userEvent.setup()
    mockHookReturn.documents = [makeDoc('a')]
    mockHookReturn.total = 1
    render(<DocumentList />)
    await user.click(screen.getByRole('checkbox', { name: /select a\.pdf/i }))
    expect(screen.getByRole('toolbar', { name: /bulk actions/i })).toBeTruthy()
    expect(screen.getByText(/1 document selected/i)).toBeTruthy()
  })

  it('hides action bar after cancel', async () => {
    const user = userEvent.setup()
    mockHookReturn.documents = [makeDoc('a')]
    mockHookReturn.total = 1
    render(<DocumentList />)
    await user.click(screen.getByRole('checkbox', { name: /select a\.pdf/i }))
    await user.click(screen.getByRole('button', { name: /cancel/i }))
    expect(screen.queryByRole('toolbar', { name: /bulk actions/i })).toBeNull()
  })

  it('select-all checkbox selects all documents on the page', async () => {
    const user = userEvent.setup()
    mockHookReturn.documents = [makeDoc('a'), makeDoc('b')]
    mockHookReturn.total = 2
    render(<DocumentList />)
    await user.click(screen.getByRole('checkbox', { name: /select all documents/i }))
    expect(screen.getByText(/2 documents selected/i)).toBeTruthy()
  })

  it('calls categories_bulk_link with selected ids and chosen category', async () => {
    const user = userEvent.setup()
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'categories_list')
        return Promise.resolve([
          { id: 'cat-1', name: 'Cardiology', parent_id: null, color_hex: '#EF4444', is_system: true, sort_order: 0 },
        ])
      return Promise.resolve(undefined)
    })
    mockHookReturn.documents = [makeDoc('a'), makeDoc('b')]
    mockHookReturn.total = 2
    render(<DocumentList />)

    await user.click(screen.getByRole('checkbox', { name: /select a\.pdf/i }))
    await user.click(screen.getByRole('checkbox', { name: /select b\.pdf/i }))

    await waitFor(() => screen.getByRole('option', { name: 'Cardiology' }))
    await user.selectOptions(
      screen.getByRole('combobox', { name: /choose category/i }),
      'cat-1',
    )
    await user.click(screen.getByRole('button', { name: /assign category/i }))

    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith('categories_bulk_link', {
        userId: '',
        entityType: 'document',
        entityIds: ['a', 'b'],
        categoryId: 'cat-1',
      }),
    )
    // selection cleared after success
    expect(screen.queryByRole('toolbar', { name: /bulk actions/i })).toBeNull()
  })
})

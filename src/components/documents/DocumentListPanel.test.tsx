import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { DocumentListPanel } from './DocumentListPanel'
import type { Document } from '../../store/documentsStore'

const { mockInvoke } = vi.hoisted(() => ({ mockInvoke: vi.fn() }))
vi.mock('@tauri-apps/api/core', () => ({ invoke: mockInvoke }))

vi.mock('react-virtuoso', () => ({
  Virtuoso: ({ data, itemContent }: { data: Document[]; itemContent: (i: number, d: Document) => React.ReactNode }) => (
    <div data-testid="virtuoso">
      {data.map((doc, i) => (
        <div key={doc.id}>{itemContent(i, doc)}</div>
      ))}
    </div>
  ),
}))

const makeDoc = (id: string, overrides: Partial<Document> = {}): Document => ({
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
  extracted_text: null,
  ...overrides,
})

const DOCS_50 = Array.from({ length: 50 }, (_, i) => makeDoc(`doc-${i}`))

describe('DocumentListPanel', () => {
  beforeEach(() => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'categories_list') return Promise.resolve([{ id: 'lab', name: 'Lab' }])
      if (cmd === 'documents_search_filtered') return Promise.resolve({ items: [], total: 0 })
      return Promise.resolve(null)
    })
  })

  it('renders list panel with testid', () => {
    render(<DocumentListPanel documents={DOCS_50} />)
    expect(screen.getByTestId('document-list-panel')).toBeInTheDocument()
  })

  it('renders all 50 docs via virtualised list', () => {
    render(<DocumentListPanel documents={DOCS_50} />)
    const rows = screen.getAllByTestId('document-row')
    expect(rows).toHaveLength(50)
  })

  it('renders filter bar with search, category, date inputs', () => {
    render(<DocumentListPanel documents={DOCS_50} />)
    expect(screen.getByTestId('filter-bar')).toBeInTheDocument()
    expect(screen.getByTestId('filter-search')).toBeInTheDocument()
    expect(screen.getByTestId('filter-category')).toBeInTheDocument()
    expect(screen.getByTestId('filter-date-from')).toBeInTheDocument()
    expect(screen.getByTestId('filter-date-to')).toBeInTheDocument()
  })

  it('populates category dropdown from categories_list', async () => {
    render(<DocumentListPanel documents={DOCS_50} />)
    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Lab' })).toBeInTheDocument()
    })
  })

  it('invokes documents_search_filtered when search text entered', async () => {
    render(<DocumentListPanel documents={DOCS_50} />)
    fireEvent.change(screen.getByTestId('filter-search'), { target: { value: 'blood test' } })
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('documents_search_filtered', expect.objectContaining({
        query: 'blood test',
      }))
    }, { timeout: 500 })
  })

  it('shows filtered results when filter is active', async () => {
    const filteredDoc = makeDoc('filtered-1', { filename: 'filtered-1.pdf' })
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'categories_list') return Promise.resolve([])
      if (cmd === 'documents_search_filtered') return Promise.resolve({ items: [filteredDoc], total: 1 })
      return Promise.resolve(null)
    })
    render(<DocumentListPanel documents={DOCS_50} />)
    fireEvent.change(screen.getByTestId('filter-search'), { target: { value: 'blood' } })
    await waitFor(() => {
      const rows = screen.getAllByTestId('document-row')
      expect(rows).toHaveLength(1)
    }, { timeout: 500 })
  })

  it('highlights selected row with amber left border', () => {
    render(<DocumentListPanel documents={DOCS_50} selectedId="doc-0" />)
    const rows = screen.getAllByTestId('document-row')
    expect(rows[0]).toHaveStyle({ borderLeft: '2px solid #F0A500' })
  })

  it('emits selected doc on row click', () => {
    const onSelect = vi.fn()
    render(<DocumentListPanel documents={DOCS_50} onSelect={onSelect} />)
    fireEvent.click(screen.getAllByTestId('document-row')[0]!)
    expect(onSelect).toHaveBeenCalledWith(DOCS_50[0])
  })

  it('renders flagged indicator for docs with flagged tag', () => {
    const flaggedDoc = makeDoc('flagged-1', { tags: ['flagged'] })
    render(<DocumentListPanel documents={[flaggedDoc]} />)
    expect(screen.getByLabelText('Flagged')).toBeInTheDocument()
  })

  it('applies tint background to flagged rows', () => {
    const flaggedDoc = makeDoc('flagged-1', { tags: ['flagged'] })
    render(<DocumentListPanel documents={[flaggedDoc]} />)
    const row = screen.getByTestId('document-row')
    expect(row).toHaveStyle({ backgroundColor: 'rgba(240,165,0,0.08)' })
  })
})

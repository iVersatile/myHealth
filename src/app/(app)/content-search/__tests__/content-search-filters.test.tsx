import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ContentSearchPage from '../page'

const mockInvoke = vi.fn()
vi.mock('@tauri-apps/api/core', () => ({ invoke: (...args: unknown[]) => mockInvoke(...args) }))
vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}))

const ALL_RESULTS = [
  { entity_type: 'document', id: 'doc-1', title: 'Lab Report', snippet: 'fever <mark>reading</mark>' },
  { entity_type: 'note',     id: 'note-2', title: 'Visit Note', snippet: 'fever <mark>noted</mark>' },
]
const DOC_ONLY = [
  { entity_type: 'document', id: 'doc-1', title: 'Lab Report', snippet: 'fever <mark>reading</mark>' },
]
const SUMMARY_ALL  = { first_date: null, last_date: null, doc_count: 2, unique_providers: 0 }
const SUMMARY_DOC  = { first_date: null, last_date: null, doc_count: 1, unique_providers: 0 }

describe('ContentSearchPage — entity-type filter chips', () => {
  beforeEach(() => {
    mockInvoke.mockReset()
    mockInvoke.mockResolvedValue({ results: ALL_RESULTS, summary: SUMMARY_ALL })
  })

  async function searchFor(term: string) {
    render(<ContentSearchPage />)
    await userEvent.type(screen.getByTestId('content-search-input'), term)
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(screen.getByText('Lab Report')).toBeInTheDocument())
  }

  it('renders all chip options', async () => {
    render(<ContentSearchPage />)
    const chips = screen.getByTestId('entity-filter-chips')
    expect(chips.textContent).toContain('All')
    expect(chips.textContent).toContain('Document')
    expect(chips.textContent).toContain('Note')
    expect(chips.textContent).toContain('Symptom')
    expect(chips.textContent).toContain('Medication')
    expect(chips.textContent).toContain('Appointment')
  })

  it('initial search passes entityTypes: null to invoke', async () => {
    await searchFor('fever')
    expect(mockInvoke).toHaveBeenCalledWith('documents_content_search', expect.objectContaining({
      query: 'fever',
      entityTypes: null,
    }))
  })

  it('clicking Document chip triggers invoke with entityTypes: [document]', async () => {
    mockInvoke.mockResolvedValue({ results: DOC_ONLY, summary: SUMMARY_DOC })
    await searchFor('fever')
    mockInvoke.mockClear()
    mockInvoke.mockResolvedValue({ results: DOC_ONLY, summary: SUMMARY_DOC })

    await userEvent.click(screen.getByTestId('chip-document'))
    await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith(
      'documents_content_search',
      expect.objectContaining({ entityTypes: ['document'] }),
    ))
  })

  it('clicking All chip clears entity filter (entityTypes: null)', async () => {
    mockInvoke.mockResolvedValue({ results: DOC_ONLY, summary: SUMMARY_DOC })
    await searchFor('fever')
    await userEvent.click(screen.getByTestId('chip-document'))
    await waitFor(() => expect(mockInvoke).toHaveBeenLastCalledWith(
      'documents_content_search',
      expect.objectContaining({ entityTypes: ['document'] }),
    ))

    mockInvoke.mockClear()
    mockInvoke.mockResolvedValue({ results: ALL_RESULTS, summary: SUMMARY_ALL })
    await userEvent.click(screen.getByTestId('chip-all'))
    await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith(
      'documents_content_search',
      expect.objectContaining({ entityTypes: null }),
    ))
  })

  it('summary bar label changes to "Filtered results" when entity chip active', async () => {
    await searchFor('fever')
    mockInvoke.mockResolvedValue({ results: DOC_ONLY, summary: SUMMARY_DOC })
    await userEvent.click(screen.getByTestId('chip-document'))
    await waitFor(() => {
      const bar = screen.getByTestId('summary-bar')
      expect(bar.textContent).toContain('Filtered results')
    })
  })

  it('summary bar label is "Results" when no filter active', async () => {
    await searchFor('fever')
    const bar = screen.getByTestId('summary-bar')
    expect(bar.textContent).toContain('Results')
    expect(bar.textContent).not.toContain('Filtered results')
  })
})

describe('ContentSearchPage — date range filter', () => {
  beforeEach(() => {
    mockInvoke.mockReset()
    mockInvoke.mockResolvedValue({ results: ALL_RESULTS, summary: SUMMARY_ALL })
  })

  async function searchFor(term: string) {
    render(<ContentSearchPage />)
    await userEvent.type(screen.getByTestId('content-search-input'), term)
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(screen.getByText('Lab Report')).toBeInTheDocument())
  }

  it('date range inputs are rendered', async () => {
    render(<ContentSearchPage />)
    expect(screen.getByTestId('date-from')).toBeInTheDocument()
    expect(screen.getByTestId('date-to')).toBeInTheDocument()
  })

  it('entering dateFrom triggers invoke with dateFrom param', async () => {
    await searchFor('fever')
    mockInvoke.mockClear()
    mockInvoke.mockResolvedValue({ results: DOC_ONLY, summary: SUMMARY_DOC })

    await userEvent.type(screen.getByTestId('date-from'), '2024-01-01')
    await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith(
      'documents_content_search',
      expect.objectContaining({ dateFrom: '2024-01-01' }),
    ))
  })

  it('entering dateTo triggers invoke with dateTo param', async () => {
    await searchFor('fever')
    mockInvoke.mockClear()
    mockInvoke.mockResolvedValue({ results: DOC_ONLY, summary: SUMMARY_DOC })

    await userEvent.type(screen.getByTestId('date-to'), '2024-12-31')
    await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith(
      'documents_content_search',
      expect.objectContaining({ dateTo: '2024-12-31' }),
    ))
  })

  it('Clear button appears only when date filter active', async () => {
    render(<ContentSearchPage />)
    expect(screen.queryByTestId('clear-dates')).toBeNull()

    await userEvent.type(screen.getByTestId('date-from'), '2024-01-01')
    await waitFor(() => expect(screen.getByTestId('clear-dates')).toBeInTheDocument())
  })

  it('clicking Clear resets dates and re-searches with null dates', async () => {
    await searchFor('fever')
    await userEvent.type(screen.getByTestId('date-from'), '2024-01-01')
    await waitFor(() => expect(screen.getByTestId('clear-dates')).toBeInTheDocument())

    mockInvoke.mockClear()
    mockInvoke.mockResolvedValue({ results: ALL_RESULTS, summary: SUMMARY_ALL })
    await userEvent.click(screen.getByTestId('clear-dates'))
    await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith(
      'documents_content_search',
      expect.objectContaining({ dateFrom: null, dateTo: null }),
    ))
    expect(screen.queryByTestId('clear-dates')).toBeNull()
  })

  it('summary bar shows Filtered results when date range active', async () => {
    await searchFor('fever')
    mockInvoke.mockResolvedValue({ results: DOC_ONLY, summary: SUMMARY_DOC })
    await userEvent.type(screen.getByTestId('date-from'), '2024-01-01')
    await waitFor(() => {
      const bar = screen.getByTestId('summary-bar')
      expect(bar.textContent).toContain('Filtered results')
    })
  })
})

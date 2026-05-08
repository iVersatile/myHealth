import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ContentSearchPage from './page'

const mockInvoke = vi.fn()
vi.mock('@tauri-apps/api/core', () => ({ invoke: (...args: unknown[]) => mockInvoke(...args) }))
vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}))

const RESULT_A = {
  entity_type: 'document',
  id: 'doc-1',
  title: 'Blood Pressure Check',
  snippet: 'Patient has <mark>hypertension</mark> diagnosed.',
}
const RESULT_B = {
  entity_type: 'symptom',
  id: 'sym-2',
  title: 'Follow-up Visit',
  snippet: 'Ongoing <mark>hypertension</mark> management.',
}
const SUMMARY_2 = {
  first_date: null,
  last_date: null,
  doc_count: 2,
  unique_providers: 0,
}

describe('ContentSearchPage', () => {
  beforeEach(() => {
    mockInvoke.mockReset()
  })

  it('renders search input and button', () => {
    render(<ContentSearchPage />)
    expect(screen.getByTestId('content-search-input')).toBeTruthy()
    expect(screen.getByRole('button', { name: /search/i })).toBeTruthy()
  })

  it('search button disabled when input empty', () => {
    render(<ContentSearchPage />)
    const btn = screen.getByRole('button', { name: /search/i }) as HTMLButtonElement
    expect(btn.disabled).toBe(true)
  })

  it('search button enabled when input has text', async () => {
    render(<ContentSearchPage />)
    await userEvent.type(screen.getByTestId('content-search-input'), 'hypertension')
    const btn = screen.getByRole('button', { name: /search/i }) as HTMLButtonElement
    expect(btn.disabled).toBe(false)
  })

  it('shows no results state when invoke returns empty results', async () => {
    mockInvoke.mockResolvedValue({
      results: [],
      summary: { first_date: null, last_date: null, doc_count: 0, unique_providers: 0 },
    })
    render(<ContentSearchPage />)
    await userEvent.type(screen.getByTestId('content-search-input'), 'xyz')
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(screen.getByText(/no results found/i)).toBeTruthy())
    expect(screen.queryByTestId('summary-bar')).toBeNull()
  })

  it('shows summary bar with result count', async () => {
    mockInvoke.mockResolvedValue({ results: [RESULT_A, RESULT_B], summary: SUMMARY_2 })
    render(<ContentSearchPage />)
    await userEvent.type(screen.getByTestId('content-search-input'), 'hypertension')
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(screen.getByTestId('summary-bar')).toBeTruthy())
    const bar = screen.getByTestId('summary-bar')
    expect(bar.textContent).toContain('2')
  })

  it('renders result cards in returned order', async () => {
    mockInvoke.mockResolvedValue({ results: [RESULT_A, RESULT_B], summary: SUMMARY_2 })
    render(<ContentSearchPage />)
    await userEvent.type(screen.getByTestId('content-search-input'), 'hypertension')
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(screen.getByText('Blood Pressure Check')).toBeTruthy())
    const links = screen.getAllByRole('link')
    const hrefs = links.map((c) => c.getAttribute('href'))
    const idxA = hrefs.findIndex((h) => h?.includes('doc-1'))
    const idxB = hrefs.findIndex((h) => h?.includes('sym-2'))
    expect(idxA).toBeLessThan(idxB)
  })

  it('shows entity type badge on result card', async () => {
    mockInvoke.mockResolvedValue({ results: [RESULT_A], summary: { ...SUMMARY_2, doc_count: 1 } })
    render(<ContentSearchPage />)
    await userEvent.type(screen.getByTestId('content-search-input'), 'hypertension')
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(screen.getByText('Blood Pressure Check')).toBeTruthy())
    expect(screen.getByText('Document')).toBeTruthy()
  })

  it('renders highlighted snippet without raw mark tags in DOM', async () => {
    mockInvoke.mockResolvedValue({ results: [RESULT_A], summary: { ...SUMMARY_2, doc_count: 1, unique_providers: 1 } })
    render(<ContentSearchPage />)
    await userEvent.type(screen.getByTestId('content-search-input'), 'hypertension')
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(screen.getByText(/Patient has/)).toBeTruthy())
    expect(document.body.innerHTML).not.toContain('&lt;mark&gt;')
    expect(document.body.innerHTML).not.toContain('<mark>hypertension</mark>')
    const mark = document.querySelector('mark')
    expect(mark).toBeTruthy()
    expect(mark?.textContent).toBe('hypertension')
  })

  it('each result card links to document detail', async () => {
    mockInvoke.mockResolvedValue({ results: [RESULT_A, RESULT_B], summary: SUMMARY_2 })
    render(<ContentSearchPage />)
    await userEvent.type(screen.getByTestId('content-search-input'), 'hypertension')
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(screen.getByText('Blood Pressure Check')).toBeTruthy())
    const links = screen.getAllByRole('link')
    expect(links.some((l) => l.getAttribute('href')?.includes('doc-1'))).toBe(true)
    expect(links.some((l) => l.getAttribute('href')?.includes('sym-2'))).toBe(true)
  })

  it('shows error message when invoke rejects', async () => {
    mockInvoke.mockRejectedValue(new Error('FTS not available'))
    render(<ContentSearchPage />)
    await userEvent.type(screen.getByTestId('content-search-input'), 'hypertension')
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(screen.getByText('FTS not available')).toBeTruthy())
  })

  it('invokes documents_content_search with trimmed query', async () => {
    mockInvoke.mockResolvedValue({ results: [], summary: { first_date: null, last_date: null, doc_count: 0, unique_providers: 0 } })
    render(<ContentSearchPage />)
    await userEvent.type(screen.getByTestId('content-search-input'), '  hypertension  ')
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(mockInvoke).toHaveBeenCalled())
    expect(mockInvoke).toHaveBeenCalledWith('documents_content_search', { query: 'hypertension' })
  })
})

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

const MULTI_RESULTS = [
  { entity_type: 'document',    id: 'doc-1',  title: 'Blood Test',    snippet: 'Test <mark>result</mark>' },
  { entity_type: 'note',        id: 'note-2', title: 'Visit Note',    snippet: 'Note <mark>result</mark>' },
  { entity_type: 'symptom',     id: 'sym-3',  title: 'Headache',      snippet: 'Symptom <mark>result</mark>' },
  { entity_type: 'medication',  id: 'med-4',  title: 'Ibuprofen',     snippet: 'Med <mark>result</mark>' },
]
const SUMMARY = { first_date: null, last_date: null, doc_count: 4, unique_providers: 0 }

describe('ContentSearchPage — multi-type results', () => {
  beforeEach(() => {
    mockInvoke.mockReset()
    mockInvoke.mockResolvedValue({ results: MULTI_RESULTS, summary: SUMMARY })
  })

  async function search() {
    render(<ContentSearchPage />)
    await userEvent.type(screen.getByTestId('content-search-input'), 'result')
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(screen.getByText('Blood Test')).toBeTruthy())
  }

  it('renders one card per entity type', async () => {
    await search()
    expect(screen.getByText('Blood Test')).toBeTruthy()
    expect(screen.getByText('Visit Note')).toBeTruthy()
    expect(screen.getByText('Headache')).toBeTruthy()
    expect(screen.getByText('Ibuprofen')).toBeTruthy()
  })

  it('shows type badge for each entity', async () => {
    await search()
    expect(screen.getAllByText('Document').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Note').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Symptom').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Medication').length).toBeGreaterThan(0)
  })

  it('links to correct route per entity type', async () => {
    await search()
    const links = screen.getAllByRole('link')
    const hrefs = links.map((l) => l.getAttribute('href') ?? '')
    expect(hrefs.some((h) => h.includes('/documents/view') && h.includes('doc-1'))).toBe(true)
    expect(hrefs.some((h) => h.includes('/notes/view') && h.includes('note-2'))).toBe(true)
    expect(hrefs.some((h) => h.includes('/symptoms/view') && h.includes('sym-3'))).toBe(true)
    expect(hrefs.some((h) => h.includes('/medications/view') && h.includes('med-4'))).toBe(true)
  })

  it('summary bar shows total and per-type breakdown', async () => {
    await search()
    const bar = screen.getByTestId('summary-bar')
    expect(bar.textContent).toContain('4')
    expect(bar.textContent).toMatch(/Document|Note|Symptom|Medication/)
  })

  it('links appointment, contact, category, and unknown types correctly', async () => {
    const extended = [
      { entity_type: 'appointment', id: 'appt-5', title: 'Checkup', snippet: 'appt' },
      { entity_type: 'contact',     id: 'c-6',    title: 'Dr Smith', snippet: 'contact' },
      { entity_type: 'category',    id: 'cat-7',  title: 'Cardiology', snippet: 'cat' },
      { entity_type: 'unknown',     id: 'u-8',    title: 'Mystery',   snippet: 'unknown' },
    ]
    mockInvoke.mockResolvedValueOnce({ results: extended, summary: SUMMARY })
    render(<ContentSearchPage />)
    await userEvent.type(screen.getByTestId('content-search-input'), 'test')
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(screen.getByText('Checkup')).toBeTruthy())
    const links = screen.getAllByRole('link')
    const hrefs = links.map((l) => l.getAttribute('href') ?? '')
    expect(hrefs.some((h) => h.includes('/appointments/view') && h.includes('appt-5'))).toBe(true)
    expect(hrefs.some((h) => h === '/contacts')).toBe(true)
    expect(hrefs.some((h) => h === '/categories')).toBe(true)
    expect(hrefs.some((h) => h === '/')).toBe(true)
  })
})

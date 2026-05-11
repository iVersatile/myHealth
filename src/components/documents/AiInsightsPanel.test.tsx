import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AiInsightsPanel } from './AiInsightsPanel'
import type { Document } from '@/store/documentsStore'

const mockInvoke = vi.fn()
vi.mock('@tauri-apps/api/core', () => ({ invoke: (...args: unknown[]) => mockInvoke(...args) }))

function makeDoc(overrides: Partial<Document> = {}): Document {
  return {
    id: 'doc1',
    filename: 'test.pdf',
    file_path: '/tmp/test.pdf',
    mime_type: 'application/pdf',
    file_size_bytes: 1000,
    category: 'general',
    thumbnail_path: null,
    notes: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    is_deleted: false,
    document_date: null,
    activity_date: '2024-03-15',
    tags: [],
    clinic_name: null,
    extracted_text: null,
    ...overrides,
  }
}

const ENTITIES: Parameters<typeof AiInsightsPanel>[0]['entities'] = []

describe('AiInsightsPanel', () => {
  beforeEach(() => {
    mockInvoke.mockReset()
    mockInvoke.mockResolvedValue([])
  })

  it('renders panel with data-testid', async () => {
    render(<AiInsightsPanel doc={makeDoc()} entities={ENTITIES} docId="doc1" />)
    expect(screen.getByTestId('ai-insights-panel')).toBeTruthy()
  })

  it('shows "No summary available" when extracted_text is null', async () => {
    render(<AiInsightsPanel doc={makeDoc({ extracted_text: null })} entities={ENTITIES} docId="doc1" />)
    expect(screen.getByText(/no summary available/i)).toBeTruthy()
  })

  it('renders full summary text when under 300 chars', async () => {
    const text = 'A'.repeat(250)
    render(<AiInsightsPanel doc={makeDoc({ extracted_text: text })} entities={ENTITIES} docId="doc1" />)
    expect(screen.getByText(text)).toBeTruthy()
  })

  it('truncates summary and shows expand toggle when over 300 chars', async () => {
    const text = 'B'.repeat(400)
    render(<AiInsightsPanel doc={makeDoc({ extracted_text: text })} entities={ENTITIES} docId="doc1" />)
    expect(screen.getByText(/show more/i)).toBeTruthy()
  })

  it('expands summary on "Show more" click', async () => {
    const text = 'C'.repeat(400)
    render(<AiInsightsPanel doc={makeDoc({ extracted_text: text })} entities={ENTITIES} docId="doc1" />)
    await userEvent.click(screen.getByText(/show more/i))
    expect(screen.getByText(/show less/i)).toBeTruthy()
  })

  it('hides Flagged Lab Values section for non-lab docs', async () => {
    render(<AiInsightsPanel doc={makeDoc({ category: 'general' })} entities={ENTITIES} docId="doc1" />)
    expect(screen.queryByText(/flagged lab values/i)).toBeNull()
  })

  it('shows Flagged Lab Values section for lab docs', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_flagged_lab_values') {
        return Promise.resolve([
          { name: 'Haemoglobin', value: '18.5', unit: 'g/dL', status: 'HIGH', reference_range: '12–16' },
        ])
      }
      return Promise.resolve([])
    })
    render(<AiInsightsPanel doc={makeDoc({ category: 'lab' })} entities={ENTITIES} docId="doc1" />)
    await waitFor(() => expect(screen.getByText('Haemoglobin')).toBeTruthy())
    expect(screen.getByText(/18\.5/)).toBeTruthy()
  })

  it('renders HIGH badge with correct testid and label', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_flagged_lab_values') {
        return Promise.resolve([
          { name: 'WBC', value: '12', unit: 'K/uL', status: 'HIGH', reference_range: '4–10' },
        ])
      }
      return Promise.resolve([])
    })
    render(<AiInsightsPanel doc={makeDoc({ category: 'lab' })} entities={ENTITIES} docId="doc1" />)
    await waitFor(() => expect(screen.getAllByTestId('flagged-status-pill').length).toBeGreaterThan(0))
    expect(screen.getByText('High')).toBeTruthy()
  })

  it('shows clinic name in Extracted Details', async () => {
    render(
      <AiInsightsPanel
        doc={makeDoc({ clinic_name: 'City Health Clinic' })}
        entities={ENTITIES}
        docId="doc1"
      />,
    )
    await waitFor(() => expect(screen.getByText('City Health Clinic')).toBeTruthy())
  })

  it('shows doctor name from entities', async () => {
    const entities = [
      { id: 'e1', document_id: 'doc1', entity_type: 'contact', name: 'Dr. House', created_at: '' },
    ]
    render(<AiInsightsPanel doc={makeDoc()} entities={entities} docId="doc1" />)
    expect(screen.getByText('Dr. House')).toBeTruthy()
  })

  it('shows tags as pills', async () => {
    render(
      <AiInsightsPanel
        doc={makeDoc({ tags: ['cardiology', 'urgent'] })}
        entities={ENTITIES}
        docId="doc1"
      />,
    )
    expect(screen.getByText('cardiology')).toBeTruthy()
    expect(screen.getByText('urgent')).toBeTruthy()
  })

  it('shows "No related documents" when linked docs empty', async () => {
    mockInvoke.mockResolvedValue([])
    render(<AiInsightsPanel doc={makeDoc()} entities={ENTITIES} docId="doc1" />)
    await waitFor(() => expect(screen.getByText(/no related documents/i)).toBeTruthy())
  })

  it('renders linked docs as links', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_linked_documents') {
        return Promise.resolve([
          { id: 'doc2', title: 'Blood Test 2024', activity_date: '2024-02-01', doc_type: 'lab' },
          { id: 'doc3', title: 'Referral Letter', activity_date: null, doc_type: 'referral' },
        ])
      }
      return Promise.resolve([])
    })
    render(<AiInsightsPanel doc={makeDoc()} entities={ENTITIES} docId="doc1" />)
    await waitFor(() => expect(screen.getByText('Blood Test 2024')).toBeTruthy())
    expect(screen.getByText('Referral Letter')).toBeTruthy()
  })

  it('shows "Show all" button when more than 5 linked docs', async () => {
    const docs = Array.from({ length: 7 }, (_, i) => ({
      id: `doc${i + 2}`,
      title: `Doc ${i + 2}`,
      activity_date: null,
      doc_type: 'general',
    }))
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_linked_documents') return Promise.resolve(docs)
      return Promise.resolve([])
    })
    render(<AiInsightsPanel doc={makeDoc()} entities={ENTITIES} docId="doc1" />)
    await waitFor(() => expect(screen.getByTestId('show-all-linked')).toBeTruthy())
    expect(screen.getByText(/show all \(7\)/i)).toBeTruthy()
  })

  it('expands all linked docs on "Show all" click', async () => {
    const docs = Array.from({ length: 7 }, (_, i) => ({
      id: `doc${i + 2}`,
      title: `Doc ${i + 2}`,
      activity_date: null,
      doc_type: 'general',
    }))
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_linked_documents') return Promise.resolve(docs)
      return Promise.resolve([])
    })
    render(<AiInsightsPanel doc={makeDoc()} entities={ENTITIES} docId="doc1" />)
    await waitFor(() => screen.getByTestId('show-all-linked'))
    await userEvent.click(screen.getByTestId('show-all-linked'))
    expect(screen.queryByTestId('show-all-linked')).toBeNull()
    expect(screen.getByText('Doc 7')).toBeTruthy()
  })

  it('collapses panel body on chevron click', async () => {
    render(<AiInsightsPanel doc={makeDoc()} entities={ENTITIES} docId="doc1" />)
    const toggle = screen.getByRole('button', { name: /ai insights/i })
    await userEvent.click(toggle)
    const body = toggle.nextElementSibling as HTMLElement
    expect(body?.style.maxHeight).toBe('0px')
  })
})

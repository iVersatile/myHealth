import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import DocumentDetailClient from '../view/DocumentDetailClient'

const mockInvoke = vi.fn()
const mockConvertFileSrc = vi.fn((path: string) => `asset://localhost${path}`)
const mockRouterPush = vi.fn()
const mockConfirm = vi.fn()

vi.mock('@tauri-apps/plugin-dialog', () => ({ confirm: (...a: unknown[]) => mockConfirm(...a) }))

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
  convertFileSrc: (path: string) => mockConvertFileSrc(path),
}))

vi.mock('next/navigation', () => ({
  useSearchParams: () => ({ get: () => 'doc-1' }),
  useRouter: () => ({ push: mockRouterPush }),
}))

vi.mock('../../../../components/categories/CategoryPicker', () => ({
  CategoryPicker: ({ onChange }: { onChange: (ids: string[]) => void }) => (
    <button onClick={() => onChange(['cat-1'])}>Pick Category</button>
  ),
}))

const makeDoc = (overrides = {}) => ({
  id: 'doc-1',
  filename: 'invoice.pdf',
  file_path: '/Users/test/.myHealth/files/documents/doc-1/original.pdf',
  mime_type: 'application/pdf',
  file_size_bytes: 102400,
  category: 'invoice',
  thumbnail_path: null,
  notes: null,
  created_at: '2026-01-15T10:00:00Z',
  updated_at: '2026-01-15T10:00:00Z',
  is_deleted: false,
  document_date: null,
  tags: [],
  ...overrides,
})

const makeEntity = (overrides = {}) => ({
  id: 'ent-1',
  document_id: 'doc-1',
  entity_type: 'medication',
  name: 'Metformin',
  value: '500',
  unit: 'mg',
  raw_text: 'Metformin 500 mg',
  created_at: '2026-01-15T10:00:00Z',
  ...overrides,
})

function setupInvoke(entities: ReturnType<typeof makeEntity>[] = []) {
  mockInvoke.mockImplementation((cmd: string) => {
    if (cmd === 'documents_get') return Promise.resolve(makeDoc())
    if (cmd === 'categories_list') return Promise.resolve([])
    if (cmd === 'categories_for_document') return Promise.resolve([])
    if (cmd === 'links_list_for_document') return Promise.resolve([])
    if (cmd === 'appointments_list') return Promise.resolve([])
    if (cmd === 'links_score_candidates') return Promise.resolve([])
    if (cmd === 'notes_for_entity') return Promise.resolve([])
    if (cmd === 'document_entities_get') return Promise.resolve(entities)
    if (cmd === 'symptoms_for_entity') return Promise.resolve([])
    if (cmd === 'medications_for_entity') return Promise.resolve([])
    return Promise.resolve(undefined)
  })
}

describe('DocumentDetailClient — Extracted Info section (task 40.6)', () => {
  beforeEach(() => {
    mockInvoke.mockReset()
  })

  it('hides Extracted Info section when entities array is empty', async () => {
    setupInvoke([])
    render(<DocumentDetailClient />)
    await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith('documents_get', expect.anything()))
    expect(screen.queryByText('Extracted Info')).toBeNull()
  })

  it('shows "Extracted Info" heading when entities exist', async () => {
    setupInvoke([makeEntity()])
    render(<DocumentDetailClient />)
    await waitFor(() => expect(screen.getByText('Extracted Info')).toBeInTheDocument())
  })

  it('shows medication name and value with unit', async () => {
    setupInvoke([makeEntity({ name: 'Metformin', value: '500', unit: 'mg' })])
    render(<DocumentDetailClient />)
    await waitFor(() => expect(screen.getByText('Metformin')).toBeInTheDocument())
    expect(screen.getByText(/— 500 mg/)).toBeInTheDocument()
  })

  it('shows "Medications" group label for medication entities', async () => {
    setupInvoke([makeEntity({ entity_type: 'medication' })])
    render(<DocumentDetailClient />)
    await waitFor(() => expect(screen.getByText('Medications')).toBeInTheDocument())
  })

  it('shows "Conditions" group label for diagnosis entities', async () => {
    setupInvoke([makeEntity({ entity_type: 'diagnosis', name: 'Type 2 Diabetes', value: null, unit: null })])
    render(<DocumentDetailClient />)
    await waitFor(() => expect(screen.getByText('Conditions')).toBeInTheDocument())
    expect(screen.getByText('Type 2 Diabetes')).toBeInTheDocument()
  })

  it('shows "Lab Results" group label for lab_value entities', async () => {
    setupInvoke([makeEntity({ entity_type: 'lab_value', name: 'HbA1c', value: '7.2', unit: '%' })])
    render(<DocumentDetailClient />)
    await waitFor(() => expect(screen.getByText('Lab Results')).toBeInTheDocument())
    expect(screen.getByText('HbA1c')).toBeInTheDocument()
  })

  it('shows "Referrals" group label for referral entities', async () => {
    setupInvoke([makeEntity({ entity_type: 'referral', name: 'Cardiology', value: null, unit: null })])
    render(<DocumentDetailClient />)
    await waitFor(() => expect(screen.getByText('Referrals')).toBeInTheDocument())
    expect(screen.getByText('Cardiology')).toBeInTheDocument()
  })

  it('does not render group heading for absent entity types', async () => {
    setupInvoke([makeEntity({ entity_type: 'medication' })])
    render(<DocumentDetailClient />)
    await waitFor(() => expect(screen.getByText('Medications')).toBeInTheDocument())
    expect(screen.queryByText('Conditions')).toBeNull()
    expect(screen.queryByText('Lab Results')).toBeNull()
    expect(screen.queryByText('Referrals')).toBeNull()
  })

  it('renders multiple group headings when multiple entity types present', async () => {
    setupInvoke([
      makeEntity({ id: 'e1', entity_type: 'medication', name: 'Aspirin', value: '100', unit: 'mg' }),
      makeEntity({ id: 'e2', entity_type: 'diagnosis', name: 'Hypertension', value: null, unit: null }),
    ])
    render(<DocumentDetailClient />)
    await waitFor(() => expect(screen.getByText('Medications')).toBeInTheDocument())
    expect(screen.getByText('Conditions')).toBeInTheDocument()
  })

  it('omits em-dash when entity value is null', async () => {
    setupInvoke([makeEntity({ name: 'Referral', value: null, unit: null, entity_type: 'referral' })])
    render(<DocumentDetailClient />)
    await waitFor(() => expect(screen.getByText('Referral')).toBeInTheDocument())
    expect(screen.queryByText(/—/)).toBeNull()
  })

  it('calls document_entities_get with correct documentId', async () => {
    setupInvoke([])
    render(<DocumentDetailClient />)
    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith('document_entities_get', { documentId: 'doc-1' })
    )
  })
})

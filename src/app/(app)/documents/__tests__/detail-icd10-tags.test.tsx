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

vi.mock('../../../../components/documents/DocumentReport', () => ({
  downloadReport: vi.fn().mockResolvedValue(undefined),
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

function setupInvoke(icd10Tags: Array<{ code: string; description: string; confidence: number }> = []) {
  mockInvoke.mockImplementation((cmd: string) => {
    if (cmd === 'documents_get') return Promise.resolve(makeDoc())
    if (cmd === 'categories_list') return Promise.resolve([])
    if (cmd === 'categories_for_document') return Promise.resolve([])
    if (cmd === 'links_list_for_document') return Promise.resolve([])
    if (cmd === 'appointments_list') return Promise.resolve([])
    if (cmd === 'links_score_candidates') return Promise.resolve([])
    if (cmd === 'notes_for_entity') return Promise.resolve([])
    if (cmd === 'document_entities_get') return Promise.resolve([])
    if (cmd === 'symptoms_for_entity') return Promise.resolve([])
    if (cmd === 'medications_for_entity') return Promise.resolve([])
    if (cmd === 'symptoms_list') return Promise.resolve([])
    if (cmd === 'medications_list') return Promise.resolve([])
    if (cmd === 'documents_get_icd10_tags') return Promise.resolve(icd10Tags)
    return Promise.resolve(undefined)
  })
}

describe('DocumentDetailClient — ICD-10 tags section (task 105.4)', () => {
  beforeEach(() => {
    mockInvoke.mockReset()
    mockConvertFileSrc.mockClear()
    mockRouterPush.mockClear()
  })

  it('hides icd10-section when no tags returned', async () => {
    setupInvoke([])
    render(<DocumentDetailClient />)
    await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull())
    expect(screen.queryByTestId('icd10-section')).toBeNull()
  })

  it('renders icd10-section with chips when tags present', async () => {
    setupInvoke([
      { code: 'J18.9', description: 'Pneumonia, unspecified organism', confidence: 0.95 },
      { code: 'I10', description: 'Essential (primary) hypertension', confidence: 0.8 },
    ])
    render(<DocumentDetailClient />)
    await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull())

    expect(screen.getByTestId('icd10-section')).toBeInTheDocument()
    const chips = screen.getAllByTestId('icd10-tag')
    expect(chips).toHaveLength(2)
    expect(chips[0]).toHaveTextContent('J18.9')
    expect(chips[1]).toHaveTextContent('I10')
  })

  it('renders chip title attribute with description', async () => {
    setupInvoke([
      { code: 'J18.9', description: 'Pneumonia, unspecified organism', confidence: 0.95 },
    ])
    render(<DocumentDetailClient />)
    await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull())

    const chip = screen.getByTestId('icd10-tag')
    expect(chip).toHaveAttribute('title', 'Pneumonia, unspecified organism')
  })

  it('shows ICD-10 Codes section heading when tags present', async () => {
    setupInvoke([{ code: 'Z00.00', description: 'General adult medical examination', confidence: 0.7 }])
    render(<DocumentDetailClient />)
    await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull())

    expect(screen.getByText('ICD-10 Codes')).toBeInTheDocument()
  })
})

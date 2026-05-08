import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
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

function setupInvoke(docOverrides = {}) {
  mockInvoke.mockImplementation((cmd: string) => {
    if (cmd === 'documents_get') return Promise.resolve(makeDoc(docOverrides))
    if (cmd === 'categories_list') return Promise.resolve([])
    if (cmd === 'categories_for_document') return Promise.resolve([])
    if (cmd === 'links_list_for_document') return Promise.resolve([])
    if (cmd === 'appointments_list') return Promise.resolve([])
    if (cmd === 'links_score_candidates') return Promise.resolve([])
    if (cmd === 'notes_for_entity') return Promise.resolve([])
    if (cmd === 'document_entities_get') return Promise.resolve([])
    if (cmd === 'symptoms_for_entity') return Promise.resolve([])
    if (cmd === 'medications_for_entity') return Promise.resolve([])
    return Promise.resolve(undefined)
  })
}

describe('DocumentDetailClient — activity_date editing (V3-F5)', () => {
  beforeEach(() => {
    mockInvoke.mockReset()
    mockConvertFileSrc.mockClear()
    mockRouterPush.mockClear()
    mockConfirm.mockResolvedValue(false)
  })

  it('pre-populates input from doc.activity_date', async () => {
    setupInvoke({ activity_date: '2026-03-10T00:00:00Z' })
    render(<DocumentDetailClient />)
    await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull())

    const input = screen.getByTestId('detail-activity-date-input') as HTMLInputElement
    expect(input.value).toBe('2026-03-10')
  })

  it('leaves input empty when doc.activity_date is null', async () => {
    setupInvoke({ activity_date: null })
    render(<DocumentDetailClient />)
    await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull())

    const input = screen.getByTestId('detail-activity-date-input') as HTMLInputElement
    expect(input.value).toBe('')
  })

  it('calls documents_update with the entered activityDate on Set click', async () => {
    setupInvoke({ activity_date: null })
    render(<DocumentDetailClient />)
    await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull())

    const input = screen.getByTestId('detail-activity-date-input')
    fireEvent.change(input, { target: { value: '2026-05-01' } })
    fireEvent.click(screen.getByTestId('detail-activity-date-save'))

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('documents_update', {
        id: 'doc-1',
        activityDate: '2026-05-01',
      })
    })
  })

  it('passes null when activityDate is cleared before saving', async () => {
    setupInvoke({ activity_date: '2026-03-10T00:00:00Z' })
    render(<DocumentDetailClient />)
    await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull())

    const input = screen.getByTestId('detail-activity-date-input')
    fireEvent.change(input, { target: { value: '' } })
    fireEvent.click(screen.getByTestId('detail-activity-date-save'))

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('documents_update', {
        id: 'doc-1',
        activityDate: null,
      })
    })
  })

  it('disables Set button while saving', async () => {
    let resolve: (v: unknown) => void = () => {}
    const pending = new Promise((r) => { resolve = r })

    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'documents_update') return pending
      if (cmd === 'documents_get') return Promise.resolve(makeDoc())
      if (cmd === 'categories_list') return Promise.resolve([])
      if (cmd === 'categories_for_document') return Promise.resolve([])
      if (cmd === 'links_list_for_document') return Promise.resolve([])
      if (cmd === 'appointments_list') return Promise.resolve([])
      if (cmd === 'links_score_candidates') return Promise.resolve([])
      if (cmd === 'notes_for_entity') return Promise.resolve([])
      if (cmd === 'document_entities_get') return Promise.resolve([])
      return Promise.resolve(undefined)
    })

    render(<DocumentDetailClient />)
    await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull())

    const btn = screen.getByTestId('detail-activity-date-save')
    expect(btn).not.toBeDisabled()

    fireEvent.click(btn)
    await waitFor(() => expect(btn).toBeDisabled())

    resolve(undefined)
    await waitFor(() => expect(btn).not.toBeDisabled())
  })

  it('shows ✓ checkmark after successful save', async () => {
    setupInvoke()
    render(<DocumentDetailClient />)
    await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull())

    fireEvent.click(screen.getByTestId('detail-activity-date-save'))

    await waitFor(() =>
      expect(screen.getByTestId('detail-activity-date-save').textContent).toBe('✓')
    )
  })

  it('updates local doc state so UI reflects new date without reload', async () => {
    setupInvoke({ activity_date: '2026-01-01T00:00:00Z' })
    render(<DocumentDetailClient />)
    await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull())

    const input = screen.getByTestId('detail-activity-date-input') as HTMLInputElement
    fireEvent.change(input, { target: { value: '2026-06-15' } })
    fireEvent.click(screen.getByTestId('detail-activity-date-save'))

    await waitFor(() =>
      expect(screen.getByTestId('detail-activity-date-save').textContent).toBe('✓')
    )
    expect(input.value).toBe('2026-06-15')
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import DocumentDetailClient from '../DocumentDetailClient'

const mockInvoke = vi.fn()
const mockConvertFileSrc = vi.fn((path: string) => `asset://localhost${path}`)
const mockRouterPush = vi.fn()
const mockConfirm = vi.fn()
const mockDownloadReport = vi.fn().mockResolvedValue(undefined)

vi.mock('@tauri-apps/plugin-dialog', () => ({ confirm: (...a: unknown[]) => mockConfirm(...a) }))

vi.mock('../../../../../components/documents/DocumentReport', () => ({
  downloadReport: (...args: unknown[]) => mockDownloadReport(...args),
}))

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
  convertFileSrc: (path: string) => mockConvertFileSrc(path),
}))

vi.mock('next/navigation', () => ({
  useSearchParams: () => ({ get: () => 'doc-1' }),
  useRouter: () => ({ push: mockRouterPush }),
}))

vi.mock('../../../../../components/categories/CategoryPicker', () => ({
  CategoryPicker: ({ onChange }: { onChange: (ids: string[]) => void }) => (
    <button onClick={() => onChange(['cat-1'])}>Pick Category</button>
  ),
}))

const makeDoc = (overrides = {}) => ({
  id: 'doc-1',
  filename: 'report.pdf',
  file_path: '/Users/test/.myHealth/files/documents/doc-1/original.pdf',
  mime_type: 'application/pdf',
  file_size_bytes: 102400,
  category: 'lab',
  thumbnail_path: null,
  notes: null,
  created_at: '2026-04-22T10:00:00Z',
  updated_at: '2026-04-22T10:00:00Z',
  is_deleted: false,
  document_date: null,
  tags: [],
  ...overrides,
})

const makeCategory = (id = 'cat-1', name = 'Blood Tests') => ({
  id,
  name,
  parent_id: null,
  color_hex: '#ff0000',
  is_system: true,
  sort_order: 1,
})

const makeLink = (overrides = {}) => ({
  id: 'link-1',
  document_id: 'doc-1',
  appointment_id: 'appt-1',
  link_type: 'related',
  confidence: 'manual',
  created_at: '2026-04-22T10:00:00Z',
  ...overrides,
})

const makeAppointment = (overrides = {}) => ({
  id: 'appt-1',
  title: 'Annual Checkup',
  date: '2026-04-22',
  time: '09:00',
  doctor: 'Dr. Smith',
  location: 'Clinic',
  notes: null,
  status: 'scheduled',
  created_at: '2026-04-22T10:00:00Z',
  updated_at: '2026-04-22T10:00:00Z',
  ...overrides,
})

function setupInvoke(
  docOverrides = {},
  opts: {
    categories?: ReturnType<typeof makeCategory>[]
    links?: ReturnType<typeof makeLink>[]
    appointments?: ReturnType<typeof makeAppointment>[]
    assignedIds?: string[]
  } = {}
) {
  const {
    categories = [],
    links = [],
    appointments = [],
    assignedIds = [],
  } = opts
  mockInvoke.mockImplementation((cmd: string) => {
    if (cmd === 'documents_get') return Promise.resolve(makeDoc(docOverrides))
    if (cmd === 'categories_list') return Promise.resolve(categories)
    if (cmd === 'categories_for_document') return Promise.resolve(assignedIds)
    if (cmd === 'links_list_for_document') return Promise.resolve(links)
    if (cmd === 'appointments_list') return Promise.resolve(appointments)
    if (cmd === 'links_score_candidates') return Promise.resolve([])
    if (cmd === 'notes_for_entity') return Promise.resolve([])
    if (cmd === 'document_entities_get') return Promise.resolve([])
    if (cmd === 'symptoms_for_entity') return Promise.resolve([])
    if (cmd === 'medications_for_entity') return Promise.resolve([])
    if (cmd === 'symptoms_list') return Promise.resolve([])
    if (cmd === 'medications_list') return Promise.resolve([])
    if (cmd === 'documents_get_icd10_tags') return Promise.resolve([])
    return Promise.resolve(undefined)
  })
}

describe('DocumentDetailClient — document preview (AC-F1.6)', () => {
  beforeEach(() => {
    mockInvoke.mockReset()
    mockConvertFileSrc.mockClear()
    mockRouterPush.mockClear()
  })

  it('renders iframe with asset URL for PDF documents', async () => {
    setupInvoke()
    const { container } = render(<DocumentDetailClient />)
    await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull())
    const iframe = container.querySelector('iframe')
    expect(iframe).toBeInTheDocument()
    expect(iframe?.getAttribute('src')).toContain('original.pdf')
  })

  it('passes file_path to convertFileSrc for PDF documents', async () => {
    setupInvoke()
    render(<DocumentDetailClient />)
    await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull())
    expect(mockConvertFileSrc).toHaveBeenCalledWith(
      '/Users/test/.myHealth/files/documents/doc-1/original.pdf'
    )
  })

  it('renders img with asset URL for image documents', async () => {
    setupInvoke({ mime_type: 'image/jpeg', filename: 'scan.jpg' })
    const { container } = render(<DocumentDetailClient />)
    await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull())
    const img = container.querySelector('img[alt="scan.jpg"]')
    expect(img).toBeInTheDocument()
    expect(img?.getAttribute('src')).toContain('original.pdf')
  })

  it('shows fallback for unsupported file types', async () => {
    setupInvoke({ mime_type: 'text/plain', filename: 'note.txt' })
    render(<DocumentDetailClient />)
    await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull())
    expect(screen.getByText('Preview not available for this file type.')).toBeInTheDocument()
  })

  it('does not render iframe for image documents', async () => {
    setupInvoke({ mime_type: 'image/jpeg', filename: 'scan.jpg' })
    const { container } = render(<DocumentDetailClient />)
    await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull())
    expect(container.querySelector('iframe')).toBeNull()
  })
})

describe('DocumentDetailClient — error and loading states', () => {
  beforeEach(() => {
    mockInvoke.mockReset()
    mockConvertFileSrc.mockClear()
  })

  it('shows loading state initially', () => {
    mockInvoke.mockReturnValue(new Promise(() => {}))
    render(<DocumentDetailClient />)
    expect(screen.getByText('Loading…')).toBeInTheDocument()
  })

  it('shows error when documents_get rejects', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'documents_get') return Promise.reject(new Error('DB error'))
      return Promise.resolve([])
    })
    render(<DocumentDetailClient />)
    await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull())
    expect(screen.getByText('DB error')).toBeInTheDocument()
  })

  it('shows error string when non-Error is thrown', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'documents_get') return Promise.reject('string error')
      return Promise.resolve([])
    })
    render(<DocumentDetailClient />)
    await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull())
    expect(screen.getByText('string error')).toBeInTheDocument()
  })
})

describe('DocumentDetailClient — document details panel', () => {
  beforeEach(() => {
    mockInvoke.mockReset()
    mockConvertFileSrc.mockClear()
  })

  it('displays document filename in breadcrumb', async () => {
    setupInvoke({ filename: 'blood-test.pdf' })
    render(<DocumentDetailClient />)
    await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull())
    expect(screen.getByText('blood-test.pdf')).toBeInTheDocument()
  })

  it('displays file size in bytes for small files', async () => {
    setupInvoke({ file_size_bytes: 500 })
    render(<DocumentDetailClient />)
    await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull())
    expect(screen.getByText('500 B')).toBeInTheDocument()
  })

  it('displays file size in KB for medium files', async () => {
    setupInvoke({ file_size_bytes: 2048 })
    render(<DocumentDetailClient />)
    await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull())
    expect(screen.getByText('2.0 KB')).toBeInTheDocument()
  })

  it('displays file size in MB for large files', async () => {
    setupInvoke({ file_size_bytes: 2 * 1024 * 1024 })
    render(<DocumentDetailClient />)
    await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull())
    expect(screen.getByText('2.0 MB')).toBeInTheDocument()
  })

  it('shows category label from CATEGORY_LABELS', async () => {
    setupInvoke({ category: 'lab' })
    render(<DocumentDetailClient />)
    await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull())
    expect(screen.getByText('Lab')).toBeInTheDocument()
  })

  it('falls back to raw category when label not in map', async () => {
    setupInvoke({ category: 'unknown_cat' })
    render(<DocumentDetailClient />)
    await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull())
    expect(screen.getByText('unknown_cat')).toBeInTheDocument()
  })
})

describe('DocumentDetailClient — tags', () => {
  beforeEach(() => {
    mockInvoke.mockReset()
    mockConvertFileSrc.mockClear()
  })

  it('renders existing tags', async () => {
    setupInvoke({ tags: ['cardiology', '2024-03-15'] })
    render(<DocumentDetailClient />)
    await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull())
    expect(screen.getByText('#cardiology')).toBeInTheDocument()
    expect(screen.getByText('#2024-03-15')).toBeInTheDocument()
  })

  it('adds a tag on button click', async () => {
    setupInvoke()
    render(<DocumentDetailClient />)
    await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull())

    const input = screen.getByPlaceholderText('Add tag')
    fireEvent.change(input, { target: { value: 'newtag' } })
    fireEvent.click(screen.getByRole('button', { name: '+' }))

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('documents_tags_set', {
        id: 'doc-1',
        tags: ['newtag'],
      })
    })
  })

  it('adds a tag on Enter key', async () => {
    setupInvoke()
    render(<DocumentDetailClient />)
    await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull())

    const input = screen.getByPlaceholderText('Add tag')
    fireEvent.change(input, { target: { value: 'entertag' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('documents_tags_set', {
        id: 'doc-1',
        tags: ['entertag'],
      })
    })
  })

  it('does not add duplicate tags', async () => {
    setupInvoke({ tags: ['existing'] })
    render(<DocumentDetailClient />)
    await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull())

    const input = screen.getByPlaceholderText('Add tag')
    fireEvent.change(input, { target: { value: 'existing' } })
    fireEvent.click(screen.getByRole('button', { name: '+' }))

    await waitFor(() => {
      const tagCalls = mockInvoke.mock.calls.filter(
        (c: unknown[]) => c[0] === 'documents_tags_set'
      )
      expect(tagCalls).toHaveLength(0)
    })
  })

  it('removes a tag on ✕ click', async () => {
    setupInvoke({ tags: ['cardiology'] })
    render(<DocumentDetailClient />)
    await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull())

    fireEvent.click(screen.getByRole('button', { name: 'Remove tag cardiology' }))

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('documents_tags_set', {
        id: 'doc-1',
        tags: [],
      })
    })
  })
})

describe('DocumentDetailClient — notes', () => {
  beforeEach(() => {
    mockInvoke.mockReset()
    mockConvertFileSrc.mockClear()
  })

  it('pre-populates notes from document', async () => {
    setupInvoke({ notes: 'Existing note text' })
    render(<DocumentDetailClient />)
    await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull())
    const textarea = screen.getByPlaceholderText('Add notes…') as HTMLTextAreaElement
    expect(textarea.value).toBe('Existing note text')
  })

  it('saves notes on button click', async () => {
    setupInvoke({ notes: 'Some notes' })
    render(<DocumentDetailClient />)
    await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull())

    fireEvent.click(screen.getByRole('button', { name: 'Save Notes' }))

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('documents_update', {
        id: 'doc-1',
        notes: 'Some notes',
      })
    })
  })

  it('passes null for empty notes on save', async () => {
    setupInvoke({ notes: null })
    render(<DocumentDetailClient />)
    await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull())

    fireEvent.click(screen.getByRole('button', { name: 'Save Notes' }))

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('documents_update', {
        id: 'doc-1',
        notes: null,
      })
    })
  })
})

describe('DocumentDetailClient — categories section', () => {
  beforeEach(() => {
    mockInvoke.mockReset()
    mockConvertFileSrc.mockClear()
  })

  it('shows CategoryPicker when categories are available', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'documents_get') return Promise.resolve(makeDoc())
      if (cmd === 'categories_list') return Promise.resolve([makeCategory()])
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
      if (cmd === 'documents_get_icd10_tags') return Promise.resolve([])
      return Promise.resolve(undefined)
    })
    render(<DocumentDetailClient />)
    await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull())
    expect(screen.getByText('Pick Category')).toBeInTheDocument()
  })

  it('does not show CategoryPicker when no categories', async () => {
    setupInvoke({}, { categories: [] })
    render(<DocumentDetailClient />)
    await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull())
    expect(screen.queryByText('Pick Category')).toBeNull()
  })

  it('calls categories_assign_document when new category added', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'documents_get') return Promise.resolve(makeDoc())
      if (cmd === 'categories_list') return Promise.resolve([makeCategory()])
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
      if (cmd === 'documents_get_icd10_tags') return Promise.resolve([])
      return Promise.resolve(undefined)
    })
    render(<DocumentDetailClient />)
    await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull())

    fireEvent.click(screen.getByText('Pick Category'))

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('assign_category_to_document', {
        userId: '',
        documentId: 'doc-1',
        categoryId: 'cat-1',
      })
    })
  })

  it('calls categories_unassign when category removed', async () => {
    // Start with cat-1 and cat-2 both assigned; mock picks only cat-1 → cat-2 removed
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'documents_get') return Promise.resolve(makeDoc())
      if (cmd === 'categories_list')
        return Promise.resolve([makeCategory('cat-1'), makeCategory('cat-2', 'X-Ray')])
      if (cmd === 'categories_for_document') return Promise.resolve(['cat-1', 'cat-2'])
      if (cmd === 'links_list_for_document') return Promise.resolve([])
      if (cmd === 'appointments_list') return Promise.resolve([])
      if (cmd === 'links_score_candidates') return Promise.resolve([])
      if (cmd === 'notes_for_entity') return Promise.resolve([])
      if (cmd === 'document_entities_get') return Promise.resolve([])
      if (cmd === 'symptoms_for_entity') return Promise.resolve([])
      if (cmd === 'medications_for_entity') return Promise.resolve([])
      if (cmd === 'symptoms_list') return Promise.resolve([])
      if (cmd === 'medications_list') return Promise.resolve([])
      if (cmd === 'documents_get_icd10_tags') return Promise.resolve([])
      return Promise.resolve(undefined)
    })
    render(<DocumentDetailClient />)
    await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull())

    fireEvent.click(screen.getByText('Pick Category'))

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('unassign_category_from_document', {
        userId: '',
        documentId: 'doc-1',
        categoryId: 'cat-2',
      })
    })
  })
})

describe('DocumentDetailClient — appointment links', () => {
  beforeEach(() => {
    mockInvoke.mockReset()
    mockConvertFileSrc.mockClear()
  })

  it('shows linked appointment title', async () => {
    setupInvoke(
      {},
      {
        links: [makeLink()],
        appointments: [makeAppointment()],
      }
    )
    render(<DocumentDetailClient />)
    await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull())
    expect(screen.getByText('Annual Checkup')).toBeInTheDocument()
  })

  it('shows appointment id when appointment not found', async () => {
    setupInvoke({}, { links: [makeLink()], appointments: [] })
    render(<DocumentDetailClient />)
    await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull())
    expect(screen.getByText('appt-1')).toBeInTheDocument()
  })

  it('unlinks appointment on ✕ click', async () => {
    setupInvoke(
      {},
      {
        links: [makeLink()],
        appointments: [makeAppointment()],
      }
    )
    render(<DocumentDetailClient />)
    await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull())

    fireEvent.click(screen.getByRole('button', { name: 'Unlink appointment' }))

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('links_delete', { id: 'link-1' })
    })
  })

  it('shows appointment select when unlinkable appointments exist', async () => {
    setupInvoke(
      {},
      {
        links: [],
        appointments: [makeAppointment()],
      }
    )
    render(<DocumentDetailClient />)
    await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull())
    expect(screen.getByText('Select appointment…')).toBeInTheDocument()
    expect(screen.getByText('Annual Checkup')).toBeInTheDocument()
  })

  it('hides select when all appointments already linked', async () => {
    setupInvoke(
      {},
      {
        links: [makeLink()],
        appointments: [makeAppointment()],
      }
    )
    render(<DocumentDetailClient />)
    await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull())
    expect(screen.queryByText('Select appointment…')).toBeNull()
  })

  it('links selected appointment on Link button click', async () => {
    const newLink = makeLink({ id: 'link-2', appointment_id: 'appt-1' })
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'documents_get') return Promise.resolve(makeDoc())
      if (cmd === 'categories_list') return Promise.resolve([])
      if (cmd === 'categories_for_document') return Promise.resolve([])
      if (cmd === 'links_list_for_document') return Promise.resolve([])
      if (cmd === 'appointments_list') return Promise.resolve([makeAppointment()])
      if (cmd === 'links_score_candidates') return Promise.resolve([])
      if (cmd === 'links_create') return Promise.resolve(newLink)
      if (cmd === 'notes_for_entity') return Promise.resolve([])
      if (cmd === 'document_entities_get') return Promise.resolve([])
      if (cmd === 'symptoms_for_entity') return Promise.resolve([])
      if (cmd === 'medications_for_entity') return Promise.resolve([])
      if (cmd === 'symptoms_list') return Promise.resolve([])
      if (cmd === 'medications_list') return Promise.resolve([])
      if (cmd === 'documents_get_icd10_tags') return Promise.resolve([])
      return Promise.resolve(undefined)
    })
    render(<DocumentDetailClient />)
    await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull())

    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: 'appt-1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Link' }))

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('links_create', {
        input: {
          document_id: 'doc-1',
          appointment_id: 'appt-1',
          link_type: 'related',
          confidence: 'manual',
        },
      })
    })
  })
})

const makeSuggestion = (overrides = {}) => ({
  appointment_id: 'appt-2',
  appointment_title: 'Cardiology Review',
  score: 5,
  reasons: ['Date proximity', 'Category match'],
  ...overrides,
})

describe('DocumentDetailClient — suggested links', () => {
  beforeEach(() => {
    mockInvoke.mockReset()
    mockConvertFileSrc.mockClear()
  })

  it('shows suggestion card when score >= 4', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'documents_get') return Promise.resolve(makeDoc())
      if (cmd === 'categories_list') return Promise.resolve([])
      if (cmd === 'categories_for_document') return Promise.resolve([])
      if (cmd === 'links_list_for_document') return Promise.resolve([])
      if (cmd === 'appointments_list') return Promise.resolve([])
      if (cmd === 'links_score_candidates') return Promise.resolve([makeSuggestion()])
      if (cmd === 'notes_for_entity') return Promise.resolve([])
      if (cmd === 'document_entities_get') return Promise.resolve([])
      if (cmd === 'symptoms_for_entity') return Promise.resolve([])
      if (cmd === 'medications_for_entity') return Promise.resolve([])
      if (cmd === 'symptoms_list') return Promise.resolve([])
      if (cmd === 'medications_list') return Promise.resolve([])
      if (cmd === 'documents_get_icd10_tags') return Promise.resolve([])
      return Promise.resolve(undefined)
    })
    render(<DocumentDetailClient />)
    await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull())
    expect(screen.getByText('Cardiology Review')).toBeInTheDocument()
    expect(screen.getByText('Score: 5')).toBeInTheDocument()
  })

  it('hides suggestion for already-linked appointment', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'documents_get') return Promise.resolve(makeDoc())
      if (cmd === 'categories_list') return Promise.resolve([])
      if (cmd === 'categories_for_document') return Promise.resolve([])
      if (cmd === 'links_list_for_document') return Promise.resolve([makeLink({ appointment_id: 'appt-2' })])
      if (cmd === 'appointments_list') return Promise.resolve([])
      if (cmd === 'links_score_candidates') return Promise.resolve([makeSuggestion()])
      if (cmd === 'notes_for_entity') return Promise.resolve([])
      if (cmd === 'document_entities_get') return Promise.resolve([])
      if (cmd === 'symptoms_for_entity') return Promise.resolve([])
      if (cmd === 'medications_for_entity') return Promise.resolve([])
      if (cmd === 'symptoms_list') return Promise.resolve([])
      if (cmd === 'medications_list') return Promise.resolve([])
      if (cmd === 'documents_get_icd10_tags') return Promise.resolve([])
      return Promise.resolve(undefined)
    })
    render(<DocumentDetailClient />)
    await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull())
    expect(screen.queryByText('Score: 5')).toBeNull()
  })

  it('calls link_document_to_appointment and removes card on Link click', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'documents_get') return Promise.resolve(makeDoc())
      if (cmd === 'categories_list') return Promise.resolve([])
      if (cmd === 'categories_for_document') return Promise.resolve([])
      if (cmd === 'links_list_for_document') return Promise.resolve([])
      if (cmd === 'appointments_list') return Promise.resolve([])
      if (cmd === 'links_score_candidates') return Promise.resolve([makeSuggestion()])
      if (cmd === 'link_document_to_appointment') return Promise.resolve(undefined)
      if (cmd === 'notes_for_entity') return Promise.resolve([])
      if (cmd === 'document_entities_get') return Promise.resolve([])
      if (cmd === 'symptoms_for_entity') return Promise.resolve([])
      if (cmd === 'medications_for_entity') return Promise.resolve([])
      if (cmd === 'symptoms_list') return Promise.resolve([])
      if (cmd === 'medications_list') return Promise.resolve([])
      if (cmd === 'documents_get_icd10_tags') return Promise.resolve([])
      return Promise.resolve(undefined)
    })
    render(<DocumentDetailClient />)
    await waitFor(() => expect(screen.getByText('Score: 5')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: 'Link suggestion' }))

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('link_document_to_appointment', expect.objectContaining({
        documentId: 'doc-1',
        appointmentId: 'appt-2',
      }))
    })
    await waitFor(() => expect(screen.queryByText('Score: 5')).toBeNull())
  })

  it('dismisses suggestion for session on Not Related click', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'documents_get') return Promise.resolve(makeDoc())
      if (cmd === 'categories_list') return Promise.resolve([])
      if (cmd === 'categories_for_document') return Promise.resolve([])
      if (cmd === 'links_list_for_document') return Promise.resolve([])
      if (cmd === 'appointments_list') return Promise.resolve([])
      if (cmd === 'links_score_candidates') return Promise.resolve([makeSuggestion()])
      if (cmd === 'notes_for_entity') return Promise.resolve([])
      if (cmd === 'document_entities_get') return Promise.resolve([])
      if (cmd === 'symptoms_for_entity') return Promise.resolve([])
      if (cmd === 'medications_for_entity') return Promise.resolve([])
      if (cmd === 'symptoms_list') return Promise.resolve([])
      if (cmd === 'medications_list') return Promise.resolve([])
      if (cmd === 'documents_get_icd10_tags') return Promise.resolve([])
      return Promise.resolve(undefined)
    })
    render(<DocumentDetailClient />)
    await waitFor(() => expect(screen.getByText('Score: 5')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: 'Not Related' }))

    await waitFor(() => expect(screen.queryByText('Score: 5')).toBeNull())
  })

  it('shows suggestion reasons', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'documents_get') return Promise.resolve(makeDoc())
      if (cmd === 'categories_list') return Promise.resolve([])
      if (cmd === 'categories_for_document') return Promise.resolve([])
      if (cmd === 'links_list_for_document') return Promise.resolve([])
      if (cmd === 'appointments_list') return Promise.resolve([])
      if (cmd === 'links_score_candidates') return Promise.resolve([makeSuggestion()])
      if (cmd === 'notes_for_entity') return Promise.resolve([])
      if (cmd === 'document_entities_get') return Promise.resolve([])
      if (cmd === 'symptoms_for_entity') return Promise.resolve([])
      if (cmd === 'medications_for_entity') return Promise.resolve([])
      if (cmd === 'symptoms_list') return Promise.resolve([])
      if (cmd === 'medications_list') return Promise.resolve([])
      if (cmd === 'documents_get_icd10_tags') return Promise.resolve([])
      return Promise.resolve(undefined)
    })
    render(<DocumentDetailClient />)
    await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull())
    expect(screen.getByText('Date proximity')).toBeInTheDocument()
    expect(screen.getByText('Category match')).toBeInTheDocument()
  })
})

describe('DocumentDetailClient — delete', () => {
  beforeEach(() => {
    mockInvoke.mockReset()
    mockConvertFileSrc.mockClear()
    mockConfirm.mockResolvedValue(true)
  })

  it('calls documents_delete and navigates on confirm', async () => {
    setupInvoke()
    render(<DocumentDetailClient />)
    await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull())

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('documents_delete', { id: 'doc-1' })
      expect(mockRouterPush).toHaveBeenCalledWith('/documents')
    })
  })

  it('does not delete when confirm returns false', async () => {
    mockConfirm.mockResolvedValue(false)
    setupInvoke()
    render(<DocumentDetailClient />)
    await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull())

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))

    await waitFor(() => {
      const deleteCalls = mockInvoke.mock.calls.filter(
        (c: unknown[]) => c[0] === 'documents_delete'
      )
      expect(deleteCalls).toHaveLength(0)
    })
  })
})

describe('DocumentDetailClient — clinic entity section', () => {
  beforeEach(() => {
    mockInvoke.mockReset()
    mockConvertFileSrc.mockClear()
    mockRouterPush.mockClear()
  })

  function setupWithClinic(clinicExists: boolean) {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'documents_get') return Promise.resolve(makeDoc({ clinic_name: 'City Clinic' }))
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
      if (cmd === 'clinics_list')
        return Promise.resolve(clinicExists ? [{ id: 'c-1', name: 'City Clinic' }] : [])
      if (cmd === 'documents_get_icd10_tags') return Promise.resolve([])
      return Promise.resolve(undefined)
    })
  }

  it('shows clinic name when doc has clinic_name', async () => {
    setupWithClinic(true)
    render(<DocumentDetailClient />)
    await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull())
    expect(screen.getByText('City Clinic')).toBeInTheDocument()
  })

  it('hides Save as Clinic button when clinic already exists', async () => {
    setupWithClinic(true)
    render(<DocumentDetailClient />)
    await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull())
    expect(screen.queryByTestId('detail-save-clinic-btn')).toBeNull()
  })

  it('shows Save as Clinic button when clinic does not exist', async () => {
    setupWithClinic(false)
    render(<DocumentDetailClient />)
    await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull())
    expect(screen.getByTestId('detail-save-clinic-btn')).toBeInTheDocument()
  })

  it('calls clinics_create_if_not_exists on Save as Clinic click', async () => {
    setupWithClinic(false)
    render(<DocumentDetailClient />)
    await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull())
    mockInvoke.mockImplementationOnce(() => Promise.resolve(undefined))
    fireEvent.click(screen.getByTestId('detail-save-clinic-btn'))
    await waitFor(() => {
      const calls = mockInvoke.mock.calls.filter((c: unknown[]) => c[0] === 'clinics_create_if_not_exists')
      expect(calls).toHaveLength(1)
    })
    expect(screen.queryByTestId('detail-save-clinic-btn')).toBeNull()
  })

  it('shows error message when clinics_create_if_not_exists fails', async () => {
    setupWithClinic(false)
    render(<DocumentDetailClient />)
    await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull())
    mockInvoke.mockImplementationOnce(() => Promise.reject(new Error('DB error')))
    fireEvent.click(screen.getByTestId('detail-save-clinic-btn'))
    await waitFor(() =>
      expect(screen.getByText('Failed to create clinic. Please try again.')).toBeInTheDocument()
    )
  })
})

describe('DocumentDetailClient — linked notes', () => {
  beforeEach(() => {
    mockInvoke.mockReset()
    mockConvertFileSrc.mockClear()
    mockRouterPush.mockClear()
  })

  it('shows empty state when no notes linked', async () => {
    setupInvoke()
    render(<DocumentDetailClient />)
    await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull())
    expect(screen.getByText('No linked notes yet.')).toBeInTheDocument()
  })

  it('renders linked note titles', async () => {
    setupInvoke({}, { links: [], appointments: [] })
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'documents_get') return Promise.resolve(makeDoc())
      if (cmd === 'categories_list') return Promise.resolve([])
      if (cmd === 'categories_for_document') return Promise.resolve([])
      if (cmd === 'links_list_for_document') return Promise.resolve([])
      if (cmd === 'appointments_list') return Promise.resolve([])
      if (cmd === 'links_score_candidates') return Promise.resolve([])
      if (cmd === 'notes_for_entity') return Promise.resolve([{ id: 'n-1', title: 'My Note' }])
      if (cmd === 'document_entities_get') return Promise.resolve([])
      if (cmd === 'symptoms_for_entity') return Promise.resolve([])
      if (cmd === 'medications_for_entity') return Promise.resolve([])
      if (cmd === 'symptoms_list') return Promise.resolve([])
      if (cmd === 'medications_list') return Promise.resolve([])
      if (cmd === 'documents_get_icd10_tags') return Promise.resolve([])
      return Promise.resolve(undefined)
    })
    render(<DocumentDetailClient />)
    await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull())
    expect(screen.getByText('My Note')).toBeInTheDocument()
  })

  it('falls back to Untitled for notes without a title', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'documents_get') return Promise.resolve(makeDoc())
      if (cmd === 'categories_list') return Promise.resolve([])
      if (cmd === 'categories_for_document') return Promise.resolve([])
      if (cmd === 'links_list_for_document') return Promise.resolve([])
      if (cmd === 'appointments_list') return Promise.resolve([])
      if (cmd === 'links_score_candidates') return Promise.resolve([])
      if (cmd === 'notes_for_entity') return Promise.resolve([{ id: 'n-2', title: '' }])
      if (cmd === 'document_entities_get') return Promise.resolve([])
      if (cmd === 'symptoms_for_entity') return Promise.resolve([])
      if (cmd === 'medications_for_entity') return Promise.resolve([])
      if (cmd === 'symptoms_list') return Promise.resolve([])
      if (cmd === 'medications_list') return Promise.resolve([])
      if (cmd === 'documents_get_icd10_tags') return Promise.resolve([])
      return Promise.resolve(undefined)
    })
    render(<DocumentDetailClient />)
    await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull())
    expect(screen.getByText('Untitled')).toBeInTheDocument()
  })
})

describe('DocumentDetailClient — save feedback states', () => {
  beforeEach(() => {
    mockInvoke.mockReset()
    mockConvertFileSrc.mockClear()
    mockRouterPush.mockClear()
  })

  it('shows ✓ after activity date saved', async () => {
    setupInvoke()
    render(<DocumentDetailClient />)
    await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull())
    mockInvoke.mockResolvedValueOnce(undefined)
    fireEvent.click(screen.getByTestId('detail-activity-date-save'))
    await waitFor(() => expect(screen.getByTestId('detail-activity-date-save').textContent).toBe('✓'))
  })

  it('shows ✓ Saved after notes saved', async () => {
    setupInvoke()
    render(<DocumentDetailClient />)
    await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull())
    mockInvoke.mockResolvedValueOnce(undefined)
    fireEvent.click(screen.getByRole('button', { name: 'Save Notes' }))
    await waitFor(() => expect(screen.getByRole('button', { name: '✓ Saved' })).toBeInTheDocument())
  })
})

describe('DocumentDetailClient — unlink error path', () => {
  beforeEach(() => {
    mockInvoke.mockReset()
    mockConvertFileSrc.mockClear()
    mockRouterPush.mockClear()
    mockConfirm.mockResolvedValue(true)
  })

  it('shows error when links_delete rejects', async () => {
    const link = makeLink()
    const appt = makeAppointment()
    setupInvoke({}, { links: [link], appointments: [appt] })
    render(<DocumentDetailClient />)
    await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull())
    mockInvoke.mockImplementationOnce(() => Promise.reject(new Error('unlink failed')))
    fireEvent.click(screen.getByRole('button', { name: /unlink/i }))
    await waitFor(() =>
      expect(screen.getByText('unlink failed')).toBeInTheDocument()
    )
  })
})

describe('DocumentDetailClient — extracted text section', () => {
  beforeEach(() => {
    mockInvoke.mockReset()
    mockConvertFileSrc.mockClear()
    mockRouterPush.mockClear()
  })

  it('shows Extracted Text section when extracted_text is present', async () => {
    setupInvoke({ extracted_text: 'Invoice total: £120.00\nDate: 01 Jan 2026' })
    render(<DocumentDetailClient />)
    await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull())
    expect(screen.getByText('Extracted Text')).toBeInTheDocument()
    expect(screen.getByText(/Invoice total/)).toBeInTheDocument()
  })

  it('hides Extracted Text section when extracted_text is null', async () => {
    setupInvoke({ extracted_text: null })
    render(<DocumentDetailClient />)
    await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull())
    expect(screen.queryByText('Extracted Text')).toBeNull()
  })
})

const makeSymptom = (overrides = {}) => ({
  id: 'sym-1',
  name: 'Headache',
  severity: null,
  onset_date: null,
  notes: null,
  deleted_at: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...overrides,
})

const makeMedication = (overrides = {}) => ({
  id: 'med-1',
  name: 'Ibuprofen',
  dosage: null,
  frequency: null,
  start_date: null,
  end_date: null,
  notes: null,
  deleted_at: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...overrides,
})

function setupInvokeWithSymptoms(symptoms = [makeSymptom()], linkedSymptoms: typeof symptoms = []) {
  mockInvoke.mockImplementation((cmd: string) => {
    if (cmd === 'documents_get') return Promise.resolve(makeDoc())
    if (cmd === 'categories_list') return Promise.resolve([])
    if (cmd === 'categories_for_document') return Promise.resolve([])
    if (cmd === 'links_list_for_document') return Promise.resolve([])
    if (cmd === 'appointments_list') return Promise.resolve([])
    if (cmd === 'links_score_candidates') return Promise.resolve([])
    if (cmd === 'notes_for_entity') return Promise.resolve([])
    if (cmd === 'document_entities_get') return Promise.resolve([])
    if (cmd === 'symptoms_for_entity') return Promise.resolve(linkedSymptoms)
    if (cmd === 'medications_for_entity') return Promise.resolve([])
    if (cmd === 'symptoms_list') return Promise.resolve(symptoms)
    if (cmd === 'medications_list') return Promise.resolve([])
    if (cmd === 'documents_get_icd10_tags') return Promise.resolve([])
    return Promise.resolve(undefined)
  })
}

function setupInvokeWithMedications(medications = [makeMedication()], linkedMedications: typeof medications = []) {
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
    if (cmd === 'medications_for_entity') return Promise.resolve(linkedMedications)
    if (cmd === 'symptoms_list') return Promise.resolve([])
    if (cmd === 'medications_list') return Promise.resolve(medications)
    if (cmd === 'documents_get_icd10_tags') return Promise.resolve([])
    return Promise.resolve(undefined)
  })
}

describe('DocumentDetailClient — symptom linking', () => {
  beforeEach(() => {
    mockInvoke.mockReset()
    mockConvertFileSrc.mockClear()
    mockRouterPush.mockClear()
    mockConfirm.mockResolvedValue(false)
  })

  it('shows symptom select when unlinkable symptoms exist', async () => {
    setupInvokeWithSymptoms()
    render(<DocumentDetailClient />)
    await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull())
    expect(screen.getByText('Select symptom…')).toBeInTheDocument()
    expect(screen.getByText('Headache')).toBeInTheDocument()
  })

  it('calls symptom_link with correct args on Link click', async () => {
    setupInvokeWithSymptoms()
    render(<DocumentDetailClient />)
    await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull())

    const select = screen.getByText('Select symptom…').closest('select')!
    fireEvent.change(select, { target: { value: 'sym-1' } })

    const linkBtn = screen.getAllByRole('button', { name: 'Link' }).find(
      (b) => b.closest('div')?.querySelector('select')
    )!
    fireEvent.click(linkBtn)

    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith('symptom_link', {
        symptomId: 'sym-1',
        toType: 'document',
        toId: 'doc-1',
      })
    )
  })

  it('shows linked symptom name and unlink button', async () => {
    setupInvokeWithSymptoms([makeSymptom({ id: 'sym-2', name: 'Fatigue' })], [makeSymptom({ id: 'sym-2', name: 'Fatigue' })])
    render(<DocumentDetailClient />)
    await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull())
    expect(screen.getByText('Fatigue')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Unlink symptom' })).toBeInTheDocument()
  })

  it('calls symptom_unlink when ✕ button clicked', async () => {
    setupInvokeWithSymptoms(
      [makeSymptom({ id: 'sym-1', name: 'Headache' })],
      [makeSymptom({ id: 'sym-1', name: 'Headache' })]
    )
    render(<DocumentDetailClient />)
    await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull())

    mockInvoke.mockResolvedValueOnce(undefined)
    fireEvent.click(screen.getByRole('button', { name: 'Unlink symptom' }))

    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith('symptom_unlink', {
        symptomId: 'sym-1',
        toType: 'document',
        toId: 'doc-1',
      })
    )
  })
})

describe('DocumentDetailClient — medication linking', () => {
  beforeEach(() => {
    mockInvoke.mockReset()
    mockConvertFileSrc.mockClear()
    mockRouterPush.mockClear()
    mockConfirm.mockResolvedValue(false)
  })

  it('shows medication select when unlinkable medications exist', async () => {
    setupInvokeWithMedications()
    render(<DocumentDetailClient />)
    await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull())
    expect(screen.getByText('Select medication…')).toBeInTheDocument()
    expect(screen.getByText('Ibuprofen')).toBeInTheDocument()
  })

  it('calls medication_link with correct args on Link click', async () => {
    setupInvokeWithMedications()
    render(<DocumentDetailClient />)
    await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull())

    const select = screen.getByText('Select medication…').closest('select')!
    fireEvent.change(select, { target: { value: 'med-1' } })

    const linkBtn = screen.getAllByRole('button', { name: 'Link' }).find(
      (b) => b.closest('div')?.querySelector('select')
    )!
    fireEvent.click(linkBtn)

    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith('medication_link', {
        medicationId: 'med-1',
        toType: 'document',
        toId: 'doc-1',
      })
    )
  })

  it('shows linked medication name and unlink button', async () => {
    setupInvokeWithMedications(
      [makeMedication({ id: 'med-2', name: 'Aspirin' })],
      [makeMedication({ id: 'med-2', name: 'Aspirin' })]
    )
    render(<DocumentDetailClient />)
    await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull())
    expect(screen.getByText('Aspirin')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Unlink medication' })).toBeInTheDocument()
  })

  it('calls medication_unlink when ✕ button clicked', async () => {
    setupInvokeWithMedications(
      [makeMedication({ id: 'med-1', name: 'Ibuprofen' })],
      [makeMedication({ id: 'med-1', name: 'Ibuprofen' })]
    )
    render(<DocumentDetailClient />)
    await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull())

    mockInvoke.mockResolvedValueOnce(undefined)
    fireEvent.click(screen.getByRole('button', { name: 'Unlink medication' }))

    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith('medication_unlink', {
        medicationId: 'med-1',
        toType: 'document',
        toId: 'doc-1',
      })
    )
  })
})

describe('DocumentDetailClient — symptom error paths', () => {
  beforeEach(() => {
    mockInvoke.mockReset()
    mockConvertFileSrc.mockClear()
    mockRouterPush.mockClear()
    mockConfirm.mockResolvedValue(false)
  })

  it('shows error when symptom_link rejects', async () => {
    setupInvokeWithSymptoms()
    render(<DocumentDetailClient />)
    await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull())

    const select = screen.getByText('Select symptom…').closest('select')!
    fireEvent.change(select, { target: { value: 'sym-1' } })

    mockInvoke.mockImplementationOnce(() => Promise.reject(new Error('sym link failed')))
    const linkBtn = screen.getAllByRole('button', { name: 'Link' }).find(
      (b) => b.closest('div')?.querySelector('select')
    )!
    fireEvent.click(linkBtn)

    await waitFor(() => expect(screen.getByText('sym link failed')).toBeInTheDocument())
  })

  it('shows error when symptom_unlink rejects', async () => {
    setupInvokeWithSymptoms([makeSymptom()], [makeSymptom()])
    render(<DocumentDetailClient />)
    await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull())

    mockInvoke.mockImplementationOnce(() => Promise.reject(new Error('sym unlink failed')))
    fireEvent.click(screen.getByRole('button', { name: 'Unlink symptom' }))

    await waitFor(() => expect(screen.getByText('sym unlink failed')).toBeInTheDocument())
  })
})

describe('DocumentDetailClient — medication error paths', () => {
  beforeEach(() => {
    mockInvoke.mockReset()
    mockConvertFileSrc.mockClear()
    mockRouterPush.mockClear()
    mockConfirm.mockResolvedValue(false)
  })

  it('shows error when medication_link rejects', async () => {
    setupInvokeWithMedications()
    render(<DocumentDetailClient />)
    await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull())

    const select = screen.getByText('Select medication…').closest('select')!
    fireEvent.change(select, { target: { value: 'med-1' } })

    mockInvoke.mockImplementationOnce(() => Promise.reject(new Error('link failed')))
    const linkBtn = screen.getAllByRole('button', { name: 'Link' }).find(
      (b) => b.closest('div')?.querySelector('select')
    )!
    fireEvent.click(linkBtn)

    await waitFor(() => expect(screen.getByText('link failed')).toBeInTheDocument())
  })

  it('shows error when medication_unlink rejects', async () => {
    setupInvokeWithMedications([makeMedication()], [makeMedication()])
    render(<DocumentDetailClient />)
    await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull())

    mockInvoke.mockImplementationOnce(() => Promise.reject(new Error('unlink failed')))
    fireEvent.click(screen.getByRole('button', { name: 'Unlink medication' }))

    await waitFor(() => expect(screen.getByText('unlink failed')).toBeInTheDocument())
  })
})

describe('DocumentDetailClient — uncovered branches', () => {
  beforeEach(() => {
    mockInvoke.mockReset()
    mockConvertFileSrc.mockClear()
    mockRouterPush.mockClear()
    mockConfirm.mockResolvedValue(false)
    setupInvoke()
  })

  it('updates notes state when textarea value changes', async () => {
    render(<DocumentDetailClient />)
    await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull())
    const textarea = screen.getByPlaceholderText('Add notes…')
    fireEvent.change(textarea, { target: { value: 'new note text' } })
    expect((textarea as HTMLTextAreaElement).value).toBe('new note text')
  })

  it('navigates to new note page when + Add Note clicked', async () => {
    render(<DocumentDetailClient />)
    await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull())
    fireEvent.click(screen.getByRole('button', { name: '+ Add Note' }))
    expect(mockRouterPush).toHaveBeenCalledWith('/notes/new?linkedDocumentId=doc-1')
  })

  it('calls documents_get_file_url when Open in Finder clicked', async () => {
    render(<DocumentDetailClient />)
    await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull())
    fireEvent.click(screen.getByText('↓ Open in Finder'))
    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith('documents_get_file_url', { id: 'doc-1' })
    )
  })
})

describe('DocumentDetailClient — export PDF report (task 50.4)', () => {
  const reportFixture = {
    document_id: 'doc-1',
    title: 'report.pdf',
    document_date: '2026-04-22',
    category: 'lab',
    clinic_name: 'City Clinic',
    notes: null,
    tags: ['blood', 'annual'],
    entities: [],
    appointments: [],
    ocr_excerpt: 'Sample text',
  }

  beforeEach(() => {
    mockInvoke.mockReset()
    mockConvertFileSrc.mockClear()
    mockDownloadReport.mockClear()
    setupInvoke()
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'documents_export_report') return Promise.resolve(reportFixture)
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
      if (cmd === 'documents_get_icd10_tags') return Promise.resolve([])
      return Promise.resolve(undefined)
    })
  })

  it('renders export-report-btn', async () => {
    render(<DocumentDetailClient />)
    await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull())
    expect(screen.getByTestId('export-report-btn')).toBeInTheDocument()
  })

  it('invokes documents_export_report and calls downloadReport on click', async () => {
    render(<DocumentDetailClient />)
    await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull())
    fireEvent.click(screen.getByTestId('export-report-btn'))
    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith('documents_export_report', { documentId: 'doc-1' })
    )
    await waitFor(() => expect(mockDownloadReport).toHaveBeenCalledWith(reportFixture))
  })

  it('button is disabled while generating', async () => {
    mockDownloadReport.mockReturnValue(new Promise(() => {}))
    render(<DocumentDetailClient />)
    await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull())
    const btn = screen.getByTestId('export-report-btn')
    fireEvent.click(btn)
    await waitFor(() => expect(btn).toBeDisabled())
  })
})

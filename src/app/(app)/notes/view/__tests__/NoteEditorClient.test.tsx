import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import React from 'react'

// ─── Module-level mocks ────────────────────────────────────────────────────
let mockLinkedDocumentId: string | null = null
const mockInvoke = vi.fn()
const mockConfirm = vi.fn(() => Promise.resolve(true))
const mockRouterPush = vi.fn()
const mockRouterBack = vi.fn()
const mockSetContent = vi.fn()
const mockGetHTML = vi.fn(() => '<p>content</p>')
const mockIsActive = vi.fn(() => false)

const mockChain = {
  focus: vi.fn().mockReturnThis(),
  toggleBold: vi.fn().mockReturnThis(),
  toggleItalic: vi.fn().mockReturnThis(),
  toggleHeading: vi.fn().mockReturnThis(),
  toggleBulletList: vi.fn().mockReturnThis(),
  toggleOrderedList: vi.fn().mockReturnThis(),
  run: vi.fn(),
}

const mockEditor = {
  commands: { setContent: mockSetContent },
  getHTML: mockGetHTML,
  isActive: mockIsActive,
  chain: vi.fn(() => mockChain),
}

const mockGetNote = vi.fn()
const mockSaveNote = vi.fn()
const mockDeleteNote = vi.fn()
const mockPinNote = vi.fn()
const mockSetNoteTags = vi.fn()
const mockShowToast = vi.fn()

vi.mock('@tauri-apps/api/core', () => ({ invoke: (...args: unknown[]) => mockInvoke(...args) }))
vi.mock('@tauri-apps/plugin-dialog', () => ({ confirm: (...args: unknown[]) => (mockConfirm as (...a: unknown[]) => unknown)(...args) }))

vi.mock('@tiptap/react', () => ({
  useEditor: () => mockEditor,
  EditorContent: () => <div data-testid="editor" />,
}))

vi.mock('next/navigation', () => ({
  useSearchParams: () => ({
    get: (k: string) => {
      if (k === 'id') return 'note-1'
      if (k === 'linkedDocumentId') return mockLinkedDocumentId
      return null
    },
  }),
  useRouter: () => ({ push: mockRouterPush, back: mockRouterBack }),
}))

vi.mock('../../../../../hooks/useNotes', () => ({
  useNotes: () => ({
    getNote: (...args: unknown[]) => mockGetNote(...args),
    saveNote: (...args: unknown[]) => mockSaveNote(...args),
    deleteNote: (...args: unknown[]) => mockDeleteNote(...args),
    pinNote: (...args: unknown[]) => mockPinNote(...args),
    setNoteTags: (...args: unknown[]) => mockSetNoteTags(...args),
  }),
}))

vi.mock('../../../../../hooks/useToast', () => ({
  useToast: () => ({ message: null, show: mockShowToast }),
}))

vi.mock('../../../../../components/shared/Toast', () => ({
  Toast: () => null,
}))

// ─── Factories ─────────────────────────────────────────────────────────────
function makeNote(overrides: Record<string, unknown> = {}) {
  return {
    id: 'note-1',
    title: 'My Note',
    content: '<p>Hello</p>',
    is_pinned: false,
    created_at: '2026-05-01T00:00:00Z',
    updated_at: '2026-05-01T00:00:00Z',
    tags: [],
    ...overrides,
  }
}

function makeVersion(id: string, createdAt: string) {
  return { id, note_id: 'note-1', content: '<p>old</p>', created_at: createdAt }
}

function makeDoc(overrides: Record<string, unknown> = {}) {
  return {
    id: 'doc-1',
    filename: 'test.pdf',
    extracted_text: null,
    is_deleted: false,
    created_at: '2026-05-01T00:00:00Z',
    updated_at: '2026-05-01T00:00:00Z',
    document_date: null,
    notes: null,
    category_ids: [],
    tag_ids: [],
    contact_id: null,
    clinic_id: null,
    ...overrides,
  }
}

function makeAppt(overrides: Record<string, unknown> = {}) {
  return {
    id: 'appt-1',
    title: 'GP Visit',
    appt_date: '2026-05-10T10:00:00Z',
    ...overrides,
  }
}

function makeLink(entityType: string, entityId: string, id?: string) {
  return { id: id ?? `link-${entityType}-${entityId}`, entity_type: entityType, entity_id: entityId }
}

// ─── Default invoke setup ──────────────────────────────────────────────────
function setupInvoke(overrides: {
  note?: ReturnType<typeof makeNote> | 'error' | 'string-error'
  versions?: ReturnType<typeof makeVersion>[]
  docs?: ReturnType<typeof makeDoc>[]
  appts?: ReturnType<typeof makeAppt>[]
  links?: ReturnType<typeof makeLink>[]
} = {}) {
  const note = overrides.note ?? makeNote()
  const versions = overrides.versions ?? []
  const docs = overrides.docs ?? []
  const appts = overrides.appts ?? []
  const links = overrides.links ?? []

  if (note === 'error') {
    mockGetNote.mockRejectedValue(new Error('Load failed'))
  } else if (note === 'string-error') {
    mockGetNote.mockRejectedValue('raw string error')
  } else {
    mockGetNote.mockResolvedValue(note)
  }

  mockSaveNote.mockResolvedValue(makeNote({ updated_at: '2026-05-01T01:00:00Z' }))
  mockDeleteNote.mockResolvedValue(undefined)
  mockPinNote.mockResolvedValue(makeNote())
  mockSetNoteTags.mockResolvedValue(makeNote())

  mockInvoke.mockImplementation((cmd: string) => {
    if (cmd === 'appointments_list') return Promise.resolve(appts)
    if (cmd === 'documents_list') return Promise.resolve(docs)
    if (cmd === 'links_for_note') return Promise.resolve(links)
    if (cmd === 'note_versions_list') return Promise.resolve(versions)
    if (cmd === 'notes_save') return Promise.resolve(makeNote())
    if (cmd === 'note_link') return Promise.resolve(undefined)
    if (cmd === 'note_unlink') return Promise.resolve(undefined)
    if (cmd === 'note_version_restore') return Promise.resolve(makeNote())
    return Promise.resolve(undefined)
  })
}

// Static import so the module is shared but mocks are stable
import NoteEditorClient from '../NoteEditorClient'

// ─── Tests ─────────────────────────────────────────────────────────────────
describe('NoteEditorClient', () => {
  beforeEach(() => {
    cleanup()
    vi.clearAllMocks()
    mockLinkedDocumentId = null
    mockChain.focus.mockReturnThis()
    mockChain.toggleBold.mockReturnThis()
    mockChain.toggleItalic.mockReturnThis()
    mockChain.toggleHeading.mockReturnThis()
    mockChain.toggleBulletList.mockReturnThis()
    mockChain.toggleOrderedList.mockReturnThis()
    mockEditor.chain.mockReturnValue(mockChain)
    mockConfirm.mockResolvedValue(true)
    mockRouterPush.mockClear()
  })

  // ── Loading / error states ────────────────────────────────────────────────
  describe('loading and error states', () => {
    it('shows loading state before note loads', () => {
      mockGetNote.mockReturnValue(new Promise(() => {})) // never resolves
      mockInvoke.mockResolvedValue([])
      render(<NoteEditorClient />)
      expect(screen.getByText(/loading/i)).toBeInTheDocument()
    })

    it('shows error message when load throws Error instance', async () => {
      setupInvoke({ note: 'error' })
      render(<NoteEditorClient />)
      await waitFor(() => {
        expect(screen.getByText('Load failed')).toBeInTheDocument()
      })
    })

    it('shows stringified error when load throws non-Error', async () => {
      setupInvoke({ note: 'string-error' })
      render(<NoteEditorClient />)
      await waitFor(() => {
        expect(screen.getByText('raw string error')).toBeInTheDocument()
      })
    })

    it('back button in error state navigates to /notes', async () => {
      setupInvoke({ note: 'error' })
      render(<NoteEditorClient />)
      await waitFor(() => screen.getByText('Load failed'))
      fireEvent.click(screen.getByText(/back to notes/i))
      expect(mockRouterPush).toHaveBeenCalledWith('/notes')
    })
  })

  // ── Loaded state ──────────────────────────────────────────────────────────
  describe('loaded state', () => {
    it('renders note title after load', async () => {
      setupInvoke()
      render(<NoteEditorClient />)
      await waitFor(() => {
        expect(screen.getByDisplayValue('My Note')).toBeInTheDocument()
      })
    })

    it('renders editor area', async () => {
      setupInvoke()
      render(<NoteEditorClient />)
      await waitFor(() => screen.getByDisplayValue('My Note'))
      expect(screen.getByTestId('editor')).toBeInTheDocument()
    })

    it('renders all toolbar buttons', async () => {
      setupInvoke()
      render(<NoteEditorClient />)
      await waitFor(() => screen.getByDisplayValue('My Note'))
      expect(screen.getByTitle('Bold')).toBeInTheDocument()
      expect(screen.getByTitle('Italic')).toBeInTheDocument()
      expect(screen.getByTitle('Heading 1')).toBeInTheDocument()
      expect(screen.getByTitle('Heading 2')).toBeInTheDocument()
      expect(screen.getByTitle('Bullet list')).toBeInTheDocument()
      expect(screen.getByTitle('Ordered list')).toBeInTheDocument()
    })

    it('renders Save and Delete buttons', async () => {
      setupInvoke()
      render(<NoteEditorClient />)
      await waitFor(() => screen.getByDisplayValue('My Note'))
      expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument()
    })

    it('renders pin button with correct aria-label when not pinned', async () => {
      setupInvoke()
      render(<NoteEditorClient />)
      await waitFor(() => screen.getByDisplayValue('My Note'))
      expect(screen.getByRole('button', { name: 'Pin note' })).toBeInTheDocument()
    })

    it('renders unpin aria-label when note is pinned', async () => {
      setupInvoke({ note: makeNote({ is_pinned: true }) })
      render(<NoteEditorClient />)
      await waitFor(() => screen.getByDisplayValue('My Note'))
      expect(screen.getByRole('button', { name: 'Unpin note' })).toBeInTheDocument()
    })
  })

  // ── Toolbar actions ───────────────────────────────────────────────────────
  describe('toolbar actions', () => {
    it('calls toggleBold chain on Bold click', async () => {
      setupInvoke()
      render(<NoteEditorClient />)
      await waitFor(() => screen.getByTitle('Bold'))
      fireEvent.click(screen.getByTitle('Bold'))
      expect(mockChain.toggleBold).toHaveBeenCalled()
      expect(mockChain.run).toHaveBeenCalled()
    })

    it('calls toggleItalic chain on Italic click', async () => {
      setupInvoke()
      render(<NoteEditorClient />)
      await waitFor(() => screen.getByTitle('Italic'))
      fireEvent.click(screen.getByTitle('Italic'))
      expect(mockChain.toggleItalic).toHaveBeenCalled()
      expect(mockChain.run).toHaveBeenCalled()
    })

    it('calls toggleHeading chain on H1 click', async () => {
      setupInvoke()
      render(<NoteEditorClient />)
      await waitFor(() => screen.getByTitle('Heading 1'))
      fireEvent.click(screen.getByTitle('Heading 1'))
      expect(mockChain.toggleHeading).toHaveBeenCalled()
      expect(mockChain.run).toHaveBeenCalled()
    })

    it('calls toggleHeading chain on H2 click', async () => {
      setupInvoke()
      render(<NoteEditorClient />)
      await waitFor(() => screen.getByTitle('Heading 2'))
      fireEvent.click(screen.getByTitle('Heading 2'))
      expect(mockChain.toggleHeading).toHaveBeenCalled()
      expect(mockChain.run).toHaveBeenCalled()
    })

    it('calls toggleBulletList chain on Bullet list click', async () => {
      setupInvoke()
      render(<NoteEditorClient />)
      await waitFor(() => screen.getByTitle('Bullet list'))
      fireEvent.click(screen.getByTitle('Bullet list'))
      expect(mockChain.toggleBulletList).toHaveBeenCalled()
      expect(mockChain.run).toHaveBeenCalled()
    })

    it('calls toggleOrderedList chain on Ordered list click', async () => {
      setupInvoke()
      render(<NoteEditorClient />)
      await waitFor(() => screen.getByTitle('Ordered list'))
      fireEvent.click(screen.getByTitle('Ordered list'))
      expect(mockChain.toggleOrderedList).toHaveBeenCalled()
      expect(mockChain.run).toHaveBeenCalled()
    })
  })

  // ── Save ──────────────────────────────────────────────────────────────────
  describe('save', () => {
    it('calls saveNote when Save button clicked', async () => {
      setupInvoke()
      render(<NoteEditorClient />)
      await waitFor(() => screen.getByDisplayValue('My Note'))
      fireEvent.click(screen.getByRole('button', { name: /save/i }))
      await waitFor(() => {
        expect(mockSaveNote).toHaveBeenCalledWith('note-1', expect.any(String), expect.any(String))
      })
    })

    it('calls saveNote when title input loses focus', async () => {
      setupInvoke()
      render(<NoteEditorClient />)
      await waitFor(() => screen.getByDisplayValue('My Note'))
      const titleInput = screen.getByDisplayValue('My Note')
      fireEvent.blur(titleInput)
      await waitFor(() => {
        expect(mockSaveNote).toHaveBeenCalled()
      })
    })

    it('shows error when saveNote rejects', async () => {
      setupInvoke()
      mockSaveNote.mockRejectedValue(new Error('Save failed'))
      render(<NoteEditorClient />)
      await waitFor(() => screen.getByDisplayValue('My Note'))
      fireEvent.click(screen.getByRole('button', { name: /save/i }))
      await waitFor(() => {
        expect(screen.getByText('Save failed')).toBeInTheDocument()
      })
    })
  })

  // ── Pin ───────────────────────────────────────────────────────────────────
  describe('pin toggle', () => {
    it('calls pinNote with true when not pinned', async () => {
      setupInvoke({ note: makeNote({ is_pinned: false }) })
      render(<NoteEditorClient />)
      await waitFor(() => screen.getByRole('button', { name: 'Pin note' }))
      fireEvent.click(screen.getByRole('button', { name: 'Pin note' }))
      await waitFor(() => {
        expect(mockPinNote).toHaveBeenCalledWith('note-1', true)
      })
    })

    it('calls pinNote with false when pinned', async () => {
      setupInvoke({ note: makeNote({ is_pinned: true }) })
      render(<NoteEditorClient />)
      await waitFor(() => screen.getByRole('button', { name: 'Unpin note' }))
      fireEvent.click(screen.getByRole('button', { name: 'Unpin note' }))
      await waitFor(() => {
        expect(mockPinNote).toHaveBeenCalledWith('note-1', false)
      })
    })
  })

  // ── Tags ──────────────────────────────────────────────────────────────────
  describe('tags', () => {
    it('renders existing tags', async () => {
      setupInvoke({ note: makeNote({ tags: ['cardio', 'checkup'] }) })
      render(<NoteEditorClient />)
      await waitFor(() => screen.getByDisplayValue('My Note'))
      expect(screen.getByText('cardio')).toBeInTheDocument()
      expect(screen.getByText('checkup')).toBeInTheDocument()
    })

    it('adds tag on Enter key', async () => {
      setupInvoke()
      render(<NoteEditorClient />)
      await waitFor(() => screen.getByDisplayValue('My Note'))
      const tagInput = screen.getByPlaceholderText(/add tag/i)
      fireEvent.change(tagInput, { target: { value: 'newtag' } })
      fireEvent.keyDown(tagInput, { key: 'Enter' })
      await waitFor(() => {
        expect(mockSetNoteTags).toHaveBeenCalledWith('note-1', ['newtag'])
      })
    })

    it('adds tag on comma key', async () => {
      setupInvoke()
      render(<NoteEditorClient />)
      await waitFor(() => screen.getByDisplayValue('My Note'))
      const tagInput = screen.getByPlaceholderText(/add tag/i)
      fireEvent.change(tagInput, { target: { value: 'commatag' } })
      fireEvent.keyDown(tagInput, { key: ',' })
      await waitFor(() => {
        expect(mockSetNoteTags).toHaveBeenCalledWith('note-1', ['commatag'])
      })
    })

    it('does not add tag on irrelevant key', async () => {
      setupInvoke()
      render(<NoteEditorClient />)
      await waitFor(() => screen.getByDisplayValue('My Note'))
      const tagInput = screen.getByPlaceholderText(/add tag/i)
      fireEvent.change(tagInput, { target: { value: 'irrelevant' } })
      fireEvent.keyDown(tagInput, { key: 'a' })
      expect(mockSetNoteTags).not.toHaveBeenCalled()
    })

    it('does not add empty tag', async () => {
      setupInvoke()
      render(<NoteEditorClient />)
      await waitFor(() => screen.getByDisplayValue('My Note'))
      const tagInput = screen.getByPlaceholderText(/add tag/i)
      fireEvent.change(tagInput, { target: { value: '  ' } })
      fireEvent.keyDown(tagInput, { key: 'Enter' })
      expect(mockSetNoteTags).not.toHaveBeenCalled()
    })

    it('does not add duplicate tag', async () => {
      setupInvoke({ note: makeNote({ tags: ['existing'] }) })
      render(<NoteEditorClient />)
      await waitFor(() => screen.getByDisplayValue('My Note'))
      const tagInput = screen.getByPlaceholderText(/add tag/i)
      fireEvent.change(tagInput, { target: { value: 'existing' } })
      fireEvent.keyDown(tagInput, { key: 'Enter' })
      expect(mockSetNoteTags).not.toHaveBeenCalled()
    })

    it('removes tag via × button', async () => {
      setupInvoke({ note: makeNote({ tags: ['removeme'] }) })
      render(<NoteEditorClient />)
      await waitFor(() => screen.getByDisplayValue('My Note'))
      fireEvent.click(screen.getByRole('button', { name: 'Remove tag removeme' }))
      await waitFor(() => {
        expect(mockSetNoteTags).toHaveBeenCalledWith('note-1', [])
      })
    })
  })

  // ── Delete ────────────────────────────────────────────────────────────────
  describe('delete', () => {
    it('navigates to /notes after confirmed delete', async () => {
      setupInvoke()
      mockConfirm.mockResolvedValue(true)
      render(<NoteEditorClient />)
      await waitFor(() => screen.getByDisplayValue('My Note'))
      fireEvent.click(screen.getByRole('button', { name: /delete/i }))
      await waitFor(() => {
        expect(mockDeleteNote).toHaveBeenCalledWith('note-1')
        expect(mockRouterPush).toHaveBeenCalledWith('/notes')
      })
    })

    it('shows toast after confirmed delete', async () => {
      setupInvoke()
      mockConfirm.mockResolvedValue(true)
      render(<NoteEditorClient />)
      await waitFor(() => screen.getByDisplayValue('My Note'))
      fireEvent.click(screen.getByRole('button', { name: /delete/i }))
      await waitFor(() => {
        expect(mockShowToast).toHaveBeenCalledWith('Moved to Trash')
      })
    })

    it('does not delete when confirm is cancelled', async () => {
      setupInvoke()
      mockConfirm.mockResolvedValue(false)
      render(<NoteEditorClient />)
      await waitFor(() => screen.getByDisplayValue('My Note'))
      fireEvent.click(screen.getByRole('button', { name: /delete/i }))
      await waitFor(() => {
        expect(mockDeleteNote).not.toHaveBeenCalled()
        expect(mockRouterPush).not.toHaveBeenCalled()
      })
    })
  })

  // ── Version history ───────────────────────────────────────────────────────
  describe('version history', () => {
    it('opens history drawer when History button clicked', async () => {
      setupInvoke()
      render(<NoteEditorClient />)
      await waitFor(() => screen.getByDisplayValue('My Note'))
      fireEvent.click(screen.getByTitle('Version History'))
      expect(screen.getByRole('dialog', { name: 'Version History' })).toBeInTheDocument()
    })

    it('shows empty state when no versions', async () => {
      setupInvoke({ versions: [] })
      render(<NoteEditorClient />)
      await waitFor(() => screen.getByDisplayValue('My Note'))
      fireEvent.click(screen.getByTitle('Version History'))
      expect(screen.getByText(/no saved versions/i)).toBeInTheDocument()
    })

    it('shows version entries when versions exist', async () => {
      const now = new Date().toISOString()
      setupInvoke({ versions: [makeVersion('v1', now), makeVersion('v2', now)] })
      render(<NoteEditorClient />)
      await waitFor(() => screen.getByDisplayValue('My Note'))
      fireEvent.click(screen.getByTitle('Version History'))
      const restoreButtons = screen.getAllByRole('button', { name: /restore/i })
      expect(restoreButtons).toHaveLength(2)
    })

    it('shows version count in History button', async () => {
      const now = new Date().toISOString()
      setupInvoke({ versions: [makeVersion('v1', now)] })
      render(<NoteEditorClient />)
      await waitFor(() => screen.getByDisplayValue('My Note'))
      expect(screen.getByTitle('Version History').textContent).toContain('(1)')
    })

    it('closes drawer on backdrop click', async () => {
      setupInvoke()
      render(<NoteEditorClient />)
      await waitFor(() => screen.getByDisplayValue('My Note'))
      fireEvent.click(screen.getByTitle('Version History'))
      expect(screen.getByRole('dialog', { name: 'Version History' })).toBeInTheDocument()
      const backdrop = document.querySelector('[aria-hidden="true"]') as HTMLElement
      fireEvent.click(backdrop)
      await waitFor(() => {
        expect(screen.queryByRole('dialog', { name: 'Version History' })).not.toBeInTheDocument()
      })
    })

    it('closes drawer on Close button click', async () => {
      setupInvoke()
      render(<NoteEditorClient />)
      await waitFor(() => screen.getByDisplayValue('My Note'))
      fireEvent.click(screen.getByTitle('Version History'))
      fireEvent.click(screen.getByRole('button', { name: 'Close history' }))
      await waitFor(() => {
        expect(screen.queryByRole('dialog', { name: 'Version History' })).not.toBeInTheDocument()
      })
    })

    it('restores version successfully', async () => {
      const now = new Date().toISOString()
      setupInvoke({ versions: [makeVersion('v1', now)] })
      render(<NoteEditorClient />)
      await waitFor(() => screen.getByDisplayValue('My Note'))
      fireEvent.click(screen.getByTitle('Version History'))
      fireEvent.click(screen.getByRole('button', { name: /restore/i }))
      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('note_version_restore', {
          noteId: 'note-1',
          versionId: 'v1',
        })
      })
    })

    it('shows error state when restore fails', async () => {
      const now = new Date().toISOString()
      setupInvoke({ versions: [makeVersion('v1', now)] })
      mockInvoke.mockImplementation((cmd: string) => {
        if (cmd === 'note_version_restore') return Promise.reject(new Error('Restore failed'))
        if (cmd === 'appointments_list') return Promise.resolve([])
        if (cmd === 'documents_list') return Promise.resolve([])
        if (cmd === 'links_for_note') return Promise.resolve([])
        if (cmd === 'note_versions_list') return Promise.resolve([makeVersion('v1', now)])
        return Promise.resolve(undefined)
      })
      render(<NoteEditorClient />)
      await waitFor(() => screen.getByDisplayValue('My Note'))
      fireEvent.click(screen.getByTitle('Version History'))
      fireEvent.click(screen.getByRole('button', { name: /restore/i }))
      await waitFor(() => {
        expect(screen.getByText('Restore failed')).toBeInTheDocument()
      })
    })
  })

  // ── Links ─────────────────────────────────────────────────────────────────
  describe('link to appointment', () => {
    it('calls note_link when appointment selected and Link clicked', async () => {
      setupInvoke({ appts: [makeAppt()] })
      render(<NoteEditorClient />)
      await waitFor(() => screen.getByDisplayValue('My Note'))
      const select = screen.getByDisplayValue(/link to appointment/i)
      fireEvent.change(select, { target: { value: 'appt-1' } })
      const linkBtn = screen.getAllByRole('button', { name: /^link$/i })[0]!
      fireEvent.click(linkBtn)
      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('note_link', {
          noteId: 'note-1',
          entityType: 'appointment',
          entityId: 'appt-1',
        })
      })
    })

    it('does not call note_link when no appointment selected', async () => {
      setupInvoke()
      render(<NoteEditorClient />)
      await waitFor(() => screen.getByDisplayValue('My Note'))
      const linkBtn = screen.getAllByRole('button', { name: /^link$/i })[0]!
      fireEvent.click(linkBtn)
      await waitFor(() => {
        expect(mockInvoke).not.toHaveBeenCalledWith(
          'note_link',
          expect.objectContaining({ entityType: 'appointment' }),
        )
      })
    })
  })

  describe('link to document', () => {
    it('calls note_link when document selected and Link clicked', async () => {
      setupInvoke({ docs: [makeDoc()] })
      render(<NoteEditorClient />)
      await waitFor(() => screen.getByDisplayValue('My Note'))
      const select = screen.getByDisplayValue(/link to document/i)
      fireEvent.change(select, { target: { value: 'doc-1' } })
      const linkBtns = screen.getAllByRole('button', { name: /^link$/i })
      fireEvent.click(linkBtns[linkBtns.length - 1]!)
      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('note_link', {
          noteId: 'note-1',
          entityType: 'document',
          entityId: 'doc-1',
        })
      })
    })

    it('does not call note_link when no document selected', async () => {
      setupInvoke()
      render(<NoteEditorClient />)
      await waitFor(() => screen.getByDisplayValue('My Note'))
      const linkBtns = screen.getAllByRole('button', { name: /^link$/i })
      fireEvent.click(linkBtns[linkBtns.length - 1]!)
      await waitFor(() => {
        expect(mockInvoke).not.toHaveBeenCalledWith(
          'note_link',
          expect.objectContaining({ entityType: 'document' }),
        )
      })
    })
  })

  // ── Linked entity chips ───────────────────────────────────────────────────
  describe('linked entity chips', () => {
    it('renders appointment chip with emoji and title when linked', async () => {
      setupInvoke({
        appts: [makeAppt({ id: 'appt-1', title: 'GP Visit' })],
        links: [makeLink('appointment', 'appt-1')],
      })
      render(<NoteEditorClient />)
      await waitFor(() => screen.getByDisplayValue('My Note'))
      expect(screen.getByText(/📅/)).toBeInTheDocument()
      expect(screen.getByText(/GP Visit/)).toBeInTheDocument()
    })

    it('renders document chip with emoji and filename when linked', async () => {
      setupInvoke({
        docs: [makeDoc({ id: 'doc-1', filename: 'report.pdf' })],
        links: [makeLink('document', 'doc-1')],
      })
      render(<NoteEditorClient />)
      await waitFor(() => screen.getByDisplayValue('My Note'))
      expect(screen.getByText(/📄/)).toBeInTheDocument()
      expect(screen.getByText(/report\.pdf/)).toBeInTheDocument()
    })

    it('falls back to entity_id when appointment not found in list', async () => {
      setupInvoke({
        appts: [],
        links: [makeLink('appointment', 'appt-unknown')],
      })
      render(<NoteEditorClient />)
      await waitFor(() => screen.getByDisplayValue('My Note'))
      expect(screen.getByText(/appt-unknown/)).toBeInTheDocument()
    })

    it('falls back to entity_id when document not found in list', async () => {
      setupInvoke({
        docs: [],
        links: [makeLink('document', 'doc-unknown')],
      })
      render(<NoteEditorClient />)
      await waitFor(() => screen.getByDisplayValue('My Note'))
      expect(screen.getByText(/doc-unknown/)).toBeInTheDocument()
    })

    it('calls note_unlink when × button on chip is clicked', async () => {
      setupInvoke({
        appts: [makeAppt({ id: 'appt-1', title: 'GP Visit' })],
        links: [makeLink('appointment', 'appt-1')],
      })
      render(<NoteEditorClient />)
      await waitFor(() => screen.getByDisplayValue('My Note'))
      fireEvent.click(screen.getByRole('button', { name: /unlink GP Visit/i }))
      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('note_unlink', {
          noteId: 'note-1',
          entityType: 'appointment',
          entityId: 'appt-1',
        })
      })
    })
  })

  // ── Saving state ──────────────────────────────────────────────────────────
  describe('saving state', () => {
    it('shows "Saving…" while save in progress', async () => {
      setupInvoke()
      // saveNote never resolves so saving stays true
      mockSaveNote.mockReturnValue(new Promise(() => {}))
      render(<NoteEditorClient />)
      await waitFor(() => screen.getByDisplayValue('My Note'))
      fireEvent.click(screen.getByRole('button', { name: /save/i }))
      await waitFor(() => {
        expect(screen.getByText('Saving…')).toBeInTheDocument()
      })
    })
  })

  // ── OCR prefill block ─────────────────────────────────────────────────────
  describe('OCR prefill block', () => {
    it('renders OCR toggle when linkedDocumentId doc has extracted_text', async () => {
      mockLinkedDocumentId = 'doc-ocr'
      setupInvoke({
        docs: [makeDoc({ id: 'doc-ocr', extracted_text: 'Some OCR text' })],
      })
      render(<NoteEditorClient />)
      await waitFor(() => screen.getByDisplayValue('My Note'))
      expect(screen.getByText(/start from extracted text/i)).toBeInTheDocument()
      expect(screen.getByRole('switch')).toBeInTheDocument()
    })

    it('does not render OCR block when doc has no extracted_text', async () => {
      mockLinkedDocumentId = 'doc-noocr'
      setupInvoke({
        docs: [makeDoc({ id: 'doc-noocr', extracted_text: null })],
      })
      render(<NoteEditorClient />)
      await waitFor(() => screen.getByDisplayValue('My Note'))
      expect(screen.queryByText(/start from extracted text/i)).not.toBeInTheDocument()
    })

    it('toggles OCR switch aria-checked on click', async () => {
      mockLinkedDocumentId = 'doc-ocr'
      setupInvoke({
        docs: [makeDoc({ id: 'doc-ocr', extracted_text: 'OCR content here' })],
      })
      render(<NoteEditorClient />)
      await waitFor(() => screen.getByRole('switch'))
      const toggle = screen.getByRole('switch')
      expect(toggle).toHaveAttribute('aria-checked', 'false')
      fireEvent.click(toggle)
      await waitFor(() => {
        expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true')
      })
    })
  })

  // ── Branch coverage helpers ───────────────────────────────────────────────
  describe('additional branch coverage', () => {
    it('renders "Untitled" breadcrumb when note title is empty', async () => {
      setupInvoke({ note: makeNote({ title: '' }) })
      render(<NoteEditorClient />)
      await waitFor(() => screen.getByText('Untitled'))
    })

    it('sets content from empty string when note content is falsy', async () => {
      setupInvoke({ note: makeNote({ content: '' }) })
      render(<NoteEditorClient />)
      await waitFor(() => screen.getByDisplayValue(''))
      // setContent was called with '' (empty content branch)
      expect(mockSetContent).toHaveBeenCalledWith('')
    })

    it('shows String(err) when restore throws a non-Error value', async () => {
      const now = new Date().toISOString()
      setupInvoke({ versions: [makeVersion('v1', now)] })
      mockInvoke.mockImplementation((cmd: string) => {
        if (cmd === 'note_version_restore') return Promise.reject('plain string rejection')
        if (cmd === 'appointments_list') return Promise.resolve([])
        if (cmd === 'documents_list') return Promise.resolve([])
        if (cmd === 'links_for_note') return Promise.resolve([])
        if (cmd === 'note_versions_list') return Promise.resolve([makeVersion('v1', now)])
        return Promise.resolve(undefined)
      })
      render(<NoteEditorClient />)
      await waitFor(() => screen.getByDisplayValue('My Note'))
      fireEvent.click(screen.getByTitle('Version History'))
      fireEvent.click(screen.getByRole('button', { name: /restore/i }))
      await waitFor(() => {
        expect(screen.getByText('plain string rejection')).toBeInTheDocument()
      })
    })

    it('calls setContent with empty string when restored note content is falsy', async () => {
      const now = new Date().toISOString()
      const emptyNote = makeNote({ content: '' })
      setupInvoke({ versions: [makeVersion('v1', now)] })
      mockInvoke.mockImplementation((cmd: string) => {
        if (cmd === 'note_version_restore') return Promise.resolve(emptyNote)
        if (cmd === 'appointments_list') return Promise.resolve([])
        if (cmd === 'documents_list') return Promise.resolve([])
        if (cmd === 'links_for_note') return Promise.resolve([])
        if (cmd === 'note_versions_list') return Promise.resolve([makeVersion('v1', now)])
        return Promise.resolve(undefined)
      })
      render(<NoteEditorClient />)
      await waitFor(() => screen.getByDisplayValue('My Note'))
      fireEvent.click(screen.getByTitle('Version History'))
      fireEvent.click(screen.getByRole('button', { name: /restore/i }))
      await waitFor(() => {
        // setContent called twice: once on load (with 'Hello'), once on restore (with '')
        expect(mockSetContent).toHaveBeenLastCalledWith('')
      })
    })
  })

  // ── relativeTime branches ─────────────────────────────────────────────────
  describe('relativeTime via version timestamps', () => {
    it('shows "just now" for version < 5s ago', async () => {
      const now = new Date().toISOString()
      setupInvoke({ versions: [makeVersion('v1', now)] })
      render(<NoteEditorClient />)
      await waitFor(() => screen.getByDisplayValue('My Note'))
      fireEvent.click(screen.getByTitle('Version History'))
      expect(screen.getByText(/just now/i)).toBeInTheDocument()
    })

    it('shows seconds for version 10s ago', async () => {
      const tenSecondsAgo = new Date(Date.now() - 10_000).toISOString()
      setupInvoke({ versions: [makeVersion('v1', tenSecondsAgo)] })
      render(<NoteEditorClient />)
      await waitFor(() => screen.getByDisplayValue('My Note'))
      fireEvent.click(screen.getByTitle('Version History'))
      expect(screen.getByText(/\ds ago/)).toBeInTheDocument()
    })

    it('shows minutes for version 2min ago', async () => {
      const twoMinAgo = new Date(Date.now() - 2 * 60_000).toISOString()
      setupInvoke({ versions: [makeVersion('v1', twoMinAgo)] })
      render(<NoteEditorClient />)
      await waitFor(() => screen.getByDisplayValue('My Note'))
      fireEvent.click(screen.getByTitle('Version History'))
      expect(screen.getByText(/\dm ago/)).toBeInTheDocument()
    })

    it('shows hours for version 2h ago', async () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 3600_000).toISOString()
      setupInvoke({ versions: [makeVersion('v1', twoHoursAgo)] })
      render(<NoteEditorClient />)
      await waitFor(() => screen.getByDisplayValue('My Note'))
      fireEvent.click(screen.getByTitle('Version History'))
      expect(screen.getAllByText(/\dh ago/).length).toBeGreaterThanOrEqual(1)
    })
  })
})

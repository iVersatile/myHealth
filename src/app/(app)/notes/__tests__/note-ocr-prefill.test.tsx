import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import React from 'react'

// Module-level mocks — implementations set per-test via setupInvoke
const mockInvoke = vi.fn()
const mockSetContent = vi.fn()
const mockGetHTML = vi.fn(() => '<p></p>')
const mockEditor = {
  commands: { setContent: mockSetContent },
  getHTML: mockGetHTML,
  isActive: vi.fn(() => false),
}

vi.mock('@tauri-apps/api/core', () => ({ invoke: (...args: unknown[]) => mockInvoke(...args) }))
vi.mock('@tauri-apps/plugin-dialog', () => ({ confirm: vi.fn(() => Promise.resolve(true)) }))

vi.mock('@tiptap/react', () => ({
  useEditor: () => mockEditor,
  EditorContent: () => <div data-testid="editor" />,
}))

vi.mock('next/navigation', () => ({
  useSearchParams: () => ({
    get: (k: string) => {
      if (k === 'id') return 'note-1'
      if (k === 'linkedDocumentId') return 'doc-1'
      return null
    },
  }),
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}))

const makeNote = () => ({
  id: 'note-1',
  title: 'Test Note',
  content: '',
  is_pinned: false,
  created_at: '2026-05-01T00:00:00Z',
  updated_at: '2026-05-01T00:00:00Z',
  tags: [],
})

const makeDoc = (extracted_text: string | null = null) => ({
  id: 'doc-1',
  filename: 'test.pdf',
  extracted_text,
  is_deleted: false,
  created_at: '2026-05-01T00:00:00Z',
  updated_at: '2026-05-01T00:00:00Z',
  document_date: null,
  notes: null,
  category_ids: [],
  tag_ids: [],
  contact_id: null,
  clinic_id: null,
})

vi.mock('../../../../hooks/useNotes', () => ({
  useNotes: () => ({
    getNote: () => Promise.resolve(makeNote()),
    saveNote: () => Promise.resolve(makeNote()),
    deleteNote: () => Promise.resolve(),
    pinNote: () => Promise.resolve(makeNote()),
    setNoteTags: () => Promise.resolve(makeNote()),
  }),
}))

vi.mock('../../../../hooks/useToast', () => ({
  useToast: () => ({ message: null, show: vi.fn() }),
}))

vi.mock('../../../../components/shared/Toast', () => ({
  Toast: () => null,
}))

function setupInvoke(extractedText: string | null = null) {
  mockInvoke.mockImplementation((cmd: string) => {
    if (cmd === 'appointments_list') return Promise.resolve([])
    if (cmd === 'documents_list') return Promise.resolve([makeDoc(extractedText)])
    if (cmd === 'links_for_note') return Promise.resolve([])
    if (cmd === 'note_versions_list') return Promise.resolve([])
    if (cmd === 'notes_save') return Promise.resolve(makeNote())
    return Promise.resolve(undefined)
  })
}

// Static import so the module is shared but mocks are stable
import NoteEditorClient from '../view/NoteEditorClient'

describe('NoteEditorClient — OCR prefill toggle', () => {
  beforeEach(() => {
    cleanup()
    mockInvoke.mockReset()
    mockSetContent.mockClear()
  })

  it('hides toggle when linked doc has no extracted_text', async () => {
    setupInvoke(null)
    render(<NoteEditorClient />)
    await waitFor(() => {
      expect(screen.queryByRole('switch')).toBeNull()
    })
  })

  it('shows toggle when linked doc has extracted_text', async () => {
    setupInvoke('Blood pressure 120/80')
    render(<NoteEditorClient />)
    await waitFor(() => {
      expect(screen.getByRole('switch')).toBeInTheDocument()
    })
  })

  it('sets editor content with extracted text when toggle turned on', async () => {
    setupInvoke('Blood pressure 120/80')
    render(<NoteEditorClient />)
    await waitFor(() => screen.getByRole('switch'))
    fireEvent.click(screen.getByRole('switch'))
    expect(mockSetContent).toHaveBeenCalledWith(expect.stringContaining('Blood pressure 120/80'))
  })
})

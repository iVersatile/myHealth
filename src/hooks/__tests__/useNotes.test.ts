import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useNotesStore, type Note } from '../../store/notesStore'

const mockInvoke = vi.fn()

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}))

const makeNote = (overrides: Partial<Note> = {}): Note => ({
  id: 'n1',
  title: 'My Note',
  content: '<p>Hello</p>',
  is_pinned: false,
  created_at: '2026-04-20T10:00:00Z',
  updated_at: '2026-04-20T10:05:00Z',
  tags: [],
  ...overrides,
})

beforeEach(() => {
  vi.clearAllMocks()
  useNotesStore.setState({ notes: [], loading: false, error: null })
})

describe('useNotes', () => {
  it('fetches notes on mount', async () => {
    const { useNotes } = await import('../useNotes')
    const list = [makeNote({ id: 'a' }), makeNote({ id: 'b' })]
    mockInvoke.mockResolvedValueOnce(list)

    const { result } = renderHook(() => useNotes())

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(mockInvoke).toHaveBeenCalledWith('notes_list')
    expect(result.current.notes).toEqual(list)
  })

  it('sets error when fetch fails', async () => {
    const { useNotes } = await import('../useNotes')
    mockInvoke.mockRejectedValueOnce(new Error('DB error'))

    const { result } = renderHook(() => useNotes())

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe('DB error')
  })

  it('createNote invokes notes_create and prepends to store', async () => {
    const { useNotes } = await import('../useNotes')
    const newNote = makeNote({ id: 'new', title: 'Untitled' })
    mockInvoke.mockResolvedValueOnce([])
    mockInvoke.mockResolvedValueOnce(newNote)

    const { result } = renderHook(() => useNotes())
    await waitFor(() => expect(result.current.loading).toBe(false))

    let created: Note | undefined
    await act(async () => {
      created = await result.current.createNote()
    })

    expect(mockInvoke).toHaveBeenCalledWith('notes_create', { input: { title: 'Untitled', content: '' } })
    expect(created?.id).toBe('new')
    expect(result.current.notes.some((n) => n.id === 'new')).toBe(true)
  })

  it('saveNote invokes notes_update and updates store', async () => {
    const { useNotes } = await import('../useNotes')
    const existing = makeNote({ id: 'n1', title: 'Old' })
    const updated = makeNote({ id: 'n1', title: 'New', updated_at: '2026-04-20T11:00:00Z' })
    mockInvoke.mockResolvedValueOnce([existing])
    mockInvoke.mockResolvedValueOnce(updated)

    const { result } = renderHook(() => useNotes())
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.saveNote('n1', 'New', '<p>New</p>')
    })

    expect(mockInvoke).toHaveBeenCalledWith('notes_update', {
      id: 'n1',
      title: 'New',
      content: '<p>New</p>',
    })
    expect(result.current.notes.find((n) => n.id === 'n1')?.title).toBe('New')
  })

  it('deleteNote invokes notes_delete and removes from store', async () => {
    const { useNotes } = await import('../useNotes')
    const note = makeNote({ id: 'n1' })
    mockInvoke.mockResolvedValueOnce([note])
    mockInvoke.mockResolvedValueOnce(undefined)

    const { result } = renderHook(() => useNotes())
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.deleteNote('n1')
    })

    expect(mockInvoke).toHaveBeenCalledWith('notes_delete', { id: 'n1' })
    expect(result.current.notes.find((n) => n.id === 'n1')).toBeUndefined()
  })

  it('pinNote invokes notes_pin and updates store', async () => {
    const { useNotes } = await import('../useNotes')
    const note = makeNote({ id: 'n1', is_pinned: false })
    mockInvoke.mockResolvedValueOnce([note])
    mockInvoke.mockResolvedValueOnce(undefined)

    const { result } = renderHook(() => useNotes())
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.pinNote('n1', true)
    })

    expect(mockInvoke).toHaveBeenCalledWith('notes_pin', { id: 'n1', pinned: true })
    expect(result.current.notes.find((n) => n.id === 'n1')?.is_pinned).toBe(true)
  })

  it('setNoteTags invokes notes_tags_set and updates store', async () => {
    const { useNotes } = await import('../useNotes')
    const note = makeNote({ id: 'n1', tags: [] })
    mockInvoke.mockResolvedValueOnce([note])
    mockInvoke.mockResolvedValueOnce(undefined)

    const { result } = renderHook(() => useNotes())
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.setNoteTags('n1', ['health', 'checkup'])
    })

    expect(mockInvoke).toHaveBeenCalledWith('notes_tags_set', {
      id: 'n1',
      tags: ['health', 'checkup'],
    })
    expect(result.current.notes.find((n) => n.id === 'n1')?.tags).toEqual(['health', 'checkup'])
  })

  it('getNote invokes notes_get and returns the note', async () => {
    const { useNotes } = await import('../useNotes')
    const note = makeNote({ id: 'n1' })
    mockInvoke.mockResolvedValueOnce([])
    mockInvoke.mockResolvedValueOnce(note)

    const { result } = renderHook(() => useNotes())
    await waitFor(() => expect(result.current.loading).toBe(false))

    let fetched: Note | undefined
    await act(async () => {
      fetched = await result.current.getNote('n1')
    })

    expect(mockInvoke).toHaveBeenCalledWith('notes_get', { id: 'n1' })
    expect(fetched?.id).toBe('n1')
  })
})

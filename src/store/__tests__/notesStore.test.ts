import { describe, it, expect, beforeEach } from 'vitest'
import { useNotesStore, type Note } from '../notesStore'

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
  useNotesStore.setState({ notes: [], loading: false, error: null })
})

describe('useNotesStore', () => {
  it('starts with empty state', () => {
    const { notes, loading, error } = useNotesStore.getState()
    expect(notes).toEqual([])
    expect(loading).toBe(false)
    expect(error).toBeNull()
  })

  it('setNotes replaces the list', () => {
    const list = [makeNote({ id: 'a' }), makeNote({ id: 'b' })]
    useNotesStore.getState().setNotes(list)
    expect(useNotesStore.getState().notes).toHaveLength(2)
    expect(useNotesStore.getState().notes[0]?.id).toBe('a')
  })

  it('setLoading toggles the flag', () => {
    useNotesStore.getState().setLoading(true)
    expect(useNotesStore.getState().loading).toBe(true)
    useNotesStore.getState().setLoading(false)
    expect(useNotesStore.getState().loading).toBe(false)
  })

  it('setError stores and clears error', () => {
    useNotesStore.getState().setError('fail')
    expect(useNotesStore.getState().error).toBe('fail')
    useNotesStore.getState().setError(null)
    expect(useNotesStore.getState().error).toBeNull()
  })

  it('upsertNote prepends a new note', () => {
    useNotesStore.getState().setNotes([makeNote({ id: 'old' })])
    useNotesStore.getState().upsertNote(makeNote({ id: 'new' }))
    const ids = useNotesStore.getState().notes.map((n) => n.id)
    expect(ids).toEqual(['new', 'old'])
  })

  it('upsertNote updates an existing note in place', () => {
    useNotesStore.getState().setNotes([makeNote({ id: 'n1', title: 'Old' })])
    useNotesStore.getState().upsertNote(makeNote({ id: 'n1', title: 'New' }))
    expect(useNotesStore.getState().notes).toHaveLength(1)
    expect(useNotesStore.getState().notes[0]?.title).toBe('New')
  })

  it('upsertNote does not mutate the original array', () => {
    const original = [makeNote({ id: 'n1' })]
    useNotesStore.getState().setNotes(original)
    useNotesStore.getState().upsertNote(makeNote({ id: 'n1', title: 'Changed' }))
    expect(original[0]?.title).toBe('My Note')
  })

  it('removeNote removes by id', () => {
    useNotesStore.getState().setNotes([makeNote({ id: 'a' }), makeNote({ id: 'b' })])
    useNotesStore.getState().removeNote('a')
    expect(useNotesStore.getState().notes.map((n) => n.id)).toEqual(['b'])
  })

  it('removeNote is a no-op for unknown id', () => {
    useNotesStore.getState().setNotes([makeNote({ id: 'a' })])
    useNotesStore.getState().removeNote('z')
    expect(useNotesStore.getState().notes).toHaveLength(1)
  })

  it('updatePinned sets is_pinned for matching note', () => {
    useNotesStore.getState().setNotes([makeNote({ id: 'n1', is_pinned: false })])
    useNotesStore.getState().updatePinned('n1', true)
    expect(useNotesStore.getState().notes[0]?.is_pinned).toBe(true)
  })

  it('updatePinned does not affect other notes', () => {
    useNotesStore.getState().setNotes([
      makeNote({ id: 'n1', is_pinned: false }),
      makeNote({ id: 'n2', is_pinned: false }),
    ])
    useNotesStore.getState().updatePinned('n1', true)
    expect(useNotesStore.getState().notes[1]?.is_pinned).toBe(false)
  })

  it('updateTags replaces tags for matching note', () => {
    useNotesStore.getState().setNotes([makeNote({ id: 'n1', tags: ['old'] })])
    useNotesStore.getState().updateTags('n1', ['new', 'tag'])
    expect(useNotesStore.getState().notes[0]?.tags).toEqual(['new', 'tag'])
  })

  it('updateTags does not affect other notes', () => {
    useNotesStore.getState().setNotes([
      makeNote({ id: 'n1', tags: [] }),
      makeNote({ id: 'n2', tags: ['keep'] }),
    ])
    useNotesStore.getState().updateTags('n1', ['x'])
    expect(useNotesStore.getState().notes[1]?.tags).toEqual(['keep'])
  })
})

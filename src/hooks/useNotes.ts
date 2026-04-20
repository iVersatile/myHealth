import { useCallback, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { Note, useNotesStore } from '../store/notesStore'

export function useNotes() {
  const {
    notes,
    loading,
    error,
    setNotes,
    setLoading,
    setError,
    upsertNote,
    removeNote,
    updatePinned,
    updateTags,
  } = useNotesStore()

  const fetchNotes = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await invoke<Note[]>('notes_list')
      setNotes(result)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [setNotes, setLoading, setError])

  useEffect(() => {
    void fetchNotes()
  }, [fetchNotes])

  async function createNote(): Promise<Note> {
    const note = await invoke<Note>('notes_create', { input: { title: 'Untitled', content: '' } })
    upsertNote(note)
    return note
  }

  async function getNote(id: string): Promise<Note> {
    return invoke<Note>('notes_get', { id })
  }

  async function saveNote(id: string, title: string, content: string): Promise<Note> {
    const note = await invoke<Note>('notes_update', { id, title, content })
    upsertNote(note)
    return note
  }

  async function deleteNote(id: string): Promise<void> {
    await invoke('notes_delete', { id })
    removeNote(id)
  }

  async function pinNote(id: string, pinned: boolean): Promise<void> {
    await invoke('notes_pin', { id, pinned })
    updatePinned(id, pinned)
  }

  async function setNoteTags(id: string, tags: string[]): Promise<void> {
    await invoke('notes_tags_set', { id, tags })
    updateTags(id, tags)
  }

  return {
    notes,
    loading,
    error,
    createNote,
    getNote,
    saveNote,
    deleteNote,
    pinNote,
    setNoteTags,
    refresh: fetchNotes,
  }
}

import { create } from 'zustand'

export interface Note {
  id: string
  title: string
  content: string
  is_pinned: boolean
  created_at: string
  updated_at: string
  tags: string[]
}

interface NotesState {
  notes: Note[]
  loading: boolean
  error: string | null
  setNotes: (notes: Note[]) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  upsertNote: (note: Note) => void
  removeNote: (id: string) => void
  updatePinned: (id: string, is_pinned: boolean) => void
  updateTags: (id: string, tags: string[]) => void
}

export const useNotesStore = create<NotesState>((set) => ({
  notes: [],
  loading: false,
  error: null,

  setNotes: (notes) => set({ notes }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),

  upsertNote: (note) =>
    set((s) => {
      const idx = s.notes.findIndex((n) => n.id === note.id)
      if (idx === -1) return { notes: [note, ...s.notes] }
      const next = [...s.notes]
      next[idx] = note
      return { notes: next }
    }),

  removeNote: (id) => set((s) => ({ notes: s.notes.filter((n) => n.id !== id) })),

  updatePinned: (id, is_pinned) =>
    set((s) => ({
      notes: s.notes.map((n) => (n.id === id ? { ...n, is_pinned } : n)),
    })),

  updateTags: (id, tags) =>
    set((s) => ({
      notes: s.notes.map((n) => (n.id === id ? { ...n, tags } : n)),
    })),
}))

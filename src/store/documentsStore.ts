import { create } from 'zustand'

export interface Document {
  id: string
  filename: string
  file_path: string
  mime_type: string
  file_size_bytes: number
  category: string
  thumbnail_path: string | null
  notes: string | null
  created_at: string
  updated_at: string
  is_deleted: boolean
  document_date: string | null
  activity_date: string | null
  tags: string[]
  clinic_name: string | null
}

export type DocumentCategory =
  | 'all'
  | 'diagnosis'
  | 'lab'
  | 'imaging'
  | 'prescription'
  | 'letter'
  | 'other'

export const DOCUMENT_CATEGORIES: DocumentCategory[] = [
  'all',
  'diagnosis',
  'lab',
  'imaging',
  'prescription',
  'letter',
  'other',
]

export const CATEGORY_LABELS: Record<DocumentCategory, string> = {
  all: 'All',
  diagnosis: 'Diagnosis',
  lab: 'Lab',
  imaging: 'Imaging',
  prescription: 'Prescription',
  letter: 'Letter',
  other: 'Other',
}

const PAGE_LIMIT = 20

interface DocumentsState {
  documents: Document[]
  total: number
  page: number
  limit: number
  category: DocumentCategory
  loading: boolean
  error: string | null
  setDocuments: (docs: Document[], total: number) => void
  setPage: (page: number) => void
  setCategory: (category: DocumentCategory) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  removeDocument: (id: string) => void
}

export const useDocumentsStore = create<DocumentsState>((set) => ({
  documents: [],
  total: 0,
  page: 1,
  limit: PAGE_LIMIT,
  category: 'all',
  loading: false,
  error: null,

  setDocuments: (docs, total) => set({ documents: docs, total }),
  setPage: (page) => set({ page }),
  setCategory: (category) => set({ category, page: 1 }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  removeDocument: (id) =>
    set((s) => ({ documents: s.documents.filter((d) => d.id !== id) })),
}))

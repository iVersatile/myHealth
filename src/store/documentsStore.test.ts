import { describe, it, expect, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import {
  useDocumentsStore,
  DOCUMENT_CATEGORIES,
  CATEGORY_LABELS,
  type Document,
} from './documentsStore'

const makeDoc = (id: string): Document => ({
  id,
  filename: `${id}.pdf`,
  file_path: `/files/${id}.pdf`,
  mime_type: 'application/pdf',
  file_size_bytes: 1024,
  category: 'lab',
  thumbnail_path: null,
  notes: null,
  created_at: '2026-04-14T09:00:00Z',
  updated_at: '2026-04-14T09:00:00Z',
  is_deleted: false,
  document_date: null,
  activity_date: null,
  tags: [],
})

describe('documentsStore', () => {
  beforeEach(() => {
    act(() => {
      useDocumentsStore.setState({
        documents: [],
        total: 0,
        page: 1,
        limit: 20,
        category: 'all',
        loading: false,
        error: null,
      })
    })
  })

  it('has correct initial state', () => {
    const { result } = renderHook(() => useDocumentsStore())
    expect(result.current.documents).toEqual([])
    expect(result.current.total).toBe(0)
    expect(result.current.page).toBe(1)
    expect(result.current.category).toBe('all')
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('setDocuments replaces list and total', () => {
    const { result } = renderHook(() => useDocumentsStore())
    const docs = [makeDoc('a'), makeDoc('b')]
    act(() => result.current.setDocuments(docs, 42))
    expect(result.current.documents).toHaveLength(2)
    expect(result.current.total).toBe(42)
  })

  it('setPage updates page', () => {
    const { result } = renderHook(() => useDocumentsStore())
    act(() => result.current.setPage(3))
    expect(result.current.page).toBe(3)
  })

  it('setCategory resets page to 1', () => {
    const { result } = renderHook(() => useDocumentsStore())
    act(() => {
      result.current.setPage(5)
      result.current.setCategory('lab')
    })
    expect(result.current.category).toBe('lab')
    expect(result.current.page).toBe(1)
  })

  it('removeDocument removes by id immutably', () => {
    const { result } = renderHook(() => useDocumentsStore())
    const docs = [makeDoc('x'), makeDoc('y'), makeDoc('z')]
    act(() => result.current.setDocuments(docs, 3))
    act(() => result.current.removeDocument('y'))
    expect(result.current.documents.map((d) => d.id)).toEqual(['x', 'z'])
  })

  it('setLoading toggles loading flag', () => {
    const { result } = renderHook(() => useDocumentsStore())
    act(() => result.current.setLoading(true))
    expect(result.current.loading).toBe(true)
    act(() => result.current.setLoading(false))
    expect(result.current.loading).toBe(false)
  })

  it('setError stores error string and clears it', () => {
    const { result } = renderHook(() => useDocumentsStore())
    act(() => result.current.setError('something went wrong'))
    expect(result.current.error).toBe('something went wrong')
    act(() => result.current.setError(null))
    expect(result.current.error).toBeNull()
  })
})

describe('DOCUMENT_CATEGORIES', () => {
  it('includes all and lab', () => {
    expect(DOCUMENT_CATEGORIES).toContain('all')
    expect(DOCUMENT_CATEGORIES).toContain('lab')
  })

  it('has a label for every category', () => {
    for (const cat of DOCUMENT_CATEGORIES) {
      expect(CATEGORY_LABELS[cat]).toBeTruthy()
    }
  })
})

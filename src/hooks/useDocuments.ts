import { useCallback, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { useShallow } from 'zustand/shallow'
import {
  Document,
  DocumentCategory,
  useDocumentsStore,
} from '../store/documentsStore'

export function useDocuments() {
  const {
    documents,
    total,
    page,
    limit,
    category,
    loading,
    error,
    setDocuments,
    setPage,
    setCategory,
    setLoading,
    setError,
    removeDocument,
  } = useDocumentsStore(
    useShallow(s => ({
      documents: s.documents,
      total: s.total,
      page: s.page,
      limit: s.limit,
      category: s.category,
      loading: s.loading,
      error: s.error,
      setDocuments: s.setDocuments,
      setPage: s.setPage,
      setCategory: s.setCategory,
      setLoading: s.setLoading,
      setError: s.setError,
      removeDocument: s.removeDocument,
    })),
  )

  const fetchDocuments = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const cat = category === 'all' ? null : category
      const docs = await invoke<Document[]>('documents_list', {
        category: cat,
        page,
        limit,
      })
      const estimatedTotal =
        docs.length < limit ? (page - 1) * limit + docs.length : page * limit + 1
      setDocuments(docs, estimatedTotal)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [category, page, limit, setDocuments, setLoading, setError])

  useEffect(() => {
    void fetchDocuments()
  }, [fetchDocuments])

  async function deleteDocument(id: string): Promise<void> {
    await invoke('documents_delete', { id })
    removeDocument(id)
  }

  function goToPage(next: number): void {
    setPage(next)
  }

  function filterByCategory(cat: DocumentCategory): void {
    setCategory(cat)
  }

  return {
    documents,
    total,
    page,
    limit,
    category,
    loading,
    error,
    deleteDocument,
    goToPage,
    filterByCategory,
    refresh: fetchDocuments,
  }
}

'use client'

import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { useDocuments } from '../../hooks/useDocuments'
import {
  DOCUMENT_CATEGORIES,
  CATEGORY_LABELS,
  DocumentCategory,
} from '../../store/documentsStore'
import { DocumentCard } from './DocumentCard'

interface Category {
  id: string
  name: string
  parent_id: string | null
  color_hex: string
  is_system: boolean
  sort_order: number
}

export function DocumentList() {
  const {
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
  } = useDocuments()

  const totalPages = Math.max(1, Math.ceil(total / limit))

  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [allCategories, setAllCategories] = useState<Category[]>([])
  const [pickedCategoryId, setPickedCategoryId] = useState('')
  const [assigning, setAssigning] = useState(false)
  const [assignError, setAssignError] = useState('')

  useEffect(() => {
    invoke<Category[]>('categories_list').then(setAllCategories).catch(() => {})
  }, [])

  function toggleSelect(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  function toggleSelectAll() {
    const ids = documents.map((d) => d.id)
    const allSelected = ids.every((id) => selectedIds.includes(id))
    setSelectedIds(allSelected ? [] : ids)
  }

  async function handleBulkAssign() {
    if (!pickedCategoryId || selectedIds.length === 0) return
    setAssigning(true)
    setAssignError('')
    try {
      await invoke('categories_bulk_link', {
        userId: '',
        entityType: 'document',
        entityIds: selectedIds,
        categoryId: pickedCategoryId,
      })
      setSelectedIds([])
      setPickedCategoryId('')
    } catch (e) {
      setAssignError(e instanceof Error ? e.message : String(e))
    } finally {
      setAssigning(false)
    }
  }

  const docIds = documents.map((d) => d.id)
  const allPageSelected = docIds.length > 0 && docIds.every((id) => selectedIds.includes(id))

  return (
    <section>
      {/* Category filter chips */}
      <div className="mb-4 flex flex-wrap gap-2">
        {DOCUMENT_CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => filterByCategory(cat as DocumentCategory)}
            className={[
              'rounded-full border px-3 py-1 text-[var(--text-sm)] transition-colors duration-[var(--duration-fast)]',
              category === cat
                ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-text-inverse)]'
                : 'border-[var(--color-border)] bg-[var(--color-surface-raised)] text-[var(--color-text)] hover:bg-[var(--color-surface-sunken)]',
            ].join(' ')}
          >
            {CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>

      {loading && (
        <p className="py-12 text-center text-[var(--text-sm)] text-[var(--color-text-secondary)]">
          Loading…
        </p>
      )}

      {error && !loading && (
        <p className="rounded-[var(--radius-md)] border border-[var(--color-danger)] px-4 py-3 text-[var(--text-sm)] text-[var(--color-danger)]">
          {error}
        </p>
      )}

      {!loading && !error && documents.length === 0 && (
        <p className="py-12 text-center text-[var(--text-sm)] text-[var(--color-text-secondary)]">
          No documents yet. Upload your first document to get started.
        </p>
      )}

      {!loading && documents.length > 0 && (
        <>
          {/* Select-all row */}
          <div className="mb-2 flex items-center gap-2">
            <input
              type="checkbox"
              id="select-all-docs"
              aria-label="Select all documents"
              checked={allPageSelected}
              onChange={toggleSelectAll}
              className="h-4 w-4 cursor-pointer rounded border-[var(--color-border)]"
            />
            <label
              htmlFor="select-all-docs"
              className="cursor-pointer text-[var(--text-sm)] text-[var(--color-text-secondary)]"
            >
              {selectedIds.length > 0 ? `${selectedIds.length} selected` : 'Select all'}
            </label>
          </div>

          <ul className="flex flex-col gap-3">
            {documents.map((doc) => (
              <li key={doc.id} className="flex items-start gap-3">
                <input
                  type="checkbox"
                  aria-label={`Select ${doc.filename}`}
                  checked={selectedIds.includes(doc.id)}
                  onChange={() => toggleSelect(doc.id)}
                  className="mt-4 h-4 w-4 shrink-0 cursor-pointer rounded border-[var(--color-border)]"
                />
                <div className="min-w-0 flex-1">
                  <DocumentCard document={doc} onDelete={deleteDocument} />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {/* Bulk-assign action bar */}
      {selectedIds.length > 0 && (
        <div
          role="toolbar"
          aria-label="Bulk actions"
          className="sticky bottom-4 mt-4 flex flex-wrap items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--color-primary)] bg-[var(--color-surface-raised)] px-4 py-3 shadow-[var(--shadow-lg)]"
        >
          <span className="text-[var(--text-sm)] font-medium text-[var(--color-text)]">
            {selectedIds.length} document{selectedIds.length !== 1 ? 's' : ''} selected
          </span>
          <select
            aria-label="Choose category to assign"
            value={pickedCategoryId}
            onChange={(e) => setPickedCategoryId(e.target.value)}
            className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-[var(--text-sm)] text-[var(--color-text)]"
          >
            <option value="">— pick a category —</option>
            {allCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!pickedCategoryId || assigning}
            onClick={handleBulkAssign}
            className="rounded-[var(--radius-sm)] bg-[var(--color-primary)] px-4 py-1 text-[var(--text-sm)] font-medium text-[var(--color-text-inverse)] disabled:opacity-40"
          >
            {assigning ? 'Assigning…' : 'Assign Category'}
          </button>
          <button
            type="button"
            onClick={() => setSelectedIds([])}
            className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-1 text-[var(--text-sm)] text-[var(--color-text)] hover:bg-[var(--color-surface-sunken)]"
          >
            Cancel
          </button>
          {assignError && (
            <span className="text-[var(--text-sm)] text-[var(--color-danger)]">{assignError}</span>
          )}
        </div>
      )}

      {totalPages > 1 && (
        <nav
          aria-label="Document pages"
          className="mt-6 flex items-center justify-center gap-4"
        >
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => goToPage(page - 1)}
            aria-label="Previous page"
            className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-1 text-[var(--text-sm)] text-[var(--color-text)] disabled:opacity-40"
          >
            ◀
          </button>
          <span className="text-[var(--text-sm)] text-[var(--color-text-secondary)]">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => goToPage(page + 1)}
            aria-label="Next page"
            className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-1 text-[var(--text-sm)] text-[var(--color-text)] disabled:opacity-40"
          >
            ▶
          </button>
        </nav>
      )}
    </section>
  )
}

'use client'

import { useState, useEffect, useRef } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { useDocuments } from '../../hooks/useDocuments'
import { Document } from '../../store/documentsStore'
import { DocumentCard } from './DocumentCard'

interface Category {
  id: string
  name: string
  parent_id: string | null
  color_hex: string
  is_system: boolean
  sort_order: number
}

interface FilteredResult {
  items: Document[]
  total: number
}

const FILTER_PAGE_SIZE = 50

export function DocumentList() {
  const {
    documents,
    total,
    page,
    limit,
    loading,
    error,
    deleteDocument,
    goToPage,
  } = useDocuments()

  const totalPages = Math.max(1, Math.ceil(total / limit))

  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [allCategories, setAllCategories] = useState<Category[]>([])
  const [pickedCategoryId, setPickedCategoryId] = useState('')
  const [assigning, setAssigning] = useState(false)
  const [assignError, setAssignError] = useState('')

  // Filter state
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [filterCatIds, setFilterCatIds] = useState<string[]>([])
  const [filteredResult, setFilteredResult] = useState<FilteredResult | null>(null)
  const [filterPage, setFilterPage] = useState(0)
  const [filterLoading, setFilterLoading] = useState(false)
  const [filterError, setFilterError] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const hasFilter = dateFrom !== '' || dateTo !== '' || filterCatIds.length > 0

  useEffect(() => {
    invoke<Category[]>('categories_list').then(setAllCategories).catch(() => {})
  }, [])

  // Reset filter page when criteria change
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFilterPage(0)
  }, [dateFrom, dateTo, filterCatIds])

  // Debounced filter effect
  useEffect(() => {
    if (!hasFilter) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFilteredResult(null)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFilterError('')
      return
    }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setFilterLoading(true)
      setFilterError('')
      invoke<FilteredResult>('documents_search_filtered', {
        query: null,
        dateFrom: dateFrom || null,
        dateTo: dateTo || null,
        categoryIds: filterCatIds.length > 0 ? filterCatIds : null,
        page: filterPage,
        limit: FILTER_PAGE_SIZE,
      })
        .then((res) => setFilteredResult(res))
        .catch((e) => setFilterError(e instanceof Error ? e.message : String(e)))
        .finally(() => setFilterLoading(false))
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [hasFilter, dateFrom, dateTo, filterCatIds, filterPage])

  function clearFilters() {
    setDateFrom('')
    setDateTo('')
    setFilterCatIds([])
    setFilteredResult(null)
    setFilterPage(0)
    setFilterError('')
  }

  function toggleFilterCat(id: string) {
    setFilterCatIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  const displayDocs = hasFilter ? (filteredResult?.items ?? []) : documents
  const displayTotal = hasFilter ? (filteredResult?.total ?? 0) : total
  const displayLoading = hasFilter ? filterLoading : loading
  const displayError = hasFilter ? filterError : error

  function toggleSelect(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  function toggleSelectAll() {
    const ids = displayDocs.map((d) => d.id)
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

  const docIds = displayDocs.map((d) => d.id)
  const allPageSelected = docIds.length > 0 && docIds.every((id) => selectedIds.includes(id))

  const filterTotalPages = Math.max(1, Math.ceil((filteredResult?.total ?? 0) / FILTER_PAGE_SIZE))

  return (
    <section>
      {/* Filter bar */}
      <div className="mb-4 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label
              htmlFor="filter-date-from"
              className="text-[var(--text-xs)] text-[var(--color-text-secondary)]"
            >
              From
            </label>
            <input
              id="filter-date-from"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-[var(--text-sm)] text-[var(--color-text)]"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label
              htmlFor="filter-date-to"
              className="text-[var(--text-xs)] text-[var(--color-text-secondary)]"
            >
              To
            </label>
            <input
              id="filter-date-to"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-[var(--text-sm)] text-[var(--color-text)]"
            />
          </div>
          {hasFilter && (
            <button
              type="button"
              onClick={clearFilters}
              className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-1 text-[var(--text-sm)] text-[var(--color-text)] hover:bg-[var(--color-surface-sunken)]"
            >
              Clear
            </button>
          )}
        </div>

        {allCategories.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {allCategories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => toggleFilterCat(cat.id)}
                className={[
                  'rounded-full border px-3 py-1 text-[var(--text-sm)] transition-colors duration-[var(--duration-fast)]',
                  filterCatIds.includes(cat.id)
                    ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-text-inverse)]'
                    : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] hover:bg-[var(--color-surface-sunken)]',
                ].join(' ')}
              >
                {cat.name}
              </button>
            ))}
          </div>
        )}

        {hasFilter && !filterLoading && (
          <p className="mt-2 text-[var(--text-xs)] text-[var(--color-text-secondary)]">
            {displayTotal} result{displayTotal !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {displayLoading && (
        <p className="py-12 text-center text-[var(--text-sm)] text-[var(--color-text-secondary)]">
          Loading…
        </p>
      )}

      {displayError && !displayLoading && (
        <p className="rounded-[var(--radius-md)] border border-[var(--color-danger)] px-4 py-3 text-[var(--text-sm)] text-[var(--color-danger)]">
          {displayError}
        </p>
      )}

      {!displayLoading && !displayError && displayDocs.length === 0 && (
        <p className="py-12 text-center text-[var(--text-sm)] text-[var(--color-text-secondary)]">
          {hasFilter
            ? 'No documents match the current filters.'
            : 'No documents yet. Upload your first document to get started.'}
        </p>
      )}

      {!displayLoading && displayDocs.length > 0 && (
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
            {displayDocs.map((doc) => (
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

      {/* Pagination */}
      {hasFilter ? (
        filterTotalPages > 1 && (
          <nav
            aria-label="Filter result pages"
            className="mt-6 flex items-center justify-center gap-4"
          >
            <button
              type="button"
              disabled={filterPage <= 0}
              onClick={() => setFilterPage((p) => p - 1)}
              aria-label="Previous page"
              className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-1 text-[var(--text-sm)] text-[var(--color-text)] disabled:opacity-40"
            >
              ◀
            </button>
            <span className="text-[var(--text-sm)] text-[var(--color-text-secondary)]">
              Page {filterPage + 1} of {filterTotalPages}
            </span>
            <button
              type="button"
              disabled={filterPage >= filterTotalPages - 1}
              onClick={() => setFilterPage((p) => p + 1)}
              aria-label="Next page"
              className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-1 text-[var(--text-sm)] text-[var(--color-text)] disabled:opacity-40"
            >
              ▶
            </button>
          </nav>
        )
      ) : (
        totalPages > 1 && (
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
        )
      )}
    </section>
  )
}

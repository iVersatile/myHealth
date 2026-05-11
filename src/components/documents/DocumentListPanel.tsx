'use client'

import { useState, useEffect, useRef } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { Virtuoso } from 'react-virtuoso'
import { Document } from '../../store/documentsStore'

interface Category {
  id: string
  name: string
}

interface FilteredResult {
  items: Document[]
  total: number
}

interface DocumentListPanelProps {
  documents: Document[]
  selectedId?: string | null
  onSelect?: (doc: Document) => void
}

const MIME_ICON: Record<string, string> = {
  'application/pdf': 'PDF',
  'image/jpeg': 'IMG',
  'image/png': 'IMG',
  'image/webp': 'IMG',
  'image/heic': 'IMG',
  'image/tiff': 'IMG',
}

const CATEGORY_LABELS: Record<string, string> = {
  diagnosis: 'Diagnosis',
  lab: 'Lab',
  imaging: 'Imaging',
  prescription: 'Rx',
  letter: 'Letter',
  other: 'Other',
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

interface RowProps {
  doc: Document
  selected: boolean
  onSelect: (doc: Document) => void
}

function DocumentRow({ doc, selected, onSelect }: RowProps) {
  const typeLabel = MIME_ICON[doc.mime_type] ?? 'FILE'
  const catLabel = CATEGORY_LABELS[doc.category] ?? doc.category
  const date = formatDate(doc.document_date ?? doc.activity_date ?? doc.created_at)
  const flagged = doc.tags.includes('flagged')

  return (
    <button
      type="button"
      data-testid="document-row"
      onClick={() => onSelect(doc)}
      style={{
        height: 56,
        borderLeft: selected ? '2px solid #F0A500' : '2px solid transparent',
        backgroundColor: selected ? '#1C2128' : flagged ? 'rgba(240,165,0,0.08)' : 'transparent',
      }}
      className="flex w-full items-center gap-3 px-3 text-left transition-colors hover:bg-[var(--color-surface-raised)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F0A500]"
    >
      {/* Type badge */}
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--color-surface-sunken)] text-[10px] font-semibold tracking-wide text-[var(--color-text-secondary)]">
        {typeLabel}
      </span>

      {/* Title + date */}
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1">
          {flagged && (
            <span aria-label="Flagged" className="shrink-0 text-[#F0A500]">
              ⚑
            </span>
          )}
          <span className="block truncate text-[var(--text-sm)] font-medium text-[var(--color-text)]">
            {doc.filename}
          </span>
        </span>
        <span className="text-[var(--text-xs)] text-[var(--color-text-secondary)]">{date}</span>
      </span>

      {/* Category pill */}
      <span className="shrink-0 rounded-full bg-[var(--color-surface-sunken)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-text-secondary)]">
        {catLabel}
      </span>
    </button>
  )
}

export function DocumentListPanel({
  documents,
  selectedId,
  onSelect,
}: DocumentListPanelProps) {
  const handleSelect = onSelect ?? (() => {})

  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [categories, setCategories] = useState<Category[]>([])
  const [filteredDocs, setFilteredDocs] = useState<Document[] | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    invoke<Category[]>('categories_list').then(setCategories).catch(() => {})
  }, [])

  const hasFilter = search !== '' || categoryId !== '' || dateFrom !== '' || dateTo !== ''

  useEffect(() => {
    if (!hasFilter) {
      const id = setTimeout(() => setFilteredDocs(null), 0)
      return () => clearTimeout(id)
    }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      invoke<FilteredResult>('documents_search_filtered', {
        query: search || null,
        dateFrom: dateFrom || null,
        dateTo: dateTo || null,
        categoryIds: categoryId ? [categoryId] : null,
        page: 0,
        limit: 1000,
      })
        .then((res) => setFilteredDocs(res.items))
        .catch(() => {})
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [hasFilter, search, categoryId, dateFrom, dateTo])

  const displayDocs = hasFilter ? (filteredDocs ?? []) : documents

  return (
    <div
      data-testid="document-list-panel"
      className="flex h-full flex-col bg-[var(--color-surface)]"
    >
      {/* Filter bar */}
      <div
        data-testid="filter-bar"
        className="flex shrink-0 flex-wrap items-center gap-2 border-b border-[var(--color-border)] px-3 py-2"
      >
        <input
          type="search"
          placeholder="Search…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          data-testid="filter-search"
          className="h-8 min-w-0 flex-1 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-sunken)] px-2 text-[var(--text-sm)] text-[var(--color-text)] placeholder:text-[var(--color-text-secondary)] focus:outline-none focus:ring-1 focus:ring-[#F0A500]"
        />
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          data-testid="filter-category"
          className="h-8 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-sunken)] px-2 text-[var(--text-sm)] text-[var(--color-text)] focus:outline-none focus:ring-1 focus:ring-[#F0A500]"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          data-testid="filter-date-from"
          aria-label="From date"
          className="h-8 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-sunken)] px-2 text-[var(--text-sm)] text-[var(--color-text)] focus:outline-none focus:ring-1 focus:ring-[#F0A500]"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          data-testid="filter-date-to"
          aria-label="To date"
          className="h-8 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-sunken)] px-2 text-[var(--text-sm)] text-[var(--color-text)] focus:outline-none focus:ring-1 focus:ring-[#F0A500]"
        />
      </div>

      <Virtuoso
        data={displayDocs}
        fixedItemHeight={56}
        itemContent={(_index, doc) => (
          <DocumentRow
            key={doc.id}
            doc={doc}
            selected={selectedId === doc.id}
            onSelect={handleSelect}
          />
        )}
      />
    </div>
  )
}

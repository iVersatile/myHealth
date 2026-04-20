'use client'

import { useDocuments } from '../../hooks/useDocuments'
import {
  DOCUMENT_CATEGORIES,
  CATEGORY_LABELS,
  DocumentCategory,
} from '../../store/documentsStore'
import { DocumentCard } from './DocumentCard'

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
        <ul className="flex flex-col gap-3">
          {documents.map((doc) => (
            <li key={doc.id}>
              <DocumentCard document={doc} onDelete={deleteDocument} />
            </li>
          ))}
        </ul>
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

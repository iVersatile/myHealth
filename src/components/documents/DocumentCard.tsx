import Link from 'next/link'
import { Document } from '../../store/documentsStore'

interface DocumentCardProps {
  document: Document
  onDelete: (id: string) => void
}

const CATEGORY_LABELS: Record<string, string> = {
  diagnosis: 'Diagnosis',
  lab: 'Lab Result',
  imaging: 'Imaging',
  prescription: 'Prescription',
  letter: 'Letter',
  other: 'Other',
}

const MIME_ICON: Record<string, string> = {
  'application/pdf': 'PDF',
  'image/jpeg': 'IMG',
  'image/png': 'IMG',
  'image/webp': 'IMG',
  'image/heic': 'IMG',
  'image/tiff': 'IMG',
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function DocumentCard({ document: doc, onDelete }: DocumentCardProps) {
  const typeLabel = MIME_ICON[doc.mime_type] ?? 'FILE'
  const catLabel = CATEGORY_LABELS[doc.category] ?? doc.category

  return (
    <article className="flex items-start gap-4 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-4 shadow-[var(--shadow-sm)] transition-shadow duration-[var(--duration-fast)] hover:shadow-[var(--shadow-md)]">
      {/* Thumbnail / type badge */}
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-surface-sunken)] text-[var(--text-xs)] font-semibold tracking-wide text-[var(--color-text-secondary)]">
        {doc.thumbnail_path ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`asset://localhost/${doc.thumbnail_path}`}
            alt=""
            className="h-12 w-12 rounded-[var(--radius-md)] object-cover"
          />
        ) : (
          <span>{typeLabel}</span>
        )}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[var(--text-base)] font-medium text-[var(--color-text)]">
          {doc.filename}
        </p>
        <p className="mt-0.5 text-[var(--text-sm)] text-[var(--color-text-secondary)]">
          {catLabel} · {formatBytes(doc.file_size_bytes)} · {formatDate(doc.created_at)}
        </p>
        {doc.tags.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-1">
            {doc.tags.map((tag) => (
              <li
                key={tag}
                className="rounded-full bg-[var(--color-surface-sunken)] px-2 py-0.5 text-[var(--text-xs)] text-[var(--color-text-secondary)]"
              >
                #{tag}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-2">
        <Link
          href={`/documents/view?id=${doc.id}`}
          className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-1 text-[var(--text-sm)] text-[var(--color-text)] transition-colors duration-[var(--duration-fast)] hover:bg-[var(--color-surface-sunken)]"
        >
          View
        </Link>
        <Link
          href={`/documents/view?id=${doc.id}&edit=1`}
          className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-1 text-[var(--text-sm)] text-[var(--color-text)] transition-colors duration-[var(--duration-fast)] hover:bg-[var(--color-surface-sunken)]"
        >
          Edit
        </Link>
        <button
          type="button"
          aria-label={`Delete ${doc.filename}`}
          onClick={() => onDelete(doc.id)}
          className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-2 py-1 text-[var(--text-sm)] text-[var(--color-danger)] transition-colors duration-[var(--duration-fast)] hover:bg-[var(--color-surface-sunken)]"
        >
          ✕
        </button>
      </div>
    </article>
  )
}

'use client'

import { useState } from 'react'
import { useExport } from '../../hooks/useExport'
import { useDocumentsStore, CATEGORY_LABELS, type DocumentCategory } from '../../store/documentsStore'

interface ExportDialogProps {
  onClose: () => void
}

export function ExportDialog({ onClose }: ExportDialogProps) {
  const { documents } = useDocumentsStore()
  const { exporting, error, exportBundle, pickOutputPath } = useExport()

  const today = new Date().toLocaleDateString('en-GB', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  const [title, setTitle] = useState(`Health Records — ${today}`)
  const [outputPath, setOutputPath] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [done, setDone] = useState(false)

  function toggleDoc(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (selected.size === documents.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(documents.map((d) => d.id)))
    }
  }

  async function handlePickPath() {
    const defaultName = title
      .replace(/[^a-zA-Z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .toLowerCase()
    const path = await pickOutputPath(`${defaultName}.pdf`)
    if (path) setOutputPath(path)
  }

  async function handleExport() {
    if (selected.size === 0 || !outputPath || !title.trim()) return
    const success = await exportBundle([...selected], title.trim(), outputPath)
    if (success) setDone(true)
  }

  const canExport =
    selected.size > 0 && outputPath.trim().length > 0 && title.trim().length > 0

  const inputCls =
    'w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-3 py-2 text-[var(--text-sm)] text-[var(--color-text)] placeholder:text-[var(--color-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]'

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center"
    >
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative z-10 w-full max-w-lg rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-lg)]">
        <div className="mb-5 flex items-center justify-between">
          <h2
            id="export-dialog-title"
            className="text-[var(--text-lg)] font-semibold text-[var(--color-text)]"
          >
            Export PDF Bundle
          </h2>
          <button
            type="button"
            aria-label="Close dialog"
            onClick={onClose}
            className="rounded-[var(--radius-sm)] p-1 text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-sunken)]"
          >
            ✕
          </button>
        </div>

        {done ? (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <span className="text-4xl">✓</span>
            <p className="text-[var(--text-sm)] text-[var(--color-text)]">
              PDF exported successfully.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="rounded-[var(--radius-md)] bg-[var(--color-primary)] px-6 py-2 text-[var(--text-sm)] font-medium text-[var(--color-text-inverse)] hover:bg-[var(--color-primary-hover)]"
            >
              Done
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {/* Title */}
            <div className="flex flex-col gap-1">
              <label
                htmlFor="export-title"
                className="text-[var(--text-sm)] font-medium text-[var(--color-text)]"
              >
                Bundle Title
              </label>
              <input
                id="export-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={inputCls}
              />
            </div>

            {/* Document list */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-[var(--text-sm)] font-medium text-[var(--color-text)]">
                  Select Documents{' '}
                  <span className="font-normal text-[var(--color-text-secondary)]">
                    ({selected.size} selected)
                  </span>
                </span>
                <button
                  type="button"
                  onClick={toggleAll}
                  className="text-[var(--text-xs)] text-[var(--color-primary)] hover:underline"
                >
                  {selected.size === documents.length ? 'Deselect all' : 'Select all'}
                </button>
              </div>

              <div className="max-h-48 overflow-y-auto rounded-[var(--radius-md)] border border-[var(--color-border)]">
                {documents.length === 0 ? (
                  <p className="px-3 py-4 text-center text-[var(--text-sm)] text-[var(--color-text-secondary)]">
                    No documents available.
                  </p>
                ) : (
                  <ul>
                    {documents.map((doc, idx) => (
                      <li
                        key={doc.id}
                        className={[
                          'flex items-center gap-3 px-3 py-2.5 text-[var(--text-sm)]',
                          idx !== documents.length - 1
                            ? 'border-b border-[var(--color-border)]'
                            : '',
                        ].join(' ')}
                      >
                        <input
                          type="checkbox"
                          id={`export-doc-${doc.id}`}
                          checked={selected.has(doc.id)}
                          onChange={() => toggleDoc(doc.id)}
                          className="h-4 w-4 rounded accent-[var(--color-primary)]"
                        />
                        <label
                          htmlFor={`export-doc-${doc.id}`}
                          className="flex-1 cursor-pointer text-[var(--color-text)]"
                        >
                          {doc.filename}
                          <span className="ml-2 text-[var(--text-xs)] text-[var(--color-text-secondary)]">
                            — {CATEGORY_LABELS[doc.category as DocumentCategory] ?? doc.category}
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* Output path */}
            <div className="flex flex-col gap-1">
              <label
                htmlFor="export-path"
                className="text-[var(--text-sm)] font-medium text-[var(--color-text)]"
              >
                Save to
              </label>
              <div className="flex gap-2">
                <input
                  id="export-path"
                  type="text"
                  readOnly
                  value={outputPath}
                  placeholder="Click Browse to choose location…"
                  className={inputCls + ' cursor-default'}
                />
                <button
                  type="button"
                  onClick={() => void handlePickPath()}
                  className="shrink-0 rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2 text-[var(--text-sm)] text-[var(--color-text)] hover:bg-[var(--color-surface-sunken)]"
                  aria-label="Browse for output location"
                >
                  📁
                </button>
              </div>
            </div>

            {error && (
              <p className="rounded-[var(--radius-md)] border border-[var(--color-danger)] px-3 py-2 text-[var(--text-sm)] text-[var(--color-danger)]">
                {error}
              </p>
            )}

            <div className="flex justify-end gap-3 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-4 py-2 text-[var(--text-sm)] text-[var(--color-text)] transition-colors duration-[var(--duration-fast)] hover:bg-[var(--color-surface-sunken)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleExport()}
                disabled={!canExport || exporting}
                className="rounded-[var(--radius-md)] bg-[var(--color-primary)] px-4 py-2 text-[var(--text-sm)] font-medium text-[var(--color-text-inverse)] transition-colors duration-[var(--duration-fast)] hover:bg-[var(--color-primary-hover)] disabled:opacity-40"
              >
                {exporting ? 'Exporting…' : 'Export PDF'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

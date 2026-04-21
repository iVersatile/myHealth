'use client'

import { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import { Document, DocumentCategory, DOCUMENT_CATEGORIES, CATEGORY_LABELS } from '../../store/documentsStore'
import { CategoryPicker, Category } from '../categories/CategoryPicker'

interface UploadDialogProps {
  onClose: () => void
  onUploaded: (doc: Document) => void
}

export function UploadDialog({ onClose, onUploaded }: UploadDialogProps) {
  const [filePath, setFilePath] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string>('')
  const [category, setCategory] = useState<DocumentCategory>('lab')
  const [tagsRaw, setTagsRaw] = useState('')
  const [notes, setNotes] = useState('')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [allCategories, setAllCategories] = useState<Category[]>([])
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([])

  useEffect(() => {
    invoke<Array<{ id: string; name: string; parent_id: string | null; color_hex: string; is_system: boolean; sort_order: number }>>('categories_list')
      .then((rows) =>
        setAllCategories(
          rows.map((r) => ({
            id: r.id,
            name: r.name,
            parentId: r.parent_id,
            colorHex: r.color_hex,
            isSystem: r.is_system,
            sortOrder: r.sort_order,
          }))
        )
      )
      .catch(() => {})
  }, [])

  async function pickFile() {
    const selected = await open({
      multiple: false,
      filters: [
        { name: 'Documents', extensions: ['pdf', 'jpg', 'jpeg', 'png', 'webp', 'heic', 'tiff'] },
      ],
    })
    if (typeof selected === 'string') {
      setFilePath(selected)
      setFileName(selected.split('/').pop() ?? selected)
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    setDragging(true)
  }

  function handleDragLeave() {
    setDragging(false)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (!file) return
    const nativePath = (file as File & { path?: string }).path
    if (nativePath) {
      setFilePath(nativePath)
      setFileName(file.name)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!filePath) {
      setError('Please select a file.')
      return
    }
    setUploading(true)
    setError(null)
    try {
      const doc = await invoke<Document>('documents_upload', {
        filePath,
        category,
        notes: notes.trim() || null,
      })
      const tags = tagsRaw
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
      if (tags.length > 0) {
        await invoke('documents_tags_set', { id: doc.id, tags })
        onUploaded({ ...doc, tags })
      } else {
        onUploaded(doc)
      }
      if (selectedCategoryIds.length > 0) {
        await Promise.all(
          selectedCategoryIds.map((categoryId) =>
            invoke('categories_assign_document', { documentId: doc.id, categoryId })
          )
        )
      }
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setUploading(false)
    }
  }

  const categories = DOCUMENT_CATEGORIES.filter((c) => c !== 'all')

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="upload-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-md rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-lg)]">
        <div className="mb-5 flex items-center justify-between">
          <h2
            id="upload-dialog-title"
            className="text-[var(--text-lg)] font-semibold text-[var(--color-text)]"
          >
            Upload Document
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

        <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4">
          {/* Drop zone */}
          <button
            type="button"
            onClick={() => void pickFile()}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={[
              'flex flex-col items-center justify-center gap-2 rounded-[var(--radius-lg)] border-2 border-dashed px-4 py-8 text-center transition-colors duration-[var(--duration-fast)]',
              dragging
                ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5'
                : 'border-[var(--color-border)] hover:border-[var(--color-primary)] hover:bg-[var(--color-surface-sunken)]',
            ].join(' ')}
          >
            <span className="text-2xl">↑</span>
            {filePath ? (
              <span className="text-[var(--text-sm)] font-medium text-[var(--color-text)]">
                {fileName}
              </span>
            ) : (
              <>
                <span className="text-[var(--text-sm)] font-medium text-[var(--color-text)]">
                  Drop file here or click to browse
                </span>
                <span className="text-[var(--text-xs)] text-[var(--color-text-secondary)]">
                  PDF, JPG, PNG, HEIC, TIFF, WebP
                </span>
              </>
            )}
          </button>

          {/* Category */}
          <div className="flex flex-col gap-1">
            <label
              htmlFor="upload-category"
              className="text-[var(--text-sm)] font-medium text-[var(--color-text)]"
            >
              Category
            </label>
            <select
              id="upload-category"
              value={category}
              onChange={(e) => setCategory(e.target.value as DocumentCategory)}
              className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-3 py-2 text-[var(--text-sm)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {CATEGORY_LABELS[cat]}
                </option>
              ))}
            </select>
          </div>

          {/* Medical Categories */}
          {allCategories.length > 0 && (
            <div className="flex flex-col gap-1">
              <label className="text-[var(--text-sm)] font-medium text-[var(--color-text)]">
                Medical Categories{' '}
                <span className="font-normal text-[var(--color-text-secondary)]">(optional)</span>
              </label>
              <CategoryPicker
                categories={allCategories}
                selectedIds={selectedCategoryIds}
                onChange={setSelectedCategoryIds}
              />
            </div>
          )}

          {/* Tags */}
          <div className="flex flex-col gap-1">
            <label
              htmlFor="upload-tags"
              className="text-[var(--text-sm)] font-medium text-[var(--color-text)]"
            >
              Tags{' '}
              <span className="font-normal text-[var(--color-text-secondary)]">
                (comma-separated)
              </span>
            </label>
            <input
              id="upload-tags"
              type="text"
              value={tagsRaw}
              onChange={(e) => setTagsRaw(e.target.value)}
              placeholder="e.g. blood test, annual, Dr. Smith"
              className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-3 py-2 text-[var(--text-sm)] text-[var(--color-text)] placeholder:text-[var(--color-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            />
          </div>

          {/* Notes */}
          <div className="flex flex-col gap-1">
            <label
              htmlFor="upload-notes"
              className="text-[var(--text-sm)] font-medium text-[var(--color-text)]"
            >
              Notes{' '}
              <span className="font-normal text-[var(--color-text-secondary)]">(optional)</span>
            </label>
            <textarea
              id="upload-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional context…"
              className="resize-none rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-3 py-2 text-[var(--text-sm)] text-[var(--color-text)] placeholder:text-[var(--color-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            />
          </div>

          {error && (
            <p className="rounded-[var(--radius-md)] border border-[var(--color-danger)] px-3 py-2 text-[var(--text-sm)] text-[var(--color-danger)]">
              {error}
            </p>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-4 py-2 text-[var(--text-sm)] text-[var(--color-text)] transition-colors duration-[var(--duration-fast)] hover:bg-[var(--color-surface-sunken)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={uploading || !filePath}
              className="rounded-[var(--radius-md)] bg-[var(--color-primary)] px-4 py-2 text-[var(--text-sm)] font-medium text-[var(--color-text-inverse)] transition-colors duration-[var(--duration-fast)] hover:bg-[var(--color-primary-hover)] disabled:opacity-40"
            >
              {uploading ? 'Uploading…' : 'Upload'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { invoke } from '@tauri-apps/api/core'
import { Document, CATEGORY_LABELS } from '../../../../store/documentsStore'
import { CategoryPicker, type Category } from '../../../../components/categories/CategoryPicker'

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function DocumentDetailClient() {
  const searchParams = useSearchParams()
  const id = searchParams.get('id') ?? ''
  const router = useRouter()

  const [doc, setDoc] = useState<Document | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [tags, setTags] = useState<string[]>([])
  const [newTag, setNewTag] = useState('')
  const [notes, setNotes] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)
  const [notesSaved, setNotesSaved] = useState(false)
  const [savingTags, setSavingTags] = useState(false)

  const [allCategories, setAllCategories] = useState<Category[]>([])
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([])

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const [fetched, catRows, assignedIds] = await Promise.all([
          invoke<Document>('documents_get', { id }),
          invoke<
            Array<{
              id: string
              name: string
              parent_id: string | null
              color_hex: string
              is_system: boolean
              sort_order: number
            }>
          >('categories_list'),
          invoke<string[]>('categories_for_document', { documentId: id }),
        ])
        setDoc(fetched)
        setTags(fetched.tags)
        setNotes(fetched.notes ?? '')
        setAllCategories(
          catRows.map((r) => ({
            id: r.id,
            name: r.name,
            parentId: r.parent_id,
            colorHex: r.color_hex,
            isSystem: r.is_system,
            sortOrder: r.sort_order,
          }))
        )
        setSelectedCategoryIds(assignedIds)
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [id])

  async function handleSaveNotes() {
    if (!doc) return
    setSavingNotes(true)
    try {
      await invoke('documents_update', { id: doc.id, notes: notes.trim() || null })
      setNotesSaved(true)
      setTimeout(() => setNotesSaved(false), 2000)
    } finally {
      setSavingNotes(false)
    }
  }

  async function handleAddTag() {
    const tag = newTag.trim()
    if (!tag || !doc || tags.includes(tag)) return
    const next = [...tags, tag]
    setSavingTags(true)
    try {
      await invoke('documents_tags_set', { id: doc.id, tags: next })
      setTags(next)
      setNewTag('')
    } finally {
      setSavingTags(false)
    }
  }

  async function handleRemoveTag(tag: string) {
    if (!doc) return
    const next = tags.filter((t) => t !== tag)
    setSavingTags(true)
    try {
      await invoke('documents_tags_set', { id: doc.id, tags: next })
      setTags(next)
    } finally {
      setSavingTags(false)
    }
  }

  async function handleCategoryChange(nextIds: string[]) {
    if (!doc) return
    const toAdd = nextIds.filter((id) => !selectedCategoryIds.includes(id))
    const toRemove = selectedCategoryIds.filter((id) => !nextIds.includes(id))
    try {
      await Promise.all([
        ...toAdd.map((categoryId) =>
          invoke('categories_assign_document', { documentId: doc.id, categoryId })
        ),
        ...toRemove.map((categoryId) =>
          invoke('categories_unassign', { entityId: doc.id, categoryId, entityType: 'document' })
        ),
      ])
      setSelectedCategoryIds(nextIds)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function handleDelete() {
    if (!doc) return
    if (!window.confirm(`Delete "${doc.filename}"? This can be undone from the trash.`)) return
    await invoke('documents_delete', { id: doc.id })
    router.push('/documents')
  }

  async function openInFinder() {
    if (!doc) return
    await invoke('documents_get_file_url', { id: doc.id })
  }

  if (loading) {
    return (
      <p className="py-16 text-center text-[var(--text-sm)] text-[var(--color-text-secondary)]">
        Loading…
      </p>
    )
  }

  if (error || !doc) {
    return (
      <p className="rounded-[var(--radius-md)] border border-[var(--color-danger)] px-4 py-3 text-[var(--text-sm)] text-[var(--color-danger)]">
        {error ?? 'Document not found.'}
      </p>
    )
  }

  const isPdf = doc.mime_type === 'application/pdf'
  const isImage = doc.mime_type.startsWith('image/')
  const assetUrl = `asset://localhost/${doc.file_path}`
  const catLabel = CATEGORY_LABELS[doc.category as keyof typeof CATEGORY_LABELS] ?? doc.category

  return (
    <div>
      <div className="mb-5 flex items-center gap-2 text-[var(--text-sm)] text-[var(--color-text-secondary)]">
        <Link href="/documents" className="hover:text-[var(--color-text)]">
          ◀ Documents
        </Link>
        <span>/</span>
        <span className="truncate text-[var(--color-text)]">{doc.filename}</span>
      </div>

      <div className="flex gap-6">
        <div className="flex min-h-[480px] flex-1 flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-raised)]">
          {isPdf && (
            <iframe
              src={assetUrl}
              title={doc.filename}
              className="h-[600px] w-full rounded-[var(--radius-lg)]"
            />
          )}
          {isImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={assetUrl}
              alt={doc.filename}
              className="h-full max-h-[600px] w-full rounded-[var(--radius-lg)] object-contain"
            />
          )}
          {!isPdf && !isImage && (
            <div className="flex flex-1 items-center justify-center p-8 text-[var(--color-text-secondary)]">
              <p className="text-[var(--text-sm)]">Preview not available for this file type.</p>
            </div>
          )}
          <div className="border-t border-[var(--color-border)] px-4 py-3">
            <button
              type="button"
              onClick={() => void openInFinder()}
              className="text-[var(--text-sm)] text-[var(--color-primary)] hover:underline"
            >
              ↓ Open in Finder
            </button>
          </div>
        </div>

        <aside className="w-64 shrink-0 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-5">
          <h2 className="mb-4 text-[var(--text-base)] font-semibold text-[var(--color-text)]">
            Details
          </h2>
          <dl className="flex flex-col gap-3 text-[var(--text-sm)]">
            <div>
              <dt className="text-[var(--color-text-secondary)]">Category</dt>
              <dd className="font-medium text-[var(--color-text)]">{catLabel}</dd>
            </div>
            <div>
              <dt className="text-[var(--color-text-secondary)]">Uploaded</dt>
              <dd className="font-medium text-[var(--color-text)]">{formatDate(doc.created_at)}</dd>
            </div>
            <div>
              <dt className="text-[var(--color-text-secondary)]">Size</dt>
              <dd className="font-medium text-[var(--color-text)]">
                {formatBytes(doc.file_size_bytes)}
              </dd>
            </div>
          </dl>

          <hr className="my-4 border-[var(--color-border)]" />

          {allCategories.length > 0 && (
            <>
              <div className="mb-4">
                <p className="mb-2 text-[var(--text-sm)] font-medium text-[var(--color-text)]">
                  Medical Categories
                </p>
                <CategoryPicker
                  categories={allCategories}
                  selectedIds={selectedCategoryIds}
                  onChange={(ids) => void handleCategoryChange(ids)}
                />
              </div>

              <hr className="my-4 border-[var(--color-border)]" />
            </>
          )}

          <div className="mb-4">
            <p className="mb-2 text-[var(--text-sm)] font-medium text-[var(--color-text)]">Tags</p>
            {tags.length > 0 && (
              <ul className="mb-2 flex flex-wrap gap-1">
                {tags.map((tag) => (
                  <li key={tag} className="flex items-center gap-1">
                    <span className="rounded-full bg-[var(--color-surface-sunken)] px-2 py-0.5 text-[var(--text-xs)] text-[var(--color-text-secondary)]">
                      #{tag}
                    </span>
                    <button
                      type="button"
                      aria-label={`Remove tag ${tag}`}
                      disabled={savingTags}
                      onClick={() => void handleRemoveTag(tag)}
                      className="text-[var(--text-xs)] text-[var(--color-text-secondary)] hover:text-[var(--color-danger)] disabled:opacity-40"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex gap-1">
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    void handleAddTag()
                  }
                }}
                placeholder="Add tag"
                className="min-w-0 flex-1 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-[var(--text-xs)] text-[var(--color-text)] placeholder:text-[var(--color-text-secondary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
              />
              <button
                type="button"
                disabled={savingTags || !newTag.trim()}
                onClick={() => void handleAddTag()}
                className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-2 py-1 text-[var(--text-xs)] text-[var(--color-text)] disabled:opacity-40 hover:bg-[var(--color-surface-sunken)]"
              >
                +
              </button>
            </div>
          </div>

          <hr className="my-4 border-[var(--color-border)]" />

          <div className="mb-4">
            <p className="mb-2 text-[var(--text-sm)] font-medium text-[var(--color-text)]">Notes</p>
            <textarea
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes…"
              className="w-full resize-none rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[var(--text-sm)] text-[var(--color-text)] placeholder:text-[var(--color-text-secondary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
            />
            <button
              type="button"
              disabled={savingNotes}
              onClick={() => void handleSaveNotes()}
              className="mt-2 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] py-1.5 text-[var(--text-sm)] text-[var(--color-text)] transition-colors duration-[var(--duration-fast)] hover:bg-[var(--color-surface-sunken)] disabled:opacity-40"
            >
              {notesSaved ? '✓ Saved' : savingNotes ? 'Saving…' : 'Save Notes'}
            </button>
          </div>

          <hr className="my-4 border-[var(--color-border)]" />

          <button
            type="button"
            onClick={() => void handleDelete()}
            className="w-full rounded-[var(--radius-md)] border border-[var(--color-danger)] py-1.5 text-[var(--text-sm)] text-[var(--color-danger)] transition-colors duration-[var(--duration-fast)] hover:bg-[var(--color-surface-sunken)]"
          >
            Delete
          </button>
        </aside>
      </div>
    </div>
  )
}

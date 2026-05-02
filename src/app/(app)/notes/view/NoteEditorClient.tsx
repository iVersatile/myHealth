'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { confirm } from '@tauri-apps/plugin-dialog'
import { useSearchParams, useRouter } from 'next/navigation'
import { invoke } from '@tauri-apps/api/core'
import { useEditor, EditorContent } from '@tiptap/react'
import { Node } from '@tiptap/core'
import Bold from '@tiptap/extension-bold'
import Italic from '@tiptap/extension-italic'
import Heading from '@tiptap/extension-heading'
import { BulletList, OrderedList, ListItem, ListKeymap } from '@tiptap/extension-list'
import { useNotes } from '../../../../hooks/useNotes'
import { Note } from '../../../../store/notesStore'
import type { Appointment } from '../../../../store/appointmentsStore'
import type { Document } from '../../../../store/documentsStore'

interface NoteLinkDto {
  id: string
  note_id: string
  entity_type: string
  entity_id: string
  created_at: string
}

interface NoteVersionDto {
  id: string
  note_id: string
  content: string
  created_at: string
}

// Tiptap v3 does not ship Document/Paragraph/Text as separate packages
const Document = Node.create({ name: 'doc', topNode: true, content: 'block+' })
const Paragraph = Node.create({
  name: 'paragraph',
  group: 'block',
  content: 'inline*',
  parseHTML() {
    return [{ tag: 'p' }]
  },
  renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, unknown> }) {
    return ['p', HTMLAttributes, 0]
  },
})
const Text = Node.create({ name: 'text', group: 'inline' })

function relativeTime(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 5) return 'just now'
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  return `${Math.floor(diff / 3600)}h ago`
}

export default function NoteEditorClient() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const id = searchParams.get('id') ?? ''

  const { getNote, saveNote, deleteNote, pinNote, setNoteTags } = useNotes()

  const [note, setNote] = useState<Note | null>(null)
  const [title, setTitle] = useState('')
  const [isPinned, setIsPinned] = useState(false)
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [lastSaved, setLastSaved] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [links, setLinks] = useState<NoteLinkDto[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [documents, setDocuments] = useState<Document[]>([])
  const [selectedAppt, setSelectedAppt] = useState('')
  const [selectedDoc, setSelectedDoc] = useState('')

  const [versions, setVersions] = useState<NoteVersionDto[]>([])
  const [historyOpen, setHistoryOpen] = useState(false)

  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const titleRef = useRef(title)
  // eslint-disable-next-line react-hooks/refs
  titleRef.current = title

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      Document,
      Paragraph,
      Text,
      Bold,
      Italic,
      Heading.configure({ levels: [1, 2] }),
      BulletList,
      OrderedList,
      ListItem,
      ListKeymap,
    ],
    content: '',
    onUpdate: () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
      autoSaveTimer.current = setTimeout(() => {
        void triggerSave()
      }, 1000)
    },
  })

  const loadLinks = useCallback(async () => {
    if (!id) return
    const result = await invoke<NoteLinkDto[]>('links_for_note', { noteId: id })
    setLinks(result)
  }, [id])

  useEffect(() => {
    async function load() {
      try {
        const n = await getNote(id)
        setNote(n)
        setTitle(n.title)
        setIsPinned(n.is_pinned)
        setTags(n.tags)
        setLastSaved(n.updated_at)
        editor?.commands.setContent(n.content || '')
        const [appts, docs, lnks, vers] = await Promise.all([
          invoke<Appointment[]>('appointments_list', {}),
          invoke<Document[]>('documents_list', {}),
          invoke<NoteLinkDto[]>('links_for_note', { noteId: id }),
          invoke<NoteVersionDto[]>('note_versions_list', { noteId: id }),
        ])
        setAppointments(appts)
        setDocuments(docs.filter((d) => !d.is_deleted))
        setLinks(lnks)
        setVersions(vers)
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : String(err))
      }
    }
    if (editor) void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, editor])

  useEffect(() => {
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    }
  }, [])

  const triggerSave = useCallback(async () => {
    if (!editor) return
    setSaving(true)
    try {
      const saved = await saveNote(id, titleRef.current, editor.getHTML())
      setNote(saved)
      setLastSaved(saved.updated_at)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }, [editor, id, saveNote])

  async function handleTitleBlur() {
    await triggerSave()
  }

  async function handlePinToggle() {
    const next = !isPinned
    setIsPinned(next)
    await pinNote(id, next)
  }

  async function handleAddTag(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter' && e.key !== ',') return
    e.preventDefault()
    const tag = tagInput.trim().toLowerCase()
    if (!tag || tags.includes(tag)) {
      setTagInput('')
      return
    }
    const next = [...tags, tag]
    setTags(next)
    setTagInput('')
    await setNoteTags(id, next)
  }

  async function handleRemoveTag(tag: string) {
    const next = tags.filter((t) => t !== tag)
    setTags(next)
    await setNoteTags(id, next)
  }

  async function handleLinkAppointment() {
    if (!selectedAppt) return
    await invoke('note_link', { noteId: id, entityType: 'appointment', entityId: selectedAppt })
    setSelectedAppt('')
    await loadLinks()
  }

  async function handleLinkDocument() {
    if (!selectedDoc) return
    await invoke('note_link', { noteId: id, entityType: 'document', entityId: selectedDoc })
    setSelectedDoc('')
    await loadLinks()
  }

  async function handleUnlink(entityType: string, entityId: string) {
    await invoke('note_unlink', { noteId: id, entityType, entityId })
    await loadLinks()
  }

  async function handleDelete() {
    if (!await confirm('Delete this note? This cannot be undone.')) return
    await deleteNote(id)
    router.push('/notes')
  }

  async function handleRestore(versionId: string) {
    try {
      const restored = await invoke<Note>('note_version_restore', { noteId: id, versionId })
      editor?.commands.setContent(restored.content || '')
      setNote(restored)
      setLastSaved(restored.updated_at)
      setHistoryOpen(false)
      const vers = await invoke<NoteVersionDto[]>('note_versions_list', { noteId: id })
      setVersions(vers)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  if (error) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-6">
        <p className="text-[var(--color-danger)]">{error}</p>
        <button onClick={() => router.push('/notes')} className="mt-4 text-sm text-[var(--color-accent)]">
          ← Back to Notes
        </button>
      </div>
    )
  }

  if (!note) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-6 text-sm text-[var(--color-text-muted)]">Loading…</div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-6 text-sm text-[var(--color-text-muted)]">
        <button
          onClick={() => router.push('/notes')}
          className="hover:text-[var(--color-accent)] transition-colors"
        >
          ← Notes
        </button>
        <span>/</span>
        <span className="text-[var(--color-text)] truncate max-w-xs">{title || 'Untitled'}</span>
      </div>

      {/* Title + pin toggle */}
      <div className="flex items-center gap-3 mb-4">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => void handleTitleBlur()}
          placeholder="Untitled"
          className="flex-1 text-[var(--text-2xl)] font-semibold bg-transparent border-none outline-none text-[var(--color-text)] placeholder:text-[var(--color-text-muted)]"
        />
        <button
          onClick={() => void handlePinToggle()}
          aria-label={isPinned ? 'Unpin note' : 'Pin note'}
          className={`text-xl transition-opacity ${isPinned ? 'opacity-100' : 'opacity-30 hover:opacity-60'}`}
        >
          📌
        </button>
      </div>

      {/* Formatting toolbar */}
      <div className="flex items-center gap-1 mb-2 p-1 rounded-[var(--radius-sm)] bg-[var(--color-surface-alt)] border border-[var(--color-border)]">
        {(
          [
            {
              label: 'B',
              title: 'Bold',
              action: () => editor?.chain().focus().toggleBold().run(),
              active: editor?.isActive('bold'),
            },
            {
              label: 'I',
              title: 'Italic',
              action: () => editor?.chain().focus().toggleItalic().run(),
              active: editor?.isActive('italic'),
            },
            {
              label: 'H1',
              title: 'Heading 1',
              action: () => editor?.chain().focus().toggleHeading({ level: 1 }).run(),
              active: editor?.isActive('heading', { level: 1 }),
            },
            {
              label: 'H2',
              title: 'Heading 2',
              action: () => editor?.chain().focus().toggleHeading({ level: 2 }).run(),
              active: editor?.isActive('heading', { level: 2 }),
            },
            {
              label: '•',
              title: 'Bullet list',
              action: () => editor?.chain().focus().toggleBulletList().run(),
              active: editor?.isActive('bulletList'),
            },
            {
              label: '1.',
              title: 'Ordered list',
              action: () => editor?.chain().focus().toggleOrderedList().run(),
              active: editor?.isActive('orderedList'),
            },
          ] as const
        ).map(({ label, title: ttl, action, active }) => (
          <button
            key={label}
            onClick={action}
            title={ttl}
            className={`px-2 py-1 text-sm rounded transition-colors font-mono ${
              active
                ? 'bg-[var(--color-accent)] text-white'
                : 'text-[var(--color-text-muted)] hover:bg-[var(--color-border)] hover:text-[var(--color-text)]'
            }`}
          >
            {label}
          </button>
        ))}
        <div className="ml-auto">
          <button
            onClick={() => setHistoryOpen(true)}
            title="Version History"
            className="px-2 py-1 text-xs rounded transition-colors text-[var(--color-text-muted)] hover:bg-[var(--color-border)] hover:text-[var(--color-text)]"
          >
            History {versions.length > 0 && `(${versions.length})`}
          </button>
        </div>
      </div>

      {/* Rich-text editor */}
      <div className="min-h-64 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 mb-6 prose prose-sm max-w-none focus-within:border-[var(--color-accent)] transition-colors">
        <EditorContent editor={editor} />
      </div>

      {/* Tags */}
      <div className="mb-6">
        <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-2">
          Tags
        </label>
        <div className="flex flex-wrap gap-2 mb-1">
          {tags.map((tag) => (
            <span
              key={tag}
              className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-[var(--color-tag-bg)] text-[var(--color-tag-text)]"
            >
              {tag}
              <button
                onClick={() => void handleRemoveTag(tag)}
                className="ml-1 hover:text-[var(--color-danger)] transition-colors"
                aria-label={`Remove tag ${tag}`}
              >
                ×
              </button>
            </span>
          ))}
          <input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => void handleAddTag(e)}
            placeholder="Add tag…"
            className="text-xs px-2 py-1 rounded-full border border-dashed border-[var(--color-border)] bg-transparent outline-none text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] w-24"
          />
        </div>
        <p className="text-xs text-[var(--color-text-muted)]">Press Enter or comma to add a tag</p>
      </div>

      {/* Linked To */}
      <div className="mb-6">
        <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-2">
          Linked To
        </label>

        {/* Existing links as chips */}
        {links.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {links.map((lnk) => {
              const label =
                lnk.entity_type === 'appointment'
                  ? (appointments.find((a) => a.id === lnk.entity_id)?.title ?? lnk.entity_id)
                  : (documents.find((d) => d.id === lnk.entity_id)?.filename ?? lnk.entity_id)
              const prefix = lnk.entity_type === 'appointment' ? '📅' : '📄'
              return (
                <span
                  key={lnk.id}
                  className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-[var(--color-tag-bg)] text-[var(--color-tag-text)]"
                >
                  {prefix} {label}
                  <button
                    onClick={() => void handleUnlink(lnk.entity_type, lnk.entity_id)}
                    className="ml-1 hover:text-[var(--color-danger)] transition-colors"
                    aria-label={`Unlink ${label}`}
                  >
                    ×
                  </button>
                </span>
              )
            })}
          </div>
        )}

        {/* Link to appointment */}
        <div className="flex items-center gap-2 mb-2">
          <select
            value={selectedAppt}
            onChange={(e) => setSelectedAppt(e.target.value)}
            className="flex-1 text-xs px-2 py-1 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] outline-none"
          >
            <option value="">Link to appointment…</option>
            {appointments
              .filter((a) => !links.some((l) => l.entity_type === 'appointment' && l.entity_id === a.id))
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title} — {new Date(a.appt_date).toLocaleDateString()}
                </option>
              ))}
          </select>
          <button
            onClick={() => void handleLinkAppointment()}
            disabled={!selectedAppt}
            className="px-3 py-1 text-xs rounded-[var(--radius-sm)] bg-[var(--color-accent)] text-white disabled:opacity-40 hover:opacity-90 transition-opacity"
          >
            Link
          </button>
        </div>

        {/* Link to document */}
        <div className="flex items-center gap-2">
          <select
            value={selectedDoc}
            onChange={(e) => setSelectedDoc(e.target.value)}
            className="flex-1 text-xs px-2 py-1 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] outline-none"
          >
            <option value="">Link to document…</option>
            {documents
              .filter((d) => !links.some((l) => l.entity_type === 'document' && l.entity_id === d.id))
              .map((d) => (
                <option key={d.id} value={d.id}>
                  {d.filename}
                </option>
              ))}
          </select>
          <button
            onClick={() => void handleLinkDocument()}
            disabled={!selectedDoc}
            className="px-3 py-1 text-xs rounded-[var(--radius-sm)] bg-[var(--color-accent)] text-white disabled:opacity-40 hover:opacity-90 transition-opacity"
          >
            Link
          </button>
        </div>
      </div>

      {/* Footer: last saved + actions */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-[var(--color-text-muted)]">
          {saving ? 'Saving…' : lastSaved ? `Last saved: ${relativeTime(lastSaved)}` : ''}
        </span>
        <div className="flex gap-3">
          <button
            onClick={() => void handleDelete()}
            className="px-4 py-2 rounded-[var(--radius-md)] border border-[var(--color-danger)] text-[var(--color-danger)] text-sm hover:bg-[var(--color-danger)] hover:text-white transition-colors"
          >
            Delete
          </button>
          <button
            onClick={() => void triggerSave()}
            disabled={saving}
            className="px-4 py-2 rounded-[var(--radius-md)] bg-[var(--color-accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </div>

      {/* Version history drawer */}
      {historyOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/30"
            onClick={() => setHistoryOpen(false)}
            aria-hidden="true"
          />
          {/* Drawer */}
          <aside
            role="dialog"
            aria-label="Version History"
            className="fixed right-0 top-0 z-50 h-full w-80 flex flex-col bg-[var(--color-surface)] border-l border-[var(--color-border)] shadow-xl"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
              <h2 className="text-sm font-semibold text-[var(--color-text)]">Version History</h2>
              <button
                onClick={() => setHistoryOpen(false)}
                aria-label="Close history"
                className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
              >
                ✕
              </button>
            </div>
            <ul className="flex-1 overflow-y-auto divide-y divide-[var(--color-border)]">
              {versions.length === 0 ? (
                <li className="px-4 py-6 text-xs text-[var(--color-text-muted)]">
                  No saved versions yet. Save the note to create a version.
                </li>
              ) : (
                versions.map((v, i) => (
                  <li key={v.id} className="flex items-center justify-between px-4 py-3 gap-2">
                    <span className="text-xs text-[var(--color-text)]">
                      v{versions.length - i} &mdash; {relativeTime(v.created_at)}
                    </span>
                    <button
                      onClick={() => void handleRestore(v.id)}
                      className="shrink-0 px-3 py-1 text-xs rounded-[var(--radius-sm)] border border-[var(--color-accent)] text-[var(--color-accent)] hover:bg-[var(--color-accent)] hover:text-white transition-colors"
                    >
                      Restore
                    </button>
                  </li>
                ))
              )}
            </ul>
          </aside>
        </>
      )}
    </div>
  )
}

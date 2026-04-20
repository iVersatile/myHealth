'use client'

import { useRouter } from 'next/navigation'
import { useNotes } from '../../../hooks/useNotes'
import { Note } from '../../../store/notesStore'

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function NoteCard({ note, onClick }: { note: Note; onClick: () => void }) {
  const preview = stripHtml(note.content).slice(0, 120)

  return (
    <button
      onClick={onClick}
      className="w-full text-left p-4 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] transition-colors"
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <span className="font-medium text-[var(--color-text)] truncate">{note.title || 'Untitled'}</span>
        {note.is_pinned && (
          <span className="text-[var(--color-accent)] shrink-0" aria-label="Pinned">
            📌
          </span>
        )}
      </div>
      <p className="text-sm text-[var(--color-text-muted)] line-clamp-2 mb-2">{preview || 'No content'}</p>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-[var(--color-text-muted)]">{formatDate(note.updated_at)}</span>
        {note.tags.map((tag) => (
          <span
            key={tag}
            className="text-xs px-2 py-0.5 rounded-full bg-[var(--color-tag-bg)] text-[var(--color-tag-text)]"
          >
            {tag}
          </span>
        ))}
      </div>
    </button>
  )
}

export default function NotesPage() {
  const router = useRouter()
  const { notes, loading, error, createNote } = useNotes()

  const pinned = notes.filter((n) => n.is_pinned)
  const unpinned = notes.filter((n) => !n.is_pinned)

  async function handleNew() {
    const note = await createNote()
    router.push(`/notes/view?id=${note.id}`)
  }

  function openNote(id: string) {
    router.push(`/notes/view?id=${id}`)
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-[var(--text-2xl)] font-semibold text-[var(--color-text)]">Notes</h1>
        <button
          onClick={() => void handleNew()}
          className="px-4 py-2 rounded-[var(--radius-md)] bg-[var(--color-accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
        >
          + New Note
        </button>
      </div>

      {error && <p className="mb-4 text-sm text-[var(--color-danger)]">{error}</p>}

      {loading && notes.length === 0 && (
        <p className="text-sm text-[var(--color-text-muted)]">Loading…</p>
      )}

      {!loading && notes.length === 0 && (
        <div className="text-center py-16 text-[var(--color-text-muted)]">
          <p className="text-lg mb-2">No notes yet</p>
          <p className="text-sm">Create your first note to get started.</p>
        </div>
      )}

      {pinned.length > 0 && (
        <section className="mb-6">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
              Pinned
            </span>
            <div className="flex-1 h-px bg-[var(--color-border)]" />
          </div>
          <div className="flex flex-col gap-2">
            {pinned.map((note) => (
              <NoteCard key={note.id} note={note} onClick={() => openNote(note.id)} />
            ))}
          </div>
        </section>
      )}

      {unpinned.length > 0 && (
        <section>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
              {pinned.length > 0 ? 'All Notes' : 'Notes'}
            </span>
            <div className="flex-1 h-px bg-[var(--color-border)]" />
          </div>
          <div className="flex flex-col gap-2">
            {unpinned.map((note) => (
              <NoteCard key={note.id} note={note} onClick={() => openNote(note.id)} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

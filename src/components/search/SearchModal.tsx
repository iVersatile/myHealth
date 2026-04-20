'use client'

import { useEffect, useRef, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'

interface SearchResult {
  entity_type: string
  entity_id: string
  title: string
  snippet: string
  tags: string[]
}

interface SearchResults {
  items: SearchResult[]
}

const TYPE_LABELS: Record<string, string> = {
  note: 'Notes',
  appointment: 'Appointments',
  contact: 'Contacts',
  document: 'Documents',
}

interface SearchModalProps {
  open: boolean
  onClose: () => void
}

export function SearchModal({ open, onClose }: SearchModalProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    inputRef.current?.focus()

    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  useEffect(() => {
    if (!open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQuery('')
      setResults([])
    }
  }, [open])

  useEffect(() => {
    const trimmed = query.trim()
    if (trimmed.length < 2) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResults([])
      return
    }

    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const data = await invoke<SearchResults>('search_query', { q: trimmed })
        setResults(data.items)
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [query])

  const grouped = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
    ;(acc[r.entity_type] ??= []).push(r)
    return acc
  }, {})

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Search records"
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-[15vh]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-[var(--color-border)] px-4 py-3">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search records…"
            className="flex-1 bg-transparent text-[var(--text-base)] text-[var(--color-text)] placeholder:text-[var(--color-text-disabled)] outline-none"
          />
          {loading && (
            <span className="text-[var(--color-text-disabled)] text-[var(--text-sm)]">…</span>
          )}
          <kbd className="rounded-[var(--radius-sm)] bg-[var(--color-surface-raised)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--color-text-secondary)]">
            Esc
          </kbd>
        </div>

        {query.trim().length >= 2 && !loading && results.length === 0 && (
          <div className="px-4 py-6 text-center text-[var(--text-sm)] text-[var(--color-text-secondary)]">
            No results for &ldquo;{query}&rdquo;
          </div>
        )}

        {query.trim().length < 2 && (
          <div className="px-4 py-3 text-[var(--text-sm)] text-[var(--color-text-secondary)]">
            Type at least 2 characters to search…
          </div>
        )}

        {Object.entries(grouped).map(([type, items]) => (
          <div key={type}>
            <div className="border-t border-[var(--color-border)] px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
              {TYPE_LABELS[type] ?? type}
            </div>
            {items.map((r) => (
              <button
                key={r.entity_id}
                className="w-full px-4 py-2.5 text-left hover:bg-[var(--color-surface-raised)] transition-colors"
                onClick={onClose}
              >
                <div className="text-[var(--text-sm)] font-medium text-[var(--color-text)]">
                  {r.title}
                </div>
                {r.snippet && (
                  <div
                    className="mt-0.5 text-[var(--text-xs)] text-[var(--color-text-secondary)] [&_mark]:bg-[var(--color-accent)]/20 [&_mark]:text-[var(--color-accent)] [&_mark]:rounded-sm [&_mark]:px-0.5"
                    dangerouslySetInnerHTML={{ __html: r.snippet }}
                  />
                )}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

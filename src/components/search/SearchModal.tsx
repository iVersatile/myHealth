'use client'

import { useEffect, useRef } from 'react'

interface SearchModalProps {
  open: boolean
  onClose: () => void
}

export function SearchModal({ open, onClose }: SearchModalProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    inputRef.current?.focus()

    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onClose])

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
            placeholder="Search records…"
            className="flex-1 bg-transparent text-[var(--text-base)] text-[var(--color-text)] placeholder:text-[var(--color-text-disabled)] outline-none"
          />
          <kbd className="rounded-[var(--radius-sm)] bg-[var(--color-surface-raised)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--color-text-secondary)]">
            Esc
          </kbd>
        </div>
        <div className="px-4 py-3 text-[var(--text-sm)] text-[var(--color-text-secondary)]">
          Full-text search available in Phase 9.
        </div>
      </div>
    </div>
  )
}

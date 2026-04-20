'use client'

interface TopBarProps {
  onSearchOpen?: () => void
}

export function TopBar({ onSearchOpen }: TopBarProps) {
  return (
    <header className="flex h-[var(--topbar-height,56px)] shrink-0 items-center border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4">
      <button
        onClick={onSearchOpen}
        className="flex w-full max-w-sm items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-3 py-1.5 text-[var(--text-sm)] text-[var(--color-text-disabled)] transition-colors hover:border-[var(--color-primary)] hover:text-[var(--color-text-secondary)]"
      >
        <span className="flex-1 text-left">Search records…</span>
        <kbd className="rounded-[var(--radius-sm)] bg-[var(--color-border)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--color-text-secondary)]">
          ⌘K
        </kbd>
      </button>
    </header>
  )
}

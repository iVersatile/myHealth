'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { invoke } from '@tauri-apps/api/core'
import { useAuthStore } from '../../store/authStore'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/documents', label: 'Documents' },
  { href: '/appointments', label: 'Appointments' },
  { href: '/notes', label: 'Notes' },
  { href: '/contacts', label: 'Contacts' },
  { href: '/clinics', label: 'Clinics' },
  { href: '/timeline', label: 'Timeline' },
  { href: '/content-search', label: 'Content Search' },
  { href: '/categories', label: 'Categories' },
] as const

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const setLocked = useAuthStore((s) => s.setLocked)

  async function handleLock() {
    try {
      await invoke('auth_lock')
    } catch {
      // non-Tauri environment
    }
    setLocked(true)
    router.push('/')
  }

  return (
    <aside className="flex h-full w-[var(--sidebar-width,220px)] shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="flex h-[var(--topbar-height,56px)] shrink-0 items-center gap-2 px-5">
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          aria-hidden="true"
          className="flex-shrink-0 text-[var(--color-primary)]"
        >
          <path
            d="M10 17s-7-4.35-7-9a4 4 0 0 1 7-2.646A4 4 0 0 1 17 8c0 4.65-7 9-7 9z"
            fill="currentColor"
          />
        </svg>
        <span className="text-[var(--text-base)] font-semibold tracking-tight text-[var(--color-text)]">
          MyHealth
        </span>
      </div>

      <div className="mx-3 h-px bg-[var(--color-border)]" />

      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2 py-3">
        {NAV_ITEMS.map(({ href, label }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={[
                'flex items-center rounded-[var(--radius-md)] px-3 py-2 text-[var(--text-sm)] transition-colors',
                active
                  ? 'bg-[var(--color-primary)]/10 font-medium text-[var(--color-primary)]'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-raised)] hover:text-[var(--color-text)]',
              ].join(' ')}
            >
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="mx-3 h-px bg-[var(--color-border)]" />

      <div className="flex flex-col gap-0.5 px-2 py-3">
        <Link
          href="/trash"
          className={[
            'flex items-center rounded-[var(--radius-md)] px-3 py-2 text-[var(--text-sm)] transition-colors',
            pathname === '/trash'
              ? 'bg-[var(--color-primary)]/10 font-medium text-[var(--color-primary)]'
              : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-raised)] hover:text-[var(--color-text)]',
          ].join(' ')}
        >
          Trash
        </Link>
        <Link
          href="/settings"
          className={[
            'flex items-center rounded-[var(--radius-md)] px-3 py-2 text-[var(--text-sm)] transition-colors',
            pathname === '/settings'
              ? 'bg-[var(--color-primary)]/10 font-medium text-[var(--color-primary)]'
              : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-raised)] hover:text-[var(--color-text)]',
          ].join(' ')}
        >
          Settings
        </Link>
        <button
          onClick={handleLock}
          className="flex items-center rounded-[var(--radius-md)] px-3 py-2 text-[var(--text-sm)] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-raised)] hover:text-[var(--color-text)]"
        >
          Lock
        </button>
      </div>
    </aside>
  )
}

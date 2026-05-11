'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { invoke } from '@tauri-apps/api/core'
import { useAuthStore } from '../../store/authStore'

interface NavItem {
  href: string
  label: string
  icon: React.ReactNode
}

const TOP_ITEMS: NavItem[] = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="M3 11l7-7 7 7v7a1 1 0 01-1 1H4a1 1 0 01-1-1v-7z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M7 19v-7h6v7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    href: '/documents',
    label: 'Documents',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="M4 3h8l4 4v10a1 1 0 01-1 1H4a1 1 0 01-1-1V4a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M12 3v4h4M7 10h6M7 13h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    href: '/content-search',
    label: 'Search',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <circle cx="9" cy="9" r="5.5" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M13.5 13.5l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    href: '/contacts',
    label: 'Contacts',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <circle cx="10" cy="7" r="3.5" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M3 17c0-3.314 3.134-6 7-6s7 2.686 7 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    href: '/timeline',
    label: 'Timeline',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="M10 3v14M5 6l5-3 5 3M5 10l5 3 5-3M5 14l5 3 5-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    href: '/categories',
    label: 'Tags',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="M3 3h6l8 8-6 6-8-8V3z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="7" cy="7" r="1" fill="currentColor"/>
      </svg>
    ),
  },
  {
    href: '/settings',
    label: 'Settings',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.22 4.22l1.42 1.42M14.36 14.36l1.42 1.42M4.22 15.78l1.42-1.42M14.36 5.64l1.42-1.42" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
]

interface TooltipState {
  id: string | null
  timerId: ReturnType<typeof setTimeout> | null
}

function NavButton({
  item,
  active,
  onTooltipShow,
  onTooltipHide,
  tooltipVisible,
}: {
  item: NavItem
  active: boolean
  onTooltipShow: (id: string) => void
  onTooltipHide: () => void
  tooltipVisible: boolean
}) {
  const tooltipId = `tooltip-${item.href.replace(/\//g, '')}`

  return (
    <div className="relative flex items-center">
      <Link
        href={item.href}
        aria-label={item.label}
        aria-describedby={tooltipVisible ? tooltipId : undefined}
        onMouseEnter={() => onTooltipShow(item.href)}
        onMouseLeave={onTooltipHide}
        onFocus={() => onTooltipShow(item.href)}
        onBlur={onTooltipHide}
        className={[
          'flex h-10 w-10 items-center justify-center transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]',
          active
            ? 'text-[#F0A500]'
            : 'rounded-[var(--radius-md)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-raised)] hover:text-[var(--color-text)]',
        ].join(' ')}
        style={
          active
            ? { borderLeft: '3px solid #F0A500', paddingLeft: '9px' }
            : undefined
        }
      >
        {item.icon}
      </Link>
      {tooltipVisible && (
        <div
          id={tooltipId}
          role="tooltip"
          className="pointer-events-none absolute left-full ml-2 z-50 whitespace-nowrap rounded-[var(--radius-sm)] bg-[var(--color-text)] px-2 py-1 text-[var(--text-xs)] text-[var(--color-surface)] shadow-md"
        >
          {item.label}
        </div>
      )}
    </div>
  )
}

export function IconRail() {
  const pathname = usePathname()
  const router = useRouter()
  const setLocked = useAuthStore((s) => s.setLocked)
  const [tooltip, setTooltip] = useState<TooltipState>({ id: null, timerId: null })

  const showTooltip = useCallback((id: string) => {
    setTooltip((prev) => {
      if (prev.timerId) clearTimeout(prev.timerId)
      const timerId = setTimeout(() => {
        setTooltip({ id, timerId: null })
      }, 400)
      return { id: null, timerId }
    })
  }, [])

  const hideTooltip = useCallback(() => {
    setTooltip((prev) => {
      if (prev.timerId) clearTimeout(prev.timerId)
      return { id: null, timerId: null }
    })
  }, [])

  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') hideTooltip()
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [hideTooltip])

  useEffect(() => {
    return () => {
      setTooltip((prev) => {
        if (prev.timerId) clearTimeout(prev.timerId)
        return { id: null, timerId: null }
      })
    }
  }, [])

  async function handleLock() {
    try {
      await invoke('auth_lock')
    } catch {
      // non-Tauri environment
    }
    setLocked(true)
    router.push('/')
  }

  const lockTooltipId = 'tooltip-lock'

  return (
    <aside
      data-testid="nav-rail"
      className="flex h-full w-[52px] shrink-0 flex-col items-center border-r border-[var(--color-border)] bg-[var(--color-surface)] py-3"
    >
      {/* Logo mark */}
      <div className="mb-3 flex h-10 w-10 items-center justify-center">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true" className="text-[var(--color-primary)]">
          <path d="M10 17s-7-4.35-7-9a4 4 0 017-2.646A4 4 0 0117 8c0 4.65-7 9-7 9z" fill="currentColor"/>
        </svg>
      </div>

      <div className="mb-2 h-px w-8 bg-[var(--color-border)]" />

      {/* Top nav items — Tab order follows DOM order (top-to-bottom) */}
      <nav className="flex flex-1 flex-col items-center gap-1">
        {TOP_ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <NavButton
              key={item.href}
              item={item}
              active={active}
              onTooltipShow={showTooltip}
              onTooltipHide={hideTooltip}
              tooltipVisible={tooltip.id === item.href}
            />
          )
        })}
      </nav>

      <div className="mb-2 h-px w-8 bg-[var(--color-border)]" />

      {/* Bottom: Lock */}
      <div className="relative flex items-center">
        <button
          aria-label="Lock vault"
          aria-describedby={tooltip.id === 'lock' ? lockTooltipId : undefined}
          onClick={handleLock}
          onMouseEnter={() => showTooltip('lock')}
          onMouseLeave={hideTooltip}
          onFocus={() => showTooltip('lock')}
          onBlur={hideTooltip}
          className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-raised)] hover:text-[var(--color-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <rect x="4" y="9" width="12" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M7 9V6.5a3 3 0 016 0V9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
        {tooltip.id === 'lock' && (
          <div
            id={lockTooltipId}
            role="tooltip"
            className="pointer-events-none absolute left-full ml-2 z-50 whitespace-nowrap rounded-[var(--radius-sm)] bg-[var(--color-text)] px-2 py-1 text-[var(--text-xs)] text-[var(--color-surface)] shadow-md"
          >
            Lock vault
          </div>
        )}
      </div>
    </aside>
  )
}

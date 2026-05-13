'use client'

import type { ReactNode } from 'react'

interface SuggestionBannerProps {
  testId?: string
  children: ReactNode
  actions: ReactNode
  className?: string
}

export const bannerPrimaryBtn =
  'px-3 py-1 rounded-[var(--radius-sm)] bg-[var(--color-accent)] text-white text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-50'

export const bannerSecondaryBtn =
  'px-3 py-1 rounded-[var(--radius-sm)] border border-[var(--color-border)] text-[var(--color-text-muted)] text-xs hover:text-[var(--color-text)] transition-colors'

export function SuggestionBanner({ testId, children, actions, className }: SuggestionBannerProps) {
  const base =
    'flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--color-accent)] bg-[var(--color-accent)]/10 px-4 py-3 text-sm'
  return (
    <div data-testid={testId} className={className ?? base}>
      {children}
      <div className="flex gap-2 shrink-0">{actions}</div>
    </div>
  )
}

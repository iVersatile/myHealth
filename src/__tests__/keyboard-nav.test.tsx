/**
 * G-12 Keyboard Navigation Audit
 *
 * Renders the Sidebar (which contains all nav links + the Lock button) in jsdom,
 * then simulates Tab presses to walk through every interactive element.
 *
 * Assertions:
 *  - Every nav link and the Lock button is reachable via Tab
 *  - Focus never gets trapped (tabbing past the last element wraps or stops — it
 *    does NOT stay on the same element)
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'

vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) =>
    React.createElement('a', { href, className }, children),
}))

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../store/authStore', () => ({
  useAuthStore: (selector: (s: { setLocked: (v: boolean) => void }) => unknown) =>
    selector({ setLocked: vi.fn() }),
}))

describe('Keyboard navigation — Sidebar (G-12)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('all nav links and Lock button are reachable via Tab', async () => {
    const { Sidebar } = await import('../components/layout/Sidebar')
    render(React.createElement(Sidebar))

    const user = userEvent.setup()

    // Expected focusable labels in tab order:
    // Dashboard, Documents, Appointments, Notes, Contacts, Clinics, Timeline,
    // Content Search, Categories, Settings, Trash, Lock
    const expectedLabels = [
      'Dashboard',
      'Documents',
      'Appointments',
      'Notes',
      'Contacts',
      'Clinics',
      'Timeline',
      'Content Search',
      'Categories',
      'Settings',
      'Trash',
      'Lock',
    ]

    ;(document.body as HTMLElement).focus()

    const focusedLabels: string[] = []

    for (let i = 0; i < expectedLabels.length; i++) {
      await user.tab()
      const active = document.activeElement
      if (active && active !== document.body) {
        focusedLabels.push(active.textContent?.trim() ?? '')
      }
    }

    for (const label of expectedLabels) {
      expect(focusedLabels).toContain(label)
    }
  })

  it('focus does not trap on the Lock button (last element)', async () => {
    const { Sidebar } = await import('../components/layout/Sidebar')
    render(React.createElement(Sidebar))

    const user = userEvent.setup()

    const lockButton = screen.getByRole('button', { name: /lock/i })
    lockButton.focus()
    expect(document.activeElement).toBe(lockButton)

    // One more Tab — focus must leave the Lock button
    await user.tab()
    expect(document.activeElement).not.toBe(lockButton)
  })
})

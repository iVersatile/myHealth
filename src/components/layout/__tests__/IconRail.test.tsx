import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'

const mockPush = vi.fn()
const mockPathname = vi.fn(() => '/dashboard')

vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname(),
  useRouter: () => ({ push: mockPush }),
}))

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../../store/authStore', () => ({
  useAuthStore: (selector: (s: { setLocked: (v: boolean) => void }) => unknown) =>
    selector({ setLocked: vi.fn() }),
}))

import { IconRail } from '../IconRail'

describe('IconRail', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockPathname.mockReturnValue('/dashboard')
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('renders nav-rail testid', () => {
    render(<IconRail />)
    expect(screen.getByTestId('nav-rail')).toBeDefined()
  })

  it('renders all 7 nav links with correct aria-labels', () => {
    render(<IconRail />)
    const labels = ['Dashboard', 'Documents', 'Search', 'Contacts', 'Timeline', 'Tags', 'Settings']
    for (const label of labels) {
      expect(screen.getByRole('link', { name: label })).toBeDefined()
    }
  })

  it('renders Lock vault button', () => {
    render(<IconRail />)
    expect(screen.getByRole('button', { name: 'Lock vault' })).toBeDefined()
  })

  it('active route gets amber left-border style', () => {
    mockPathname.mockReturnValue('/documents')
    render(<IconRail />)
    const link = screen.getByRole('link', { name: 'Documents' })
    expect(link.style.borderLeft).toMatch(/3px solid (#F0A500|rgb\(240, 165, 0\))/i)
  })

  it('inactive route has no left-border style', () => {
    mockPathname.mockReturnValue('/documents')
    render(<IconRail />)
    const link = screen.getByRole('link', { name: 'Dashboard' })
    expect(link.style.borderLeft).toBe('')
  })

  it('tooltip appears after 400ms on mouse enter', () => {
    render(<IconRail />)
    const link = screen.getByRole('link', { name: 'Documents' })
    fireEvent.mouseEnter(link)
    expect(screen.queryByRole('tooltip')).toBeNull()
    act(() => { vi.advanceTimersByTime(400) })
    expect(screen.getByRole('tooltip')).toBeDefined()
    expect(screen.getByRole('tooltip').textContent).toBe('Documents')
  })

  it('tooltip hides on mouse leave', () => {
    render(<IconRail />)
    const link = screen.getByRole('link', { name: 'Documents' })
    fireEvent.mouseEnter(link)
    act(() => { vi.advanceTimersByTime(400) })
    expect(screen.getByRole('tooltip')).toBeDefined()
    fireEvent.mouseLeave(link)
    expect(screen.queryByRole('tooltip')).toBeNull()
  })

  it('tooltip hides on Escape key', () => {
    render(<IconRail />)
    const link = screen.getByRole('link', { name: 'Settings' })
    fireEvent.mouseEnter(link)
    act(() => { vi.advanceTimersByTime(400) })
    expect(screen.getByRole('tooltip')).toBeDefined()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('tooltip')).toBeNull()
  })

  it('link has aria-describedby pointing to visible tooltip id', () => {
    render(<IconRail />)
    const link = screen.getByRole('link', { name: 'Contacts' })
    fireEvent.mouseEnter(link)
    act(() => { vi.advanceTimersByTime(400) })
    const tooltipId = screen.getByRole('tooltip').id
    expect(link.getAttribute('aria-describedby')).toBe(tooltipId)
  })
})

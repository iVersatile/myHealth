import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'

vi.mock('next/navigation', () => ({
  usePathname: () => '/documents',
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue([]),
  convertFileSrc: vi.fn((p: string) => p),
}))

vi.mock('react-virtuoso', () => ({
  Virtuoso: ({ itemContent, data }: { itemContent: (i: number, d: unknown) => React.ReactNode; data: unknown[] }) =>
    <div>{data.map((d, i) => itemContent(i, d))}</div>,
}))

import { VaultLayout } from '../VaultLayout'

let roCallback: ResizeObserverCallback | null = null

beforeEach(() => {
  roCallback = null
  vi.stubGlobal('ResizeObserver', class {
    constructor(cb: ResizeObserverCallback) { roCallback = cb }
    observe() {}
    disconnect() {}
  })
  localStorage.clear()
})

function fireResize(width: number) {
  act(() => {
    roCallback?.([{ contentRect: { width } } as ResizeObserverEntry], {} as ResizeObserver)
  })
}

describe('VaultLayout', () => {
  it('renders all 4 panel testids', () => {
    render(<VaultLayout documents={[]} />)
    expect(screen.getByTestId('nav-rail')).toBeInTheDocument()
    expect(screen.getByTestId('document-list-panel')).toBeInTheDocument()
    expect(screen.getByTestId('document-preview-panel')).toBeInTheDocument()
    expect(screen.getByTestId('ai-insights-panel')).toBeInTheDocument()
  })

  it('renders drag handle', () => {
    render(<VaultLayout documents={[]} />)
    expect(screen.getByTestId('doc-list-resize-handle')).toBeInTheDocument()
  })

  it('uses CSS Grid layout', () => {
    render(<VaultLayout documents={[]} />)
    const layout = screen.getByTestId('vault-layout')
    expect(layout.style.display).toBe('grid')
    expect(layout.style.gridTemplateColumns).toContain('52px')
  })

  it('collapses AI panel below 1400px and shows expand button', () => {
    render(<VaultLayout documents={[]} />)
    fireResize(1280)
    expect(screen.getByTestId('ai-panel-expand-btn')).toBeInTheDocument()
    const layout = screen.getByTestId('vault-layout')
    expect(layout.style.gridTemplateColumns).toContain('1fr 0px')
  })

  it('expand button restores AI panel', () => {
    render(<VaultLayout documents={[]} />)
    fireResize(1280)
    fireEvent.click(screen.getByTestId('ai-panel-expand-btn'))
    expect(screen.queryByTestId('ai-panel-expand-btn')).not.toBeInTheDocument()
    expect(screen.getByTestId('vault-layout').style.gridTemplateColumns).not.toContain('1fr 0px')
  })

  it('stays expanded above 1400px', () => {
    render(<VaultLayout documents={[]} />)
    fireResize(1440)
    expect(screen.queryByTestId('ai-panel-expand-btn')).not.toBeInTheDocument()
  })

  it('drag handle resizes list panel and persists to localStorage', () => {
    render(<VaultLayout documents={[]} />)
    const handle = screen.getByTestId('doc-list-resize-handle')

    // Flush each event separately so effects (listener registration) run between steps
    act(() => { fireEvent.mouseDown(handle, { clientX: 400 }) })
    act(() => { fireEvent.mouseMove(window, { clientX: 450 }) })
    act(() => { fireEvent.mouseUp(window) })

    const layout = screen.getByTestId('vault-layout')
    expect(layout.style.gridTemplateColumns).toContain('350px')
    expect(localStorage.getItem('doc-list-width')).toBe('350')
  })

  it('clamps drag to min 240px', () => {
    render(<VaultLayout documents={[]} />)
    const handle = screen.getByTestId('doc-list-resize-handle')

    act(() => { fireEvent.mouseDown(handle, { clientX: 400 }) })
    act(() => { fireEvent.mouseMove(window, { clientX: 100 }) })
    act(() => { fireEvent.mouseUp(window) })

    const layout = screen.getByTestId('vault-layout')
    expect(layout.style.gridTemplateColumns).toContain('240px')
  })

  it('clamps drag to max 400px', () => {
    render(<VaultLayout documents={[]} />)
    const handle = screen.getByTestId('doc-list-resize-handle')

    act(() => { fireEvent.mouseDown(handle, { clientX: 400 }) })
    act(() => { fireEvent.mouseMove(window, { clientX: 800 }) })
    act(() => { fireEvent.mouseUp(window) })

    const layout = screen.getByTestId('vault-layout')
    expect(layout.style.gridTemplateColumns).toContain('400px')
  })

  it('restores list width from localStorage on mount', () => {
    localStorage.setItem('doc-list-width', '360')
    render(<VaultLayout documents={[]} />)
    const layout = screen.getByTestId('vault-layout')
    expect(layout.style.gridTemplateColumns).toContain('360px')
  })
})

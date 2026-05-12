'use client'

import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react'
import { IconRail } from './IconRail'
import { DocumentListPanel } from '../documents/DocumentListPanel'
import { DocumentPreviewPanel } from '../documents/DocumentPreviewPanel'
import { AiInsightsPanel } from '../documents/AiInsightsPanel'
import type { Document } from '../../store/documentsStore'

const AI_PANEL_BREAKPOINT = 1400
const LIST_WIDTH_KEY = 'doc-list-width'
const LIST_WIDTH_MIN = 240
const LIST_WIDTH_MAX = 400
const LIST_WIDTH_DEFAULT = 300

interface VaultLayoutProps {
  documents: Document[]
}

export function VaultLayout({ documents }: VaultLayoutProps) {
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null)
  const [aiCollapsed, setAiCollapsed] = useState(false)
  const [listWidth, setListWidth] = useState<number>(() => {
    if (typeof window === 'undefined') return LIST_WIDTH_DEFAULT
    const saved = localStorage.getItem(LIST_WIDTH_KEY)
    if (!saved) return LIST_WIDTH_DEFAULT
    const n = Number(saved)
    return Number.isFinite(n) ? Math.min(LIST_WIDTH_MAX, Math.max(LIST_WIDTH_MIN, n)) : LIST_WIDTH_DEFAULT
  })
  const [isDragging, setIsDragging] = useState(false)

  useLayoutEffect(() => {
    document.documentElement.setAttribute('data-theme', 'vault-dark')
    return () => { document.documentElement.removeAttribute('data-theme') }
  }, [])

  const rootRef = useRef<HTMLDivElement>(null)
  const dragStartRef = useRef<{ x: number; width: number } | null>(null)
  const listWidthRef = useRef(listWidth)
  useEffect(() => { listWidthRef.current = listWidth }, [listWidth])

  const handleResize = useCallback((entries: ResizeObserverEntry[]) => {
    const width = entries[0]?.contentRect.width ?? window.innerWidth
    setAiCollapsed(width < AI_PANEL_BREAKPOINT)
  }, [])

  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    const ro = new ResizeObserver(handleResize)
    ro.observe(el)
    return () => ro.disconnect()
  }, [handleResize])

  useEffect(() => {
    if (!isDragging) return
    const onMove = (e: MouseEvent) => {
      const start = dragStartRef.current
      if (!start) return
      const next = Math.min(LIST_WIDTH_MAX, Math.max(LIST_WIDTH_MIN, start.width + e.clientX - start.x))
      setListWidth(next)
    }
    const onUp = () => {
      setIsDragging(false)
      dragStartRef.current = null
      localStorage.setItem(LIST_WIDTH_KEY, String(listWidthRef.current))
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [isDragging])

  const aiWidth = aiCollapsed ? '0px' : 'var(--ai-panel-width, 240px)'

  return (
    <div
      ref={rootRef}
      data-testid="vault-layout"
      style={{
        display: 'grid',
        gridTemplateColumns: `52px ${listWidth}px 4px 1fr ${aiWidth}`,
        height: '100vh',
        overflow: 'hidden',
        transition: 'none',
      }}
    >
      <IconRail />

      <DocumentListPanel
        documents={documents}
        selectedId={selectedDoc?.id}
        onSelect={setSelectedDoc}
      />

      <div
        data-testid="doc-list-resize-handle"
        onMouseDown={(e) => {
          dragStartRef.current = { x: e.clientX, width: listWidth }
          setIsDragging(true)
          e.preventDefault()
        }}
        style={{
          cursor: 'col-resize',
          background: 'var(--color-border, #e2e8f0)',
          transition: 'background 150ms',
        }}
      />

      <DocumentPreviewPanel document={selectedDoc} />

      <div
        data-testid="ai-insights-panel"
        style={{ overflow: aiCollapsed ? 'visible' : 'hidden', borderLeft: aiCollapsed ? 'none' : '1px solid var(--color-border)', position: 'relative' }}
      >
        {!aiCollapsed && (
          <button
            onClick={() => setAiCollapsed(true)}
            aria-label="Collapse AI insights"
            style={{
              position: 'absolute',
              right: 4,
              top: 8,
              zIndex: 10,
              padding: '2px 6px',
              background: 'var(--color-surface-raised)',
              border: '1px solid var(--color-border)',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '10px',
              color: 'var(--color-text-secondary)',
            }}
          >
            ‹
          </button>
        )}
        {!aiCollapsed && selectedDoc && (
          <AiInsightsPanel
            doc={selectedDoc}
            entities={[]}
            docId={selectedDoc.id}
          />
        )}
        {aiCollapsed && (
          <button
            data-testid="ai-panel-expand-btn"
            onClick={() => setAiCollapsed(false)}
            aria-label="Expand AI insights"
            style={{
              position: 'absolute',
              right: 0,
              top: '50%',
              transform: 'translateY(-50%)',
              padding: '8px 4px',
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: '4px 0 0 4px',
              cursor: 'pointer',
              fontSize: '10px',
              writingMode: 'vertical-rl',
            }}
          >
            AI
          </button>
        )}
      </div>
    </div>
  )
}

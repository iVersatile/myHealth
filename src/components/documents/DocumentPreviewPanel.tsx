'use client'
import { useState } from 'react'
import { convertFileSrc } from '@tauri-apps/api/core'
import type { Document } from '../../store/documentsStore'

interface Props {
  document: Document | null
}

const ZOOM_STEP = 0.25
const ZOOM_MIN = 0.5
const ZOOM_MAX = 2.0

export function DocumentPreviewPanel({ document }: Props) {
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [fullscreen, setFullscreen] = useState(false)

  if (!document) {
    return (
      <div
        data-testid="document-preview-panel"
        className="flex h-full items-center justify-center text-[var(--color-text-secondary)] text-sm"
      >
        Select a document to preview
      </div>
    )
  }

  const assetUrl = convertFileSrc(document.file_path)
  const isPdf = document.mime_type === 'application/pdf'
  const isImage = document.mime_type.startsWith('image/')

  const zoomIn = () => setZoom((z) => Math.min(ZOOM_MAX, +(z + ZOOM_STEP).toFixed(2)))
  const zoomOut = () => setZoom((z) => Math.max(ZOOM_MIN, +(z - ZOOM_STEP).toFixed(2)))
  const rotate = () => setRotation((r) => (r + 90) % 360)
  const resetView = () => {
    setZoom(1)
    setRotation(0)
  }

  const mediaStyle: React.CSSProperties = {
    transform: `scale(${zoom}) rotate(${rotation}deg)`,
    transformOrigin: 'top center',
    transition: 'transform 0.2s ease',
  }

  return (
    <div
      data-testid="document-preview-panel"
      className={
        fullscreen
          ? 'fixed inset-0 z-50 flex flex-col bg-[var(--color-surface)] overflow-hidden'
          : 'flex flex-col h-full overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-raised)]'
      }
    >
      <div
        data-testid="preview-toolbar"
        className="flex shrink-0 items-center gap-1 border-b border-[var(--color-border)] px-3 py-1.5 text-[var(--color-text-secondary)]"
      >
        <span
          className="mr-auto truncate text-xs text-[var(--color-text)]"
          title={document.filename}
        >
          {document.filename}
        </span>
        {(isPdf || isImage) && (
          <>
            <ToolbarBtn aria-label="Zoom out" onClick={zoomOut} disabled={zoom <= ZOOM_MIN}>
              −
            </ToolbarBtn>
            <span
              className="w-10 text-center text-xs tabular-nums"
              data-testid="zoom-label"
            >
              {Math.round(zoom * 100)}%
            </span>
            <ToolbarBtn aria-label="Zoom in" onClick={zoomIn} disabled={zoom >= ZOOM_MAX}>
              +
            </ToolbarBtn>
            <ToolbarBtn aria-label="Rotate" onClick={rotate} title="Rotate 90°">
              ↻
            </ToolbarBtn>
            <ToolbarBtn aria-label="Reset view" onClick={resetView} title="Reset view">
              ⊙
            </ToolbarBtn>
          </>
        )}
        <ToolbarBtn
          aria-label={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          onClick={() => setFullscreen((f) => !f)}
        >
          {fullscreen ? '⊡' : '⊞'}
        </ToolbarBtn>
      </div>

      <div className="relative flex-1 overflow-auto">
        {isPdf && (
          <iframe
            data-testid="preview-iframe"
            src={assetUrl}
            title={document.filename}
            className="absolute inset-0 h-full w-full border-0"
            style={mediaStyle}
          />
        )}
        {isImage && (
          <img
            data-testid="preview-image"
            src={assetUrl}
            alt={document.filename}
            className="mx-auto max-w-full object-contain"
            style={mediaStyle}
          />
        )}
        {!isPdf && !isImage && (
          <div className="p-4">
            {document.extracted_text ? (
              <pre
                data-testid="preview-text"
                className="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-[var(--color-text)]"
              >
                {document.extracted_text}
              </pre>
            ) : (
              <p
                data-testid="preview-unavailable"
                className="text-center text-sm text-[var(--color-text-secondary)]"
              >
                Preview not available for this file type.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function ToolbarBtn({
  children,
  disabled,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      disabled={disabled}
      className={
        'flex h-6 w-6 items-center justify-center rounded text-sm transition-colors ' +
        (disabled
          ? 'cursor-not-allowed opacity-30'
          : 'hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)]')
      }
    >
      {children}
    </button>
  )
}

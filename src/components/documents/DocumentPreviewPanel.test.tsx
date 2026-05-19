import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DocumentPreviewPanel } from './DocumentPreviewPanel'
import type { Document } from '../../store/documentsStore'

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
  convertFileSrc: (path: string) => `asset://localhost${path}`,
}))

const makeDoc = (overrides: Partial<Document> = {}): Document => ({
  id: 'doc1',
  filename: 'report.pdf',
  file_path: '/files/report.pdf',
  mime_type: 'application/pdf',
  file_size_bytes: 4096,
  category: 'lab',
  thumbnail_path: null,
  notes: null,
  created_at: '2026-01-01T10:00:00Z',
  updated_at: '2026-01-01T10:00:00Z',
  is_deleted: false,
  document_date: null,
  activity_date: null,
  tags: [],
  clinic_name: null,
  ...overrides,
})

describe('DocumentPreviewPanel', () => {
  it('renders empty state when document is null', () => {
    render(<DocumentPreviewPanel document={null} />)
    expect(screen.getByTestId('document-preview-panel')).toBeInTheDocument()
    expect(screen.getByText(/select a document/i)).toBeInTheDocument()
  })

  it('renders preview panel with toolbar for PDF', () => {
    render(<DocumentPreviewPanel document={makeDoc()} />)
    expect(screen.getByTestId('document-preview-panel')).toBeInTheDocument()
    expect(screen.getByTestId('preview-toolbar')).toBeInTheDocument()
    expect(screen.getByTestId('preview-iframe')).toBeInTheDocument()
    expect(screen.getByTestId('zoom-label')).toBeInTheDocument()
  })

  it('sets iframe src to asset URL', () => {
    render(<DocumentPreviewPanel document={makeDoc()} />)
    const iframe = screen.getByTestId('preview-iframe') as HTMLIFrameElement
    expect(iframe.src).toContain('asset://localhost')
    expect(iframe.src).toContain('report.pdf')
  })

  it('renders image tag for image mime type', () => {
    render(<DocumentPreviewPanel document={makeDoc({ mime_type: 'image/png', filename: 'scan.png' })} />)
    expect(screen.getByTestId('preview-image')).toBeInTheDocument()
  })

  it('renders extracted text fallback for non-pdf non-image', () => {
    render(
      <DocumentPreviewPanel
        document={makeDoc({ mime_type: 'text/plain', extracted_text: 'hello world' })}
      />,
    )
    expect(screen.getByTestId('text-preview')).toBeInTheDocument()
    expect(screen.getByText('hello world')).toBeInTheDocument()
  })

  it('renders unavailable message when no extracted text for unsupported type', () => {
    render(<DocumentPreviewPanel document={makeDoc({ mime_type: 'application/zip', extracted_text: null })} />)
    expect(screen.getByTestId('preview-unavailable')).toBeInTheDocument()
  })

  it('shows filename in toolbar', () => {
    render(<DocumentPreviewPanel document={makeDoc({ filename: 'my-lab-result.pdf' })} />)
    expect(screen.getByText('my-lab-result.pdf')).toBeInTheDocument()
  })

  it('shows zoom label at 100% initially', () => {
    render(<DocumentPreviewPanel document={makeDoc()} />)
    expect(screen.getByTestId('zoom-label').textContent).toBe('100%')
  })

  it('increments zoom on zoom-in click', async () => {
    const user = userEvent.setup()
    render(<DocumentPreviewPanel document={makeDoc()} />)
    await user.click(screen.getByRole('button', { name: /zoom in/i }))
    expect(screen.getByTestId('zoom-label').textContent).toBe('125%')
  })

  it('decrements zoom on zoom-out click', async () => {
    const user = userEvent.setup()
    render(<DocumentPreviewPanel document={makeDoc()} />)
    await user.click(screen.getByRole('button', { name: /zoom out/i }))
    expect(screen.getByTestId('zoom-label').textContent).toBe('75%')
  })

  it('hides zoom controls for non-pdf non-image', () => {
    render(<DocumentPreviewPanel document={makeDoc({ mime_type: 'text/plain' })} />)
    expect(screen.queryByTestId('zoom-label')).toBeNull()
  })
})

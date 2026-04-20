import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DocumentCard } from './DocumentCard'
import type { Document } from '../../store/documentsStore'

vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}))

const makeDoc = (overrides: Partial<Document> = {}): Document => ({
  id: 'doc1',
  filename: 'blood-test.pdf',
  file_path: '/files/doc1.pdf',
  mime_type: 'application/pdf',
  file_size_bytes: 2048,
  category: 'lab',
  thumbnail_path: null,
  notes: null,
  created_at: '2026-04-14T09:00:00Z',
  updated_at: '2026-04-14T09:00:00Z',
  is_deleted: false,
  tags: [],
  ...overrides,
})

describe('DocumentCard', () => {
  it('renders filename', () => {
    render(<DocumentCard document={makeDoc()} onDelete={vi.fn()} />)
    expect(screen.getByText('blood-test.pdf')).toBeTruthy()
  })

  it('renders category label for lab', () => {
    render(<DocumentCard document={makeDoc()} onDelete={vi.fn()} />)
    expect(screen.getByText(/Lab Result/)).toBeTruthy()
  })

  it('renders formatted file size in KB', () => {
    render(<DocumentCard document={makeDoc({ file_size_bytes: 2048 })} onDelete={vi.fn()} />)
    expect(screen.getByText(/2\.0 KB/)).toBeTruthy()
  })

  it('renders formatted file size in MB for large files', () => {
    render(<DocumentCard document={makeDoc({ file_size_bytes: Math.round(1.5 * 1024 * 1024) })} onDelete={vi.fn()} />)
    expect(screen.getByText(/1\.5 MB/)).toBeTruthy()
  })

  it('renders PDF type badge when no thumbnail', () => {
    render(<DocumentCard document={makeDoc()} onDelete={vi.fn()} />)
    expect(screen.getByText('PDF')).toBeTruthy()
  })

  it('renders IMG badge for image mime type', () => {
    render(<DocumentCard document={makeDoc({ mime_type: 'image/jpeg' })} onDelete={vi.fn()} />)
    expect(screen.getByText('IMG')).toBeTruthy()
  })

  it('renders FILE badge for unknown mime type', () => {
    render(<DocumentCard document={makeDoc({ mime_type: 'text/plain' })} onDelete={vi.fn()} />)
    expect(screen.getByText('FILE')).toBeTruthy()
  })

  it('renders thumbnail image when thumbnail_path is set', () => {
    const { container } = render(<DocumentCard document={makeDoc({ thumbnail_path: '/thumbs/doc1.webp' })} onDelete={vi.fn()} />)
    const img = container.querySelector('img')
    expect(img).toBeTruthy()
    expect((img as HTMLImageElement).src).toContain('doc1.webp')
  })

  it('renders tags', () => {
    render(<DocumentCard document={makeDoc({ tags: ['annual', 'blood'] })} onDelete={vi.fn()} />)
    expect(screen.getByText('#annual')).toBeTruthy()
    expect(screen.getByText('#blood')).toBeTruthy()
  })

  it('does not render tag list when tags is empty', () => {
    render(<DocumentCard document={makeDoc({ tags: [] })} onDelete={vi.fn()} />)
    expect(screen.queryByText(/^#/)).toBeNull()
  })

  it('calls onDelete with document id when delete button clicked', async () => {
    const onDelete = vi.fn()
    render(<DocumentCard document={makeDoc()} onDelete={onDelete} />)
    await userEvent.click(screen.getByRole('button', { name: /delete blood-test\.pdf/i }))
    expect(onDelete).toHaveBeenCalledWith('doc1')
  })

  it('View link points to /documents/:id', () => {
    render(<DocumentCard document={makeDoc()} onDelete={vi.fn()} />)
    const viewLink = screen.getByRole('link', { name: 'View' })
    expect((viewLink as HTMLAnchorElement).href).toContain('/documents/view?id=doc1')
  })
})

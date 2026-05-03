import { describe, it, expect } from 'vitest'
import { formatApptDate, docTypeLabel, formatBytes, stripHtml } from '../formatting'

describe('formatApptDate', () => {
  it('formats ISO date string with weekday, day, month, year', () => {
    const result = formatApptDate('2026-06-01T10:00:00Z')
    expect(result).toMatch(/Mon|Tue|Wed|Thu|Fri|Sat|Sun/)
    expect(result).toMatch(/Jun/)
    expect(result).toMatch(/2026/)
  })
})

describe('docTypeLabel', () => {
  it('returns PDF for application/pdf', () => {
    expect(docTypeLabel('application/pdf')).toBe('PDF')
  })

  it('returns uppercased subtype for image mimetypes', () => {
    expect(docTypeLabel('image/jpeg')).toBe('JPEG')
    expect(docTypeLabel('image/png')).toBe('PNG')
    expect(docTypeLabel('image/webp')).toBe('WEBP')
  })

  it('returns FILE for unknown mimetypes', () => {
    expect(docTypeLabel('application/octet-stream')).toBe('FILE')
    expect(docTypeLabel('text/plain')).toBe('FILE')
  })
})

describe('formatBytes', () => {
  it('formats bytes < 1024 as B', () => {
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(0)).toBe('0 B')
  })

  it('formats bytes in KB range', () => {
    expect(formatBytes(2048)).toBe('2 KB')
    expect(formatBytes(1536)).toBe('2 KB')
  })

  it('formats bytes in MB range', () => {
    expect(formatBytes(1048576)).toBe('1.0 MB')
    expect(formatBytes(2621440)).toBe('2.5 MB')
  })
})

describe('stripHtml', () => {
  it('removes HTML tags', () => {
    expect(stripHtml('<p>Hello <b>world</b></p>')).toBe('Hello world')
  })

  it('returns plain text unchanged', () => {
    expect(stripHtml('no tags here')).toBe('no tags here')
  })

  it('handles empty string', () => {
    expect(stripHtml('')).toBe('')
  })

  it('strips self-closing tags', () => {
    expect(stripHtml('line1<br/>line2')).toBe('line1line2')
  })
})

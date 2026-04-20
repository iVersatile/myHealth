import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const mockInvoke = vi.fn()
const mockSave = vi.fn()

vi.mock('@tauri-apps/api/core', () => ({ invoke: (...args: unknown[]) => mockInvoke(...args) }))
vi.mock('@tauri-apps/plugin-dialog', () => ({ save: (...args: unknown[]) => mockSave(...args) }))

vi.mock('pdf-lib', () => {
  const mockPage = {
    drawText: vi.fn(),
    getSize: () => ({ width: 595, height: 842 }),
    getHeight: () => 842,
    drawImage: vi.fn(),
  }
  const mockDoc = {
    embedFont: vi.fn().mockResolvedValue({}),
    addPage: vi.fn().mockReturnValue(mockPage),
    copyPages: vi.fn().mockResolvedValue([mockPage]),
    getPageIndices: vi.fn().mockReturnValue([0]),
    save: vi.fn().mockResolvedValue(new Uint8Array([37, 80, 68, 70])),
    embedJpg: vi.fn().mockResolvedValue({ width: 100, height: 100 }),
    embedPng: vi.fn().mockResolvedValue({ width: 100, height: 100 }),
  }
  return {
    PDFDocument: {
      create: vi.fn().mockResolvedValue(mockDoc),
      load: vi.fn().mockResolvedValue(mockDoc),
    },
    StandardFonts: { Helvetica: 'Helvetica', HelveticaBold: 'Helvetica-Bold' },
    rgb: vi.fn().mockReturnValue({}),
  }
})

const makeBundle = (overrides = {}) => ({
  title: 'My Health Records',
  output_path: '/tmp/out.pdf',
  documents: [],
  ...overrides,
})

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useExport', () => {
  it('initialises with exporting=false and no error', async () => {
    const { useExport } = await import('../useExport')
    const { result } = renderHook(() => useExport())
    expect(result.current.exporting).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('pickOutputPath calls save dialog and returns path', async () => {
    const { useExport } = await import('../useExport')
    mockSave.mockResolvedValueOnce('/home/user/records.pdf')
    const { result } = renderHook(() => useExport())

    let path: string | null = null
    await act(async () => {
      path = await result.current.pickOutputPath('records.pdf')
    })

    expect(mockSave).toHaveBeenCalledWith({
      defaultPath: 'records.pdf',
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    })
    expect(path).toBe('/home/user/records.pdf')
  })

  it('pickOutputPath returns null when dialog is cancelled', async () => {
    const { useExport } = await import('../useExport')
    mockSave.mockResolvedValueOnce(null)
    const { result } = renderHook(() => useExport())

    let path: string | null = 'not-null'
    await act(async () => {
      path = await result.current.pickOutputPath('records.pdf')
    })

    expect(path).toBeNull()
  })

  it('exportBundle calls export_pdf_bundle and export_save_bytes, returns true on success', async () => {
    const { useExport } = await import('../useExport')
    const bundle = makeBundle({ documents: [] })
    mockInvoke.mockResolvedValueOnce(bundle)
    mockInvoke.mockResolvedValueOnce(undefined)

    const { result } = renderHook(() => useExport())

    let success: boolean | undefined
    await act(async () => {
      success = await result.current.exportBundle(['doc-1'], 'My Records', '/tmp/out.pdf')
    })

    expect(success).toBe(true)
    expect(mockInvoke).toHaveBeenCalledWith('export_pdf_bundle', {
      documentIds: ['doc-1'],
      title: 'My Records',
      outputPath: '/tmp/out.pdf',
    })
    expect(mockInvoke).toHaveBeenCalledWith('export_save_bytes', {
      outputPath: '/tmp/out.pdf',
      bytesB64: expect.any(String),
    })
  })

  it('exportBundle returns false and sets error on failure', async () => {
    const { useExport } = await import('../useExport')
    mockInvoke.mockRejectedValueOnce(new Error('DB locked'))

    const { result } = renderHook(() => useExport())

    let success: boolean | undefined
    await act(async () => {
      success = await result.current.exportBundle(['doc-1'], 'My Records', '/tmp/out.pdf')
    })

    expect(success).toBe(false)
    expect(result.current.error).toBe('DB locked')
    expect(result.current.exporting).toBe(false)
  })

  it('exportBundle sets string error for non-Error rejections', async () => {
    const { useExport } = await import('../useExport')
    mockInvoke.mockRejectedValueOnce('something went wrong')

    const { result } = renderHook(() => useExport())

    await act(async () => {
      await result.current.exportBundle(['doc-1'], 'My Records', '/tmp/out.pdf')
    })

    expect(result.current.error).toBe('something went wrong')
  })
})

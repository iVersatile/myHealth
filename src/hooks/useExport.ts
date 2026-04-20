'use client'

import { useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { save } from '@tauri-apps/plugin-dialog'

export interface ExportDocumentItem {
  id: string
  filename: string
  category: string
  notes: string | null
  created_at: string
  mime_type: string
  file_bytes_b64: string | null
}

export interface ExportBundleData {
  title: string
  output_path: string
  documents: ExportDocumentItem[]
}

export function useExport() {
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function pickOutputPath(defaultName: string): Promise<string | null> {
    const path = await save({
      defaultPath: defaultName,
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    })
    return path ?? null
  }

  async function exportBundle(
    documentIds: string[],
    title: string,
    outputPath: string,
  ): Promise<boolean> {
    setExporting(true)
    setError(null)
    try {
      const bundle = await invoke<ExportBundleData>('export_pdf_bundle', {
        documentIds,
        title,
        outputPath,
      })
      const pdfBytes = await assemblePdf(bundle)
      const bytesB64 = bytesToBase64(pdfBytes)
      await invoke('export_save_bytes', { outputPath, bytesB64 })
      return true
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
      return false
    } finally {
      setExporting(false)
    }
  }

  return { exporting, error, exportBundle, pickOutputPath }
}

async function assemblePdf(bundle: ExportBundleData): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib')

  const pdfDoc = await PDFDocument.create()
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  addCoverPage(pdfDoc, bundle.title, helveticaBold, helvetica, rgb)
  addTocPage(pdfDoc, bundle.documents, helveticaBold, helvetica, rgb)

  for (const doc of bundle.documents) {
    if (!doc.file_bytes_b64) continue
    const bytes = base64ToBytes(doc.file_bytes_b64)

    if (doc.mime_type === 'application/pdf') {
      const embedded = await PDFDocument.load(bytes)
      const pages = await pdfDoc.copyPages(embedded, embedded.getPageIndices())
      for (const page of pages) pdfDoc.addPage(page)
    } else if (doc.mime_type === 'image/jpeg' || doc.mime_type === 'image/jpg') {
      const img = await pdfDoc.embedJpg(bytes)
      const page = pdfDoc.addPage()
      const { width, height } = page.getSize()
      const scale = Math.min(width / img.width, height / img.height, 1)
      page.drawImage(img, {
        x: (width - img.width * scale) / 2,
        y: (height - img.height * scale) / 2,
        width: img.width * scale,
        height: img.height * scale,
      })
    } else if (doc.mime_type === 'image/png') {
      const img = await pdfDoc.embedPng(bytes)
      const page = pdfDoc.addPage()
      const { width, height } = page.getSize()
      const scale = Math.min(width / img.width, height / img.height, 1)
      page.drawImage(img, {
        x: (width - img.width * scale) / 2,
        y: (height - img.height * scale) / 2,
        width: img.width * scale,
        height: img.height * scale,
      })
    } else {
      const page = pdfDoc.addPage()
      page.drawText(`[${doc.filename} — unsupported format]`, {
        x: 50,
        y: page.getHeight() - 100,
        size: 14,
        font: helvetica,
        color: rgb(0.4, 0.4, 0.4),
      })
    }
  }

  return pdfDoc.save()
}

type RgbFn = (r: number, g: number, b: number) => import('pdf-lib').RGB

function addCoverPage(
  pdfDoc: import('pdf-lib').PDFDocument,
  title: string,
  bold: import('pdf-lib').PDFFont,
  regular: import('pdf-lib').PDFFont,
  rgb: RgbFn,
) {
  const page = pdfDoc.addPage()
  const { width, height } = page.getSize()
  const now = new Date().toLocaleDateString('en-GB', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  page.drawText(title, {
    x: 60,
    y: height / 2 + 30,
    size: 28,
    font: bold,
    color: rgb(0.1, 0.1, 0.1),
    maxWidth: width - 120,
  })
  page.drawText(`Generated ${now}`, {
    x: 60,
    y: height / 2 - 10,
    size: 12,
    font: regular,
    color: rgb(0.5, 0.5, 0.5),
  })
}

function addTocPage(
  pdfDoc: import('pdf-lib').PDFDocument,
  docs: ExportDocumentItem[],
  bold: import('pdf-lib').PDFFont,
  regular: import('pdf-lib').PDFFont,
  rgb: RgbFn,
) {
  const page = pdfDoc.addPage()
  const { height } = page.getSize()
  let y = height - 80

  page.drawText('Contents', {
    x: 60,
    y,
    size: 20,
    font: bold,
    color: rgb(0.1, 0.1, 0.1),
  })
  y -= 40

  for (const doc of docs) {
    if (y < 60) break
    page.drawText(`• ${doc.filename}`, {
      x: 60,
      y,
      size: 12,
      font: regular,
      color: rgb(0.2, 0.2, 0.2),
      maxWidth: 480,
    })
    y -= 24
  }
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!)
  }
  return btoa(binary)
}

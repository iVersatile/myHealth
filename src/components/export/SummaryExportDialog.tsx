'use client'

import { useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { save } from '@tauri-apps/plugin-dialog'
import { IPC, extractTauriError } from '../../lib/ipc'

interface SummaryDocumentItem {
  id: string
  filename: string
  category: string
  notes: string | null
  created_at: string
  extracted_text: string | null
}

interface SummaryAppointmentItem {
  id: string
  title: string
  doctor_name: string | null
  specialty: string | null
  appt_date: string
  notes: string | null
}

interface SummaryContactItem {
  id: string
  name: string
  role: string
  specialty: string | null
  phone: string | null
  email: string | null
}

interface SummaryData {
  documents: SummaryDocumentItem[]
  appointments: SummaryAppointmentItem[]
  contacts: SummaryContactItem[]
}

interface SummaryExportDialogProps {
  onClose: () => void
}

export function SummaryExportDialog({ onClose }: SummaryExportDialogProps) {
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [includeDocuments, setIncludeDocuments] = useState(true)
  const [includeAppointments, setIncludeAppointments] = useState(true)
  const [includeContacts, setIncludeContacts] = useState(true)
  const [outputPath, setOutputPath] = useState('')
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function handlePickPath() {
    const path = await save({
      defaultPath: 'health-summary.pdf',
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    })
    if (path) setOutputPath(path)
  }

  async function handleExport() {
    if (!outputPath) return
    setExporting(true)
    setError(null)
    try {
      const data = await invoke<SummaryData>(IPC.exportPdfSummaryBytes, {
        dateFrom: dateFrom || null,
        dateTo: dateTo || null,
        includeDocuments,
        includeAppointments,
        includeContacts,
      })
      const pdfBytes = await assembleSummaryPdf(data, dateFrom, dateTo)
      const bytesB64 = bytesToBase64(pdfBytes)
      await invoke(IPC.exportSaveBytes, { outputPath, bytesB64 })
      setDone(true)
    } catch (err: unknown) {
      setError(extractTauriError(err))
    } finally {
      setExporting(false)
    }
  }

  const canExport =
    outputPath.trim().length > 0 &&
    (includeDocuments || includeAppointments || includeContacts)

  const inputCls =
    'w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-3 py-2 text-[var(--text-sm)] text-[var(--color-text)] placeholder:text-[var(--color-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]'

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="summary-export-title"
      className="fixed inset-0 z-50 flex items-center justify-center"
    >
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative z-10 w-full max-w-md rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-lg)]">
        <div className="mb-5 flex items-center justify-between">
          <h2
            id="summary-export-title"
            className="text-[var(--text-lg)] font-semibold text-[var(--color-text)]"
          >
            Export Health Summary
          </h2>
          <button
            type="button"
            aria-label="Close dialog"
            onClick={onClose}
            className="rounded-[var(--radius-sm)] p-1 text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-sunken)]"
          >
            ✕
          </button>
        </div>

        {done ? (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <span className="text-4xl">✓</span>
            <p className="text-[var(--text-sm)] text-[var(--color-text)]">
              Summary exported successfully.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="rounded-[var(--radius-md)] bg-[var(--color-primary)] px-6 py-2 text-[var(--text-sm)] font-medium text-[var(--color-text-inverse)] hover:bg-[var(--color-primary-hover)]"
            >
              Done
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {/* Date range */}
            <fieldset className="flex flex-col gap-2">
              <legend className="text-[var(--text-sm)] font-medium text-[var(--color-text)]">
                Date Range{' '}
                <span className="font-normal text-[var(--color-text-secondary)]">
                  (optional — leave blank for all)
                </span>
              </legend>
              <div className="flex gap-3">
                <div className="flex flex-1 flex-col gap-1">
                  <label
                    htmlFor="summary-from"
                    className="text-[var(--text-xs)] text-[var(--color-text-secondary)]"
                  >
                    From
                  </label>
                  <input
                    id="summary-from"
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div className="flex flex-1 flex-col gap-1">
                  <label
                    htmlFor="summary-to"
                    className="text-[var(--text-xs)] text-[var(--color-text-secondary)]"
                  >
                    To
                  </label>
                  <input
                    id="summary-to"
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className={inputCls}
                  />
                </div>
              </div>
            </fieldset>

            {/* Include sections */}
            <fieldset className="flex flex-col gap-2">
              <legend className="text-[var(--text-sm)] font-medium text-[var(--color-text)]">
                Include
              </legend>
              {[
                { id: 'inc-docs', label: 'Documents', value: includeDocuments, set: setIncludeDocuments },
                { id: 'inc-appts', label: 'Appointments', value: includeAppointments, set: setIncludeAppointments },
                { id: 'inc-contacts', label: 'Contacts', value: includeContacts, set: setIncludeContacts },
              ].map(({ id, label, value, set }) => (
                <label
                  key={id}
                  htmlFor={id}
                  className="flex cursor-pointer items-center gap-2 text-[var(--text-sm)] text-[var(--color-text)]"
                >
                  <input
                    id={id}
                    type="checkbox"
                    checked={value}
                    onChange={(e) => set(e.target.checked)}
                    className="h-4 w-4 rounded accent-[var(--color-primary)]"
                  />
                  {label}
                </label>
              ))}
            </fieldset>

            {/* Output path */}
            <div className="flex flex-col gap-1">
              <label
                htmlFor="summary-path"
                className="text-[var(--text-sm)] font-medium text-[var(--color-text)]"
              >
                Save to
              </label>
              <div className="flex gap-2">
                <input
                  id="summary-path"
                  type="text"
                  readOnly
                  value={outputPath}
                  placeholder="Click Browse to choose location…"
                  className={inputCls + ' cursor-default'}
                />
                <button
                  type="button"
                  onClick={() => void handlePickPath()}
                  className="shrink-0 rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2 text-[var(--text-sm)] text-[var(--color-text)] hover:bg-[var(--color-surface-sunken)]"
                  aria-label="Browse for output location"
                >
                  📁
                </button>
              </div>
            </div>

            {error && (
              <p className="rounded-[var(--radius-md)] border border-[var(--color-danger)] px-3 py-2 text-[var(--text-sm)] text-[var(--color-danger)]">
                {error}
              </p>
            )}

            <div className="flex justify-end gap-3 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-4 py-2 text-[var(--text-sm)] text-[var(--color-text)] transition-colors duration-[var(--duration-fast)] hover:bg-[var(--color-surface-sunken)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleExport()}
                disabled={!canExport || exporting}
                className="rounded-[var(--radius-md)] bg-[var(--color-primary)] px-4 py-2 text-[var(--text-sm)] font-medium text-[var(--color-text-inverse)] transition-colors duration-[var(--duration-fast)] hover:bg-[var(--color-primary-hover)] disabled:opacity-40"
              >
                {exporting ? 'Exporting…' : 'Export PDF'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

async function assembleSummaryPdf(
  data: SummaryData,
  dateFrom: string,
  dateTo: string,
): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib')

  const pdfDoc = await PDFDocument.create()
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica)

  const now = new Date().toLocaleDateString('en-GB', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  const rangeLabel =
    dateFrom || dateTo
      ? `${dateFrom || 'beginning'} – ${dateTo || 'today'}`
      : 'All dates'

  // Cover page
  const cover = pdfDoc.addPage()
  const { width: cw, height: ch } = cover.getSize()
  cover.drawText('Health Summary Report', {
    x: 60,
    y: ch / 2 + 40,
    size: 26,
    font: bold,
    color: rgb(0.1, 0.1, 0.1),
    maxWidth: cw - 120,
  })
  cover.drawText(rangeLabel, {
    x: 60,
    y: ch / 2,
    size: 13,
    font: regular,
    color: rgb(0.3, 0.3, 0.3),
  })
  cover.drawText(`Generated ${now}`, {
    x: 60,
    y: ch / 2 - 24,
    size: 11,
    font: regular,
    color: rgb(0.5, 0.5, 0.5),
  })

  function addSection(title: string, rows: string[][], headers: string[]) {
    if (rows.length === 0) return

    const page = pdfDoc.addPage()
    const { width, height } = page.getSize()
    const marginX = 50
    let y = height - 70

    page.drawText(title, {
      x: marginX,
      y,
      size: 18,
      font: bold,
      color: rgb(0.1, 0.1, 0.1),
    })
    y -= 30

    const colW = (width - marginX * 2) / headers.length
    headers.forEach((h, i) => {
      page.drawText(h, {
        x: marginX + i * colW,
        y,
        size: 10,
        font: bold,
        color: rgb(0.3, 0.3, 0.3),
        maxWidth: colW - 8,
      })
    })
    y -= 18

    page.drawLine({
      start: { x: marginX, y },
      end: { x: width - marginX, y },
      thickness: 0.5,
      color: rgb(0.7, 0.7, 0.7),
    })
    y -= 14

    for (const row of rows) {
      if (y < 60) {
        pdfDoc.addPage()
        y = pdfDoc.getPage(pdfDoc.getPageCount() - 1).getHeight() - 70
      }
      const activePage = pdfDoc.getPage(pdfDoc.getPageCount() - 1)
      row.forEach((cell, i) => {
        activePage.drawText(cell, {
          x: marginX + i * colW,
          y,
          size: 10,
          font: regular,
          color: rgb(0.15, 0.15, 0.15),
          maxWidth: colW - 8,
        })
      })
      y -= 20
    }
  }

  if (data.documents.length > 0) {
    addSection(
      'Documents',
      data.documents.map((d) => [
        d.filename,
        d.category,
        formatDate(d.created_at),
        d.notes ?? '',
      ]),
      ['Filename', 'Category', 'Date', 'Notes'],
    )
  }

  if (data.appointments.length > 0) {
    addSection(
      'Appointments',
      data.appointments.map((a) => [
        a.title,
        a.doctor_name ?? '',
        a.specialty ?? '',
        formatDate(a.appt_date),
        a.notes ?? '',
      ]),
      ['Title', 'Doctor', 'Specialty', 'Date', 'Notes'],
    )
  }

  if (data.contacts.length > 0) {
    addSection(
      'Contacts',
      data.contacts.map((c) => [
        c.name,
        c.role,
        c.specialty ?? '',
        c.phone ?? '',
        c.email ?? '',
      ]),
      ['Name', 'Role', 'Specialty', 'Phone', 'Email'],
    )
  }

  return pdfDoc.save()
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-GB', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return iso
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!)
  }
  return btoa(binary)
}

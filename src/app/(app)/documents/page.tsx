'use client'

import { useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { DocumentList } from '../../../components/documents/DocumentList'
import { UploadDialog } from '../../../components/documents/UploadDialog'
import { ExportDialog } from '../../../components/export/ExportDialog'
import { DoctorSuggestionBanner } from '../../../components/documents/DoctorSuggestionBanner'
import { LinkSuggestionBanner } from '../../../components/documents/LinkSuggestionBanner'
import { ContactForm } from '../../../components/contacts/ContactForm'
import { useDocumentsStore } from '../../../store/documentsStore'
import { useContacts } from '../../../hooks/useContacts'
import type { Document } from '../../../store/documentsStore'
import type { ContactCreateInput } from '../../../hooks/useContacts'

export default function DocumentsPage() {
  const [uploadOpen, setUploadOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [doctorCandidates, setDoctorCandidates] = useState<string[]>([])
  const [showContactForm, setShowContactForm] = useState(false)
  const [pendingDoctorName, setPendingDoctorName] = useState<string | null>(null)
  const [linkSuggestion, setLinkSuggestion] = useState<{
    appointmentId: string
    appointmentTitle: string
    documentId: string
  } | null>(null)
  const { documents, total, setDocuments } = useDocumentsStore()
  const { createContact } = useContacts()

  async function handleUploaded(doc: Document) {
    setDocuments([doc, ...documents], total + 1)
    try {
      const metadata = await invoke<{ doctor_candidates?: string[] }>(
        'documents_run_extraction',
        { id: doc.id },
      )
      setDoctorCandidates(metadata.doctor_candidates ?? [])
    } catch {
      // extraction is best-effort; ignore failures
    }
    try {
      const suggestion = await invoke<{
        appointment_id: string
        appointment_title: string
        score: number
      } | null>('links_score_candidates', { documentId: doc.id })
      if (suggestion) {
        setLinkSuggestion({
          appointmentId: suggestion.appointment_id,
          appointmentTitle: suggestion.appointment_title,
          documentId: doc.id,
        })
      }
    } catch {
      // scoring is best-effort; ignore failures
    }
  }

  async function handleLinkConfirm(appointmentId: string) {
    if (!linkSuggestion) return
    try {
      await invoke('links_create', {
        input: {
          document_id: linkSuggestion.documentId,
          appointment_id: appointmentId,
          link_type: 'related',
          confidence: 'auto',
        },
      })
    } catch {
      // best-effort
    }
    setLinkSuggestion(null)
  }

  function handleBannerAccept(name: string) {
    setPendingDoctorName(name)
    setDoctorCandidates([])
    setShowContactForm(true)
  }

  async function handleContactSave(data: ContactCreateInput) {
    await createContact(data)
    setShowContactForm(false)
    setPendingDoctorName(null)
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-[var(--text-2xl)] font-semibold text-[var(--color-text)]">
          Documents
        </h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setExportOpen(true)}
            className="flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-border)] px-4 py-2 text-[var(--text-sm)] font-medium text-[var(--color-text)] transition-colors duration-[var(--duration-fast)] hover:bg-[var(--color-surface-sunken)]"
          >
            ↓ Export PDF
          </button>
          <button
            type="button"
            onClick={() => setUploadOpen(true)}
            className="flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--color-primary)] px-4 py-2 text-[var(--text-sm)] font-medium text-[var(--color-text-inverse)] transition-colors duration-[var(--duration-fast)] hover:bg-[var(--color-primary-hover)]"
          >
            ↑ Upload
          </button>
        </div>
      </div>

      {doctorCandidates.length > 0 && (
        <div className="mb-4">
          <DoctorSuggestionBanner
            candidates={doctorCandidates}
            onAccept={handleBannerAccept}
            onDismiss={() => setDoctorCandidates([])}
          />
        </div>
      )}

      {linkSuggestion && (
        <div className="mb-4">
          <LinkSuggestionBanner
            appointmentId={linkSuggestion.appointmentId}
            appointmentTitle={linkSuggestion.appointmentTitle}
            onConfirm={(id) => void handleLinkConfirm(id)}
            onDismiss={() => setLinkSuggestion(null)}
          />
        </div>
      )}

      <DocumentList />

      {uploadOpen && (
        <UploadDialog
          onClose={() => setUploadOpen(false)}
          onUploaded={(doc) => void handleUploaded(doc)}
        />
      )}
      {exportOpen && (
        <ExportDialog onClose={() => setExportOpen(false)} />
      )}
      {showContactForm && (
        <ContactForm
          initial={pendingDoctorName ? { id: '', name: pendingDoctorName, role: 'gp', specialty: null, phone: null, email: null, clinic: null, address: null, notes: null, created_at: '', updated_at: '' } : null}
          onSave={(data) => handleContactSave(data as ContactCreateInput)}
          onCancel={() => {
            setShowContactForm(false)
            setPendingDoctorName(null)
          }}
        />
      )}
    </div>
  )
}

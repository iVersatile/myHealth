'use client'

import { useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { DocumentList } from '../../../components/documents/DocumentList'
import { UploadDialog } from '../../../components/documents/UploadDialog'
import { ExportDialog } from '../../../components/export/ExportDialog'
import { SummaryExportDialog } from '../../../components/export/SummaryExportDialog'
import { DoctorSuggestionBanner } from '../../../components/documents/DoctorSuggestionBanner'
import type { ContactSuggestion } from '../../../components/documents/DoctorSuggestionBanner'
import { LinkSuggestionBanner } from '../../../components/documents/LinkSuggestionBanner'
import { ApptSuggestionBanner } from '../../../components/documents/ApptSuggestionBanner'
import type { AppointmentSuggestion } from '../../../components/documents/ApptSuggestionBanner'
import { ContactForm } from '../../../components/contacts/ContactForm'
import { useDocumentsStore } from '../../../store/documentsStore'
import { useContacts } from '../../../hooks/useContacts'
import { useAppointmentsStore } from '../../../store/appointmentsStore'
import type { Document } from '../../../store/documentsStore'
import type { Appointment } from '../../../store/appointmentsStore'
import type { ContactCreateInput } from '../../../hooks/useContacts'

export default function DocumentsPage() {
  const [uploadOpen, setUploadOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [summaryExportOpen, setSummaryExportOpen] = useState(false)
  const [doctorCandidates, setDoctorCandidates] = useState<string[]>([])
  const [extractedContactSuggestions, setExtractedContactSuggestions] = useState<ContactSuggestion[]>([])
  const [showContactForm, setShowContactForm] = useState(false)
  const [pendingContactSuggestion, setPendingContactSuggestion] = useState<ContactSuggestion | null>(null)
  const [linkSuggestion, setLinkSuggestion] = useState<{
    appointmentId: string
    appointmentTitle: string
    documentId: string
  } | null>(null)
  const [apptSuggestion, setApptSuggestion] = useState<{
    suggestion: AppointmentSuggestion
    documentId: string
  } | null>(null)
  const [apptSuggestionLoading, setApptSuggestionLoading] = useState(false)
  const documents = useDocumentsStore(s => s.documents)
  const total = useDocumentsStore(s => s.total)
  const setDocuments = useDocumentsStore(s => s.setDocuments)
  const { createContact, updateContact } = useContacts()
  const upsertAppointment = useAppointmentsStore(s => s.upsertAppointment)

  async function handleUploaded(doc: Document) {
    setDocuments([doc, ...documents], total + 1)
    try {
      const metadata = await invoke<{ doctor_candidates?: string[]; contact_suggestions?: ContactSuggestion[] }>(
        'documents_run_extraction',
        { id: doc.id },
      )
      setDoctorCandidates(metadata.doctor_candidates ?? [])
      setExtractedContactSuggestions(metadata.contact_suggestions ?? [])
    } catch {
      // extraction is best-effort; ignore failures
    }
    try {
      const candidates = await invoke<Array<{
        appointment_id: string
        appointment_title: string
        score: number
      }>>('links_score_candidates', { documentId: doc.id })
      const suggestion = candidates[0] ?? null
      if (suggestion) {
        setLinkSuggestion({
          appointmentId: suggestion.appointment_id,
          appointmentTitle: suggestion.appointment_title,
          documentId: doc.id,
        })
      } else {
        try {
          const appt = await invoke<AppointmentSuggestion | null>(
            'appointments_suggest_from_document',
            { id: doc.id },
          )
          if (appt) {
            setApptSuggestion({ suggestion: appt, documentId: doc.id })
          }
        } catch {
          // best-effort
        }
      }
    } catch {
      // scoring is best-effort; ignore failures
    }
  }

  async function handleApptSuggestionConfirm() {
    if (!apptSuggestion || apptSuggestionLoading) return
    setApptSuggestionLoading(true)
    try {
      const { suggestion, documentId } = apptSuggestion
      const rawDate = suggestion.appt_date
      const apptDate = rawDate.includes('T') ? rawDate : `${rawDate}T00:00:00`
      const appt = await invoke<Appointment>('appointments_create', {
        input: {
          title: suggestion.title,
          appt_date: apptDate,
          doctor_name: suggestion.doctor_name ?? null,
          clinic_name: suggestion.clinic_name ?? null,
          specialty: suggestion.specialty ?? null,
          notes: null,
          status: 'completed',
        },
      })
      await invoke('link_document_to_appointment', {
        userId: '',
        documentId,
        appointmentId: appt.id,
        score: 100,
      })
      upsertAppointment(appt)
    } catch {
      // best-effort
    } finally {
      setApptSuggestionLoading(false)
      setApptSuggestion(null)
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

  function handleBannerAccept(suggestion: ContactSuggestion) {
    setPendingContactSuggestion(suggestion)
    setDoctorCandidates([])
    setExtractedContactSuggestions([])
    setShowContactForm(true)
  }

  async function handleContactSave(data: ContactCreateInput) {
    const personContact = await createContact(data)

    // Auto-create the clinic as a separate contact when the accepted suggestion
    // carries a clinic name — the invoice's phone/email/address belong to the
    // clinic, so we copy them across. Then link the person contact to the clinic.
    if (pendingContactSuggestion?.clinic) {
      const s = pendingContactSuggestion
      const clinicContact = await createContact({
        name: s.clinic!,
        role: 'clinic',
        specialty: null,
        phone: s.phone ?? null,
        email: s.email ?? null,
        clinic: null,
        address: s.address ?? null,
        notes: null,
      })
      await updateContact({ id: personContact.id, contact_clinic_id: clinicContact.id })
    }

    setShowContactForm(false)
    setPendingContactSuggestion(null)
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
            onClick={() => setSummaryExportOpen(true)}
            className="flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-border)] px-4 py-2 text-[var(--text-sm)] font-medium text-[var(--color-text)] transition-colors duration-[var(--duration-fast)] hover:bg-[var(--color-surface-sunken)]"
          >
            ↓ Summary PDF
          </button>
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

      {(extractedContactSuggestions.length > 0 || doctorCandidates.length > 0) && (
        <div className="mb-4">
          <DoctorSuggestionBanner
            candidates={extractedContactSuggestions.length > 0
              ? extractedContactSuggestions
              : doctorCandidates.map(name => ({ name, title: null, specialty: null, clinic: null, address: null, phone: null, email: null }))}
            onAccept={handleBannerAccept}
            onDismiss={() => { setDoctorCandidates([]); setExtractedContactSuggestions([]) }}
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

      {apptSuggestion && (
        <div className="mb-4">
          <ApptSuggestionBanner
            suggestion={apptSuggestion.suggestion}
            onConfirm={() => void handleApptSuggestionConfirm()}
            onDismiss={() => setApptSuggestion(null)}
            isLoading={apptSuggestionLoading}
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
      {summaryExportOpen && (
        <SummaryExportDialog onClose={() => setSummaryExportOpen(false)} />
      )}
      {showContactForm && (
        <ContactForm
          initial={pendingContactSuggestion ? { id: '', name: pendingContactSuggestion.name, role: 'gp', specialty: pendingContactSuggestion.specialty, phone: pendingContactSuggestion.phone, email: pendingContactSuggestion.email, clinic: pendingContactSuggestion.clinic, address: pendingContactSuggestion.address, notes: null, created_at: '', updated_at: '', contact_clinic_id: null } : null}
          onSave={(data) => handleContactSave(data as ContactCreateInput)}
          onCancel={() => {
            setShowContactForm(false)
            setPendingContactSuggestion(null)
          }}
        />
      )}
    </div>
  )
}

'use client'

import { useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { useToast } from '../../../hooks/useToast'
import { Toast } from '../../../components/shared/Toast'
import { DocumentList } from '../../../components/documents/DocumentList'
import { UploadDialog } from '../../../components/documents/UploadDialog'
import { ExportDialog } from '../../../components/export/ExportDialog'
import { SummaryExportDialog } from '../../../components/export/SummaryExportDialog'
import { DoctorSuggestionBanner } from '../../../components/documents/DoctorSuggestionBanner'
import type { ContactSuggestion } from '../../../components/documents/DoctorSuggestionBanner'
import { ClinicSuggestionBanner } from '../../../components/documents/ClinicSuggestionBanner'
import type { ClinicSuggestion, ContactSuggestion as UploadContactSuggestion } from '../../../components/documents/UploadDialog'
import { LinkSuggestionBanner } from '../../../components/documents/LinkSuggestionBanner'
import { ApptSuggestionBanner } from '../../../components/documents/ApptSuggestionBanner'
import type { AppointmentSuggestion } from '../../../components/documents/ApptSuggestionBanner'
import { ContactForm } from '../../../components/contacts/ContactForm'
import { DocumentPreviewPanel } from '../../../components/documents/DocumentPreviewPanel'
import { VaultLayout } from '../../../components/layout/VaultLayout'
import { useDocumentsStore } from '../../../store/documentsStore'

const REDESIGN_A = process.env.NEXT_PUBLIC_REDESIGN_A === 'true'
import { useContacts } from '../../../hooks/useContacts'
import { useAppointmentsStore } from '../../../store/appointmentsStore'
import type { Document } from '../../../store/documentsStore'
import type { Appointment } from '../../../store/appointmentsStore'
import type { ContactCreateInput, ContactCreateWithClinicInput } from '../../../hooks/useContacts'

function extractMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err) return String((err as { message: unknown }).message)
  if (err instanceof Error) return err.message
  return 'An error occurred'
}

export default function DocumentsPage() {
  const toast = useToast()
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
  const [draftAppointmentId, setDraftAppointmentId] = useState<string | null>(null)
  const [pendingClinicSuggestions, setPendingClinicSuggestions] = useState<ClinicSuggestion[]>([])
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null)
  const documents = useDocumentsStore(s => s.documents)
  const total = useDocumentsStore(s => s.total)
  const setDocuments = useDocumentsStore(s => s.setDocuments)
  const { createContactWithClinic } = useContacts()
  const upsertAppointment = useAppointmentsStore(s => s.upsertAppointment)

  async function handleUploaded(doc: Document, unsavedClinics: ClinicSuggestion[], contactSuggestions: UploadContactSuggestion[], apptDraftId: string | null) {
    if (contactSuggestions.length > 0) setExtractedContactSuggestions(contactSuggestions)
    if (unsavedClinics.length > 0) setPendingClinicSuggestions(unsavedClinics)
    setDraftAppointmentId(apptDraftId)
    setDocuments([doc, ...documents], total + 1)
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
        } catch (err) {
          toast.show(extractMessage(err))
        }
      }
    } catch (err) {
      toast.show(extractMessage(err))
    }
  }

  async function handleApptSuggestionConfirm(doctorName: string | null) {
    if (!apptSuggestion || apptSuggestionLoading) return
    setApptSuggestionLoading(true)
    try {
      const { suggestion, documentId } = apptSuggestion
      const rawDate = suggestion.appt_date
      const apptDate = rawDate.includes('T') ? rawDate : `${rawDate}T00:00:00`
      const title = doctorName === null
        ? suggestion.title.replace(/\s+with\s+[^—–-][^—–]*/i, '').trim()
        : suggestion.title
      const appt = await invoke<Appointment>('appointments_create', {
        input: {
          title,
          appt_date: apptDate,
          doctor_name: doctorName,
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
      if (draftAppointmentId) {
        await invoke('reject_draft_entity', { entityType: 'appointment', entityId: draftAppointmentId }).catch(() => {})
        setDraftAppointmentId(null)
      }
    } catch (err) {
      toast.show(extractMessage(err))
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
    } catch (err) {
      toast.show(extractMessage(err))
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
    const s = pendingContactSuggestion
    const input: ContactCreateWithClinicInput = {
      ...data,
      clinic_name: s?.clinic ?? null,
      clinic_phone: s?.phone ?? null,
      clinic_email: s?.email ?? null,
      clinic_address: s?.address ?? null,
    }
    await createContactWithClinic(input)
    if (s?.draft_id) {
      await invoke('reject_draft_entity', { entityType: 'contact', entityId: s.draft_id }).catch(() => {})
    }
    setShowContactForm(false)
    setPendingContactSuggestion(null)
  }

  if (REDESIGN_A) {
    return <VaultLayout documents={documents} />
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
            data-testid="upload-btn"
            type="button"
            onClick={() => setUploadOpen(true)}
            className="flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--color-primary)] px-4 py-2 text-[var(--text-sm)] font-medium text-[var(--color-text-inverse)] transition-colors duration-[var(--duration-fast)] hover:bg-[var(--color-primary-hover)]"
          >
            ↑ Upload
          </button>
        </div>
      </div>

      {pendingClinicSuggestions.length > 0 && (
        <div className="mb-4">
          <ClinicSuggestionBanner
            suggestions={pendingClinicSuggestions}
            onDismiss={() => setPendingClinicSuggestions([])}
          />
        </div>
      )}

      {(extractedContactSuggestions.length > 0 || doctorCandidates.length > 0) && (
        <div className="mb-4">
          <DoctorSuggestionBanner
            candidates={extractedContactSuggestions.length > 0
              ? extractedContactSuggestions
              : doctorCandidates.map(name => ({ draft_id: null, name, title: null, specialty: null, clinic: null, address: null, phone: null, email: null }))}
            onAccept={handleBannerAccept}
            onDismiss={() => { setDoctorCandidates([]); setExtractedContactSuggestions([]) }}
            appointmentId={linkSuggestion?.appointmentId ?? null}
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
            onConfirm={(doctorName) => void handleApptSuggestionConfirm(doctorName)}
            onDismiss={() => {
              if (draftAppointmentId) {
                void invoke('reject_draft_entity', { entityType: 'appointment', entityId: draftAppointmentId }).catch(() => {})
                setDraftAppointmentId(null)
              }
              setApptSuggestion(null)
            }}
            isLoading={apptSuggestionLoading}
          />
        </div>
      )}

      <div className="flex gap-4">
        <div className="min-w-0 flex-1" data-testid="document-list-panel">
          <DocumentList
            onPreview={setPreviewDoc}
            previewDocId={previewDoc?.id}
            onDeleted={(id) => { if (previewDoc?.id === id) setPreviewDoc(null) }}
          />
        </div>
        {previewDoc && (
          <div className="w-[420px] shrink-0" data-testid="document-preview-panel-wrapper">
            <DocumentPreviewPanel document={previewDoc} />
          </div>
        )}
      </div>

      {uploadOpen && (
        <UploadDialog
          onClose={() => setUploadOpen(false)}
          onUploaded={(doc, unsaved, contacts, apptDraftId) => void handleUploaded(doc, unsaved, contacts, apptDraftId)}
        />
      )}
      {exportOpen && (
        <ExportDialog onClose={() => setExportOpen(false)} />
      )}
      {summaryExportOpen && (
        <SummaryExportDialog onClose={() => setSummaryExportOpen(false)} />
      )}
      <Toast message={toast.message} />
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

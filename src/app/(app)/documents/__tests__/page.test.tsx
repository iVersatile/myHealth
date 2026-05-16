import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import DocumentsPage from '../page'

const mockInvoke = vi.fn()
vi.mock('@tauri-apps/api/core', () => ({ invoke: (...a: unknown[]) => mockInvoke(...a) }))

const mockToastShow = vi.fn()
vi.mock('../../../../hooks/useToast', () => ({
  useToast: () => ({ show: mockToastShow, message: null }),
}))

const mockSetDocuments = vi.fn()
vi.mock('../../../../store/documentsStore', () => ({
  useDocumentsStore: (sel: (s: unknown) => unknown) =>
    sel({ documents: [], total: 0, setDocuments: mockSetDocuments }),
}))

const mockUpsertAppointment = vi.fn()
vi.mock('../../../../store/appointmentsStore', () => ({
  useAppointmentsStore: (sel: (s: unknown) => unknown) =>
    sel({ upsertAppointment: mockUpsertAppointment }),
}))

vi.mock('../../../../hooks/useContacts', () => ({
  useContacts: () => ({ createContactWithClinic: vi.fn() }),
}))

vi.mock('../../../../components/shared/Toast', () => ({ Toast: () => null }))
vi.mock('../../../../components/layout/VaultLayout', () => ({ VaultLayout: () => null }))
vi.mock('../../../../components/export/ExportDialog', () => ({ ExportDialog: () => null }))
vi.mock('../../../../components/export/SummaryExportDialog', () => ({
  SummaryExportDialog: () => null,
}))
vi.mock('../../../../components/contacts/ContactForm', () => ({ ContactForm: () => null }))
vi.mock('../../../../components/documents/DocumentPreviewPanel', () => ({
  DocumentPreviewPanel: () => null,
}))
vi.mock('../../../../components/documents/DoctorSuggestionBanner', () => ({
  DoctorSuggestionBanner: () => null,
}))
vi.mock('../../../../components/documents/ClinicSuggestionBanner', () => ({
  ClinicSuggestionBanner: () => null,
}))
vi.mock('../../../../components/documents/LinkSuggestionBanner', () => ({
  LinkSuggestionBanner: () => null,
}))

vi.mock('../../../../components/documents/DocumentList', () => ({
  DocumentList: ({
    onPreview,
    onDeleted,
  }: {
    onPreview?: (doc: unknown) => void
    onDeleted?: (id: string) => void
    previewDocId?: string
  }) => (
    <div data-testid="document-list">
      <button
        onClick={() =>
          onPreview?.({
            id: 'doc-1',
            filename: 'invoice.pdf',
            file_path: '/files/doc-1.pdf',
            mime_type: 'application/pdf',
            file_size_bytes: 1024,
            category: 'invoice',
            thumbnail_path: null,
            notes: null,
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-01T00:00:00Z',
            is_deleted: false,
            document_date: null,
            tags: [],
          })
        }
      >
        Preview
      </button>
      <button onClick={() => onDeleted?.('doc-1')}>Delete</button>
    </div>
  ),
}))

vi.mock('../../../../components/documents/UploadDialog', () => ({
  UploadDialog: ({
    onClose,
    onUploaded,
  }: {
    onClose: () => void
    onUploaded: (doc: unknown, clinics: unknown[], contacts: unknown[]) => void
  }) => (
    <div>
      <button
        onClick={() =>
          onUploaded(
            {
              id: 'doc-1',
              filename: 'invoice.pdf',
              file_path: '/files/doc-1.pdf',
              mime_type: 'application/pdf',
              file_size_bytes: 1024,
              category: 'invoice',
              thumbnail_path: null,
              notes: null,
              created_at: '2026-01-01T00:00:00Z',
              updated_at: '2026-01-01T00:00:00Z',
              is_deleted: false,
              document_date: null,
              tags: [],
            },
            [],
            [],
          )
        }
      >
        Simulate Upload
      </button>
      <button onClick={onClose}>Close</button>
    </div>
  ),
}))

vi.mock('../../../../components/documents/ApptSuggestionBanner', () => ({
  ApptSuggestionBanner: ({
    onConfirm,
    isLoading,
  }: {
    onConfirm: (n: string | null) => void
    onDismiss: () => void
    isLoading: boolean
    suggestion: unknown
  }) => (
    <div data-testid="appt-suggestion-banner">
      <button disabled={isLoading} onClick={() => onConfirm(null)}>
        Create Appointment
      </button>
    </div>
  ),
}))

beforeEach(() => {
  vi.clearAllMocks()
  mockInvoke.mockResolvedValue(undefined)
})

describe('DocumentsPage', () => {
  describe('Bug #3 — soft-delete previewed doc clears preview panel', () => {
    it('hides document-preview-panel-wrapper after the previewed document is deleted', async () => {
      render(<DocumentsPage />)

      fireEvent.click(screen.getByRole('button', { name: 'Preview' }))
      await waitFor(() =>
        expect(screen.getByTestId('document-preview-panel-wrapper')).toBeInTheDocument(),
      )

      fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
      await waitFor(() =>
        expect(screen.queryByTestId('document-preview-panel-wrapper')).not.toBeInTheDocument(),
      )
    })
  })

  describe('handleApptSuggestionConfirm — clinic contact linking', () => {
    const clinicContact = {
      id: 'contact-clinic-1',
      name: 'City Clinic',
      role: 'hospital',
      specialty: null,
      phone: null,
      email: null,
      clinic: null,
      address: null,
      notes: null,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      contact_clinic_id: null,
    }
    const createdAppt = {
      id: 'appt-1',
      title: 'Visit',
      appt_date: '2026-03-15T00:00:00Z',
      doctor_name: 'Dr Smith',
      clinic_name: 'City Clinic',
      specialty: 'Cardiology',
      duration_min: 0,
      location: null,
      notes: null,
      status: 'completed',
      reminder_min: 60,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      document_ids: [],
      contact_ids: [],
      recurrence_series_id: null,
    }

    it('calls appointment_link_contact when clinic_name matches an existing clinic contact', async () => {
      mockInvoke.mockImplementation((cmd: string) => {
        if (cmd === 'links_score_candidates') return Promise.resolve([])
        if (cmd === 'appointments_suggest_from_document')
          return Promise.resolve({
            id: 'draft-1',
            title: 'Visit with Dr Smith',
            appt_date: '2026-03-15',
            doctor_name: 'Dr Smith',
            clinic_name: 'City Clinic',
            specialty: 'Cardiology',
          })
        if (cmd === 'appointments_create') return Promise.resolve(createdAppt)
        if (cmd === 'contacts_list') return Promise.resolve([clinicContact])
        return Promise.resolve(undefined)
      })

      render(<DocumentsPage />)

      fireEvent.click(screen.getByTestId('upload-btn'))
      fireEvent.click(screen.getByRole('button', { name: 'Simulate Upload' }))

      await waitFor(() =>
        expect(screen.getByTestId('appt-suggestion-banner')).toBeInTheDocument(),
      )

      fireEvent.click(screen.getByRole('button', { name: 'Create Appointment' }))

      await waitFor(() =>
        expect(mockInvoke).toHaveBeenCalledWith('appointment_link_contact', {
          appointmentId: 'appt-1',
          contactId: 'contact-clinic-1',
        }),
      )
    })

    it('skips appointment_link_contact when no clinic contact name matches', async () => {
      mockInvoke.mockImplementation((cmd: string) => {
        if (cmd === 'links_score_candidates') return Promise.resolve([])
        if (cmd === 'appointments_suggest_from_document')
          return Promise.resolve({
            id: 'draft-1',
            title: 'Visit with Dr Smith',
            appt_date: '2026-03-15',
            doctor_name: 'Dr Smith',
            clinic_name: 'Unknown Clinic',
            specialty: 'Cardiology',
          })
        if (cmd === 'appointments_create')
          return Promise.resolve({ ...createdAppt, clinic_name: 'Unknown Clinic' })
        if (cmd === 'contacts_list') return Promise.resolve([clinicContact])
        return Promise.resolve(undefined)
      })

      render(<DocumentsPage />)

      fireEvent.click(screen.getByTestId('upload-btn'))
      fireEvent.click(screen.getByRole('button', { name: 'Simulate Upload' }))

      await waitFor(() =>
        expect(screen.getByTestId('appt-suggestion-banner')).toBeInTheDocument(),
      )

      fireEvent.click(screen.getByRole('button', { name: 'Create Appointment' }))

      await waitFor(() =>
        expect(mockInvoke).toHaveBeenCalledWith('appointments_create', expect.anything()),
      )

      expect(mockInvoke).not.toHaveBeenCalledWith('appointment_link_contact', expect.anything())
    })
  })

  describe('Bug #4 — appointments_create error shows toast', () => {
    it('displays the error message in a toast when appointments_create rejects', async () => {
      mockInvoke.mockImplementation((cmd: string) => {
        if (cmd === 'links_score_candidates') return Promise.resolve([])
        if (cmd === 'appointments_suggest_from_document')
          return Promise.resolve({
            id: 'appt-99',
            title: 'Cardiology with Dr Smith',
            appt_date: '2026-03-15',
            doctor_name: 'Dr Smith',
            clinic_name: 'City Clinic',
            specialty: 'Cardiology',
          })
        if (cmd === 'appointments_create') return Promise.reject({ message: 'DB error' })
        return Promise.resolve(undefined)
      })

      render(<DocumentsPage />)

      fireEvent.click(screen.getByTestId('upload-btn'))
      fireEvent.click(screen.getByRole('button', { name: 'Simulate Upload' }))

      await waitFor(() =>
        expect(screen.getByTestId('appt-suggestion-banner')).toBeInTheDocument(),
      )

      fireEvent.click(screen.getByRole('button', { name: 'Create Appointment' }))

      await waitFor(() => expect(mockToastShow).toHaveBeenCalledWith('DB error'))
    })
  })
})

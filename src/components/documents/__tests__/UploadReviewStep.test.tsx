import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import React from 'react'
import { UploadReviewStep } from '../UploadReviewStep'
import type { Document } from '../../../store/documentsStore'
import type { ContactSuggestion, ClinicSuggestion, ContactPhase, ClinicPhase } from '../uploadTypes'

const mockInvoke = vi.fn()
vi.mock('@tauri-apps/api/core', () => ({ invoke: (...args: unknown[]) => mockInvoke(...args) }))
vi.mock('../../categories/CategoryPicker', () => ({
  CategoryPicker: () => <div data-testid="category-picker" />,
}))

const baseDoc: Document = {
  id: 'doc-1',
  filename: 'report.pdf',
  file_path: '/tmp/report.pdf',
  mime_type: 'application/pdf',
  file_size_bytes: 1024,
  thumbnail_path: null,
  document_date: null,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  notes: null,
  category: 'other',
  tags: [],
  clinic_name: null,
  activity_date: null,
  is_deleted: false,
}

const noopSet = () => {}

function renderStep(overrides: Partial<Parameters<typeof UploadReviewStep>[0]> = {}) {
  const defaults: Parameters<typeof UploadReviewStep>[0] = {
    uploadedDoc: baseDoc,
    category: 'other',
    setCategory: noopSet,
    tags: [],
    setTags: noopSet,
    tagInput: '',
    setTagInput: noopSet,
    notes: '',
    setNotes: noopSet,
    allCategories: [],
    selectedCategoryIds: [],
    setSelectedCategoryIds: noopSet,
    categorySuggestion: null,
    categorySuggestionDismissed: false,
    setCategorySuggestionDismissed: noopSet,
    contactSuggestions: [],
    contactPhases: new Map(),
    setContactPhases: noopSet,
    dismissedContacts: new Set(),
    setDismissedContacts: noopSet,
    clinicSuggestions: [],
    clinicPhase: { kind: 'idle' },
    setClinicPhase: noopSet,
    dismissedClinics: new Set(),
    setDismissedClinics: noopSet,
    timelineDescription: '',
    setTimelineDescription: noopSet,
    activityDate: null,
    setActivityDate: noopSet,
    confirming: false,
    confirmError: null,
    docCategories: ['general'],
    extractedTextPreview: null,
    onAcceptCategorySuggestion: vi.fn(),
    onSubmit: vi.fn(),
    addTag: vi.fn(),
  }
  return render(<UploadReviewStep {...defaults} {...overrides} />)
}

describe('UploadReviewStep', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('filename and document_date', () => {
    it('renders filename', () => {
      renderStep()
      expect(screen.getByText('report.pdf')).toBeInTheDocument()
    })

    it('shows detected date when document_date is set', () => {
      renderStep({ uploadedDoc: { ...baseDoc, document_date: '2024-03-15' } })
      expect(screen.getByText('Date detected from filename:')).toBeInTheDocument()
      expect(screen.getByText('2024-03-15')).toBeInTheDocument()
    })

    it('hides detected date when document_date is null', () => {
      renderStep()
      expect(screen.queryByText('Date detected from filename:')).not.toBeInTheDocument()
    })
  })

  describe('category suggestion banner', () => {
    it('shows banner when suggestion present and not dismissed', () => {
      renderStep({ categorySuggestion: 'blood test', categorySuggestionDismissed: false })
      expect(screen.getByTestId('category-suggestion-banner')).toBeInTheDocument()
      expect(screen.getByText('Blood Test')).toBeInTheDocument()
    })

    it('hides banner when dismissed', () => {
      renderStep({ categorySuggestion: 'blood test', categorySuggestionDismissed: true })
      expect(screen.queryByTestId('category-suggestion-banner')).not.toBeInTheDocument()
    })

    it('hides banner when no suggestion', () => {
      renderStep({ categorySuggestion: null, categorySuggestionDismissed: false })
      expect(screen.queryByTestId('category-suggestion-banner')).not.toBeInTheDocument()
    })

    it('calls onAcceptCategorySuggestion when accept clicked', () => {
      const onAccept = vi.fn()
      renderStep({ categorySuggestion: 'blood test', onAcceptCategorySuggestion: onAccept })
      fireEvent.click(screen.getByTestId('category-suggestion-accept'))
      expect(onAccept).toHaveBeenCalledWith('blood test')
    })

    it('calls setCategorySuggestionDismissed(true) when dismiss clicked', () => {
      const setDismissed = vi.fn()
      renderStep({ categorySuggestion: 'blood test', setCategorySuggestionDismissed: setDismissed })
      fireEvent.click(screen.getByTestId('category-suggestion-dismiss'))
      expect(setDismissed).toHaveBeenCalledWith(true)
    })
  })

  describe('contact suggestions', () => {
    const contact: ContactSuggestion = {
      name: 'Dr. Smith',
      title: 'Dr.',
      specialty: 'Cardiology',
      clinic: 'Heart Clinic',
      phone: null,
      email: null,
      address: null,
    }

    it('shows contact card when contact not dismissed', () => {
      renderStep({ contactSuggestions: [contact], dismissedContacts: new Set() })
      expect(screen.getByTestId('contact-suggestion-card')).toBeInTheDocument()
      expect(screen.getByText('Dr. Smith')).toBeInTheDocument()
      expect(screen.getByText('Cardiology')).toBeInTheDocument()
      expect(screen.getByText('Heart Clinic')).toBeInTheDocument()
    })

    it('hides contact card when dismissed', () => {
      renderStep({ contactSuggestions: [contact], dismissedContacts: new Set(['Dr. Smith']) })
      expect(screen.queryByTestId('contact-suggestion-card')).not.toBeInTheDocument()
    })

    it('renders Save as Contact button when phase is idle', () => {
      renderStep({ contactSuggestions: [contact] })
      expect(screen.getByTestId('contact-suggestion-save')).toHaveTextContent('Save as Contact')
    })

    it('shows Checking… when contact phase is saving', () => {
      const phases = new Map<string, ContactPhase>([['Dr. Smith', { kind: 'saving' }]])
      renderStep({ contactSuggestions: [contact], contactPhases: phases })
      expect(screen.getByTestId('contact-suggestion-save')).toHaveTextContent('Checking…')
    })

    it('shows Saved when contact phase is saved', () => {
      const phases = new Map<string, ContactPhase>([['Dr. Smith', { kind: 'saved', contactId: 'c1' }]])
      renderStep({ contactSuggestions: [contact], contactPhases: phases })
      expect(screen.getByTestId('contact-suggestion-save')).toHaveTextContent('Saved')
    })

    it('shows duplicate panel when contact phase is duplicate', () => {
      const phases = new Map<string, ContactPhase>([
        ['Dr. Smith', {
          kind: 'duplicate',
          newId: 'new-1',
          match: { primary_contact_id: 'old-1', contact: { id: 'old-1', name: 'D. Smith' }, similarity_score: 0.92, match_reason: 'name' },
        }],
      ])
      renderStep({ contactSuggestions: [contact], contactPhases: phases })
      expect(screen.getByTestId('contact-suggestion-merge')).toBeInTheDocument()
      expect(screen.getByText(/D. Smith/)).toBeInTheDocument()
      expect(screen.getByText(/92%/)).toBeInTheDocument()
    })

    it('shows phone input when phone provided', () => {
      const contactWithPhone: ContactSuggestion = { ...contact, phone: '555-1234' }
      renderStep({ contactSuggestions: [contactWithPhone] })
      expect(screen.getByTestId('contact-suggestion-phone')).toHaveValue('555-1234')
    })

    it('dismiss button calls setDismissedContacts', () => {
      const setDismissed = vi.fn()
      renderStep({ contactSuggestions: [contact], setDismissedContacts: setDismissed })
      fireEvent.click(screen.getByTestId('contact-suggestion-dismiss'))
      expect(setDismissed).toHaveBeenCalled()
    })
  })

  describe('clinic suggestions', () => {
    const clinic: ClinicSuggestion = {
      name: 'City Clinic',
      company_registration_number: 'REG123',
      addresses: [{ label: 'Main', line1: '1 Main St' }],
    }

    it('shows clinic card when not dismissed', () => {
      renderStep({ clinicSuggestions: [clinic], dismissedClinics: new Set() })
      expect(screen.getByTestId('clinic-suggestion-card')).toBeInTheDocument()
      expect(screen.getByText('City Clinic')).toBeInTheDocument()
    })

    it('hides clinic card when dismissed', () => {
      renderStep({ clinicSuggestions: [clinic], dismissedClinics: new Set(['City Clinic']) })
      expect(screen.queryByTestId('clinic-suggestion-card')).not.toBeInTheDocument()
    })

    it('shows reg number input', () => {
      renderStep({ clinicSuggestions: [clinic] })
      expect(screen.getByTestId('clinic-suggestion-reg-number')).toHaveValue('REG123')
    })

    it('shows address item', () => {
      renderStep({ clinicSuggestions: [clinic] })
      expect(screen.getByTestId('clinic-address-item')).toBeInTheDocument()
      expect(screen.getByText(/1 Main St/)).toBeInTheDocument()
    })

    it('shows Save as Clinic when clinic phase idle', () => {
      renderStep({ clinicSuggestions: [clinic], clinicPhase: { kind: 'idle' } })
      expect(screen.getByTestId('clinic-suggestion-save')).toHaveTextContent('Save as Clinic')
    })

    it('shows Saving… when clinic phase saving', () => {
      renderStep({ clinicSuggestions: [clinic], clinicPhase: { kind: 'saving' } })
      expect(screen.getByTestId('clinic-suggestion-save')).toHaveTextContent('Saving…')
    })

    it('shows Saved when clinic phase saved', () => {
      renderStep({ clinicSuggestions: [clinic], clinicPhase: { kind: 'saved' } })
      expect(screen.getByTestId('clinic-suggestion-save')).toHaveTextContent('Saved')
    })

    it('shows error message when clinic phase error', () => {
      renderStep({ clinicSuggestions: [clinic], clinicPhase: { kind: 'error', message: 'Link failed' } })
      expect(screen.getByText('Link failed')).toBeInTheDocument()
    })

    it('shows duplicate/link existing UI when clinic phase duplicate', () => {
      renderStep({ clinicSuggestions: [clinic], clinicPhase: { kind: 'duplicate', existingId: 'c-existing' } })
      expect(screen.getByTestId('clinic-suggestion-merge')).toBeInTheDocument()
      expect(screen.getByText('Already exists')).toBeInTheDocument()
    })

    it('dismiss button calls setDismissedClinics', () => {
      const setDismissed = vi.fn()
      renderStep({ clinicSuggestions: [clinic], clinicPhase: { kind: 'idle' }, setDismissedClinics: setDismissed })
      fireEvent.click(screen.getByTestId('clinic-suggestion-dismiss'))
      expect(setDismissed).toHaveBeenCalled()
    })
  })

  describe('timeline section', () => {
    it('hides timeline textarea when no description and no activityDate', () => {
      renderStep({ timelineDescription: '', activityDate: null })
      expect(screen.queryByLabelText(/Timeline entry/)).not.toBeInTheDocument()
    })

    it('shows timeline textarea when timelineDescription is set', () => {
      renderStep({ timelineDescription: 'Appointment with Dr. Smith' })
      expect(screen.getByLabelText(/Timeline entry/)).toBeInTheDocument()
    })

    it('shows timeline textarea when activityDate is set', () => {
      renderStep({ activityDate: '2024-03-15', timelineDescription: '' })
      expect(screen.getByLabelText(/Timeline entry/)).toBeInTheDocument()
    })
  })

  describe('medical categories (CategoryPicker)', () => {
    it('hides CategoryPicker when allCategories is empty', () => {
      renderStep({ allCategories: [] })
      expect(screen.queryByTestId('category-picker')).not.toBeInTheDocument()
    })

    it('shows CategoryPicker when allCategories has items', () => {
      renderStep({ allCategories: [{ id: 'cat-1', name: 'Cardiology', parentId: null, colorHex: '#e0e0e0', isSystem: false, sortOrder: 0 }] })
      expect(screen.getByTestId('category-picker')).toBeInTheDocument()
    })
  })

  describe('tag chips', () => {
    it('renders tag chips for each tag', () => {
      renderStep({ tags: ['urgent', 'lab'] })
      const chips = screen.getAllByTestId('tag-chip')
      expect(chips).toHaveLength(2)
      expect(chips[0]).toHaveTextContent('urgent')
      expect(chips[1]).toHaveTextContent('lab')
    })

    it('calls setTags when remove button clicked', () => {
      const setTags = vi.fn()
      renderStep({ tags: ['urgent'], setTags })
      fireEvent.click(screen.getByLabelText('Remove tag urgent'))
      expect(setTags).toHaveBeenCalled()
    })

    it('calls addTag on Enter in tag input', () => {
      const addTag = vi.fn()
      renderStep({ addTag })
      fireEvent.keyDown(screen.getByTestId('tag-input'), { key: 'Enter' })
      expect(addTag).toHaveBeenCalled()
    })

    it('calls addTag on comma in tag input', () => {
      const addTag = vi.fn()
      renderStep({ addTag })
      fireEvent.keyDown(screen.getByTestId('tag-input'), { key: ',' })
      expect(addTag).toHaveBeenCalled()
    })
  })

  describe('extracted text preview', () => {
    it('hides preview details when null', () => {
      renderStep({ extractedTextPreview: null })
      expect(screen.queryByTestId('upload-extracted-text-preview')).not.toBeInTheDocument()
    })

    it('shows preview details when set', () => {
      renderStep({ extractedTextPreview: 'Some extracted text here' })
      expect(screen.getByTestId('upload-extracted-text-preview')).toBeInTheDocument()
      expect(screen.getByText('Some extracted text here')).toBeInTheDocument()
    })
  })

  describe('confirmError', () => {
    it('hides error when null', () => {
      renderStep({ confirmError: null })
      expect(screen.queryByText(/error/i)).not.toBeInTheDocument()
    })

    it('shows error message when set', () => {
      renderStep({ confirmError: 'Upload failed. Please try again.' })
      expect(screen.getByText('Upload failed. Please try again.')).toBeInTheDocument()
    })
  })

  describe('form submission', () => {
    it('calls onSubmit when form submitted', () => {
      const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault())
      renderStep({ onSubmit })
      fireEvent.submit(screen.getByTestId('upload-review-step'))
      expect(onSubmit).toHaveBeenCalled()
    })
  })

  describe('async contact save flow', () => {
    const contact: ContactSuggestion = {
      name: 'Dr. Adams',
      title: null,
      specialty: null,
      clinic: null,
      phone: null,
      email: null,
      address: null,
    }

    it('transitions to saved phase after successful save (no duplicate)', async () => {
      const setContactPhases = vi.fn()
      mockInvoke.mockImplementation((cmd: string) => {
        if (cmd === 'contacts_create') return Promise.resolve({ id: 'new-c1' })
        if (cmd === 'find_duplicate_contacts') return Promise.resolve([])
        if (cmd === 'documents_link_contact') return Promise.resolve(null)
        return Promise.resolve(null)
      })
      renderStep({ contactSuggestions: [contact], setContactPhases })
      await act(async () => {
        fireEvent.click(screen.getByTestId('contact-suggestion-save'))
      })
      await waitFor(() => {
        expect(setContactPhases).toHaveBeenCalled()
      })
    })

    it('transitions to duplicate phase when duplicate found', async () => {
      const setContactPhases = vi.fn()
      mockInvoke.mockImplementation((cmd: string) => {
        if (cmd === 'contacts_create') return Promise.resolve({ id: 'new-c2' })
        if (cmd === 'find_duplicate_contacts') return Promise.resolve([
          { primary_contact_id: 'old-c', contact: { id: 'old-c', name: 'Dr. Adams Sr.' }, similarity_score: 0.9, match_reason: 'name' },
        ])
        return Promise.resolve(null)
      })
      renderStep({ contactSuggestions: [contact], setContactPhases })
      await act(async () => {
        fireEvent.click(screen.getByTestId('contact-suggestion-save'))
      })
      await waitFor(() => {
        expect(setContactPhases).toHaveBeenCalled()
      })
    })

    it('handles save error gracefully', async () => {
      const setContactPhases = vi.fn()
      mockInvoke.mockImplementation((cmd: string) => {
        if (cmd === 'contacts_create') return Promise.reject(new Error('DB error'))
        return Promise.resolve(null)
      })
      renderStep({ contactSuggestions: [contact], setContactPhases })
      await act(async () => {
        fireEvent.click(screen.getByTestId('contact-suggestion-save'))
      })
      await waitFor(() => {
        expect(setContactPhases).toHaveBeenCalled()
      })
    })
  })

  describe('async merge flow', () => {
    const contact: ContactSuggestion = {
      name: 'Dr. Jones',
      title: null,
      specialty: null,
      clinic: null,
      phone: null,
      email: null,
      address: null,
    }
    const dupPhase: ContactPhase = {
      kind: 'duplicate',
      newId: 'new-j',
      match: { primary_contact_id: 'old-j', contact: { id: 'old-j', name: 'D. Jones' }, similarity_score: 0.88, match_reason: 'name' },
    }

    it('handles merge and transitions to saved', async () => {
      const setContactPhases = vi.fn()
      mockInvoke.mockResolvedValue(null)
      const phases = new Map<string, ContactPhase>([['Dr. Jones', dupPhase]])
      renderStep({ contactSuggestions: [contact], contactPhases: phases, setContactPhases })
      await act(async () => {
        fireEvent.click(screen.getByTestId('contact-suggestion-merge'))
      })
      await waitFor(() => {
        expect(setContactPhases).toHaveBeenCalled()
      })
    })

    it('handles cancel duplicate and deletes new contact', async () => {
      const setContactPhases = vi.fn()
      mockInvoke.mockResolvedValue(null)
      const phases = new Map<string, ContactPhase>([['Dr. Jones', dupPhase]])
      renderStep({ contactSuggestions: [contact], contactPhases: phases, setContactPhases })
      const cancelBtn = screen.getByText('Cancel')
      await act(async () => {
        fireEvent.click(cancelBtn)
      })
      await waitFor(() => {
        expect(setContactPhases).toHaveBeenCalled()
      })
    })
  })

  describe('async clinic save flow', () => {
    const clinic: ClinicSuggestion = {
      name: 'Test Clinic',
      company_registration_number: null,
      addresses: [],
    }

    it('transitions to saved phase after successful clinic save', async () => {
      const setClinicPhase = vi.fn()
      mockInvoke.mockImplementation((cmd: string) => {
        if (cmd === 'clinics_create_if_not_exists') return Promise.resolve({ id: 'cl-1' })
        if (cmd === 'documents_set_clinic') return Promise.resolve(null)
        return Promise.resolve(null)
      })
      renderStep({ clinicSuggestions: [clinic], clinicPhase: { kind: 'idle' }, setClinicPhase })
      await act(async () => {
        fireEvent.click(screen.getByTestId('clinic-suggestion-save'))
      })
      await waitFor(() => {
        expect(setClinicPhase).toHaveBeenCalled()
      })
    })

    it('sets error phase when documents_set_clinic fails', async () => {
      const setClinicPhase = vi.fn()
      mockInvoke.mockImplementation((cmd: string) => {
        if (cmd === 'clinics_create_if_not_exists') return Promise.resolve({ id: 'cl-2' })
        if (cmd === 'documents_set_clinic') return Promise.reject(new Error('link fail'))
        return Promise.resolve(null)
      })
      renderStep({ clinicSuggestions: [clinic], clinicPhase: { kind: 'idle' }, setClinicPhase })
      await act(async () => {
        fireEvent.click(screen.getByTestId('clinic-suggestion-save'))
      })
      await waitFor(() => {
        expect(setClinicPhase).toHaveBeenCalled()
      })
    })

    it('handles clinic save error gracefully', async () => {
      const setClinicPhase = vi.fn()
      mockInvoke.mockRejectedValue(new Error('network error'))
      renderStep({ clinicSuggestions: [clinic], clinicPhase: { kind: 'idle' }, setClinicPhase })
      await act(async () => {
        fireEvent.click(screen.getByTestId('clinic-suggestion-save'))
      })
      await waitFor(() => {
        expect(setClinicPhase).toHaveBeenCalled()
      })
    })

    it('link existing clinic when duplicate phase', async () => {
      const setClinicPhase = vi.fn()
      mockInvoke.mockResolvedValue(null)
      renderStep({
        clinicSuggestions: [clinic],
        clinicPhase: { kind: 'duplicate', existingId: 'cl-exist' },
        setClinicPhase,
      })
      await act(async () => {
        fireEvent.click(screen.getByText('Link existing'))
      })
      await waitFor(() => {
        expect(setClinicPhase).toHaveBeenCalled()
      })
    })
  })
})

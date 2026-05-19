import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import AppointmentDetailClient from '../AppointmentDetailClient'

const mockInvoke = vi.fn()
const mockRouterBack = vi.fn()
let mockApptId = 'appt-1'

vi.mock('@tauri-apps/api/core', () => ({ invoke: (...args: unknown[]) => mockInvoke(...args) }))
vi.mock('next/navigation', () => ({
  useSearchParams: () => ({ get: () => mockApptId }),
  useRouter: () => ({ back: mockRouterBack }),
}))

const makeAppt = (overrides = {}) => ({
  id: 'appt-1',
  title: 'Annual Checkup',
  doctor_name: 'Dr. Smith',
  clinic_name: 'City Clinic',
  specialty: 'General Practice',
  appt_date: '2026-04-20T10:00:00Z',
  duration_min: 30,
  location: 'Room 1',
  notes: null,
  status: 'scheduled',
  reminder_min: 60,
  created_at: '2026-04-01T00:00:00Z',
  updated_at: '2026-04-01T00:00:00Z',
  document_ids: [],
  ...overrides,
})

const makeLinkedDoc = (overrides = {}) => ({
  document_id: 'doc-1',
  filename: 'blood_test.pdf',
  category: 'lab',
  document_date: '2026-04-10T00:00:00Z',
  score: 8,
  created_at: '2026-04-22T10:00:00Z',
  ...overrides,
})

function setupInvoke(
  apptOverrides = {},
  linkedDocs: ReturnType<typeof makeLinkedDoc>[] = [],
  assignedCategoryIds: string[] = [],
) {
  mockInvoke.mockImplementation((cmd: string) => {
    if (cmd === 'appointments_get') return Promise.resolve(makeAppt(apptOverrides))
    if (cmd === 'get_appointment_links') return Promise.resolve(linkedDocs)
    if (cmd === 'categories_list') return Promise.resolve([])
    if (cmd === 'categories_for_appointment') return Promise.resolve(assignedCategoryIds)
    if (cmd === 'contacts_list') return Promise.resolve([])
    if (cmd === 'clinics_list_including_drafts') return Promise.resolve([])
    if (cmd === 'appointment_tags_get') return Promise.resolve([])
    if (cmd === 'notes_for_entity') return Promise.resolve([])
    if (cmd === 'symptoms_for_entity') return Promise.resolve([])
    if (cmd === 'medications_for_entity') return Promise.resolve([])
    if (cmd === 'symptoms_list') return Promise.resolve([])
    if (cmd === 'medications_list') return Promise.resolve([])
    return Promise.resolve(undefined)
  })
}

describe('AppointmentDetailClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApptId = 'appt-1'
  })

  it('shows loading state initially', () => {
    setupInvoke()
    render(<AppointmentDetailClient />)
    expect(screen.getByLabelText('Loading appointment')).toBeDefined()
  })

  it('renders appointment title after load', async () => {
    setupInvoke()
    render(<AppointmentDetailClient />)
    await waitFor(() => expect(screen.getByText('Annual Checkup')).toBeDefined())
  })

  it('renders status badge', async () => {
    setupInvoke()
    render(<AppointmentDetailClient />)
    await waitFor(() => expect(screen.getByText('Scheduled')).toBeDefined())
  })

  it('renders doctor and clinic', async () => {
    setupInvoke()
    render(<AppointmentDetailClient />)
    await waitFor(() => {
      expect(screen.getByText('Dr. Smith')).toBeDefined()
      expect(screen.getByText('City Clinic')).toBeDefined()
    })
  })

  it('renders notes when present', async () => {
    setupInvoke({ notes: 'Bring previous results' })
    render(<AppointmentDetailClient />)
    await waitFor(() => expect(screen.getByText('Bring previous results')).toBeDefined())
  })

  it('renders empty linked docs message when none', async () => {
    setupInvoke()
    render(<AppointmentDetailClient />)
    await waitFor(() =>
      expect(screen.getByText(/No documents linked yet/)).toBeDefined(),
    )
  })

  it('renders linked document filename', async () => {
    setupInvoke({}, [makeLinkedDoc()])
    render(<AppointmentDetailClient />)
    await waitFor(() => expect(screen.getByText('blood_test.pdf')).toBeDefined())
  })

  it('renders unlink button for each document', async () => {
    setupInvoke({}, [makeLinkedDoc()])
    render(<AppointmentDetailClient />)
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Unlink blood_test\.pdf/i })).toBeDefined(),
    )
  })

  it('removes document from list after unlink', async () => {
    setupInvoke({}, [makeLinkedDoc()])
    render(<AppointmentDetailClient />)
    await waitFor(() => screen.getByText('blood_test.pdf'))
    fireEvent.click(screen.getByRole('button', { name: /Unlink blood_test\.pdf/i }))
    await waitFor(() =>
      expect(screen.queryByText('blood_test.pdf')).toBeNull(),
    )
  })

  it('shows linked document count in heading', async () => {
    setupInvoke({}, [makeLinkedDoc(), makeLinkedDoc({ document_id: 'doc-2', filename: 'xray.pdf' })])
    render(<AppointmentDetailClient />)
    await waitFor(() => expect(screen.getByText('(2)')).toBeDefined())
  })

  it('linked document filename is a link to /documents/view', async () => {
    setupInvoke({}, [makeLinkedDoc()])
    render(<AppointmentDetailClient />)
    await waitFor(() => {
      const link = screen.getByRole('link', { name: 'blood_test.pdf' })
      expect((link as HTMLAnchorElement).href).toContain('/documents/view?id=doc-1')
    })
  })

  it('back button calls router.back', async () => {
    setupInvoke()
    render(<AppointmentDetailClient />)
    await waitFor(() => screen.getByText('Annual Checkup'))
    fireEvent.click(screen.getByText('← Back'))
    expect(mockRouterBack).toHaveBeenCalledOnce()
  })

  it('shows Summarize Notes button when notes are present', async () => {
    setupInvoke({ notes: 'Patient presented with back pain.' })
    render(<AppointmentDetailClient />)
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Summarize Notes/i })).toBeDefined(),
    )
  })

  it('does not show Summarize Notes button when notes are absent', async () => {
    setupInvoke({ notes: null })
    render(<AppointmentDetailClient />)
    await waitFor(() => screen.getByText('Annual Checkup'))
    expect(screen.queryByRole('button', { name: /Summarize Notes/i })).toBeNull()
  })

  it('calls summarize_appointment_notes and shows summary panel', async () => {
    const sentences = ['Patient has back pain.', 'Prescribed medication.']
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'appointments_get') return Promise.resolve(makeAppt({ notes: 'Patient has back pain. Prescribed medication.' }))
      if (cmd === 'get_appointment_links') return Promise.resolve([])
      if (cmd === 'categories_list') return Promise.resolve([])
      if (cmd === 'categories_for_appointment') return Promise.resolve([])
      if (cmd === 'appointment_tags_get') return Promise.resolve([])
      if (cmd === 'notes_for_entity') return Promise.resolve([])
      if (cmd === 'symptoms_for_entity') return Promise.resolve([])
      if (cmd === 'medications_for_entity') return Promise.resolve([])
      if (cmd === 'symptoms_list') return Promise.resolve([])
      if (cmd === 'medications_list') return Promise.resolve([])
      if (cmd === 'summarize_appointment_notes') return Promise.resolve(sentences)
      return Promise.resolve(undefined)
    })
    render(<AppointmentDetailClient />)
    await waitFor(() => screen.getByText('Annual Checkup'))
    fireEvent.click(screen.getByRole('button', { name: /Summarize Notes/i }))
    await waitFor(() =>
      expect(screen.getByLabelText('Appointment notes summary')).toBeDefined(),
    )
    expect(screen.getByText('Patient has back pain.')).toBeDefined()
    expect(screen.getByText('Prescribed medication.')).toBeDefined()
  })

  it('toggles summary panel closed then open', async () => {
    const sentences = ['Key finding.']
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'appointments_get') return Promise.resolve(makeAppt({ notes: 'Key finding.' }))
      if (cmd === 'get_appointment_links') return Promise.resolve([])
      if (cmd === 'categories_list') return Promise.resolve([])
      if (cmd === 'categories_for_appointment') return Promise.resolve([])
      if (cmd === 'appointment_tags_get') return Promise.resolve([])
      if (cmd === 'notes_for_entity') return Promise.resolve([])
      if (cmd === 'symptoms_for_entity') return Promise.resolve([])
      if (cmd === 'medications_for_entity') return Promise.resolve([])
      if (cmd === 'symptoms_list') return Promise.resolve([])
      if (cmd === 'medications_list') return Promise.resolve([])
      if (cmd === 'summarize_appointment_notes') return Promise.resolve(sentences)
      return Promise.resolve(undefined)
    })
    render(<AppointmentDetailClient />)
    await waitFor(() => screen.getByText('Annual Checkup'))
    fireEvent.click(screen.getByRole('button', { name: /Summarize Notes/i }))
    await waitFor(() => screen.getByLabelText('Appointment notes summary'))
    const toggle = screen.getByRole('button', { name: /AI Summary/i })
    fireEvent.click(toggle)
    expect(screen.queryByLabelText('Appointment notes summary')).toBeNull()
    fireEvent.click(toggle)
    expect(screen.getByLabelText('Appointment notes summary')).toBeDefined()
  })

  it('shows error message when summarize_appointment_notes fails', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'appointments_get') return Promise.resolve(makeAppt({ notes: 'Some notes.' }))
      if (cmd === 'get_appointment_links') return Promise.resolve([])
      if (cmd === 'categories_list') return Promise.resolve([])
      if (cmd === 'categories_for_appointment') return Promise.resolve([])
      if (cmd === 'appointment_tags_get') return Promise.resolve([])
      if (cmd === 'notes_for_entity') return Promise.resolve([])
      if (cmd === 'symptoms_for_entity') return Promise.resolve([])
      if (cmd === 'medications_for_entity') return Promise.resolve([])
      if (cmd === 'symptoms_list') return Promise.resolve([])
      if (cmd === 'medications_list') return Promise.resolve([])
      if (cmd === 'summarize_appointment_notes') return Promise.reject(new Error('summarizer error'))
      return Promise.resolve(undefined)
    })
    render(<AppointmentDetailClient />)
    await waitFor(() => screen.getByText('Annual Checkup'))
    fireEvent.click(screen.getByRole('button', { name: /Summarize Notes/i }))
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain('summarizer error'),
    )
  })

  it('calls assign_category_to_appointment when category toggled on', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'appointments_get') return Promise.resolve(makeAppt())
      if (cmd === 'get_appointment_links') return Promise.resolve([])
      if (cmd === 'categories_list')
        return Promise.resolve([{ id: 'cat-1', name: 'Cardiology', parent_id: null, color_hex: '#EF4444', is_system: true, sort_order: 0 }])
      if (cmd === 'categories_for_appointment') return Promise.resolve([])
      if (cmd === 'appointment_tags_get') return Promise.resolve([])
      if (cmd === 'notes_for_entity') return Promise.resolve([])
      if (cmd === 'symptoms_for_entity') return Promise.resolve([])
      if (cmd === 'medications_for_entity') return Promise.resolve([])
      if (cmd === 'symptoms_list') return Promise.resolve([])
      if (cmd === 'medications_list') return Promise.resolve([])
      return Promise.resolve(undefined)
    })
    render(<AppointmentDetailClient />)
    await waitFor(() => screen.getByText('Annual Checkup'))
    fireEvent.click(screen.getByRole('checkbox', { name: /Cardiology/i }))
    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith('assign_category_to_appointment', {
        userId: '',
        appointmentId: 'appt-1',
        categoryId: 'cat-1',
      })
    )
  })

  it('shows error state when appointments_get rejects', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'appointments_get') return Promise.reject(new Error('load error'))
      return Promise.resolve(undefined)
    })
    render(<AppointmentDetailClient />)
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain('load error'),
    )
  })

  it('shows not-found state when appointments_get returns null', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'appointments_get') return Promise.resolve(null)
      if (cmd === 'get_appointment_links') return Promise.resolve([])
      if (cmd === 'categories_list') return Promise.resolve([])
      if (cmd === 'categories_for_appointment') return Promise.resolve([])
      if (cmd === 'appointment_tags_get') return Promise.resolve([])
      if (cmd === 'notes_for_entity') return Promise.resolve([])
      if (cmd === 'symptoms_for_entity') return Promise.resolve([])
      if (cmd === 'medications_for_entity') return Promise.resolve([])
      if (cmd === 'symptoms_list') return Promise.resolve([])
      if (cmd === 'medications_list') return Promise.resolve([])
      return Promise.resolve(undefined)
    })
    render(<AppointmentDetailClient />)
    await waitFor(() =>
      expect(screen.getByText(/Appointment not found/)).toBeDefined(),
    )
  })

  it('renders linked notes when present', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'appointments_get') return Promise.resolve(makeAppt())
      if (cmd === 'get_appointment_links') return Promise.resolve([])
      if (cmd === 'categories_list') return Promise.resolve([])
      if (cmd === 'categories_for_appointment') return Promise.resolve([])
      if (cmd === 'appointment_tags_get') return Promise.resolve([])
      if (cmd === 'notes_for_entity') return Promise.resolve([{ id: 'note-1', title: 'Follow-up note' }])
      if (cmd === 'symptoms_for_entity') return Promise.resolve([])
      if (cmd === 'medications_for_entity') return Promise.resolve([])
      if (cmd === 'symptoms_list') return Promise.resolve([])
      if (cmd === 'medications_list') return Promise.resolve([])
      return Promise.resolve(undefined)
    })
    render(<AppointmentDetailClient />)
    await waitFor(() => expect(screen.getByText('Follow-up note')).toBeDefined())
  })

  it('shows ICD-10 suggestions after clicking Suggest ICD-10 Codes', async () => {
    const suggestions = [{ code: 'M54.5', description: 'Low back pain', confidence: 0.9 }]
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'appointments_get') return Promise.resolve(makeAppt({ notes: 'back pain' }))
      if (cmd === 'get_appointment_links') return Promise.resolve([])
      if (cmd === 'categories_list') return Promise.resolve([])
      if (cmd === 'categories_for_appointment') return Promise.resolve([])
      if (cmd === 'appointment_tags_get') return Promise.resolve([])
      if (cmd === 'notes_for_entity') return Promise.resolve([])
      if (cmd === 'symptoms_for_entity') return Promise.resolve([])
      if (cmd === 'medications_for_entity') return Promise.resolve([])
      if (cmd === 'symptoms_list') return Promise.resolve([])
      if (cmd === 'medications_list') return Promise.resolve([])
      if (cmd === 'icd10_suggest') return Promise.resolve(suggestions)
      return Promise.resolve(undefined)
    })
    render(<AppointmentDetailClient />)
    await waitFor(() => screen.getByText('Annual Checkup'))
    fireEvent.click(screen.getByRole('button', { name: /Suggest ICD-10 Codes/i }))
    await waitFor(() => expect(screen.getByText('M54.5')).toBeDefined())
    expect(screen.getByText(/Low back pain/)).toBeDefined()
  })

  it('renders saved tags when appointment_tags_get returns codes', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'appointments_get') return Promise.resolve(makeAppt())
      if (cmd === 'get_appointment_links') return Promise.resolve([])
      if (cmd === 'categories_list') return Promise.resolve([])
      if (cmd === 'categories_for_appointment') return Promise.resolve([])
      if (cmd === 'appointment_tags_get') return Promise.resolve(['M54.5', 'J06.9'])
      if (cmd === 'notes_for_entity') return Promise.resolve([])
      if (cmd === 'symptoms_for_entity') return Promise.resolve([])
      if (cmd === 'medications_for_entity') return Promise.resolve([])
      if (cmd === 'symptoms_list') return Promise.resolve([])
      if (cmd === 'medications_list') return Promise.resolve([])
      return Promise.resolve(undefined)
    })
    render(<AppointmentDetailClient />)
    await waitFor(() => expect(screen.getByText('M54.5')).toBeDefined())
    expect(screen.getByText('J06.9')).toBeDefined()
  })

  it('calls appointment_tags_set after clicking remove tag button', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'appointments_get') return Promise.resolve(makeAppt())
      if (cmd === 'get_appointment_links') return Promise.resolve([])
      if (cmd === 'categories_list') return Promise.resolve([])
      if (cmd === 'categories_for_appointment') return Promise.resolve([])
      if (cmd === 'appointment_tags_get') return Promise.resolve(['M54.5'])
      if (cmd === 'notes_for_entity') return Promise.resolve([])
      if (cmd === 'symptoms_for_entity') return Promise.resolve([])
      if (cmd === 'medications_for_entity') return Promise.resolve([])
      if (cmd === 'symptoms_list') return Promise.resolve([])
      if (cmd === 'medications_list') return Promise.resolve([])
      if (cmd === 'appointment_tags_set') return Promise.resolve(undefined)
      return Promise.resolve(undefined)
    })
    render(<AppointmentDetailClient />)
    await waitFor(() => screen.getByRole('button', { name: /Remove tag M54\.5/i }))
    fireEvent.click(screen.getByRole('button', { name: /Remove tag M54\.5/i }))
    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith('appointment_tags_set', {
        appointmentId: 'appt-1',
        tags: [],
      })
    )
  })

  it('checks ICD-10 suggestion checkbox and saves via Accept button', async () => {
    const suggestions = [{ code: 'M54.5', description: 'Low back pain', confidence: 0.9 }]
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'appointments_get') return Promise.resolve(makeAppt({ notes: 'back pain' }))
      if (cmd === 'get_appointment_links') return Promise.resolve([])
      if (cmd === 'categories_list') return Promise.resolve([])
      if (cmd === 'categories_for_appointment') return Promise.resolve([])
      if (cmd === 'appointment_tags_get') return Promise.resolve([])
      if (cmd === 'notes_for_entity') return Promise.resolve([])
      if (cmd === 'symptoms_for_entity') return Promise.resolve([])
      if (cmd === 'medications_for_entity') return Promise.resolve([])
      if (cmd === 'symptoms_list') return Promise.resolve([])
      if (cmd === 'medications_list') return Promise.resolve([])
      if (cmd === 'icd10_suggest') return Promise.resolve(suggestions)
      if (cmd === 'appointment_tags_set') return Promise.resolve(undefined)
      return Promise.resolve(undefined)
    })
    render(<AppointmentDetailClient />)
    await waitFor(() => screen.getByText('Annual Checkup'))
    fireEvent.click(screen.getByRole('button', { name: /Suggest ICD-10 Codes/i }))
    await waitFor(() => screen.getByLabelText(/M54\.5/i))
    fireEvent.click(screen.getByLabelText(/M54\.5/i))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Accept 1 Code/i })).toBeDefined()
    )
    fireEvent.click(screen.getByRole('button', { name: /Accept 1 Code/i }))
    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith('appointment_tags_set', {
        appointmentId: 'appt-1',
        tags: ['M54.5'],
      })
    )
  })
})

const makeApptSymptom = (overrides = {}) => ({
  id: 'sym-1',
  name: 'Headache',
  severity: null,
  onset_date: null,
  notes: null,
  deleted_at: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...overrides,
})

const makeApptMedication = (overrides = {}) => ({
  id: 'med-1',
  name: 'Ibuprofen',
  dosage: null,
  frequency: null,
  start_date: null,
  end_date: null,
  notes: null,
  deleted_at: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...overrides,
})

function setupWithSymptoms(symptoms = [makeApptSymptom()], linked: typeof symptoms = []) {
  mockInvoke.mockImplementation((cmd: string) => {
    if (cmd === 'appointments_get') return Promise.resolve(makeAppt())
    if (cmd === 'get_appointment_links') return Promise.resolve([])
    if (cmd === 'categories_list') return Promise.resolve([])
    if (cmd === 'categories_for_appointment') return Promise.resolve([])
    if (cmd === 'appointment_tags_get') return Promise.resolve([])
    if (cmd === 'notes_for_entity') return Promise.resolve([])
    if (cmd === 'symptoms_for_entity') return Promise.resolve(linked)
    if (cmd === 'medications_for_entity') return Promise.resolve([])
    if (cmd === 'symptoms_list') return Promise.resolve(symptoms)
    if (cmd === 'medications_list') return Promise.resolve([])
    return Promise.resolve(undefined)
  })
}

function setupWithMedications(medications = [makeApptMedication()], linked: typeof medications = []) {
  mockInvoke.mockImplementation((cmd: string) => {
    if (cmd === 'appointments_get') return Promise.resolve(makeAppt())
    if (cmd === 'get_appointment_links') return Promise.resolve([])
    if (cmd === 'categories_list') return Promise.resolve([])
    if (cmd === 'categories_for_appointment') return Promise.resolve([])
    if (cmd === 'appointment_tags_get') return Promise.resolve([])
    if (cmd === 'notes_for_entity') return Promise.resolve([])
    if (cmd === 'symptoms_for_entity') return Promise.resolve([])
    if (cmd === 'medications_for_entity') return Promise.resolve(linked)
    if (cmd === 'symptoms_list') return Promise.resolve([])
    if (cmd === 'medications_list') return Promise.resolve(medications)
    return Promise.resolve(undefined)
  })
}

describe('AppointmentDetailClient — symptom linking', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApptId = 'appt-1'
  })

  it('shows symptom select when unlinkable symptoms exist', async () => {
    setupWithSymptoms()
    render(<AppointmentDetailClient />)
    await waitFor(() => screen.getByText('Annual Checkup'))
    expect(screen.getByText('Select symptom…')).toBeInTheDocument()
    expect(screen.getByText('Headache')).toBeInTheDocument()
  })

  it('calls symptom_link with correct args on Link click', async () => {
    setupWithSymptoms()
    render(<AppointmentDetailClient />)
    await waitFor(() => screen.getByText('Annual Checkup'))

    const select = screen.getByText('Select symptom…').closest('select')!
    fireEvent.change(select, { target: { value: 'sym-1' } })

    const linkBtn = screen.getAllByRole('button', { name: 'Link' }).find(
      (b) => b.closest('div')?.querySelector('select')
    )!
    fireEvent.click(linkBtn)

    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith('symptom_link', {
        symptomId: 'sym-1',
        toType: 'appointment',
        toId: 'appt-1',
      })
    )
  })

  it('shows linked symptom and calls symptom_unlink on ✕', async () => {
    setupWithSymptoms(
      [makeApptSymptom({ id: 'sym-1', name: 'Headache' })],
      [makeApptSymptom({ id: 'sym-1', name: 'Headache' })]
    )
    render(<AppointmentDetailClient />)
    await waitFor(() => screen.getByText('Annual Checkup'))
    expect(screen.getByText('Headache')).toBeInTheDocument()

    mockInvoke.mockResolvedValueOnce(undefined)
    fireEvent.click(screen.getByRole('button', { name: 'Unlink symptom' }))

    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith('symptom_unlink', {
        symptomId: 'sym-1',
        toType: 'appointment',
        toId: 'appt-1',
      })
    )
  })
})

describe('AppointmentDetailClient — medication linking', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApptId = 'appt-1'
  })

  it('shows medication select when unlinkable medications exist', async () => {
    setupWithMedications()
    render(<AppointmentDetailClient />)
    await waitFor(() => screen.getByText('Annual Checkup'))
    expect(screen.getByText('Select medication…')).toBeInTheDocument()
    expect(screen.getByText('Ibuprofen')).toBeInTheDocument()
  })

  it('calls medication_link with correct args on Link click', async () => {
    setupWithMedications()
    render(<AppointmentDetailClient />)
    await waitFor(() => screen.getByText('Annual Checkup'))

    const select = screen.getByText('Select medication…').closest('select')!
    fireEvent.change(select, { target: { value: 'med-1' } })

    const linkBtn = screen.getAllByRole('button', { name: 'Link' }).find(
      (b) => b.closest('div')?.querySelector('select')
    )!
    fireEvent.click(linkBtn)

    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith('medication_link', {
        medicationId: 'med-1',
        toType: 'appointment',
        toId: 'appt-1',
      })
    )
  })

  it('shows linked medication and calls medication_unlink on ✕', async () => {
    setupWithMedications(
      [makeApptMedication({ id: 'med-1', name: 'Ibuprofen' })],
      [makeApptMedication({ id: 'med-1', name: 'Ibuprofen' })]
    )
    render(<AppointmentDetailClient />)
    await waitFor(() => screen.getByText('Annual Checkup'))
    expect(screen.getByText('Ibuprofen')).toBeInTheDocument()

    mockInvoke.mockResolvedValueOnce(undefined)
    fireEvent.click(screen.getByRole('button', { name: 'Unlink medication' }))

    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith('medication_unlink', {
        medicationId: 'med-1',
        toType: 'appointment',
        toId: 'appt-1',
      })
    )
  })
})

describe('AppointmentDetailClient — branch coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApptId = 'appt-1'
  })

  it('renders "No appointment selected." when id is empty', () => {
    mockApptId = ''
    setupInvoke()
    render(<AppointmentDetailClient />)
    expect(screen.getByText(/No appointment selected\./)).toBeDefined()
  })

  it('shows AppointmentForm when Edit button is clicked', async () => {
    setupInvoke()
    render(<AppointmentDetailClient />)
    await waitFor(() => screen.getByText('Annual Checkup'))
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Cancel/i })).toBeDefined()
    )
  })

  it('renders reminder offset chips when reminder_offsets is set', async () => {
    setupInvoke({ reminder_offsets: { min15: true, hr1: true, day1: true } })
    render(<AppointmentDetailClient />)
    await waitFor(() => {
      expect(screen.getByText('15 min before')).toBeDefined()
      expect(screen.getByText('1 hour before')).toBeDefined()
      expect(screen.getByText('1 day before')).toBeDefined()
    })
  })

  it('shows suggestError alert when icd10_suggest fails', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'appointments_get') return Promise.resolve(makeAppt({ notes: 'back pain' }))
      if (cmd === 'get_appointment_links') return Promise.resolve([])
      if (cmd === 'categories_list') return Promise.resolve([])
      if (cmd === 'categories_for_appointment') return Promise.resolve([])
      if (cmd === 'appointment_tags_get') return Promise.resolve([])
      if (cmd === 'notes_for_entity') return Promise.resolve([])
      if (cmd === 'symptoms_for_entity') return Promise.resolve([])
      if (cmd === 'medications_for_entity') return Promise.resolve([])
      if (cmd === 'symptoms_list') return Promise.resolve([])
      if (cmd === 'medications_list') return Promise.resolve([])
      if (cmd === 'icd10_suggest') return Promise.reject(new Error('suggest failed'))
      return Promise.resolve(undefined)
    })
    render(<AppointmentDetailClient />)
    await waitFor(() => screen.getByText('Annual Checkup'))
    fireEvent.click(screen.getByRole('button', { name: /Suggest ICD-10 Codes/i }))
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain('suggest failed')
    )
  })

  it('unchecks ICD-10 suggestion when checkbox clicked twice (delete branch)', async () => {
    const suggestions = [{ code: 'M54.5', description: 'Low back pain', confidence: 0.9 }]
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'appointments_get') return Promise.resolve(makeAppt({ notes: 'back pain' }))
      if (cmd === 'get_appointment_links') return Promise.resolve([])
      if (cmd === 'categories_list') return Promise.resolve([])
      if (cmd === 'categories_for_appointment') return Promise.resolve([])
      if (cmd === 'appointment_tags_get') return Promise.resolve([])
      if (cmd === 'notes_for_entity') return Promise.resolve([])
      if (cmd === 'symptoms_for_entity') return Promise.resolve([])
      if (cmd === 'medications_for_entity') return Promise.resolve([])
      if (cmd === 'symptoms_list') return Promise.resolve([])
      if (cmd === 'medications_list') return Promise.resolve([])
      if (cmd === 'icd10_suggest') return Promise.resolve(suggestions)
      return Promise.resolve(undefined)
    })
    render(<AppointmentDetailClient />)
    await waitFor(() => screen.getByText('Annual Checkup'))
    fireEvent.click(screen.getByRole('button', { name: /Suggest ICD-10 Codes/i }))
    await waitFor(() => screen.getByLabelText(/M54\.5/i))
    const checkbox = screen.getByLabelText(/M54\.5/i) as HTMLInputElement
    fireEvent.click(checkbox)
    expect(checkbox.checked).toBe(true)
    fireEvent.click(checkbox)
    expect(checkbox.checked).toBe(false)
  })

  it('shows "Untitled" for note with empty title and hides snippet when content empty', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'appointments_get') return Promise.resolve(makeAppt())
      if (cmd === 'get_appointment_links') return Promise.resolve([])
      if (cmd === 'categories_list') return Promise.resolve([])
      if (cmd === 'categories_for_appointment') return Promise.resolve([])
      if (cmd === 'appointment_tags_get') return Promise.resolve([])
      if (cmd === 'notes_for_entity') return Promise.resolve([{ id: 'note-2', title: '', content: '', created_at: '2026-01-01T00:00:00Z' }])
      if (cmd === 'symptoms_for_entity') return Promise.resolve([])
      if (cmd === 'medications_for_entity') return Promise.resolve([])
      if (cmd === 'symptoms_list') return Promise.resolve([])
      if (cmd === 'medications_list') return Promise.resolve([])
      return Promise.resolve(undefined)
    })
    render(<AppointmentDetailClient />)
    await waitFor(() => expect(screen.getByText('Untitled')).toBeDefined())
  })

  it('shows raw category when CATEGORY_LABELS has no matching key', async () => {
    setupInvoke({}, [makeLinkedDoc({ category: 'unknown_cat' })])
    render(<AppointmentDetailClient />)
    await waitFor(() => expect(screen.getByText(/unknown_cat/)).toBeDefined())
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import AppointmentDetailClient from '../AppointmentDetailClient'

const mockInvoke = vi.fn()
const mockRouterBack = vi.fn()

vi.mock('@tauri-apps/api/core', () => ({ invoke: (...args: unknown[]) => mockInvoke(...args) }))
vi.mock('next/navigation', () => ({
  useSearchParams: () => ({ get: () => 'appt-1' }),
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
    if (cmd === 'appointment_tags_get') return Promise.resolve([])
    if (cmd === 'notes_for_entity') return Promise.resolve([])
    return Promise.resolve(undefined)
  })
}

describe('AppointmentDetailClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
      if (cmd === 'icd10_suggest') return Promise.resolve(suggestions)
      return Promise.resolve(undefined)
    })
    render(<AppointmentDetailClient />)
    await waitFor(() => screen.getByText('Annual Checkup'))
    fireEvent.click(screen.getByRole('button', { name: /Suggest ICD-10 Codes/i }))
    await waitFor(() => expect(screen.getByText('M54.5')).toBeDefined())
    expect(screen.getByText(/Low back pain/)).toBeDefined()
  })
})

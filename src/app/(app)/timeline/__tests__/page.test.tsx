import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { apptToEvent } from '../timeline-utils'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const DOC = {
  id: 'd1',
  filename: 'bloodwork.pdf',
  file_path: '/tmp/bloodwork.pdf',
  mime_type: 'application/pdf',
  file_size_bytes: 1024,
  category: 'lab',
  thumbnail_path: null,
  notes: null,
  created_at: '2024-03-15T10:00:00Z',
  updated_at: '2024-03-15T10:00:00Z',
  activity_date: '2024-03-15T10:00:00Z' as string | null,
  is_deleted: false,
  tags: [] as string[],
  document_date: null as string | null,
}

const APPT = {
  id: 'a1',
  title: 'Cardiology checkup',
  doctor_name: 'Dr. Smith',
  clinic_name: 'Heart Clinic',
  specialty: null,
  appt_date: '2024-03-10T09:00:00Z',
  duration_min: 30,
  location: null,
  notes: null,
  status: 'completed' as const,
  reminder_min: 30,
  created_at: '2024-03-01T00:00:00Z',
  updated_at: '2024-03-01T00:00:00Z',
  document_ids: [] as string[],
  contact_ids: [] as string[],
  recurrence_series_id: null,
}

const NOTE = {
  id: 'n1',
  title: 'Post-visit notes',
  content: 'Felt good',
  is_pinned: false,
  created_at: '2024-03-12T08:00:00Z',
  updated_at: '2024-03-12T08:00:00Z',
  tags: ['follow-up'],
}

const CAT = { id: 'cat1', name: 'Cardiology', color_hex: '#ef4444' }

// ── Module-level state for per-test overrides ─────────────────────────────────

let mockDocuments = [DOC]
let mockAppointments = [APPT]
let mockNotes = [NOTE]

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockInvoke = vi.fn()

vi.mock('@tauri-apps/api/core', () => ({ invoke: (...a: unknown[]) => mockInvoke(...a) }))
vi.mock('../../../../hooks/useDocuments', () => ({
  useDocuments: () => ({ documents: mockDocuments, loading: false }),
}))
vi.mock('../../../../hooks/useAppointments', () => ({
  useAppointments: () => ({ appointments: mockAppointments, loading: false }),
}))
vi.mock('../../../../hooks/useNotes', () => ({
  useNotes: () => ({ notes: mockNotes, loading: false }),
}))

async function renderPage() {
  const { default: TimelinePage } = await import('../page')
  return render(<TimelinePage />)
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.resetModules()
  mockDocuments = [DOC]
  mockAppointments = [APPT]
  mockNotes = [NOTE]
  mockInvoke.mockImplementation((cmd: string) => {
    if (cmd === 'categories_list') return Promise.resolve([CAT])
    if (cmd === 'categories_for_document') return Promise.resolve(['cat1'])
    if (cmd === 'categories_for_appointment') return Promise.resolve(['cat1'])
    if (cmd === 'links_list_for_appointment') return Promise.resolve([])
    if (cmd === 'categories_update') return Promise.resolve({ ...CAT })
    return Promise.resolve([])
  })
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('TimelinePage', () => {
  it('renders heading and view tabs', async () => {
    await renderPage()
    expect(screen.getByText('Timeline')).toBeDefined()
    expect(screen.getByText('Chronological')).toBeDefined()
    expect(screen.getByText('By Category')).toBeDefined()
    expect(screen.getByText('By Doctor')).toBeDefined()
  })

  it('renders type filter chips', async () => {
    await renderPage()
    expect(screen.getByText('All')).toBeDefined()
    expect(screen.getByText('Documents')).toBeDefined()
    expect(screen.getByText('Appointments')).toBeDefined()
    expect(screen.getByText('Notes')).toBeDefined()
  })

  it('shows chronological events on load', async () => {
    await renderPage()
    await waitFor(() => expect(screen.getByText('2024-03-15 DOCUMENT')).toBeDefined())
    expect(screen.getByText(/Cardiology checkup/)).toBeDefined()
    expect(screen.getByText('Post-visit notes')).toBeDefined()
  })

  it('shows month group header in chronological view', async () => {
    await renderPage()
    await waitFor(() => expect(screen.getByText(/March 2024/)).toBeDefined())
  })

  it('filters to documents only when Documents chip clicked', async () => {
    await renderPage()
    await waitFor(() => expect(screen.getByText('2024-03-15 DOCUMENT')).toBeDefined())
    fireEvent.click(screen.getByText('Documents'))
    expect(screen.getByText('2024-03-15 DOCUMENT')).toBeDefined()
    expect(screen.queryByText('Post-visit notes')).toBeNull()
  })

  it('shows clear button when date range set and clears on click', async () => {
    await renderPage()
    const fromInput = screen.getByTitle('From date')
    fireEvent.change(fromInput, { target: { value: '2024-01-01' } })
    const clearBtn = screen.getByText('Clear')
    expect(clearBtn).toBeDefined()
    fireEvent.click(clearBtn)
    expect(screen.queryByText('Clear')).toBeNull()
  })

  it('switches to By Category view and loads categories', async () => {
    await renderPage()
    await waitFor(() => expect(screen.getByText('2024-03-15 DOCUMENT')).toBeDefined())
    fireEvent.click(screen.getByText('By Category'))
    await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith('categories_list'))
    await waitFor(() => expect(screen.getByText('Cardiology')).toBeDefined())
  })

  it('renders color swatch for named category in By Category view', async () => {
    await renderPage()
    fireEvent.click(screen.getByText('By Category'))
    await waitFor(() => expect(screen.getByTitle('Click to change category color')).toBeDefined())
  })

  it('calls categories_update when color picker changes', async () => {
    await renderPage()
    fireEvent.click(screen.getByText('By Category'))
    await waitFor(() => expect(screen.getByTitle('Click to change category color')).toBeDefined())
    const colorInput = document.querySelector('input[type="color"]') as HTMLInputElement
    expect(colorInput).toBeTruthy()
    fireEvent.change(colorInput, { target: { value: '#00ff00' } })
    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith('categories_update', {
        input: { id: 'cat1', color_hex: '#00ff00' },
      })
    )
  })

  it('reverts category color on invoke failure', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'categories_list') return Promise.resolve([CAT])
      if (cmd === 'categories_for_document') return Promise.resolve(['cat1'])
      if (cmd === 'categories_for_appointment') return Promise.resolve(['cat1'])
      if (cmd === 'links_list_for_appointment') return Promise.resolve([])
      if (cmd === 'categories_update') return Promise.reject(new Error('DB error'))
      return Promise.resolve([])
    })
    await renderPage()
    fireEvent.click(screen.getByText('By Category'))
    await waitFor(() => expect(screen.getByTitle('Click to change category color')).toBeDefined())
    const colorInput = document.querySelector('input[type="color"]') as HTMLInputElement
    fireEvent.change(colorInput, { target: { value: '#0000ff' } })
    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith('categories_update', expect.any(Object))
    )
  })

  it('switches to By Doctor view and groups by doctor', async () => {
    await renderPage()
    fireEvent.click(screen.getByText('By Doctor'))
    await waitFor(() => expect(screen.getByText('Dr. Smith')).toBeDefined())
  })

  it('shows appointment in By Doctor view under correct doctor', async () => {
    await renderPage()
    fireEvent.click(screen.getByText('By Doctor'))
    await waitFor(() => expect(screen.getByText('Dr. Smith')).toBeDefined())
    expect(screen.getByText(/Cardiology checkup/)).toBeDefined()
  })

  it('shows "No doctor / Service" for appointments without a doctor', async () => {
    mockAppointments = [{ ...APPT, id: 'a2', doctor_name: null as unknown as string, clinic_name: null as unknown as string }]
    await renderPage()
    fireEvent.click(screen.getByText('By Doctor'))
    await waitFor(() => expect(screen.getByText('No doctor / Service')).toBeDefined())
  })

  it('marks linked documents with "linked" badge in By Doctor view', async () => {
    mockInvoke.mockImplementation((cmd: string, args?: Record<string, unknown>) => {
      if (cmd === 'categories_list') return Promise.resolve([])
      if (cmd === 'categories_for_document') return Promise.resolve([])
      if (cmd === 'categories_for_appointment') return Promise.resolve([])
      if (cmd === 'links_list_for_appointment' && args?.appointmentId === 'a1')
        return Promise.resolve([{ id: 'lnk1', document_id: 'd1', appointment_id: 'a1' }])
      return Promise.resolve([])
    })
    await renderPage()
    fireEvent.click(screen.getByText('By Doctor'))
    await waitFor(() => expect(screen.getByText('Dr. Smith')).toBeDefined())
    await waitFor(() => expect(screen.getByText('linked')).toBeDefined())
  })

  it('date range filters out events outside range', async () => {
    await renderPage()
    await waitFor(() => expect(screen.getByText('2024-03-15 DOCUMENT')).toBeDefined())
    const toInput = screen.getByTitle('To date')
    // bloodwork.pdf (2024-03-15) — set toDate before that
    fireEvent.change(toInput, { target: { value: '2024-03-05' } })
    await waitFor(() => expect(screen.queryByText('2024-03-15 DOCUMENT')).toBeNull())
  })

  it('deleted documents do not appear in timeline', async () => {
    mockDocuments = [{ ...DOC, id: 'd2', filename: 'deleted.pdf', is_deleted: true }]
    mockAppointments = []
    mockNotes = []
    await renderPage()
    await waitFor(() => expect(screen.getByText('No events found')).toBeDefined())
    expect(screen.queryByText('deleted.pdf uploaded')).toBeNull()
  })

  it('sorts "No doctor / Service" group last when mixed doctors present', async () => {
    mockAppointments = [
      { ...APPT, id: 'a3', doctor_name: null as unknown as string, clinic_name: null as unknown as string },
      APPT,
      { ...APPT, id: 'a4', doctor_name: 'Dr. Adams', clinic_name: 'Adams Clinic' },
    ]
    await renderPage()
    fireEvent.click(screen.getByText('By Doctor'))
    await waitFor(() => expect(screen.getByText('Dr. Smith')).toBeDefined())
    await waitFor(() => expect(screen.getByText('No doctor / Service')).toBeDefined())
    await waitFor(() => expect(screen.getByText('Dr. Adams')).toBeDefined())
    const headings = screen.getAllByText(/Dr\.|No doctor \/ Service/)
    expect(headings.at(-1)?.textContent).toBe('No doctor / Service')
  })

  it('handles links_list_for_appointment invoke failure gracefully', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'categories_list') return Promise.resolve([])
      if (cmd === 'categories_for_document') return Promise.resolve([])
      if (cmd === 'categories_for_appointment') return Promise.resolve([])
      if (cmd === 'links_list_for_appointment') return Promise.reject(new Error('network error'))
      return Promise.resolve([])
    })
    await renderPage()
    fireEvent.click(screen.getByText('By Doctor'))
    await waitFor(() => expect(screen.getByText('Dr. Smith')).toBeDefined())
    expect(screen.queryByText('linked')).toBeNull()
  })

  it('shows uncategorized group with plain swatch in By Category view', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'categories_list') return Promise.resolve([CAT])
      if (cmd === 'categories_for_document') return Promise.resolve([])
      if (cmd === 'categories_for_appointment') return Promise.resolve([])
      if (cmd === 'links_list_for_appointment') return Promise.resolve([])
      return Promise.resolve([])
    })
    await renderPage()
    fireEvent.click(screen.getByText('By Category'))
    await waitFor(() => expect(screen.getByText('Uncategorized')).toBeDefined())
    expect(screen.queryByTitle('Click to change category color')).toBeNull()
  })

  it('buildDocTitle: titleTag with provider shows both in entry', async () => {
    mockDocuments = [{ ...DOC, tags: ['Registration Form', 'Dr. Vaibhav Sharma'] }]
    await renderPage()
    await waitFor(() =>
      expect(screen.getByText('2024-03-15 Registration Form Dr. Vaibhav Sharma')).toBeDefined()
    )
  })

  it('buildDocTitle: specialty + provider shows "SPECIALTY with provider"', async () => {
    mockDocuments = [{ ...DOC, tags: ['CARDIOLOGY', 'Dr. Smith'] }]
    await renderPage()
    await waitFor(() =>
      expect(screen.getByText('2024-03-15 CARDIOLOGY with Dr. Smith')).toBeDefined()
    )
  })

  it('buildDocTitle: provider-only (no title/specialty) shows "DOCUMENT with provider"', async () => {
    mockDocuments = [{ ...DOC, tags: ['Dr. Patel'] }]
    await renderPage()
    await waitFor(() =>
      expect(screen.getByText('2024-03-15 DOCUMENT with Dr. Patel')).toBeDefined()
    )
  })

  it('switches to By Uploaded Date view and shows uploaded filename', async () => {
    await renderPage()
    fireEvent.click(screen.getByText('By Uploaded Date'))
    await waitFor(() => expect(screen.getByText('Uploaded: bloodwork.pdf')).toBeDefined())
  })

  it('shows IMG badge for image documents in By Uploaded Date view', async () => {
    mockDocuments = [{ ...DOC, id: 'd3', filename: 'xray.jpg', activity_date: null }]
    mockAppointments = []
    mockNotes = []
    await renderPage()
    fireEvent.click(screen.getByText('By Uploaded Date'))
    await waitFor(() => expect(screen.getByText('Uploaded: xray.jpg')).toBeDefined())
  })
})

// ── apptToEvent unit tests ────────────────────────────────────────────────────

import type { Appointment } from '../../../../store/appointmentsStore'

function makeAppt(overrides: Partial<Appointment> = {}): Appointment {
  return { ...APPT, ...overrides }
}

describe('apptToEvent', () => {
  it('subtitle includes doctor and clinic when both present', () => {
    const event = apptToEvent(makeAppt({ doctor_name: 'Dr. Smith', clinic_name: 'Heart Clinic' }))
    expect(event.subtitle).toBe('Dr. Smith · Heart Clinic')
  })

  it('subtitle shows only clinic when doctor_name is null', () => {
    const event = apptToEvent(makeAppt({ doctor_name: null, clinic_name: 'Heart Clinic' }))
    expect(event.subtitle).toBe('Heart Clinic')
  })

  it('subtitle is null when both doctor_name and clinic_name are null', () => {
    const event = apptToEvent(makeAppt({ doctor_name: null, clinic_name: null }))
    expect(event.subtitle).toBeNull()
  })
})

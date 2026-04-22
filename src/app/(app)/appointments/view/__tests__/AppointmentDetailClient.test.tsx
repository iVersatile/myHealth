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

  it('calls assign_category_to_appointment when category toggled on', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'appointments_get') return Promise.resolve(makeAppt())
      if (cmd === 'get_appointment_links') return Promise.resolve([])
      if (cmd === 'categories_list')
        return Promise.resolve([{ id: 'cat-1', name: 'Cardiology', parent_id: null, color_hex: '#EF4444', is_system: true, sort_order: 0 }])
      if (cmd === 'categories_for_appointment') return Promise.resolve([])
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
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AppointmentsPage from '../page'

const mockInvoke = vi.fn()
const mockOpenDialog = vi.fn()
const mockSaveDialog = vi.fn()

vi.mock('@tauri-apps/api/core', () => ({ invoke: (...args: unknown[]) => mockInvoke(...args) }))
vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: (...args: unknown[]) => mockOpenDialog(...args),
  save: (...args: unknown[]) => mockSaveDialog(...args),
}))

const makeAppt = (overrides = {}): import('../../../../store/appointmentsStore').Appointment => ({
  id: 'appt-1',
  title: 'Physio',
  doctor_name: 'Dr. Jones',
  clinic_name: null,
  specialty: null,
  appt_date: '2026-06-01T10:00:00Z',
  duration_min: 30,
  location: null,
  notes: null,
  status: 'scheduled',
  reminder_min: 0,
  created_at: '2026-05-01T00:00:00Z',
  updated_at: '2026-05-01T00:00:00Z',
  document_ids: [],
  contact_ids: [],
  recurrence_series_id: null,
  ...overrides,
})

type ConflictTuple = [string, string, string, string, string, string]

function setupInvoke(appts: ReturnType<typeof makeAppt>[] = [], conflicts: ConflictTuple[] = []) {
  mockInvoke.mockImplementation((cmd: string) => {
    if (cmd === 'appointments_list') return Promise.resolve(appts)
    if (cmd === 'appointments_create') return Promise.resolve(makeAppt())
    if (cmd === 'appointments_update') return Promise.resolve(makeAppt())
    if (cmd === 'appointments_delete') return Promise.resolve(undefined)
    if (cmd === 'recurrence_create') return Promise.resolve(undefined)
    if (cmd === 'recurrence_delete_series') return Promise.resolve(undefined)
    if (cmd === 'reminders_schedule') return Promise.resolve(undefined)
    if (cmd === 'reminders_cancel') return Promise.resolve(undefined)
    if (cmd === 'contacts_list') return Promise.resolve([])
    if (cmd === 'clinics_list_including_drafts') return Promise.resolve([])
    if (cmd === 'get_draft_entities') return Promise.resolve([])
    if (cmd === 'appointments_list_conflicts') return Promise.resolve(conflicts)
    if (cmd === 'appointments_dismiss_conflict') return Promise.resolve(undefined)
    return Promise.resolve(undefined)
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  setupInvoke()
})

describe('AppointmentsPage', () => {
  it('renders the page heading', async () => {
    render(<AppointmentsPage />)
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /appointments/i })).toBeDefined()
    })
  })

  it('shows empty state when no appointments', async () => {
    render(<AppointmentsPage />)
    await waitFor(() => {
      expect(screen.getByText(/no appointments yet/i)).toBeDefined()
    })
  })

  it('lists appointments returned by the hook', async () => {
    setupInvoke([makeAppt({ title: 'Annual Checkup' })])
    render(<AppointmentsPage />)
    await waitFor(() => {
      expect(screen.getByText('Annual Checkup')).toBeDefined()
    })
  })
})

describe('Delete series confirmation modal', () => {
  const seriesAppt = makeAppt({
    id: 'appt-series-1',
    title: 'Weekly Physio',
    appt_date: '2026-06-01T10:00:00Z',
    recurrence_series_id: 'series-abc',
  })

  it('shows the series delete modal when deleting a recurring appointment', async () => {
    setupInvoke([seriesAppt])
    render(<AppointmentsPage />)
    await waitFor(() => screen.getByText('Weekly Physio'))

    await userEvent.click(screen.getByRole('button', { name: /delete weekly physio/i }))

    await waitFor(() => {
      expect(screen.getByText(/delete recurring appointment/i)).toBeDefined()
    })
  })

  it('shows all three delete options in the modal', async () => {
    setupInvoke([seriesAppt])
    render(<AppointmentsPage />)
    await waitFor(() => screen.getByText('Weekly Physio'))

    await userEvent.click(screen.getByRole('button', { name: /delete weekly physio/i }))

    await waitFor(() => {
      expect(screen.getByText(/delete this occurrence only/i)).toBeDefined()
      expect(screen.getByText(/delete this and all following/i)).toBeDefined()
      expect(screen.getByText(/delete all in series/i)).toBeDefined()
    })
  })

  it('calls appointments_delete when "this occurrence only" selected', async () => {
    setupInvoke([seriesAppt])
    render(<AppointmentsPage />)
    await waitFor(() => screen.getByText('Weekly Physio'))

    await userEvent.click(screen.getByRole('button', { name: /delete weekly physio/i }))
    await waitFor(() => screen.getByText(/delete this occurrence only/i))

    await userEvent.click(screen.getByText(/delete this occurrence only/i))

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('appointments_delete', { id: 'appt-series-1' })
    })
  })

  it('calls recurrence_delete_series with fromOccurrence for "this and following"', async () => {
    setupInvoke([seriesAppt])
    render(<AppointmentsPage />)
    await waitFor(() => screen.getByText('Weekly Physio'))

    await userEvent.click(screen.getByRole('button', { name: /delete weekly physio/i }))
    await waitFor(() => screen.getByText(/delete this and all following/i))

    await userEvent.click(screen.getByText(/delete this and all following/i))

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('recurrence_delete_series', {
        seriesId: 'series-abc',
        fromOccurrence: '2026-06-01T10:00:00Z',
      })
    })
  })

  it('calls recurrence_delete_series with null fromOccurrence for "all"', async () => {
    setupInvoke([seriesAppt])
    render(<AppointmentsPage />)
    await waitFor(() => screen.getByText('Weekly Physio'))

    await userEvent.click(screen.getByRole('button', { name: /delete weekly physio/i }))
    await waitFor(() => screen.getByText(/delete all in series/i))

    await userEvent.click(screen.getByText(/delete all in series/i))

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('recurrence_delete_series', {
        seriesId: 'series-abc',
        fromOccurrence: null,
      })
    })
  })

  it('dismisses the modal when Cancel is clicked', async () => {
    setupInvoke([seriesAppt])
    render(<AppointmentsPage />)
    await waitFor(() => screen.getByText('Weekly Physio'))

    await userEvent.click(screen.getByRole('button', { name: /delete weekly physio/i }))
    await waitFor(() => screen.getByText(/delete recurring appointment/i))

    await userEvent.click(screen.getByRole('button', { name: /^cancel$/i }))

    await waitFor(() => {
      expect(screen.queryByText(/delete recurring appointment/i)).toBeNull()
    })
  })

  it('shows double-click confirmation banner for non-recurring appointments', async () => {
    setupInvoke([makeAppt({ id: 'single-1', title: 'One-off Visit', recurrence_series_id: null })])
    render(<AppointmentsPage />)
    await waitFor(() => screen.getByText('One-off Visit'))

    await userEvent.click(screen.getByRole('button', { name: /delete one-off visit/i }))

    await waitFor(() => {
      expect(screen.getByText(/click.*again.*confirm/i)).toBeDefined()
    })
    expect(screen.queryByText(/delete recurring appointment/i)).toBeNull()
  })

  it('deletes a non-recurring appointment on second click', async () => {
    setupInvoke([makeAppt({ id: 'single-1', title: 'One-off Visit', recurrence_series_id: null })])
    render(<AppointmentsPage />)
    await waitFor(() => screen.getByText('One-off Visit'))

    const deleteBtn = screen.getByRole('button', { name: /delete one-off visit/i })
    await userEvent.click(deleteBtn)
    await waitFor(() => screen.getByText(/click.*again.*confirm/i))
    await userEvent.click(deleteBtn)

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('appointments_delete', { id: 'single-1' })
    })
  })
})

describe('Filter chips', () => {
  it('renders all status filter chips', async () => {
    render(<AppointmentsPage />)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^all$/i })).toBeDefined()
      expect(screen.getByRole('button', { name: /^scheduled$/i })).toBeDefined()
      expect(screen.getByRole('button', { name: /^completed$/i })).toBeDefined()
    })
  })

  it('calls filterByStatus when a chip is clicked', async () => {
    render(<AppointmentsPage />)
    await waitFor(() => screen.getByRole('button', { name: /^completed$/i }))
    await userEvent.click(screen.getByRole('button', { name: /^completed$/i }))
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('appointments_list', expect.objectContaining({ status: 'completed' }))
    })
  })

  it('dismisses the delete confirmation banner via Cancel', async () => {
    setupInvoke([makeAppt({ id: 'single-2', title: 'Eye Test', recurrence_series_id: null })])
    render(<AppointmentsPage />)
    await waitFor(() => screen.getByText('Eye Test'))

    await userEvent.click(screen.getByRole('button', { name: /delete eye test/i }))
    await waitFor(() => screen.getByText(/click.*again.*confirm/i))

    await userEvent.click(screen.getByRole('button', { name: /^cancel$/i }))

    await waitFor(() => {
      expect(screen.queryByText(/click.*again.*confirm/i)).toBeNull()
    })
  })
})

describe('ICS import/export', () => {
  it('calls openDialog when Import .ics is clicked', async () => {
    mockOpenDialog.mockResolvedValue(null)
    render(<AppointmentsPage />)
    await waitFor(() => screen.getByRole('button', { name: /import .ics/i }))
    await userEvent.click(screen.getByRole('button', { name: /import .ics/i }))
    await waitFor(() => expect(mockOpenDialog).toHaveBeenCalled())
  })

  it('shows import success message after ICS import', async () => {
    mockOpenDialog.mockResolvedValue('/some/path/file.ics')
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'appointments_list') return Promise.resolve([])
      if (cmd === 'icalendar_import') return Promise.resolve({ imported: 3, skipped: 0 })
      if (cmd === 'contacts_list') return Promise.resolve([])
      if (cmd === 'clinics_list_including_drafts') return Promise.resolve([])
      if (cmd === 'get_draft_entities') return Promise.resolve([])
      return Promise.resolve(undefined)
    })
    render(<AppointmentsPage />)
    await waitFor(() => screen.getByRole('button', { name: /import .ics/i }))
    await userEvent.click(screen.getByRole('button', { name: /import .ics/i }))
    await waitFor(() => expect(screen.getByText(/imported 3 appointments/i)).toBeDefined())
  })

  it('does nothing when export saveDialog returns null', async () => {
    mockSaveDialog.mockResolvedValue(null)
    render(<AppointmentsPage />)
    await waitFor(() => screen.getByRole('button', { name: /export .ics/i }))
    await userEvent.click(screen.getByRole('button', { name: /export .ics/i }))
    await waitFor(() => expect(mockSaveDialog).toHaveBeenCalled())
    expect(screen.queryByText(/exported successfully/i)).toBeNull()
  })

  it('shows export error message when saveDialog rejects', async () => {
    mockSaveDialog.mockRejectedValue(new Error('disk full'))
    render(<AppointmentsPage />)
    await waitFor(() => screen.getByRole('button', { name: /export .ics/i }))
    await userEvent.click(screen.getByRole('button', { name: /export .ics/i }))
    await waitFor(() => expect(screen.getByText(/export failed/i)).toBeDefined())
  })

  it('dismisses ICS feedback message when ✕ is clicked', async () => {
    mockSaveDialog.mockRejectedValue(new Error('oops'))
    render(<AppointmentsPage />)
    await waitFor(() => screen.getByRole('button', { name: /export .ics/i }))
    await userEvent.click(screen.getByRole('button', { name: /export .ics/i }))
    await waitFor(() => screen.getByText(/export failed/i))
    await userEvent.click(screen.getByRole('button', { name: /✕/i }))
    await waitFor(() => expect(screen.queryByText(/export failed/i)).toBeNull())
  })
})

describe('Form panel', () => {
  it('opens the new appointment form on "+ New" click', async () => {
    render(<AppointmentsPage />)
    await waitFor(() => screen.getByRole('button', { name: /\+ new/i }))
    await userEvent.click(screen.getByRole('button', { name: /\+ new/i }))
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /new appointment/i })).toBeDefined()
    })
  })

  it('closes the form on cancel', async () => {
    render(<AppointmentsPage />)
    await waitFor(() => screen.getByRole('button', { name: /\+ new/i }))
    await userEvent.click(screen.getByRole('button', { name: /\+ new/i }))
    await waitFor(() => screen.getByRole('heading', { name: /new appointment/i }))

    await userEvent.click(screen.getByRole('button', { name: /cancel/i }))

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /new appointment/i })).toBeNull()
    })
  })
})

describe('Conflict detection UI', () => {
  const conflictFixture: ConflictTuple = ['a1', 'a2', 'Physio', 'GP Visit', '2026-06-01T10:00:00Z', '2026-06-01T10:15:00Z']

  it('shows conflict-badge when conflicts are returned', async () => {
    setupInvoke([], [conflictFixture])
    render(<AppointmentsPage />)
    await waitFor(() => {
      const badges = screen.getAllByTestId('conflict-badge')
      expect(badges.length).toBeGreaterThan(0)
      expect(badges[0]!.textContent).toBe('Physio')
      expect(badges[1]!.textContent).toBe('GP Visit')
    })
  })

  it('clicking Dismiss removes the conflict banner', async () => {
    setupInvoke([], [conflictFixture])
    render(<AppointmentsPage />)
    await waitFor(() => screen.getAllByTestId('conflict-badge'))

    await userEvent.click(screen.getByTestId('dismiss-conflict-btn'))

    await waitFor(() => {
      expect(screen.queryByTestId('conflict-badge')).toBeNull()
    })
  })

  it('calls appointments_dismiss_conflict with correct ids on Dismiss', async () => {
    setupInvoke([], [conflictFixture])
    render(<AppointmentsPage />)
    await waitFor(() => screen.getByTestId('dismiss-conflict-btn'))

    await userEvent.click(screen.getByTestId('dismiss-conflict-btn'))

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('appointments_dismiss_conflict', { idA: 'a1', idB: 'a2' })
    })
  })

  it('shows no conflict section when no conflicts returned', async () => {
    setupInvoke([], [])
    render(<AppointmentsPage />)
    await waitFor(() => screen.getByRole('heading', { name: /appointments/i }))
    expect(screen.queryByTestId('conflicts-section')).toBeNull()
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AppointmentForm } from '../AppointmentForm'
import type { Appointment } from '../../../store/appointmentsStore'

const mockInvoke = vi.fn()
vi.mock('@tauri-apps/api/core', () => ({ invoke: (...args: unknown[]) => mockInvoke(...args) }))

const makeAppt = (overrides: Partial<Appointment> = {}): Appointment => ({
  id: 'a1',
  title: 'Annual Checkup',
  doctor_name: 'Dr. Smith',
  clinic_name: 'City Clinic',
  specialty: 'General Practice',
  appt_date: '2026-04-20T10:00:00',
  duration_min: 30,
  location: 'Room 1',
  notes: 'Bring results',
  status: 'scheduled',
  reminder_min: 60,
  created_at: '2026-04-01T00:00:00',
  updated_at: '2026-04-01T00:00:00',
  document_ids: [],
  contact_ids: [],
  recurrence_series_id: null,
  ...overrides,
})

describe('AppointmentForm', () => {
  const onSave = vi.fn()
  const onCancel = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockInvoke.mockResolvedValue([])
  })

  it('renders title input', () => {
    render(<AppointmentForm onSave={onSave} onCancel={onCancel} />)
    expect(screen.getByLabelText(/Title/i)).toBeDefined()
  })

  it('renders date and time input', () => {
    render(<AppointmentForm onSave={onSave} onCancel={onCancel} />)
    expect(screen.getByLabelText(/Date & Time/i)).toBeDefined()
  })

  it('renders cancel button', () => {
    render(<AppointmentForm onSave={onSave} onCancel={onCancel} />)
    expect(screen.getByText('Cancel')).toBeDefined()
  })

  it('renders Save Appointment button for new form', () => {
    render(<AppointmentForm onSave={onSave} onCancel={onCancel} />)
    expect(screen.getByText('Save Appointment')).toBeDefined()
  })

  it('renders Save Changes button when editing', () => {
    render(<AppointmentForm initial={makeAppt()} onSave={onSave} onCancel={onCancel} />)
    expect(screen.getByText('Save Changes')).toBeDefined()
  })

  it('populates title field from initial prop', () => {
    render(<AppointmentForm initial={makeAppt()} onSave={onSave} onCancel={onCancel} />)
    const titleInput = screen.getByLabelText(/Title/i) as HTMLInputElement
    expect(titleInput.value).toBe('Annual Checkup')
  })

  it('populates notes field from initial prop', () => {
    render(<AppointmentForm initial={makeAppt()} onSave={onSave} onCancel={onCancel} />)
    const notesInput = screen.getByLabelText(/Notes/i) as HTMLTextAreaElement
    expect(notesInput.value).toBe('Bring results')
  })

  it('shows error when title is empty on submit', async () => {
    const { container } = render(<AppointmentForm onSave={onSave} onCancel={onCancel} />)
    fireEvent.submit(container.querySelector('form')!)
    await waitFor(() => expect(screen.getByText('Title is required.')).toBeDefined())
    expect(onSave).not.toHaveBeenCalled()
  })

  it('shows error when date is empty on submit', async () => {
    const user = userEvent.setup()
    const { container } = render(<AppointmentForm onSave={onSave} onCancel={onCancel} />)
    await user.type(screen.getByLabelText(/Title/i), 'My appointment')
    fireEvent.submit(container.querySelector('form')!)
    await waitFor(() => expect(screen.getByText('Date and time are required.')).toBeDefined())
    expect(onSave).not.toHaveBeenCalled()
  })

  it('calls onCancel when Cancel clicked', () => {
    render(<AppointmentForm onSave={onSave} onCancel={onCancel} />)
    fireEvent.click(screen.getByText('Cancel'))
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('calls onSave with correct input when form is valid', async () => {
    onSave.mockResolvedValueOnce(undefined)
    const user = userEvent.setup()
    render(<AppointmentForm onSave={onSave} onCancel={onCancel} />)

    await user.type(screen.getByLabelText(/Title/i), 'Dental')
    fireEvent.change(screen.getByLabelText(/Date & Time/i), {
      target: { value: '2026-05-01T09:00' },
    })
    fireEvent.click(screen.getByText('Save Appointment'))

    await waitFor(() => expect(onSave).toHaveBeenCalledOnce())
    const input = onSave.mock.calls[0]?.[0]
    expect(input.title).toBe('Dental')
    expect(input.appt_date).toBe('2026-05-01T09:00:00')
  })

  it('displays Saving… while submitting', async () => {
    let resolve!: () => void
    onSave.mockReturnValueOnce(new Promise<void>((r) => { resolve = r }))
    const user = userEvent.setup()
    render(<AppointmentForm onSave={onSave} onCancel={onCancel} />)

    await user.type(screen.getByLabelText(/Title/i), 'Dental')
    fireEvent.change(screen.getByLabelText(/Date & Time/i), {
      target: { value: '2026-05-01T09:00' },
    })
    fireEvent.click(screen.getByText('Save Appointment'))

    await waitFor(() => expect(screen.getByText('Saving…')).toBeDefined())
    resolve()
  })

  it('shows error message when onSave rejects', async () => {
    onSave.mockRejectedValueOnce(new Error('Save failed'))
    const user = userEvent.setup()
    render(<AppointmentForm onSave={onSave} onCancel={onCancel} />)

    await user.type(screen.getByLabelText(/Title/i), 'Dental')
    fireEvent.change(screen.getByLabelText(/Date & Time/i), {
      target: { value: '2026-05-01T09:00' },
    })
    fireEvent.click(screen.getByText('Save Appointment'))

    await waitFor(() => expect(screen.getByText('Save failed')).toBeDefined())
  })
})

describe('AppointmentForm — clinic contact linking', () => {
  const clinicContact = { id: 'clinic-1', name: 'City Hospital', role: 'hospital', specialty: null, phone: null }

  beforeEach(() => {
    vi.clearAllMocks()
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'contacts_list') return Promise.resolve([clinicContact])
      return Promise.resolve([])
    })
  })

  it('includes linked clinic contact id in onSave payload for new appointments', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<AppointmentForm onSave={onSave} onCancel={vi.fn()} />)

    await userEvent.type(screen.getByLabelText(/Title/i), 'Checkup')
    fireEvent.change(screen.getByLabelText(/Date & Time/i), { target: { value: '2026-06-01T10:00' } })

    const picker = await screen.findByRole('combobox', { name: /select clinic from contacts/i })
    await userEvent.selectOptions(picker, 'clinic-1')

    fireEvent.click(screen.getByText('Save Appointment'))
    await waitFor(() => expect(onSave).toHaveBeenCalledOnce())

    const input = onSave.mock.calls[0]?.[0]
    expect(input.linked_contact_ids).toContain('clinic-1')
  })
})

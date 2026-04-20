import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AppointmentCard } from '../AppointmentCard'
import type { Appointment } from '../../../store/appointmentsStore'

const makeAppt = (overrides: Partial<Appointment> = {}): Appointment => ({
  id: 'a1',
  title: 'Annual Checkup',
  doctor_name: 'Dr. Smith',
  clinic_name: 'City Clinic',
  specialty: 'General Practice',
  appt_date: '2026-04-20T10:00:00',
  duration_min: 30,
  location: 'Room 1',
  notes: null,
  status: 'scheduled',
  reminder_min: 60,
  created_at: '2026-04-01T00:00:00',
  updated_at: '2026-04-01T00:00:00',
  document_ids: [],
  ...overrides,
})

describe('AppointmentCard', () => {
  const onEdit = vi.fn()
  const onDelete = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the appointment title', () => {
    render(<AppointmentCard appointment={makeAppt()} onEdit={onEdit} onDelete={onDelete} />)
    expect(screen.getByText('Annual Checkup')).toBeDefined()
  })

  it('renders scheduled status badge', () => {
    render(<AppointmentCard appointment={makeAppt()} onEdit={onEdit} onDelete={onDelete} />)
    expect(screen.getByText('Scheduled')).toBeDefined()
  })

  it('renders completed status badge', () => {
    render(
      <AppointmentCard
        appointment={makeAppt({ status: 'completed' })}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    )
    expect(screen.getByText('Completed')).toBeDefined()
  })

  it('renders cancelled status badge', () => {
    render(
      <AppointmentCard
        appointment={makeAppt({ status: 'cancelled' })}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    )
    expect(screen.getByText('Cancelled')).toBeDefined()
  })

  it('renders missed status badge', () => {
    render(
      <AppointmentCard
        appointment={makeAppt({ status: 'missed' })}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    )
    expect(screen.getByText('Missed')).toBeDefined()
  })

  it('renders doctor name when provided', () => {
    render(<AppointmentCard appointment={makeAppt()} onEdit={onEdit} onDelete={onDelete} />)
    expect(screen.getByText(/Dr\. Smith/)).toBeDefined()
  })

  it('renders clinic name when provided', () => {
    render(<AppointmentCard appointment={makeAppt()} onEdit={onEdit} onDelete={onDelete} />)
    expect(screen.getByText(/City Clinic/)).toBeDefined()
  })

  it('renders duration when > 0', () => {
    render(
      <AppointmentCard
        appointment={makeAppt({ duration_min: 45 })}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    )
    expect(screen.getByText(/45 min/)).toBeDefined()
  })

  it('renders document count when document_ids is non-empty', () => {
    render(
      <AppointmentCard
        appointment={makeAppt({ document_ids: ['d1', 'd2'] })}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    )
    expect(screen.getByText(/2 linked documents/)).toBeDefined()
  })

  it('renders singular label for one document', () => {
    render(
      <AppointmentCard
        appointment={makeAppt({ document_ids: ['d1'] })}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    )
    expect(screen.getByText('1 linked document')).toBeDefined()
  })

  it('calls onEdit with appointment when Edit clicked', () => {
    const appt = makeAppt()
    render(<AppointmentCard appointment={appt} onEdit={onEdit} onDelete={onDelete} />)
    fireEvent.click(screen.getByText('Edit'))
    expect(onEdit).toHaveBeenCalledOnce()
    expect(onEdit).toHaveBeenCalledWith(appt)
  })

  it('calls onDelete with id when delete button clicked', () => {
    render(<AppointmentCard appointment={makeAppt({ id: 'a1' })} onEdit={onEdit} onDelete={onDelete} />)
    fireEvent.click(screen.getByRole('button', { name: /Delete Annual Checkup/i }))
    expect(onDelete).toHaveBeenCalledOnce()
    expect(onDelete).toHaveBeenCalledWith('a1')
  })
})

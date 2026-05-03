import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ApptSuggestionBanner } from './ApptSuggestionBanner'
import type { AppointmentSuggestion } from './ApptSuggestionBanner'

const baseSuggestion: AppointmentSuggestion = {
  appt_date: '2022-01-21',
  title: 'PHYSIOTHERAPY with Dr. Smith',
  doctor_name: 'Dr. Smith',
  specialty: 'PHYSIOTHERAPY',
  clinic_name: null,
}

const serviceSuggestion: AppointmentSuggestion = {
  appt_date: '2022-03-10',
  title: 'ECG',
  doctor_name: null,
  specialty: null,
  clinic_name: 'London Clinic',
}

describe('ApptSuggestionBanner', () => {
  it('renders the appointment title and date', () => {
    render(
      <ApptSuggestionBanner
        suggestion={baseSuggestion}
        onConfirm={vi.fn()}
        onDismiss={vi.fn()}
      />,
    )
    expect(screen.getByText('PHYSIOTHERAPY with Dr. Smith')).toBeTruthy()
    expect(screen.getByText(/2022-01-21/)).toBeTruthy()
  })

  it('renders Create Appointment and Dismiss buttons', () => {
    render(
      <ApptSuggestionBanner
        suggestion={baseSuggestion}
        onConfirm={vi.fn()}
        onDismiss={vi.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: /create appointment/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /dismiss/i })).toBeTruthy()
  })

  it('calls onConfirm with doctor name when Create Appointment is clicked', () => {
    const onConfirm = vi.fn()
    render(
      <ApptSuggestionBanner
        suggestion={baseSuggestion}
        onConfirm={onConfirm}
        onDismiss={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /create appointment/i }))
    expect(onConfirm).toHaveBeenCalledWith('Dr. Smith')
  })

  it('calls onConfirm with null when no-doctor checkbox is checked', () => {
    const onConfirm = vi.fn()
    render(
      <ApptSuggestionBanner
        suggestion={baseSuggestion}
        onConfirm={onConfirm}
        onDismiss={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: /create appointment/i }))
    expect(onConfirm).toHaveBeenCalledWith(null)
  })

  it('initialises no-doctor checked and passes null when suggestion has no doctor', () => {
    const onConfirm = vi.fn()
    render(
      <ApptSuggestionBanner
        suggestion={serviceSuggestion}
        onConfirm={onConfirm}
        onDismiss={vi.fn()}
      />,
    )
    const checkbox = screen.getByRole('checkbox') as HTMLInputElement
    expect(checkbox.checked).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: /create appointment/i }))
    expect(onConfirm).toHaveBeenCalledWith(null)
  })

  it('allows editing the doctor name before confirming', () => {
    const onConfirm = vi.fn()
    render(
      <ApptSuggestionBanner
        suggestion={serviceSuggestion}
        onConfirm={onConfirm}
        onDismiss={vi.fn()}
      />,
    )
    // Uncheck no-doctor to enable input
    fireEvent.click(screen.getByRole('checkbox'))
    const input = screen.getByPlaceholderText(/doctor name/i) as HTMLInputElement
    fireEvent.change(input, { target: { value: 'Dr. Jones' } })
    fireEvent.click(screen.getByRole('button', { name: /create appointment/i }))
    expect(onConfirm).toHaveBeenCalledWith('Dr. Jones')
  })

  it('shows clinic name when suggestion includes clinic_name', () => {
    render(
      <ApptSuggestionBanner
        suggestion={serviceSuggestion}
        onConfirm={vi.fn()}
        onDismiss={vi.fn()}
      />,
    )
    expect(screen.getByText(/London Clinic/)).toBeTruthy()
  })

  it('does not render a clinic row when clinic_name is null', () => {
    render(
      <ApptSuggestionBanner
        suggestion={baseSuggestion}
        onConfirm={vi.fn()}
        onDismiss={vi.fn()}
      />,
    )
    expect(screen.queryByText(/Clinic:/)).toBeNull()
  })

  it('calls onDismiss when Dismiss is clicked', () => {
    const onDismiss = vi.fn()
    render(
      <ApptSuggestionBanner
        suggestion={baseSuggestion}
        onConfirm={vi.fn()}
        onDismiss={onDismiss}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('does not call onConfirm when Dismiss is clicked', () => {
    const onConfirm = vi.fn()
    render(
      <ApptSuggestionBanner
        suggestion={baseSuggestion}
        onConfirm={onConfirm}
        onDismiss={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }))
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('disables buttons and shows loading text when isLoading is true', () => {
    render(
      <ApptSuggestionBanner
        suggestion={baseSuggestion}
        onConfirm={vi.fn()}
        onDismiss={vi.fn()}
        isLoading
      />,
    )
    expect(screen.getByText('Creating…')).toBeTruthy()
    const buttons = screen.getAllByRole('button')
    for (const btn of buttons) {
      expect((btn as HTMLButtonElement).disabled).toBe(true)
    }
  })
})

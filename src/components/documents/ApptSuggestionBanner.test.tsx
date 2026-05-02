import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ApptSuggestionBanner } from './ApptSuggestionBanner'
import type { AppointmentSuggestion } from './ApptSuggestionBanner'

const baseSuggestion: AppointmentSuggestion = {
  apptDate: '2022-01-21',
  title: 'PHYSIOTHERAPY with Dr. Smith',
  doctorName: 'Dr. Smith',
  specialty: 'PHYSIOTHERAPY',
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

  it('calls onConfirm when Create Appointment is clicked', () => {
    const onConfirm = vi.fn()
    render(
      <ApptSuggestionBanner
        suggestion={baseSuggestion}
        onConfirm={onConfirm}
        onDismiss={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /create appointment/i }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
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

  it('renders with null doctorName and specialty', () => {
    const minimal: AppointmentSuggestion = {
      apptDate: '2022-01-21',
      title: 'Medical appointment',
      doctorName: null,
      specialty: null,
    }
    render(
      <ApptSuggestionBanner
        suggestion={minimal}
        onConfirm={vi.fn()}
        onDismiss={vi.fn()}
      />,
    )
    expect(screen.getByText('Medical appointment')).toBeTruthy()
  })
})

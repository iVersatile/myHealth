import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { LinkSuggestionBanner } from './LinkSuggestionBanner'

describe('LinkSuggestionBanner', () => {
  it('renders appointment title', () => {
    render(
      <LinkSuggestionBanner
        appointmentId="appt-1"
        appointmentTitle="Annual Checkup"
        onConfirm={vi.fn()}
        onDismiss={vi.fn()}
      />,
    )
    expect(screen.getByText('Annual Checkup')).toBeInTheDocument()
  })

  it('renders Link and Dismiss buttons', () => {
    render(
      <LinkSuggestionBanner
        appointmentId="appt-1"
        appointmentTitle="Annual Checkup"
        onConfirm={vi.fn()}
        onDismiss={vi.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: /link/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /dismiss/i })).toBeInTheDocument()
  })

  it('calls onConfirm with appointmentId when Link clicked', () => {
    const onConfirm = vi.fn()
    render(
      <LinkSuggestionBanner
        appointmentId="appt-42"
        appointmentTitle="Cardiology Review"
        onConfirm={onConfirm}
        onDismiss={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /link/i }))
    expect(onConfirm).toHaveBeenCalledWith('appt-42')
  })

  it('calls onDismiss when Dismiss clicked', () => {
    const onDismiss = vi.fn()
    render(
      <LinkSuggestionBanner
        appointmentId="appt-1"
        appointmentTitle="Annual Checkup"
        onConfirm={vi.fn()}
        onDismiss={onDismiss}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }))
    expect(onDismiss).toHaveBeenCalled()
  })

  it('does not call onConfirm when Dismiss clicked', () => {
    const onConfirm = vi.fn()
    render(
      <LinkSuggestionBanner
        appointmentId="appt-1"
        appointmentTitle="Annual Checkup"
        onConfirm={onConfirm}
        onDismiss={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }))
    expect(onConfirm).not.toHaveBeenCalled()
  })
})

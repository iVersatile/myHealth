import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DoctorSuggestionBanner } from './DoctorSuggestionBanner'
import type { ContactSuggestion } from './DoctorSuggestionBanner'

function makeSuggestion(name: string): ContactSuggestion {
  return { name, title: null, specialty: null, clinic: null, address: null, phone: null, email: null }
}

const mockInvoke = vi.fn()
vi.mock('@tauri-apps/api/core', () => ({ invoke: (...args: unknown[]) => mockInvoke(...args) }))

describe('DoctorSuggestionBanner', () => {
  beforeEach(() => {
    mockInvoke.mockReset()
  })

  it('renders nothing while checking for existing contacts', () => {
    mockInvoke.mockReturnValue(new Promise(() => {})) // never resolves
    const { container } = render(
      <DoctorSuggestionBanner candidates={[makeSuggestion('Dr. Jane Smith')]} onAccept={vi.fn()} onDismiss={vi.fn()} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when all candidates already exist as contacts', async () => {
    mockInvoke.mockResolvedValue({ id: 'c1', name: 'Dr. Jane Smith' })
    const { container } = render(
      <DoctorSuggestionBanner candidates={[makeSuggestion('Dr. Jane Smith')]} onAccept={vi.fn()} onDismiss={vi.fn()} />,
    )
    await waitFor(() => expect(mockInvoke).toHaveBeenCalled())
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when candidates list is empty', async () => {
    const { container } = render(
      <DoctorSuggestionBanner candidates={[]} onAccept={vi.fn()} onDismiss={vi.fn()} />,
    )
    await waitFor(() => expect(mockInvoke).not.toHaveBeenCalled())
    expect(container.firstChild).toBeNull()
  })

  it('shows banner with doctor name when no existing contact found', async () => {
    mockInvoke.mockResolvedValue(null)
    render(
      <DoctorSuggestionBanner candidates={[makeSuggestion('Dr. John Doe')]} onAccept={vi.fn()} onDismiss={vi.fn()} />,
    )
    await waitFor(() => expect(screen.getByText(/Dr\. John Doe/)).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /add to contacts/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /dismiss/i })).toBeInTheDocument()
  })

  it('calls contacts_find_similar for each candidate', async () => {
    mockInvoke.mockResolvedValue(null)
    render(
      <DoctorSuggestionBanner
        candidates={[makeSuggestion('Dr. Alice Brown'), makeSuggestion('Dr. Bob Green')]}
        onAccept={vi.fn()}
        onDismiss={vi.fn()}
      />,
    )
    await waitFor(() => expect(mockInvoke).toHaveBeenCalledTimes(2))
    expect(mockInvoke).toHaveBeenCalledWith('contacts_find_similar', { name: 'Dr. Alice Brown' })
    expect(mockInvoke).toHaveBeenCalledWith('contacts_find_similar', { name: 'Dr. Bob Green' })
  })

  it('only shows first unmatched candidate', async () => {
    mockInvoke
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
    render(
      <DoctorSuggestionBanner
        candidates={[makeSuggestion('Dr. Alice Brown'), makeSuggestion('Dr. Bob Green')]}
        onAccept={vi.fn()}
        onDismiss={vi.fn()}
      />,
    )
    await waitFor(() => expect(screen.getByText(/Dr\. Alice Brown/)).toBeInTheDocument())
    expect(screen.queryByText(/Dr\. Bob Green/)).toBeNull()
  })

  it('calls onAccept with the full suggestion when Create clicked', async () => {
    mockInvoke.mockResolvedValue(null)
    const onAccept = vi.fn()
    const suggestion = makeSuggestion('Dr. John Doe')
    render(
      <DoctorSuggestionBanner candidates={[suggestion]} onAccept={onAccept} onDismiss={vi.fn()} />,
    )
    await waitFor(() => screen.getByRole('button', { name: /add to contacts/i }))
    await userEvent.click(screen.getByRole('button', { name: /add to contacts/i }))
    expect(onAccept).toHaveBeenCalledWith(suggestion)
  })

  it('calls onDismiss immediately when no appointmentId and Dismiss clicked', async () => {
    mockInvoke.mockResolvedValue(null)
    const onDismiss = vi.fn()
    render(
      <DoctorSuggestionBanner candidates={[makeSuggestion('Dr. John Doe')]} onAccept={vi.fn()} onDismiss={onDismiss} />,
    )
    await waitFor(() => screen.getByRole('button', { name: /dismiss/i }))
    await userEvent.click(screen.getByRole('button', { name: /dismiss/i }))
    expect(onDismiss).toHaveBeenCalledTimes(1)
    expect(screen.queryByText(/is there a doctor/i)).toBeNull()
  })

  it('skips matched candidate and shows next unmatched one', async () => {
    mockInvoke
      .mockResolvedValueOnce({ id: 'c1', name: 'Dr. Alice Brown' }) // matched
      .mockResolvedValueOnce(null)                                    // unmatched
    render(
      <DoctorSuggestionBanner
        candidates={[makeSuggestion('Dr. Alice Brown'), makeSuggestion('Dr. Bob Green')]}
        onAccept={vi.fn()}
        onDismiss={vi.fn()}
      />,
    )
    await waitFor(() => expect(screen.getByText(/Dr\. Bob Green/)).toBeInTheDocument())
    expect(screen.queryByText(/Dr\. Alice Brown/)).toBeNull()
  })

  describe('follow-up prompt (with appointmentId)', () => {
    it('shows follow-up when Dismiss clicked with appointmentId', async () => {
      mockInvoke.mockResolvedValue(null)
      render(
        <DoctorSuggestionBanner
          candidates={[makeSuggestion('Dr. John Doe')]}
          onAccept={vi.fn()}
          onDismiss={vi.fn()}
          appointmentId="appt1"
        />,
      )
      await waitFor(() => screen.getByRole('button', { name: /dismiss/i }))
      await userEvent.click(screen.getByRole('button', { name: /dismiss/i }))
      expect(screen.getByText(/is there a doctor for this appointment/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /yes, keep name/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /no.*service/i })).toBeInTheDocument()
    })

    it('Yes keep name calls onDismiss without invoking clear', async () => {
      mockInvoke.mockResolvedValue(null)
      const onDismiss = vi.fn()
      render(
        <DoctorSuggestionBanner
          candidates={[makeSuggestion('Dr. John Doe')]}
          onAccept={vi.fn()}
          onDismiss={onDismiss}
          appointmentId="appt1"
        />,
      )
      await waitFor(() => screen.getByRole('button', { name: /dismiss/i }))
      await userEvent.click(screen.getByRole('button', { name: /dismiss/i }))
      await userEvent.click(screen.getByRole('button', { name: /yes, keep name/i }))
      expect(onDismiss).toHaveBeenCalledTimes(1)
      expect(mockInvoke).not.toHaveBeenCalledWith('appointments_clear_doctor', expect.anything())
    })

    it('No it is a service invokes appointments_clear_doctor then calls onDismiss', async () => {
      mockInvoke.mockResolvedValueOnce(null)       // contacts_find_similar
      mockInvoke.mockResolvedValueOnce(undefined)  // appointments_clear_doctor
      const onDismiss = vi.fn()
      render(
        <DoctorSuggestionBanner
          candidates={[makeSuggestion('Dr. John Doe')]}
          onAccept={vi.fn()}
          onDismiss={onDismiss}
          appointmentId="appt1"
        />,
      )
      await waitFor(() => screen.getByRole('button', { name: /dismiss/i }))
      await userEvent.click(screen.getByRole('button', { name: /dismiss/i }))
      await userEvent.click(screen.getByRole('button', { name: /no.*service/i }))
      await waitFor(() => expect(onDismiss).toHaveBeenCalledTimes(1))
      expect(mockInvoke).toHaveBeenCalledWith('appointments_clear_doctor', { appointmentId: 'appt1' })
    })
  })
})

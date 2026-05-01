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
    await waitFor(() => expect(screen.getByText(/Dr\. John Doe/)).toBeTruthy())
    expect(screen.getByRole('button', { name: /create/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /dismiss/i })).toBeTruthy()
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
    await waitFor(() => expect(screen.getByText(/Dr\. Alice Brown/)).toBeTruthy())
    expect(screen.queryByText(/Dr\. Bob Green/)).toBeNull()
  })

  it('calls onAccept with the full suggestion when Create clicked', async () => {
    mockInvoke.mockResolvedValue(null)
    const onAccept = vi.fn()
    const suggestion = makeSuggestion('Dr. John Doe')
    render(
      <DoctorSuggestionBanner candidates={[suggestion]} onAccept={onAccept} onDismiss={vi.fn()} />,
    )
    await waitFor(() => screen.getByRole('button', { name: /create/i }))
    await userEvent.click(screen.getByRole('button', { name: /create/i }))
    expect(onAccept).toHaveBeenCalledWith(suggestion)
  })

  it('calls onDismiss when Dismiss clicked', async () => {
    mockInvoke.mockResolvedValue(null)
    const onDismiss = vi.fn()
    render(
      <DoctorSuggestionBanner candidates={[makeSuggestion('Dr. John Doe')]} onAccept={vi.fn()} onDismiss={onDismiss} />,
    )
    await waitFor(() => screen.getByRole('button', { name: /dismiss/i }))
    await userEvent.click(screen.getByRole('button', { name: /dismiss/i }))
    expect(onDismiss).toHaveBeenCalled()
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
    await waitFor(() => expect(screen.getByText(/Dr\. Bob Green/)).toBeTruthy())
    expect(screen.queryByText(/Dr\. Alice Brown/)).toBeNull()
  })
})

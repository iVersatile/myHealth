import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ClinicSuggestionBanner } from './ClinicSuggestionBanner'
import type { ClinicSuggestion } from './UploadDialog'

function makeSuggestion(name: string): ClinicSuggestion {
  return { name, company_registration_number: null, addresses: [] }
}

const mockInvoke = vi.fn()
vi.mock('@tauri-apps/api/core', () => ({ invoke: (...args: unknown[]) => mockInvoke(...args) }))

describe('ClinicSuggestionBanner', () => {
  beforeEach(() => {
    mockInvoke.mockReset()
  })

  it('renders nothing when suggestions list is empty', () => {
    const { container } = render(
      <ClinicSuggestionBanner suggestions={[]} onDismiss={vi.fn()} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('shows banner with clinic name for single suggestion', () => {
    render(
      <ClinicSuggestionBanner suggestions={[makeSuggestion('City Health Clinic')]} onDismiss={vi.fn()} />,
    )
    expect(screen.getByText(/City Health Clinic/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /save clinic/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /dismiss/i })).toBeInTheDocument()
  })

  it('shows first suggestion when multiple provided', () => {
    render(
      <ClinicSuggestionBanner
        suggestions={[makeSuggestion('First Clinic'), makeSuggestion('Second Clinic')]}
        onDismiss={vi.fn()}
      />,
    )
    expect(screen.getByText(/First Clinic/)).toBeInTheDocument()
    expect(screen.queryByText(/Second Clinic/)).toBeNull()
  })

  it('calls clinics_create_if_not_exists with correct payload when Save clicked', async () => {
    mockInvoke.mockResolvedValue(undefined)
    const suggestion: ClinicSuggestion = {
      name: 'Royal Free',
      company_registration_number: 'RC12345',
      addresses: [],
    }
    render(<ClinicSuggestionBanner suggestions={[suggestion]} onDismiss={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /save clinic/i }))
    expect(mockInvoke).toHaveBeenCalledWith('clinics_create_if_not_exists', {
      input: {
        name: 'Royal Free',
        address: null,
        phone: null,
        company_registration_number: 'RC12345',
        addresses: [],
      },
    })
  })

  it('shows saved confirmation and Dismiss button after successful save', async () => {
    mockInvoke.mockResolvedValue(undefined)
    render(
      <ClinicSuggestionBanner suggestions={[makeSuggestion('City Health Clinic')]} onDismiss={vi.fn()} />,
    )
    await userEvent.click(screen.getByRole('button', { name: /save clinic/i }))
    await waitFor(() => expect(screen.getByText(/saved/i)).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /dismiss/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /save clinic/i })).toBeNull()
  })

  it('calls onDismiss when Dismiss clicked from saved state', async () => {
    mockInvoke.mockResolvedValue(undefined)
    const onDismiss = vi.fn()
    render(<ClinicSuggestionBanner suggestions={[makeSuggestion('City Health Clinic')]} onDismiss={onDismiss} />)
    await userEvent.click(screen.getByRole('button', { name: /save clinic/i }))
    await waitFor(() => screen.getByText(/saved/i))
    await userEvent.click(screen.getByRole('button', { name: /dismiss/i }))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('calls onDismiss when Dismiss clicked before saving', async () => {
    const onDismiss = vi.fn()
    render(<ClinicSuggestionBanner suggestions={[makeSuggestion('City Health Clinic')]} onDismiss={onDismiss} />)
    await userEvent.click(screen.getByRole('button', { name: /dismiss/i }))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('disables Save button while saving', async () => {
    let resolveSave!: () => void
    mockInvoke.mockReturnValue(new Promise<void>((res) => { resolveSave = res }))
    render(<ClinicSuggestionBanner suggestions={[makeSuggestion('City Health Clinic')]} onDismiss={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /save clinic/i }))
    expect(screen.getByRole('button', { name: /saving/i })).toBeDisabled()
    resolveSave()
    await waitFor(() => expect(screen.queryByRole('button', { name: /saving/i })).toBeNull())
  })

  it('shows error message when save fails', async () => {
    mockInvoke.mockRejectedValue(new Error('Network timeout'))
    render(<ClinicSuggestionBanner suggestions={[makeSuggestion('City Health Clinic')]} onDismiss={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /save clinic/i }))
    await waitFor(() => expect(screen.getByText(/network timeout/i)).toBeInTheDocument())
  })

  it('shows generic error when save throws non-Error', async () => {
    mockInvoke.mockRejectedValue('unknown error')
    render(<ClinicSuggestionBanner suggestions={[makeSuggestion('City Health Clinic')]} onDismiss={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /save clinic/i }))
    await waitFor(() => expect(screen.getByText(/failed to save clinic/i)).toBeInTheDocument())
  })

  it('re-enables Save button after failed save', async () => {
    mockInvoke.mockRejectedValue(new Error('Oops'))
    render(<ClinicSuggestionBanner suggestions={[makeSuggestion('City Health Clinic')]} onDismiss={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /save clinic/i }))
    await waitFor(() => screen.getByText(/oops/i))
    expect(screen.getByRole('button', { name: /save clinic/i })).not.toBeDisabled()
  })

  it('passes addresses from suggestion to invoke payload', async () => {
    mockInvoke.mockResolvedValue(undefined)
    const suggestion: ClinicSuggestion = {
      name: 'Acme Clinic',
      company_registration_number: null,
      addresses: [{ line1: '1 Main St', line2: null, city: 'London', postcode: 'SW1A 1AA', country: 'UK' }],
    }
    render(<ClinicSuggestionBanner suggestions={[suggestion]} onDismiss={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /save clinic/i }))
    expect(mockInvoke).toHaveBeenCalledWith('clinics_create_if_not_exists', {
      input: expect.objectContaining({ addresses: suggestion.addresses }),
    })
  })
})

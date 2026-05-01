import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ContactForm } from './ContactForm'
import type { Contact } from '../../store/contactsStore'

const fakeContact: Contact = {
  id: 'c1',
  name: 'Dr. Jane Smith',
  role: 'specialist',
  specialty: 'Cardiology',
  phone: '07700000001',
  email: 'jane@clinic.com',
  clinic: 'City Heart Centre',
  address: '1 Heart Lane',
  notes: 'Referred by GP',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  contact_clinic_id: null,
}

describe('ContactForm', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('shows "New Contact" title when initial is null', () => {
    render(<ContactForm initial={null} onSave={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByText('New Contact')).toBeTruthy()
  })

  it('shows "Edit Contact" title when initial contact provided', () => {
    render(<ContactForm initial={fakeContact} onSave={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByText('Edit Contact')).toBeTruthy()
  })

  it('pre-fills name field from initial contact', () => {
    render(<ContactForm initial={fakeContact} onSave={vi.fn()} onCancel={vi.fn()} />)
    const nameInput = screen.getAllByRole('textbox').find(
      (el) => (el as HTMLInputElement).value === 'Dr. Jane Smith',
    )
    expect(nameInput).toBeTruthy()
  })

  it('pre-fills name when initial has only name set', () => {
    const partial: Contact = {
      id: '',
      name: 'Dr. John Doe',
      role: 'gp',
      specialty: null,
      phone: null,
      email: null,
      clinic: null,
      address: null,
      notes: null,
      created_at: '',
      updated_at: '',
      contact_clinic_id: null,
    }
    render(<ContactForm initial={partial} onSave={vi.fn()} onCancel={vi.fn()} />)
    const nameInput = screen.getAllByRole('textbox').find(
      (el) => (el as HTMLInputElement).value === 'Dr. John Doe',
    )
    expect(nameInput).toBeTruthy()
  })

  it('calls onCancel when Cancel button clicked', async () => {
    const onCancel = vi.fn()
    render(<ContactForm initial={null} onSave={vi.fn()} onCancel={onCancel} />)
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onCancel).toHaveBeenCalled()
  })

  it('shows error when submitted with empty name', async () => {
    render(<ContactForm initial={null} onSave={vi.fn()} onCancel={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /save/i }))
    await waitFor(() => expect(screen.getByText('Name is required')).toBeTruthy())
  })

  it('calls onSave with trimmed values on valid submit', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<ContactForm initial={null} onSave={onSave} onCancel={vi.fn()} />)
    const inputs = screen.getAllByRole('textbox')
    await userEvent.type(inputs[0]!, 'Dr. New Doctor')
    await userEvent.click(screen.getByRole('button', { name: /save/i }))
    await waitFor(() => expect(onSave).toHaveBeenCalled())
    const payload = onSave.mock.calls[0]?.[0] as Record<string, unknown>
    expect(payload.name).toBe('Dr. New Doctor')
    expect(payload.specialty).toBeNull()
    expect(payload.phone).toBeNull()
  })

  it('includes id in payload when editing existing contact', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<ContactForm initial={fakeContact} onSave={onSave} onCancel={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /save/i }))
    await waitFor(() => expect(onSave).toHaveBeenCalled())
    const payload = onSave.mock.calls[0]?.[0] as Record<string, unknown>
    expect(payload.id).toBe('c1')
  })

  it('does not include id in payload when creating new contact', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<ContactForm initial={null} onSave={onSave} onCancel={vi.fn()} />)
    const inputs = screen.getAllByRole('textbox')
    await userEvent.type(inputs[0]!, 'Dr. Fresh')
    await userEvent.click(screen.getByRole('button', { name: /save/i }))
    await waitFor(() => expect(onSave).toHaveBeenCalled())
    const payload = onSave.mock.calls[0]?.[0] as Record<string, unknown>
    expect('id' in payload).toBe(false)
  })

  it('shows error message when onSave rejects', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('server error'))
    render(<ContactForm initial={null} onSave={onSave} onCancel={vi.fn()} />)
    const inputs = screen.getAllByRole('textbox')
    await userEvent.type(inputs[0]!, 'Dr. Test')
    await userEvent.click(screen.getByRole('button', { name: /save/i }))
    await waitFor(() => expect(screen.getByText('server error')).toBeTruthy())
  })

  it('disables Save button while saving', async () => {
    let resolve!: () => void
    const onSave = vi.fn().mockReturnValue(new Promise<void>((r) => { resolve = r }))
    render(<ContactForm initial={null} onSave={onSave} onCancel={vi.fn()} />)
    const inputs = screen.getAllByRole('textbox')
    await userEvent.type(inputs[0]!, 'Dr. Slow')
    await userEvent.click(screen.getByRole('button', { name: /save/i }))
    await waitFor(() => {
      const btn = screen.getByRole('button', { name: /saving/i }) as HTMLButtonElement
      expect(btn.disabled).toBe(true)
    })
    resolve()
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ClinicTree } from './ClinicTree'
import type { ClinicWithContacts } from '../../hooks/useClinics'

const mockInvoke = vi.fn()
vi.mock('@tauri-apps/api/core', () => ({ invoke: (...args: unknown[]) => mockInvoke(...args) }))

const clinicNoContacts: ClinicWithContacts = {
  id: 'clinic-1',
  name: 'Solo Clinic',
  address: null,
  phone: null,
  created_at: '2026-05-01T10:00:00Z',
  company_registration_number: null,
  linked_contacts: [],
}

const clinicWithContacts: ClinicWithContacts = {
  id: 'clinic-2',
  name: 'Full Clinic',
  address: '1 Main St',
  phone: '555-0100',
  created_at: '2026-05-01T10:00:00Z',
  company_registration_number: null,
  linked_contacts: [
    { id: 'contact-1', name: 'Dr Alice', role: 'gp' },
    { id: 'contact-2', name: 'Dr Bob', role: 'specialist' },
  ],
}

describe('ClinicTree', () => {
  beforeEach(() => {
    mockInvoke.mockReset()
  })

  // TC-F8-08: empty list shows placeholder text
  it('shows placeholder when no clinics', () => {
    render(<ClinicTree clinics={[]} onDeleted={vi.fn()} />)
    expect(screen.getByText(/No clinics yet/i)).toBeTruthy()
  })

  // TC-F8-08: standalone clinic renders as leaf with no doctor children
  it('renders standalone clinic with no linked doctors placeholder', () => {
    render(<ClinicTree clinics={[clinicNoContacts]} onDeleted={vi.fn()} />)
    expect(screen.getByText('Solo Clinic')).toBeTruthy()
    expect(screen.getByText('No linked doctors')).toBeTruthy()
  })

  // TC-F8-09: clinic with linked contacts shows doctor names
  it('renders linked doctor contacts as children', () => {
    render(<ClinicTree clinics={[clinicWithContacts]} onDeleted={vi.fn()} />)
    expect(screen.getByText('Full Clinic')).toBeTruthy()
    expect(screen.getByText('Dr Alice')).toBeTruthy()
    expect(screen.getByText('Dr Bob')).toBeTruthy()
  })

  it('shows phone number when present', () => {
    render(<ClinicTree clinics={[clinicWithContacts]} onDeleted={vi.fn()} />)
    expect(screen.getByText('555-0100')).toBeTruthy()
  })

  it('shows role badge for linked contacts', () => {
    render(<ClinicTree clinics={[clinicWithContacts]} onDeleted={vi.fn()} />)
    expect(screen.getByText('gp')).toBeTruthy()
    expect(screen.getByText('specialist')).toBeTruthy()
  })

  it('collapses clinic row on toggle click', () => {
    render(<ClinicTree clinics={[clinicWithContacts]} onDeleted={vi.fn()} />)
    const toggleBtn = screen.getByRole('button', { name: /Toggle Full Clinic/i })
    expect(screen.getByText('Dr Alice')).toBeTruthy()
    fireEvent.click(toggleBtn)
    expect(screen.queryByText('Dr Alice')).toBeNull()
  })

  it('calls clinics_delete and onDeleted when delete button clicked', async () => {
    mockInvoke.mockResolvedValue(undefined)
    const onDeleted = vi.fn()
    render(<ClinicTree clinics={[clinicNoContacts]} onDeleted={onDeleted} />)

    fireEvent.click(screen.getByRole('button', { name: /Delete Solo Clinic/i }))

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('clinics_delete', { id: 'clinic-1' })
      expect(onDeleted).toHaveBeenCalledTimes(1)
    })
  })

  it('disables delete button while deletion is in progress', async () => {
    let resolveFn!: () => void
    mockInvoke.mockReturnValue(new Promise<void>((r) => { resolveFn = r }))
    render(<ClinicTree clinics={[clinicNoContacts]} onDeleted={vi.fn()} />)

    const btn = screen.getByRole('button', { name: /Delete Solo Clinic/i })
    fireEvent.click(btn)

    await waitFor(() => expect(screen.getByText('Deleting…')).toBeTruthy())
    expect(btn).toHaveProperty('disabled', true)

    resolveFn()
    await waitFor(() => expect(screen.getByText('Delete')).toBeTruthy())
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AddressList, type Address } from '../AddressList'

const mockInvoke = vi.fn()
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}))

const makeAddress = (overrides: Partial<Address> = {}): Address => ({
  id: 'addr-1',
  label: 'Main',
  line1: '1 Test St',
  line2: null,
  city: 'London',
  postcode: 'EC1A 1BB',
  country: 'GB',
  is_primary: false,
  created_at: '2026-01-01T00:00:00Z',
  ...overrides,
})

const noop = () => {}

beforeEach(() => {
  mockInvoke.mockReset()
  mockInvoke.mockResolvedValue(undefined)
})

describe('AddressList — display', () => {
  it('renders address line1', () => {
    render(<AddressList addresses={[makeAddress()]} entityId="e1" entityType="clinic" onChanged={noop} />)
    expect(screen.getByText('1 Test St')).toBeInTheDocument()
  })

  it('shows label when present', () => {
    render(<AddressList addresses={[makeAddress({ label: 'RECEPTION' })]} entityId="e1" entityType="clinic" onChanged={noop} />)
    expect(screen.getByText('RECEPTION')).toBeInTheDocument()
  })

  it('renders city and postcode together', () => {
    render(<AddressList addresses={[makeAddress()]} entityId="e1" entityType="clinic" onChanged={noop} />)
    expect(screen.getByText('London, EC1A 1BB')).toBeInTheDocument()
  })

  it('shows non-GB country', () => {
    render(<AddressList addresses={[makeAddress({ country: 'FR' })]} entityId="e1" entityType="clinic" onChanged={noop} />)
    expect(screen.getByText('FR')).toBeInTheDocument()
  })

  it('hides GB country', () => {
    render(<AddressList addresses={[makeAddress({ country: 'GB' })]} entityId="e1" entityType="clinic" onChanged={noop} />)
    expect(screen.queryByText('GB')).toBeNull()
  })

  it('shows Add address button when not adding', () => {
    render(<AddressList addresses={[]} entityId="e1" entityType="clinic" onChanged={noop} />)
    expect(screen.getByText('+ Add address')).toBeInTheDocument()
  })
})

describe('AddressList — edit', () => {
  it('clicking edit button shows form pre-filled with address data', () => {
    render(<AddressList addresses={[makeAddress()]} entityId="e1" entityType="clinic" onChanged={noop} />)
    fireEvent.click(screen.getByTitle('Edit'))
    expect((screen.getByPlaceholderText('Line 1 *') as HTMLInputElement).value).toBe('1 Test St')
    expect((screen.getByPlaceholderText('Label (e.g. MAIN RECEPTION)') as HTMLInputElement).value).toBe('Main')
  })

  it('saveEdit calls clinic_address_update with nested input param', async () => {
    const onChanged = vi.fn()
    render(<AddressList addresses={[makeAddress()]} entityId="e1" entityType="clinic" onChanged={onChanged} />)
    fireEvent.click(screen.getByTitle('Edit'))
    fireEvent.change(screen.getByPlaceholderText('Line 1 *'), { target: { value: '2 Updated St' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith(
      'clinic_address_update',
      expect.objectContaining({ input: expect.objectContaining({ id: 'addr-1', line1: '2 Updated St' }) })
    ))
    expect(onChanged).toHaveBeenCalled()
  })

  it('saveEdit calls contact_address_update for contact entityType', async () => {
    render(<AddressList addresses={[makeAddress()]} entityId="c1" entityType="contact" onChanged={noop} />)
    fireEvent.click(screen.getByTitle('Edit'))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith('contact_address_update', expect.anything()))
  })

  it('saveEdit converts empty label to null', async () => {
    render(<AddressList addresses={[makeAddress({ label: null })]} entityId="e1" entityType="clinic" onChanged={noop} />)
    fireEvent.click(screen.getByTitle('Edit'))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith(
      'clinic_address_update',
      expect.objectContaining({ input: expect.objectContaining({ label: null }) })
    ))
  })

  it('saveEdit shows error when line1 is empty', () => {
    render(<AddressList addresses={[makeAddress()]} entityId="e1" entityType="clinic" onChanged={noop} />)
    fireEvent.click(screen.getByTitle('Edit'))
    fireEvent.change(screen.getByPlaceholderText('Line 1 *'), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByText('Line 1 is required')).toBeInTheDocument()
  })

  it('saveEdit shows error on invoke rejection', async () => {
    mockInvoke.mockRejectedValueOnce('save error')
    render(<AddressList addresses={[makeAddress()]} entityId="e1" entityType="clinic" onChanged={noop} />)
    fireEvent.click(screen.getByTitle('Edit'))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(screen.getByText('save error')).toBeInTheDocument())
  })

  it('Cancel button hides edit form', () => {
    render(<AddressList addresses={[makeAddress()]} entityId="e1" entityType="clinic" onChanged={noop} />)
    fireEvent.click(screen.getByTitle('Edit'))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByPlaceholderText('Line 1 *')).toBeNull()
  })
})

describe('AddressList — add', () => {
  it('clicking Add address shows the add form', () => {
    render(<AddressList addresses={[]} entityId="e1" entityType="clinic" onChanged={noop} />)
    fireEvent.click(screen.getByText('+ Add address'))
    expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument()
  })

  it('saveAdd calls clinic_address_create with clinicId and nested input', async () => {
    const onChanged = vi.fn()
    render(<AddressList addresses={[]} entityId="clinic-99" entityType="clinic" onChanged={onChanged} />)
    fireEvent.click(screen.getByText('+ Add address'))
    fireEvent.change(screen.getByPlaceholderText('Line 1 *'), { target: { value: '5 New Rd' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith(
      'clinic_address_create',
      { clinicId: 'clinic-99', input: expect.objectContaining({ line1: '5 New Rd' }) }
    ))
    expect(onChanged).toHaveBeenCalled()
  })

  it('saveAdd calls contact_address_create with contactId and nested input', async () => {
    render(<AddressList addresses={[]} entityId="contact-42" entityType="contact" onChanged={noop} />)
    fireEvent.click(screen.getByText('+ Add address'))
    fireEvent.change(screen.getByPlaceholderText('Line 1 *'), { target: { value: '6 Old Ln' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith(
      'contact_address_create',
      { contactId: 'contact-42', input: expect.objectContaining({ line1: '6 Old Ln' }) }
    ))
  })

  it('saveAdd shows error when line1 is empty', () => {
    render(<AddressList addresses={[]} entityId="e1" entityType="clinic" onChanged={noop} />)
    fireEvent.click(screen.getByText('+ Add address'))
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(screen.getByText('Line 1 is required')).toBeInTheDocument()
  })

  it('saveAdd shows error on invoke rejection', async () => {
    mockInvoke.mockRejectedValueOnce('add error')
    render(<AddressList addresses={[]} entityId="e1" entityType="clinic" onChanged={noop} />)
    fireEvent.click(screen.getByText('+ Add address'))
    fireEvent.change(screen.getByPlaceholderText('Line 1 *'), { target: { value: 'Valid St' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    await waitFor(() => expect(screen.getByText('add error')).toBeInTheDocument())
  })

  it('Cancel in add form hides the form', () => {
    render(<AddressList addresses={[]} entityId="e1" entityType="clinic" onChanged={noop} />)
    fireEvent.click(screen.getByText('+ Add address'))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.getByText('+ Add address')).toBeInTheDocument()
  })
})

describe('AddressList — delete & set primary', () => {
  it('delete calls clinic_address_delete', async () => {
    const onChanged = vi.fn()
    render(<AddressList addresses={[makeAddress()]} entityId="e1" entityType="clinic" onChanged={onChanged} />)
    fireEvent.click(screen.getByTitle('Delete'))
    await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith('clinic_address_delete', { id: 'addr-1' }))
    expect(onChanged).toHaveBeenCalled()
  })

  it('delete calls contact_address_delete for contact entityType', async () => {
    render(<AddressList addresses={[makeAddress()]} entityId="c1" entityType="contact" onChanged={noop} />)
    fireEvent.click(screen.getByTitle('Delete'))
    await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith('contact_address_delete', { id: 'addr-1' }))
  })

  it('set primary calls clinic_address_set_primary', async () => {
    const onChanged = vi.fn()
    render(<AddressList addresses={[makeAddress()]} entityId="clinic-1" entityType="clinic" onChanged={onChanged} />)
    fireEvent.click(screen.getByTitle('Set as primary'))
    await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith(
      'clinic_address_set_primary',
      { id: 'addr-1', clinicId: 'clinic-1' }
    ))
    expect(onChanged).toHaveBeenCalled()
  })

  it('set primary button is disabled when address is already primary', () => {
    render(<AddressList addresses={[makeAddress({ is_primary: true })]} entityId="e1" entityType="clinic" onChanged={noop} />)
    expect((screen.getByTitle('Primary address') as HTMLButtonElement).disabled).toBe(true)
  })

  it('delete shows error on invoke rejection', async () => {
    mockInvoke.mockRejectedValueOnce('delete error')
    render(<AddressList addresses={[makeAddress()]} entityId="e1" entityType="clinic" onChanged={noop} />)
    fireEvent.click(screen.getByTitle('Delete'))
    await waitFor(() => expect(screen.getByText('delete error')).toBeInTheDocument())
  })
})

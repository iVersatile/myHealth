import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mockPush = vi.fn()
const mockInvoke = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useParams: () => ({ id: 'm1' }),
}))
vi.mock('@tauri-apps/api/core', () => ({ invoke: (...args: unknown[]) => mockInvoke(...args) }))

import type { Medication } from '../../../../hooks/useMedications'

const makeMedication = (overrides: Partial<Medication> = {}): Medication => ({
  id: 'm1',
  name: 'Ibuprofen',
  dosage: '400mg',
  frequency: 'Twice daily',
  start_date: '2026-01-01',
  end_date: null,
  notes: null,
  deleted_at: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...overrides,
})

function setupInvoke(list: Medication[] = []) {
  mockInvoke.mockImplementation((cmd: string) => {
    if (cmd === 'medications_list') return Promise.resolve(list)
    if (cmd === 'medications_create') return Promise.resolve(makeMedication({ id: 'new' }))
    if (cmd === 'medications_update') return Promise.resolve(makeMedication())
    if (cmd === 'medications_delete') return Promise.resolve(undefined)
    return Promise.resolve(undefined)
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.resetModules()
  setupInvoke()
})

describe('MedicationsPage', () => {
  it('renders page heading', async () => {
    const { default: MedicationsPage } = await import('../page')
    render(<MedicationsPage />)
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /medications/i })).toBeDefined()
    })
  })

  it('shows empty state when no medications', async () => {
    const { default: MedicationsPage } = await import('../page')
    render(<MedicationsPage />)
    await waitFor(() => {
      expect(screen.getByText(/no medications logged/i)).toBeDefined()
    })
  })

  it('lists medications returned by hook', async () => {
    setupInvoke([makeMedication({ name: 'Aspirin' })])
    const { default: MedicationsPage } = await import('../page')
    render(<MedicationsPage />)
    await waitFor(() => {
      expect(screen.getByText('Aspirin')).toBeDefined()
    })
  })

  it('shows dosage on medication card', async () => {
    setupInvoke([makeMedication({ dosage: '200mg' })])
    const { default: MedicationsPage } = await import('../page')
    render(<MedicationsPage />)
    await waitFor(() => {
      expect(screen.getByText('200mg')).toBeDefined()
    })
  })

  it('navigates to new medication on button click', async () => {
    const { default: MedicationsPage } = await import('../page')
    render(<MedicationsPage />)
    await waitFor(() => screen.getByText(/\+ add medication/i))
    await userEvent.click(screen.getByText(/\+ add medication/i))
    expect(mockPush).toHaveBeenCalledWith('/medications/new')
  })

  it('navigates to view page on card click', async () => {
    setupInvoke([makeMedication({ id: 'm42', name: 'Paracetamol' })])
    const { default: MedicationsPage } = await import('../page')
    render(<MedicationsPage />)
    await waitFor(() => screen.getByText('Paracetamol'))
    await userEvent.click(screen.getByText('Paracetamol'))
    expect(mockPush).toHaveBeenCalledWith('/medications/view/m42')
  })
})

describe('NewMedicationPage', () => {
  it('renders form heading', async () => {
    const { default: NewMedicationPage } = await import('../new/page')
    render(<NewMedicationPage />)
    expect(screen.getByRole('heading', { name: /add medication/i })).toBeDefined()
  })

  it('submit button disabled when name is empty', async () => {
    const { default: NewMedicationPage } = await import('../new/page')
    render(<NewMedicationPage />)
    const btn = screen.getByRole('button', { name: /^save$/i })
    expect((btn as HTMLButtonElement).disabled).toBe(true)
  })

  it('calls medications_create and navigates on submit', async () => {
    setupInvoke([])
    const { default: NewMedicationPage } = await import('../new/page')
    render(<NewMedicationPage />)
    await userEvent.type(screen.getByPlaceholderText(/ibuprofen, metformin/i), 'Aspirin')
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }))
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('medications_create', expect.objectContaining({
        input: expect.objectContaining({ name: 'Aspirin' }),
      }))
      expect(mockPush).toHaveBeenCalledWith('/medications')
    })
  })

  it('shows error when create fails', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'medications_list') return Promise.resolve([])
      if (cmd === 'medications_create') return Promise.reject(new Error('DB error'))
      return Promise.resolve(undefined)
    })
    const { default: NewMedicationPage } = await import('../new/page')
    render(<NewMedicationPage />)
    await userEvent.type(screen.getByPlaceholderText(/ibuprofen, metformin/i), 'Aspirin')
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }))
    await waitFor(() => {
      expect(screen.getByText('DB error')).toBeDefined()
    })
  })

  it('cancel button navigates back to /medications', async () => {
    const { default: NewMedicationPage } = await import('../new/page')
    render(<NewMedicationPage />)
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(mockPush).toHaveBeenCalledWith('/medications')
  })
})

describe('ViewMedicationPage', () => {
  it('shows not-found state when medication missing', async () => {
    setupInvoke([])
    const { default: ViewMedicationPage } = await import('../view/[id]/page')
    render(<ViewMedicationPage />)
    await waitFor(() => {
      expect(screen.getByText(/medication not found/i)).toBeDefined()
    })
  })

  it('populates form with medication data', async () => {
    setupInvoke([makeMedication({ id: 'm1', name: 'Metformin', dosage: '500mg' })])
    const { default: ViewMedicationPage } = await import('../view/[id]/page')
    render(<ViewMedicationPage />)
    await waitFor(() => {
      const input = screen.getByDisplayValue('Metformin')
      expect(input).toBeDefined()
    })
  })

  it('calls medications_update on save', async () => {
    setupInvoke([makeMedication({ id: 'm1', name: 'Metformin' })])
    const { default: ViewMedicationPage } = await import('../view/[id]/page')
    render(<ViewMedicationPage />)
    await waitFor(() => screen.getByDisplayValue('Metformin'))
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }))
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('medications_update', expect.objectContaining({ id: 'm1' }))
    })
  })

  it('calls medications_delete on delete confirm', async () => {
    setupInvoke([makeMedication({ id: 'm1', name: 'Metformin' })])
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { default: ViewMedicationPage } = await import('../view/[id]/page')
    render(<ViewMedicationPage />)
    await waitFor(() => screen.getByDisplayValue('Metformin'))
    await userEvent.click(screen.getByRole('button', { name: /^delete$/i }))
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('medications_delete', { id: 'm1' })
      expect(mockPush).toHaveBeenCalledWith('/medications')
    })
  })

  it('does not delete when confirm cancelled', async () => {
    setupInvoke([makeMedication({ id: 'm1', name: 'Metformin' })])
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const { default: ViewMedicationPage } = await import('../view/[id]/page')
    render(<ViewMedicationPage />)
    await waitFor(() => screen.getByDisplayValue('Metformin'))
    await userEvent.click(screen.getByRole('button', { name: /^delete$/i }))
    expect(mockInvoke).not.toHaveBeenCalledWith('medications_delete', expect.anything())
  })
})

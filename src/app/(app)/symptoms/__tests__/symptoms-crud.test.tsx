import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mockPush = vi.fn()
const mockInvoke = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useParams: () => ({ id: 's1' }),
}))
vi.mock('@tauri-apps/api/core', () => ({ invoke: (...args: unknown[]) => mockInvoke(...args) }))

import type { Symptom } from '../../../../hooks/useSymptoms'

const makeSymptom = (overrides: Partial<Symptom> = {}): Symptom => ({
  id: 's1',
  name: 'Headache',
  severity: 5,
  onset_date: '2026-01-01',
  notes: null,
  deleted_at: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...overrides,
})

function setupInvoke(list: Symptom[] = []) {
  mockInvoke.mockImplementation((cmd: string) => {
    if (cmd === 'symptoms_list') return Promise.resolve(list)
    if (cmd === 'symptoms_create') return Promise.resolve(makeSymptom({ id: 'new' }))
    if (cmd === 'symptoms_update') return Promise.resolve(makeSymptom())
    if (cmd === 'symptoms_delete') return Promise.resolve(undefined)
    return Promise.resolve(undefined)
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.resetModules()
  setupInvoke()
})

describe('SymptomsPage', () => {
  it('renders page heading', async () => {
    const { default: SymptomsPage } = await import('../page')
    render(<SymptomsPage />)
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /symptoms/i })).toBeDefined()
    })
  })

  it('shows empty state when no symptoms', async () => {
    const { default: SymptomsPage } = await import('../page')
    render(<SymptomsPage />)
    await waitFor(() => {
      expect(screen.getByText(/no symptoms logged/i)).toBeDefined()
    })
  })

  it('lists symptoms returned by hook', async () => {
    setupInvoke([makeSymptom({ name: 'Fatigue' })])
    const { default: SymptomsPage } = await import('../page')
    render(<SymptomsPage />)
    await waitFor(() => {
      expect(screen.getByText('Fatigue')).toBeDefined()
    })
  })

  it('shows severity badge on symptom card', async () => {
    setupInvoke([makeSymptom({ severity: 8 })])
    const { default: SymptomsPage } = await import('../page')
    render(<SymptomsPage />)
    await waitFor(() => {
      expect(screen.getByText(/8\/10/)).toBeDefined()
      expect(screen.getByText(/severe/i)).toBeDefined()
    })
  })

  it('navigates to new symptom on button click', async () => {
    const { default: SymptomsPage } = await import('../page')
    render(<SymptomsPage />)
    await waitFor(() => screen.getByText(/log symptom/i))
    await userEvent.click(screen.getByText(/\+ log symptom/i))
    expect(mockPush).toHaveBeenCalledWith('/symptoms/new')
  })

  it('navigates to view page on card click', async () => {
    setupInvoke([makeSymptom({ id: 's42', name: 'Nausea' })])
    const { default: SymptomsPage } = await import('../page')
    render(<SymptomsPage />)
    await waitFor(() => screen.getByText('Nausea'))
    await userEvent.click(screen.getByText('Nausea'))
    expect(mockPush).toHaveBeenCalledWith('/symptoms/view/s42')
  })
})

describe('NewSymptomPage', () => {
  it('renders form heading', async () => {
    const { default: NewSymptomPage } = await import('../new/page')
    render(<NewSymptomPage />)
    expect(screen.getByRole('heading', { name: /log symptom/i })).toBeDefined()
  })

  it('submit button disabled when name is empty', async () => {
    const { default: NewSymptomPage } = await import('../new/page')
    render(<NewSymptomPage />)
    const btn = screen.getByRole('button', { name: /^save$/i })
    expect((btn as HTMLButtonElement).disabled).toBe(true)
  })

  it('calls symptoms_create and navigates on submit', async () => {
    setupInvoke([])
    const { default: NewSymptomPage } = await import('../new/page')
    render(<NewSymptomPage />)
    await userEvent.type(screen.getByPlaceholderText(/headache/i), 'Migraine')
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }))
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('symptoms_create', expect.objectContaining({
        input: expect.objectContaining({ name: 'Migraine' }),
      }))
      expect(mockPush).toHaveBeenCalledWith('/symptoms')
    })
  })

  it('shows error when create fails', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'symptoms_list') return Promise.resolve([])
      if (cmd === 'symptoms_create') return Promise.reject(new Error('DB error'))
      return Promise.resolve(undefined)
    })
    const { default: NewSymptomPage } = await import('../new/page')
    render(<NewSymptomPage />)
    await userEvent.type(screen.getByPlaceholderText(/headache/i), 'Migraine')
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }))
    await waitFor(() => {
      expect(screen.getByText('DB error')).toBeDefined()
    })
  })

  it('cancel button navigates back to /symptoms', async () => {
    const { default: NewSymptomPage } = await import('../new/page')
    render(<NewSymptomPage />)
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(mockPush).toHaveBeenCalledWith('/symptoms')
  })
})

describe('ViewSymptomPage', () => {
  it('shows not-found state when symptom missing', async () => {
    setupInvoke([])
    const { default: ViewSymptomPage } = await import('../view/[id]/page')
    render(<ViewSymptomPage />)
    await waitFor(() => {
      expect(screen.getByText(/symptom not found/i)).toBeDefined()
    })
  })

  it('populates form with symptom data', async () => {
    setupInvoke([makeSymptom({ id: 's1', name: 'Dizziness', severity: 3 })])
    const { default: ViewSymptomPage } = await import('../view/[id]/page')
    render(<ViewSymptomPage />)
    await waitFor(() => {
      const input = screen.getByDisplayValue('Dizziness')
      expect(input).toBeDefined()
    })
  })

  it('calls symptoms_update on save', async () => {
    setupInvoke([makeSymptom({ id: 's1', name: 'Dizziness' })])
    const { default: ViewSymptomPage } = await import('../view/[id]/page')
    render(<ViewSymptomPage />)
    await waitFor(() => screen.getByDisplayValue('Dizziness'))
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }))
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('symptoms_update', expect.objectContaining({ id: 's1' }))
    })
  })

  it('calls symptoms_delete on delete confirm', async () => {
    setupInvoke([makeSymptom({ id: 's1', name: 'Dizziness' })])
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { default: ViewSymptomPage } = await import('../view/[id]/page')
    render(<ViewSymptomPage />)
    await waitFor(() => screen.getByDisplayValue('Dizziness'))
    await userEvent.click(screen.getByRole('button', { name: /^delete$/i }))
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('symptoms_delete', { id: 's1' })
      expect(mockPush).toHaveBeenCalledWith('/symptoms')
    })
  })

  it('does not delete when confirm cancelled', async () => {
    setupInvoke([makeSymptom({ id: 's1', name: 'Dizziness' })])
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const { default: ViewSymptomPage } = await import('../view/[id]/page')
    render(<ViewSymptomPage />)
    await waitFor(() => screen.getByDisplayValue('Dizziness'))
    await userEvent.click(screen.getByRole('button', { name: /^delete$/i }))
    expect(mockInvoke).not.toHaveBeenCalledWith('symptoms_delete', expect.anything())
  })
})

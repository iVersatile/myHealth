import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MergeEntityDialog } from '../MergeEntityDialog'
import type { DraftEntityRow } from '../DraftEntitySection'

const mockInvoke = vi.fn()
vi.mock('@tauri-apps/api/core', () => ({ invoke: (...args: unknown[]) => mockInvoke(...args) }))

const makeDraft = (overrides: Partial<DraftEntityRow> = {}): DraftEntityRow => ({
  id: 'd1',
  entity_type: 'contact',
  name: 'Dr. Smith',
  created_at: '2026-01-01T00:00:00Z',
  role: 'GP',
  specialty: 'General',
  phone: '555-0001',
  email: 'smith@clinic.com',
  clinic: 'City Clinic',
  address: null,
  notes: 'Draft notes',
  merge_candidate_id: 'c99',
  appt_date: null,
  doctor_name: null,
  clinic_name: null,
  status: null,
  severity: null,
  onset_date: null,
  dosage: null,
  frequency: null,
  start_date: null,
  end_date: null,
  ...overrides,
})

const existingContact = {
  id: 'c99',
  name: 'Dr. Smith Existing',
  role: 'Surgeon',
  specialty: 'Cardiology',
  phone: '555-9999',
  email: 'smith@hospital.com',
  clinic: 'Hospital',
  notes: 'Existing notes',
}

const existingClinic = {
  id: 'c99',
  name: 'City Clinic Existing',
  address: '100 Main St',
  phone: '555-8888',
  email: 'clinic@hospital.com',
}

beforeEach(() => {
  mockInvoke.mockReset()
  mockInvoke.mockImplementation((cmd: string) => {
    if (cmd === 'contacts_get') return Promise.resolve(existingContact)
    if (cmd === 'clinics_get') return Promise.resolve(existingClinic)
    if (cmd === 'merge_draft_entity') return Promise.resolve(undefined)
    return Promise.resolve(undefined)
  })
})

describe('MergeEntityDialog', () => {
  it('renders with data-testid="merge-dialog"', async () => {
    render(
      <MergeEntityDialog
        draft={makeDraft()}
        entityType="contact"
        onClose={vi.fn()}
        onMerged={vi.fn()}
      />
    )
    expect(screen.getByTestId('merge-dialog')).toBeDefined()
  })

  it('shows loading state initially', () => {
    render(
      <MergeEntityDialog
        draft={makeDraft()}
        entityType="contact"
        onClose={vi.fn()}
        onMerged={vi.fn()}
      />
    )
    expect(screen.getByText(/loading/i)).toBeDefined()
  })

  it('calls contacts_get with merge_candidate_id for contact entityType', async () => {
    render(
      <MergeEntityDialog
        draft={makeDraft({ merge_candidate_id: 'c99' })}
        entityType="contact"
        onClose={vi.fn()}
        onMerged={vi.fn()}
      />
    )
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('contacts_get', { id: 'c99' })
    })
  })

  it('calls clinics_get with merge_candidate_id for clinic entityType', async () => {
    render(
      <MergeEntityDialog
        draft={makeDraft({ merge_candidate_id: 'c99' })}
        entityType="clinic"
        onClose={vi.fn()}
        onMerged={vi.fn()}
      />
    )
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('clinics_get', { id: 'c99' })
    })
  })

  it('renders contact field rows after loading', async () => {
    render(
      <MergeEntityDialog
        draft={makeDraft()}
        entityType="contact"
        onClose={vi.fn()}
        onMerged={vi.fn()}
      />
    )
    await waitFor(() => {
      expect(screen.getByText('Name')).toBeDefined()
      expect(screen.getByText('Role')).toBeDefined()
      expect(screen.getByText('Specialty')).toBeDefined()
      expect(screen.getByText('Phone')).toBeDefined()
      expect(screen.getByText('Email')).toBeDefined()
      expect(screen.getByText('Clinic')).toBeDefined()
      expect(screen.getByText('Notes')).toBeDefined()
    })
  })

  it('renders clinic field rows after loading', async () => {
    render(
      <MergeEntityDialog
        draft={makeDraft()}
        entityType="clinic"
        onClose={vi.fn()}
        onMerged={vi.fn()}
      />
    )
    await waitFor(() => {
      expect(screen.getByText('Name')).toBeDefined()
      expect(screen.getByText('Address')).toBeDefined()
      expect(screen.getByText('Phone')).toBeDefined()
      expect(screen.getByText('Email')).toBeDefined()
    })
  })

  it('shows both draft and existing values for each field', async () => {
    render(
      <MergeEntityDialog
        draft={makeDraft({ name: 'Draft Name' })}
        entityType="contact"
        onClose={vi.fn()}
        onMerged={vi.fn()}
      />
    )
    await waitFor(() => {
      expect(screen.getByText('Draft Name')).toBeDefined()
      expect(screen.getByText('Dr. Smith Existing')).toBeDefined()
    })
  })

  it('defaults all field choices to draft', async () => {
    render(
      <MergeEntityDialog
        draft={makeDraft()}
        entityType="contact"
        onClose={vi.fn()}
        onMerged={vi.fn()}
      />
    )
    await waitFor(() => screen.getByText('Name'))
    const radios = screen.getAllByRole('radio') as HTMLInputElement[]
    const draftRadios = radios.filter((r) => r.value === 'draft')
    const existingRadios = radios.filter((r) => r.value === 'existing')
    expect(draftRadios.every((r) => r.checked)).toBe(true)
    expect(existingRadios.every((r) => !r.checked)).toBe(true)
  })

  it('changes choice when existing radio clicked', async () => {
    render(
      <MergeEntityDialog
        draft={makeDraft()}
        entityType="contact"
        onClose={vi.fn()}
        onMerged={vi.fn()}
      />
    )
    await waitFor(() => screen.getByText('Name'))
    const existingRadios = (screen.getAllByRole('radio') as HTMLInputElement[]).filter(
      (r) => r.value === 'existing'
    )
    await userEvent.click(existingRadios[0]!)
    expect(existingRadios[0]!.checked).toBe(true)
  })

  it('calls onClose when Cancel clicked', async () => {
    const onClose = vi.fn()
    render(
      <MergeEntityDialog
        draft={makeDraft()}
        entityType="contact"
        onClose={onClose}
        onMerged={vi.fn()}
      />
    )
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onClose).toHaveBeenCalled()
  })

  it('calls onClose when × clicked', async () => {
    const onClose = vi.fn()
    render(
      <MergeEntityDialog
        draft={makeDraft()}
        entityType="contact"
        onClose={onClose}
        onMerged={vi.fn()}
      />
    )
    await userEvent.click(screen.getByRole('button', { name: '×' }))
    expect(onClose).toHaveBeenCalled()
  })

  it('Confirm Merge button disabled while loading', () => {
    render(
      <MergeEntityDialog
        draft={makeDraft()}
        entityType="contact"
        onClose={vi.fn()}
        onMerged={vi.fn()}
      />
    )
    const btn = screen.getByRole('button', { name: /confirm merge/i }) as HTMLButtonElement
    expect(btn.disabled).toBe(true)
  })

  it('Confirm Merge button enabled after loading', async () => {
    render(
      <MergeEntityDialog
        draft={makeDraft()}
        entityType="contact"
        onClose={vi.fn()}
        onMerged={vi.fn()}
      />
    )
    await waitFor(() => {
      const btn = screen.getByRole('button', { name: /confirm merge/i }) as HTMLButtonElement
      expect(btn.disabled).toBe(false)
    })
  })

  it('calls merge_draft_entity with correct args on confirm', async () => {
    const onMerged = vi.fn()
    render(
      <MergeEntityDialog
        draft={makeDraft({ id: 'd1', merge_candidate_id: 'c99' })}
        entityType="contact"
        onClose={vi.fn()}
        onMerged={onMerged}
      />
    )
    await waitFor(() => screen.getByRole('button', { name: /confirm merge/i }))
    await userEvent.click(screen.getByRole('button', { name: /confirm merge/i }))
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('merge_draft_entity', {
        entityType: 'contact',
        draftId: 'd1',
        existingId: 'c99',
        fieldChoices: {},
      })
    })
    expect(onMerged).toHaveBeenCalled()
  })

  it('shows error and re-enables button when merge fails', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'contacts_get') return Promise.resolve(existingContact)
      if (cmd === 'merge_draft_entity') return Promise.reject(new Error('Merge failed'))
      return Promise.resolve(undefined)
    })
    render(
      <MergeEntityDialog
        draft={makeDraft()}
        entityType="contact"
        onClose={vi.fn()}
        onMerged={vi.fn()}
      />
    )
    await waitFor(() => screen.getByRole('button', { name: /confirm merge/i }))
    await userEvent.click(screen.getByRole('button', { name: /confirm merge/i }))
    await waitFor(() => {
      expect(screen.getByText(/Merge failed/)).toBeDefined()
    })
    const btn = screen.getByRole('button', { name: /confirm merge/i }) as HTMLButtonElement
    expect(btn.disabled).toBe(false)
  })

  it('shows error when fetch fails', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'contacts_get') return Promise.reject(new Error('Not found'))
      return Promise.resolve(undefined)
    })
    render(
      <MergeEntityDialog
        draft={makeDraft()}
        entityType="contact"
        onClose={vi.fn()}
        onMerged={vi.fn()}
      />
    )
    await waitFor(() => {
      expect(screen.getByText(/Not found/)).toBeDefined()
    })
  })

  it('does not fetch when merge_candidate_id is null', async () => {
    render(
      <MergeEntityDialog
        draft={makeDraft({ merge_candidate_id: null })}
        entityType="contact"
        onClose={vi.fn()}
        onMerged={vi.fn()}
      />
    )
    await new Promise((r) => setTimeout(r, 50))
    expect(mockInvoke).not.toHaveBeenCalledWith('contacts_get', expect.anything())
  })

  it('shows Merging… label while submitting', async () => {
    let resolveMerge!: () => void
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'contacts_get') return Promise.resolve(existingContact)
      if (cmd === 'merge_draft_entity')
        return new Promise<void>((res) => {
          resolveMerge = res
        })
      return Promise.resolve(undefined)
    })
    render(
      <MergeEntityDialog
        draft={makeDraft()}
        entityType="contact"
        onClose={vi.fn()}
        onMerged={vi.fn()}
      />
    )
    await waitFor(() => screen.getByRole('button', { name: /confirm merge/i }))
    await userEvent.click(screen.getByRole('button', { name: /confirm merge/i }))
    expect(screen.getByRole('button', { name: /merging/i })).toBeDefined()
    resolveMerge()
  })
})

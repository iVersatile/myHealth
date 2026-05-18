import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DraftEntitySection } from '../DraftEntitySection'
import type { DraftEntityRow } from '../DraftEntitySection'

const mockInvoke = vi.fn()
vi.mock('@tauri-apps/api/core', () => ({ invoke: (...args: unknown[]) => mockInvoke(...args) }))

const makeDraft = (overrides: Partial<DraftEntityRow> = {}): DraftEntityRow => ({
  id: 'd1',
  entity_type: 'contact',
  name: 'Dr. Smith',
  created_at: '2026-01-01T00:00:00Z',
  role: null,
  specialty: null,
  phone: null,
  email: null,
  clinic: null,
  address: null,
  notes: null,
  merge_candidate_id: null,
  existing_name: null,
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

beforeEach(() => {
  mockInvoke.mockReset()
  mockInvoke.mockImplementation((cmd: string) => {
    if (cmd === 'get_draft_entities') return Promise.resolve([])
    if (cmd === 'accept_draft_entity') return Promise.resolve(undefined)
    if (cmd === 'reject_draft_entity') return Promise.resolve(undefined)
    return Promise.resolve(undefined)
  })
})

describe('DraftEntitySection', () => {
  it('renders null when no drafts', async () => {
    const { container } = render(<DraftEntitySection entityType="contact" />)
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('get_draft_entities', { entityType: 'contact' })
    })
    expect(container.firstChild).toBeNull()
  })

  it('renders draft cards when drafts present', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_draft_entities') return Promise.resolve([makeDraft({ name: 'Dr. Jones' })])
      return Promise.resolve(undefined)
    })
    render(<DraftEntitySection entityType="contact" />)
    await waitFor(() => {
      expect(screen.getByText('Dr. Jones')).toBeDefined()
    })
    expect(screen.getByTestId('draft-entity-card')).toBeDefined()
  })

  it('shows subtitle with role and specialty', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_draft_entities')
        return Promise.resolve([makeDraft({ role: 'Surgeon', specialty: 'Cardiology' })])
      return Promise.resolve(undefined)
    })
    render(<DraftEntitySection entityType="contact" />)
    await waitFor(() => {
      expect(screen.getByText(/Surgeon/)).toBeDefined()
      expect(screen.getByText(/Cardiology/)).toBeDefined()
    })
  })

  it('shows subtitle with phone and email', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_draft_entities')
        return Promise.resolve([makeDraft({ phone: '555-1234', email: 'dr@clinic.com' })])
      return Promise.resolve(undefined)
    })
    render(<DraftEntitySection entityType="contact" />)
    await waitFor(() => {
      expect(screen.getByText(/555-1234/)).toBeDefined()
      expect(screen.getByText(/dr@clinic\.com/)).toBeDefined()
    })
  })

  it('shows subtitle with address', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_draft_entities')
        return Promise.resolve([makeDraft({ address: '123 Main St' })])
      return Promise.resolve(undefined)
    })
    render(<DraftEntitySection entityType="contact" />)
    await waitFor(() => {
      expect(screen.getByText(/123 Main St/)).toBeDefined()
    })
  })

  it('shows subtitle with appt_date and doctor_name', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_draft_entities')
        return Promise.resolve([makeDraft({ appt_date: '2026-06-01', doctor_name: 'Dr. House' })])
      return Promise.resolve(undefined)
    })
    render(<DraftEntitySection entityType="appointment" />)
    await waitFor(() => {
      expect(screen.getByText(/2026-06-01/)).toBeDefined()
      expect(screen.getByText(/Dr\. House/)).toBeDefined()
    })
  })

  it('shows subtitle with dosage and frequency', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_draft_entities')
        return Promise.resolve([makeDraft({ dosage: '400mg', frequency: 'Twice daily' })])
      return Promise.resolve(undefined)
    })
    render(<DraftEntitySection entityType="medication" />)
    await waitFor(() => {
      expect(screen.getByText(/400mg/)).toBeDefined()
      expect(screen.getByText(/Twice daily/)).toBeDefined()
    })
  })

  it('shows severity in subtitle when severity is 0', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_draft_entities')
        return Promise.resolve([makeDraft({ severity: 0 })])
      return Promise.resolve(undefined)
    })
    render(<DraftEntitySection entityType="symptom" />)
    await waitFor(() => {
      expect(screen.getByText(/Severity 0/)).toBeDefined()
    })
  })

  it('shows severity in subtitle when severity is non-zero', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_draft_entities')
        return Promise.resolve([makeDraft({ severity: 7 })])
      return Promise.resolve(undefined)
    })
    render(<DraftEntitySection entityType="symptom" />)
    await waitFor(() => {
      expect(screen.getByText(/Severity 7/)).toBeDefined()
    })
  })

  it('shows Merge button when merge_candidate_id and onMerge both present', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_draft_entities')
        return Promise.resolve([makeDraft({ merge_candidate_id: 'c99' })])
      return Promise.resolve(undefined)
    })
    const onMerge = vi.fn()
    render(<DraftEntitySection entityType="contact" onMerge={onMerge} />)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /merge/i })).toBeDefined()
    })
  })

  it('does not show Merge button when merge_candidate_id is null', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_draft_entities')
        return Promise.resolve([makeDraft({ merge_candidate_id: null })])
      return Promise.resolve(undefined)
    })
    const onMerge = vi.fn()
    render(<DraftEntitySection entityType="contact" onMerge={onMerge} />)
    await waitFor(() => screen.getByTestId('draft-entity-card'))
    expect(screen.queryByRole('button', { name: /merge/i })).toBeNull()
  })

  it('does not show Merge button when onMerge absent even with merge_candidate_id', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_draft_entities')
        return Promise.resolve([makeDraft({ merge_candidate_id: 'c99' })])
      return Promise.resolve(undefined)
    })
    render(<DraftEntitySection entityType="contact" />)
    await waitFor(() => screen.getByTestId('draft-entity-card'))
    expect(screen.queryByRole('button', { name: /merge/i })).toBeNull()
  })

  it('calls onMerge with draft when Merge clicked', async () => {
    const draft = makeDraft({ merge_candidate_id: 'c99', name: 'Merge Me' })
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_draft_entities') return Promise.resolve([draft])
      return Promise.resolve(undefined)
    })
    const onMerge = vi.fn()
    render(<DraftEntitySection entityType="contact" onMerge={onMerge} />)
    await waitFor(() => screen.getByRole('button', { name: /merge/i }))
    await userEvent.click(screen.getByRole('button', { name: /merge/i }))
    expect(onMerge).toHaveBeenCalledWith(draft)
  })

  it('accept removes card and calls accept_draft_entity (success path)', async () => {
    const draft = makeDraft({ id: 'd1', entity_type: 'contact' })
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_draft_entities') return Promise.resolve([draft])
      if (cmd === 'accept_draft_entity') return Promise.resolve(undefined)
      return Promise.resolve(undefined)
    })
    render(<DraftEntitySection entityType="contact" />)
    await waitFor(() => screen.getByTestId('accept-draft-btn'))
    await userEvent.click(screen.getByTestId('accept-draft-btn'))
    await waitFor(() => {
      // R1: IPC must use entityId (snake_case entity_id → camelCase at Tauri boundary), not bare id
      expect(mockInvoke).toHaveBeenCalledWith('accept_draft_entity', { entityType: 'contact', entityId: 'd1' })
    })
    await waitFor(() => {
      expect(screen.queryByTestId('draft-entity-card')).toBeNull()
    })
  })

  it('accept reloads drafts on error (error path)', async () => {
    const draft = makeDraft({ id: 'd1', entity_type: 'contact' })
    let loadCount = 0
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_draft_entities') {
        loadCount++
        return Promise.resolve(loadCount === 1 ? [draft] : [])
      }
      if (cmd === 'accept_draft_entity') return Promise.reject(new Error('fail'))
      return Promise.resolve(undefined)
    })
    render(<DraftEntitySection entityType="contact" />)
    await waitFor(() => screen.getByTestId('accept-draft-btn'))
    await userEvent.click(screen.getByTestId('accept-draft-btn'))
    await waitFor(() => {
      expect(loadCount).toBeGreaterThanOrEqual(2)
    })
  })

  it('reject removes card, calls reject_draft_entity, and shows toast (success path)', async () => {
    // Two drafts so component stays mounted (not null) after rejecting one
    const draft1 = makeDraft({ id: 'd1', entity_type: 'contact', name: 'Draft One' })
    const draft2 = makeDraft({ id: 'd2', entity_type: 'contact', name: 'Draft Two' })
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_draft_entities') return Promise.resolve([draft1, draft2])
      if (cmd === 'reject_draft_entity') return Promise.resolve(undefined)
      return Promise.resolve(undefined)
    })
    render(<DraftEntitySection entityType="contact" />)
    await waitFor(() => screen.getAllByTestId('reject-draft-btn'))
    await userEvent.click(screen.getAllByTestId('reject-draft-btn')[0]!)
    await waitFor(() => {
      // R2: IPC must use entityId (snake_case entity_id → camelCase at Tauri boundary), not bare id
      expect(mockInvoke).toHaveBeenCalledWith('reject_draft_entity', { entityType: 'contact', entityId: 'd1' })
    })
    await waitFor(() => {
      expect(screen.getByText(/draft rejected/i)).toBeDefined()
    })
  })

  it('reject reloads drafts on error (error path)', async () => {
    const draft = makeDraft({ id: 'd1', entity_type: 'contact' })
    let loadCount = 0
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_draft_entities') {
        loadCount++
        return Promise.resolve(loadCount === 1 ? [draft] : [])
      }
      if (cmd === 'reject_draft_entity') return Promise.reject(new Error('fail'))
      return Promise.resolve(undefined)
    })
    render(<DraftEntitySection entityType="contact" />)
    await waitFor(() => screen.getByTestId('reject-draft-btn'))
    await userEvent.click(screen.getByTestId('reject-draft-btn'))
    await waitFor(() => {
      expect(loadCount).toBeGreaterThanOrEqual(2)
    })
  })

  it('shows draft count in header', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_draft_entities')
        return Promise.resolve([makeDraft({ id: 'd1' }), makeDraft({ id: 'd2', name: 'Dr. B' })])
      return Promise.resolve(undefined)
    })
    render(<DraftEntitySection entityType="contact" />)
    await waitFor(() => {
      expect(screen.getByText('(2)')).toBeDefined()
    })
  })

  it('shows merge-candidate-badge and split buttons when merge_candidate_id and existing_name set', async () => {
    const draft = makeDraft({ merge_candidate_id: 'c99', existing_name: 'Dr. Existing' })
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_draft_entities') return Promise.resolve([draft])
      return Promise.resolve(undefined)
    })
    render(<DraftEntitySection entityType="contact" />)
    await waitFor(() => screen.getByTestId('merge-candidate-badge'))
    expect(screen.getByTestId('merge-candidate-badge').textContent).toContain('Dr. Existing')
    expect(screen.getByTestId('merge-with-existing-btn')).toBeDefined()
    expect(screen.getByTestId('create-as-new-btn')).toBeDefined()
    expect(screen.queryByTestId('accept-draft-btn')).toBeNull()
  })

  it('clicking merge-with-existing-btn invokes merge_draft_entity', async () => {
    const draft = makeDraft({ id: 'd1', entity_type: 'contact', merge_candidate_id: 'c99', existing_name: 'Dr. Existing' })
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_draft_entities') return Promise.resolve([draft])
      if (cmd === 'merge_draft_entity') return Promise.resolve(undefined)
      return Promise.resolve(undefined)
    })
    render(<DraftEntitySection entityType="contact" />)
    await waitFor(() => screen.getByTestId('merge-with-existing-btn'))
    await userEvent.click(screen.getByTestId('merge-with-existing-btn'))
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('merge_draft_entity', {
        entityType: 'contact',
        entityId: 'd1',
        fieldChoices: {},
      })
    })
  })

  it('clicking create-as-new-btn invokes accept_draft_entity', async () => {
    const draft = makeDraft({ id: 'd1', entity_type: 'contact', merge_candidate_id: 'c99', existing_name: 'Dr. Existing' })
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_draft_entities') return Promise.resolve([draft])
      if (cmd === 'accept_draft_entity') return Promise.resolve(undefined)
      return Promise.resolve(undefined)
    })
    render(<DraftEntitySection entityType="contact" />)
    await waitFor(() => screen.getByTestId('create-as-new-btn'))
    await userEvent.click(screen.getByTestId('create-as-new-btn'))
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('accept_draft_entity', { entityType: 'contact', entityId: 'd1' })
    })
  })

  it('shows single Accept button and no badge when merge_candidate_id is null', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_draft_entities') return Promise.resolve([makeDraft({ merge_candidate_id: null })])
      return Promise.resolve(undefined)
    })
    render(<DraftEntitySection entityType="contact" />)
    await waitFor(() => screen.getByTestId('accept-draft-btn'))
    expect(screen.queryByTestId('merge-candidate-badge')).toBeNull()
    expect(screen.queryByTestId('merge-with-existing-btn')).toBeNull()
    expect(screen.queryByTestId('create-as-new-btn')).toBeNull()
  })
})

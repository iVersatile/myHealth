import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { ClinicEditClient } from '../ClinicEditClient'

const mockInvoke = vi.fn()
const mockRouterPush = vi.fn()
let mockId: string | null = 'clinic-1'

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}))

vi.mock('next/navigation', () => ({
  useSearchParams: () => ({ get: () => mockId }),
  useRouter: () => ({ push: mockRouterPush }),
}))

const makeClinic = (overrides = {}) => ({
  id: 'clinic-1',
  name: 'City Clinic',
  address: '1 Main St',
  phone: '01234567890',
  company_registration_number: 'CRN123',
  created_at: '2026-01-01T00:00:00Z',
  ...overrides,
})

describe('ClinicEditClient — no id', () => {
  beforeEach(() => {
    mockInvoke.mockReset()
    mockRouterPush.mockClear()
    mockId = null
  })

  it('shows error when id is null', () => {
    render(<ClinicEditClient />)
    expect(screen.getByText('No clinic ID specified.')).toBeInTheDocument()
  })

  it('shows error when id is empty string', () => {
    mockId = ''
    render(<ClinicEditClient />)
    expect(screen.getByText('No clinic ID specified.')).toBeInTheDocument()
  })

  it('back link navigates to /clinics', () => {
    render(<ClinicEditClient />)
    fireEvent.click(screen.getByText('← Back to Clinics'))
    expect(mockRouterPush).toHaveBeenCalledWith('/clinics')
  })
})

describe('ClinicEditClient — loading & error', () => {
  beforeEach(() => {
    mockInvoke.mockReset()
    mockRouterPush.mockClear()
    mockId = 'clinic-1'
  })

  it('shows loading state while fetching', () => {
    mockInvoke.mockImplementation(() => new Promise(() => {}))
    render(<ClinicEditClient />)
    expect(screen.getByText('Loading…')).toBeInTheDocument()
  })

  it('shows error message when clinics_get fails', async () => {
    mockInvoke.mockRejectedValue(new Error('Not found'))
    render(<ClinicEditClient />)
    await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull())
    expect(screen.getByText('Not found')).toBeInTheDocument()
  })

  it('back link in error state navigates to /clinics', async () => {
    mockInvoke.mockRejectedValue(new Error('fail'))
    render(<ClinicEditClient />)
    await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull())
    fireEvent.click(screen.getByText('← Back to Clinics'))
    expect(mockRouterPush).toHaveBeenCalledWith('/clinics')
  })

  it('shows generic error for non-Error load rejection', async () => {
    mockInvoke.mockRejectedValue({ message: 'raw string' })
    render(<ClinicEditClient />)
    await waitFor(() => expect(screen.getByText('raw string')).toBeInTheDocument())
  })
})

describe('ClinicEditClient — edit form', () => {
  beforeEach(() => {
    mockInvoke.mockReset()
    mockRouterPush.mockClear()
    mockId = 'clinic-1'
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'clinic_addresses_list') return Promise.resolve([])
      if (cmd === 'clinics_get_linked_contacts') return Promise.resolve([])
      if (cmd === 'clinics_get_linked_documents') return Promise.resolve([])
      return Promise.resolve(makeClinic())
    })
  })

  it('renders form pre-filled with clinic data', async () => {
    render(<ClinicEditClient />)
    await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull())
    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('City Clinic')
    expect((screen.getByLabelText('Address') as HTMLInputElement).value).toBe('1 Main St')
    expect((screen.getByLabelText('Phone') as HTMLInputElement).value).toBe('01234567890')
    expect((screen.getByLabelText('Company Registration Number') as HTMLInputElement).value).toBe('CRN123')
  })

  it('Save button is disabled when name is empty', async () => {
    render(<ClinicEditClient />)
    await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull())
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: '' } })
    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('calls clinics_update and navigates on save', async () => {
    render(<ClinicEditClient />)
    await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull())
    mockInvoke.mockResolvedValueOnce(undefined)
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(mockRouterPush).toHaveBeenCalledWith('/clinics'))
    const updateCalls = mockInvoke.mock.calls.filter((c: unknown[]) => c[0] === 'clinics_update')
    expect(updateCalls).toHaveLength(1)
  })

  it('shows save error when clinics_update fails', async () => {
    render(<ClinicEditClient />)
    await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull())
    mockInvoke.mockRejectedValueOnce(new Error('Save failed'))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(screen.getByText('Save failed')).toBeInTheDocument())
  })

  it('Cancel button navigates to /clinics', async () => {
    render(<ClinicEditClient />)
    await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull())
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(mockRouterPush).toHaveBeenCalledWith('/clinics')
  })

  it('back arrow navigates to /clinics', async () => {
    render(<ClinicEditClient />)
    await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull())
    fireEvent.click(screen.getByRole('button', { name: 'Back to clinics' }))
    expect(mockRouterPush).toHaveBeenCalledWith('/clinics')
  })

  it('can update address, phone, and CRN fields', async () => {
    render(<ClinicEditClient />)
    await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull())
    fireEvent.change(screen.getByLabelText('Address'), { target: { value: '2 New St' } })
    fireEvent.change(screen.getByLabelText('Phone'), { target: { value: '09876543210' } })
    fireEvent.change(screen.getByLabelText('Company Registration Number'), { target: { value: 'CRN999' } })
    expect((screen.getByLabelText('Address') as HTMLInputElement).value).toBe('2 New St')
    expect((screen.getByLabelText('Phone') as HTMLInputElement).value).toBe('09876543210')
    expect((screen.getByLabelText('Company Registration Number') as HTMLInputElement).value).toBe('CRN999')
  })

  it('populates null address/phone/crn as empty strings', async () => {
    const nullClinic = makeClinic({ address: null, phone: null, company_registration_number: null })
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'clinic_addresses_list') return Promise.resolve([])
      if (cmd === 'clinics_get_linked_contacts') return Promise.resolve([])
      if (cmd === 'clinics_get_linked_documents') return Promise.resolve([])
      return Promise.resolve(nullClinic)
    })
    render(<ClinicEditClient />)
    await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull())
    expect((screen.getByLabelText('Address') as HTMLInputElement).value).toBe('')
    expect((screen.getByLabelText('Phone') as HTMLInputElement).value).toBe('')
    expect((screen.getByLabelText('Company Registration Number') as HTMLInputElement).value).toBe('')
  })

  it('saves null for cleared address/phone/crn fields', async () => {
    render(<ClinicEditClient />)
    await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull())
    fireEvent.change(screen.getByLabelText('Address'), { target: { value: '' } })
    fireEvent.change(screen.getByLabelText('Phone'), { target: { value: '' } })
    fireEvent.change(screen.getByLabelText('Company Registration Number'), { target: { value: '' } })
    mockInvoke.mockResolvedValueOnce(undefined)
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(mockRouterPush).toHaveBeenCalledWith('/clinics'))
    const updateCalls = mockInvoke.mock.calls.filter((c: unknown[]) => c[0] === 'clinics_update')
    expect(updateCalls[0]![1]).toMatchObject({ input: { address: null, phone: null, company_registration_number: null } })
  })

  it('shows generic save error for non-Error rejection', async () => {
    render(<ClinicEditClient />)
    await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull())
    mockInvoke.mockRejectedValueOnce({ message: 'raw string error' })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(screen.getByText('raw string error')).toBeInTheDocument(), { timeout: 5000 })
  })
})

describe('ClinicEditClient — linked contacts & documents', () => {
  beforeEach(() => {
    mockInvoke.mockReset()
    mockRouterPush.mockClear()
    mockId = 'clinic-1'
  })

  function setupInvoke({
    contacts = [] as { id: string; name: string; role: string | null; specialty: string | null; phone: string | null }[],
    documents = [] as { id: string; filename: string; category: string | null; document_date: string | null }[],
  } = {}) {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'clinics_get') return Promise.resolve(makeClinic())
      if (cmd === 'clinic_addresses_list') return Promise.resolve([])
      if (cmd === 'clinics_get_linked_contacts') return Promise.resolve(contacts)
      if (cmd === 'clinics_get_linked_documents') return Promise.resolve(documents)
      return Promise.resolve(undefined)
    })
  }

  it('renders linked contacts section when contacts exist', async () => {
    setupInvoke({ contacts: [{ id: 'c1', name: 'Dr Smith', role: 'gp', specialty: null, phone: null }] })
    render(<ClinicEditClient />)
    await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull())
    expect(screen.getByText('Linked Contacts')).toBeInTheDocument()
    expect(screen.getByText('Dr Smith')).toBeInTheDocument()
    expect(screen.getByText('gp')).toBeInTheDocument()
  })

  it('renders role and specialty together when both present', async () => {
    setupInvoke({ contacts: [{ id: 'c2', name: 'Dr Jones', role: 'consultant', specialty: 'cardiology', phone: null }] })
    render(<ClinicEditClient />)
    await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull())
    expect(screen.getByText('consultant · cardiology')).toBeInTheDocument()
  })

  it('hides role/specialty span when both are null', async () => {
    setupInvoke({ contacts: [{ id: 'c3', name: 'Nurse Patel', role: null, specialty: null, phone: null }] })
    render(<ClinicEditClient />)
    await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull())
    expect(screen.getByText('Nurse Patel')).toBeInTheDocument()
    expect(screen.queryByText(' · ')).toBeNull()
  })

  it('hides linked contacts section when list is empty', async () => {
    setupInvoke({ contacts: [] })
    render(<ClinicEditClient />)
    await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull())
    expect(screen.queryByText('Linked Contacts')).toBeNull()
  })

  it('renders linked documents section when documents exist', async () => {
    setupInvoke({ documents: [{ id: 'd1', filename: 'scan.pdf', category: null, document_date: '2026-01-15' }] })
    render(<ClinicEditClient />)
    await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull())
    expect(screen.getByText('Linked Documents')).toBeInTheDocument()
    expect(screen.getByText('scan.pdf')).toBeInTheDocument()
    expect(screen.getByText('2026-01-15')).toBeInTheDocument()
  })

  it('hides document_date span when date is null', async () => {
    setupInvoke({ documents: [{ id: 'd2', filename: 'report.pdf', category: null, document_date: null }] })
    render(<ClinicEditClient />)
    await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull())
    expect(screen.getByText('report.pdf')).toBeInTheDocument()
    expect(screen.queryByText('null')).toBeNull()
  })

  it('hides linked documents section when list is empty', async () => {
    setupInvoke({ documents: [] })
    render(<ClinicEditClient />)
    await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull())
    expect(screen.queryByText('Linked Documents')).toBeNull()
  })
})

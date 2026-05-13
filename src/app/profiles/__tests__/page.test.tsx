import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mockInvoke = vi.fn()
const mockPush = vi.fn()

vi.mock('@tauri-apps/api/core', () => ({ invoke: mockInvoke }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }))

const FIXTURE_PROFILES = [
  { id: 'p1', name: 'Alice', db_path: '/data/p1.db', created_at: '2024-01-01' },
  { id: 'p2', name: 'Bob', db_path: '/data/p2.db', created_at: '2024-01-02' },
]

async function renderPage() {
  const { default: ProfilesPage } = await import('../page')
  return render(<ProfilesPage />)
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.resetModules()
})

describe('ProfilesPage — profile list', () => {
  it('renders all profiles returned by profiles_list', async () => {
    mockInvoke.mockResolvedValueOnce(FIXTURE_PROFILES)
    await renderPage()
    await waitFor(() => {
      expect(screen.getAllByTestId('profile-item')).toHaveLength(2)
    })
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
  })

  it('shows new-profile-btn', async () => {
    mockInvoke.mockResolvedValueOnce([])
    await renderPage()
    await waitFor(() => {
      expect(screen.getByTestId('new-profile-btn')).toBeInTheDocument()
    })
  })

  it('navigates to /profiles/new when new-profile-btn clicked', async () => {
    mockInvoke.mockResolvedValueOnce([])
    await renderPage()
    await waitFor(() => {
      expect(screen.getByTestId('new-profile-btn')).toBeInTheDocument()
    })
    await userEvent.click(screen.getByTestId('new-profile-btn'))
    expect(mockPush).toHaveBeenCalledWith('/profiles/new')
  })

  it('shows error when profiles_list rejects', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('db error'))
    await renderPage()
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })
  })
})

describe('ProfilesPage — unlock flow', () => {
  it('shows password form after selecting a profile', async () => {
    mockInvoke.mockResolvedValueOnce(FIXTURE_PROFILES)
    await renderPage()
    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument()
    })
    await userEvent.click(screen.getByText('Alice'))
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Unlock' })).toBeInTheDocument()
  })

  it('navigates to /documents on successful unlock', async () => {
    mockInvoke.mockResolvedValueOnce(FIXTURE_PROFILES)
    mockInvoke.mockResolvedValueOnce(undefined)
    await renderPage()
    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument()
    })
    await userEvent.click(screen.getByText('Alice'))
    await userEvent.type(screen.getByLabelText('Password'), 'secret')
    await userEvent.click(screen.getByRole('button', { name: 'Unlock' }))
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/documents')
    })
  })

  it('shows error on wrong password', async () => {
    mockInvoke.mockResolvedValueOnce(FIXTURE_PROFILES)
    mockInvoke.mockRejectedValueOnce({ message: 'incorrect password' })
    await renderPage()
    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument()
    })
    await userEvent.click(screen.getByText('Alice'))
    await userEvent.type(screen.getByLabelText('Password'), 'wrong')
    await userEvent.click(screen.getByRole('button', { name: 'Unlock' }))
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/incorrect password/i)
    })
  })

  it('back button returns to profile list', async () => {
    mockInvoke.mockResolvedValueOnce(FIXTURE_PROFILES)
    await renderPage()
    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument()
    })
    await userEvent.click(screen.getByText('Alice'))
    expect(screen.getByRole('button', { name: /back to profiles/i })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /back to profiles/i }))
    await waitFor(() => {
      expect(screen.getByTestId('new-profile-btn')).toBeInTheDocument()
    })
  })
})

describe('ProfilesPage — delete flow', () => {
  it('opens confirmation dialog when delete button clicked', async () => {
    mockInvoke.mockResolvedValueOnce(FIXTURE_PROFILES)
    await renderPage()
    await waitFor(() => {
      expect(screen.getAllByTestId('delete-profile-btn')).toHaveLength(2)
    })
    const [firstDeleteBtn] = screen.getAllByTestId('delete-profile-btn')
    await userEvent.click(firstDeleteBtn!)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText(/delete "Alice"/i)).toBeInTheDocument()
  })

  it('removes profile from list on confirm', async () => {
    mockInvoke.mockResolvedValueOnce(FIXTURE_PROFILES)
    mockInvoke.mockResolvedValueOnce(undefined)
    await renderPage()
    await waitFor(() => {
      expect(screen.getAllByTestId('profile-item')).toHaveLength(2)
    })
    const [firstDeleteBtn2] = screen.getAllByTestId('delete-profile-btn')
    await userEvent.click(firstDeleteBtn2!)
    await userEvent.click(screen.getByTestId('confirm-delete-btn'))
    await waitFor(() => {
      expect(screen.getAllByTestId('profile-item')).toHaveLength(1)
    })
    expect(screen.queryByText('Alice')).not.toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
  })

  it('closes dialog on cancel without deleting', async () => {
    mockInvoke.mockResolvedValueOnce(FIXTURE_PROFILES)
    await renderPage()
    await waitFor(() => {
      expect(screen.getAllByTestId('delete-profile-btn')).toHaveLength(2)
    })
    const [firstDeleteBtn3] = screen.getAllByTestId('delete-profile-btn')
    await userEvent.click(firstDeleteBtn3!)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getAllByTestId('profile-item')).toHaveLength(2)
  })
})

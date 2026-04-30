import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mockHasPassword = vi.fn()
const mockUnlock = vi.fn()
const mockSetup = vi.fn()
const mockListUsers = vi.fn()
const mockSwitchUser = vi.fn()
const mockPush = vi.fn()

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    hasPassword: mockHasPassword,
    unlock: mockUnlock,
    setup: mockSetup,
    lock: vi.fn(),
    listUsers: mockListUsers,
    switchUser: mockSwitchUser,
  }),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

async function renderPage() {
  const { default: LockScreen } = await import('../page')
  return render(<LockScreen />)
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.resetModules()
  mockListUsers.mockResolvedValue([])
})

describe('LockScreen — first-run detection', () => {
  it('shows unlock form when password exists', async () => {
    mockHasPassword.mockResolvedValue(true)
    await renderPage()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /unlock/i })).toBeInTheDocument()
    })
    expect(screen.queryByLabelText(/confirm password/i)).not.toBeInTheDocument()
  })

  it('shows setup form when no password exists (first run)', async () => {
    mockHasPassword.mockResolvedValue(false)
    await renderPage()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /create/i })).toBeInTheDocument()
    })
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument()
  })

  it('stays in unlock mode if hasPassword check throws', async () => {
    mockHasPassword.mockRejectedValue(new Error('tauri not ready'))
    await renderPage()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /unlock/i })).toBeInTheDocument()
    })
  })
})

describe('LockScreen — unlock flow', () => {
  beforeEach(() => {
    mockHasPassword.mockResolvedValue(true)
  })

  it('calls unlock with entered password and navigates on success', async () => {
    mockUnlock.mockResolvedValue(undefined)
    await renderPage()
    await waitFor(() => screen.getByLabelText(/^password$/i))

    await userEvent.type(screen.getByLabelText(/^password$/i), 'MyPassword1!')
    await userEvent.click(screen.getByRole('button', { name: /unlock/i }))

    await waitFor(() => expect(mockUnlock).toHaveBeenCalledWith('MyPassword1!'))
    expect(mockPush).toHaveBeenCalledWith('/dashboard')
  })

  it('shows incorrect password error when unlock rejects with plain Error', async () => {
    mockUnlock.mockRejectedValue(new Error('incorrect password (detail: open db: ...)'))
    await renderPage()
    await waitFor(() => screen.getByLabelText(/^password$/i))

    await userEvent.type(screen.getByLabelText(/^password$/i), 'WrongPass1!')
    await userEvent.click(screen.getByRole('button', { name: /unlock/i }))

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/incorrect password/i)
    )
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('shows incorrect password error when unlock rejects with Tauri v2 structured error', async () => {
    // Tauri v2 serializes CommandError::Internal as { Internal: "..." } on the JS side
    mockUnlock.mockRejectedValue({ Internal: 'incorrect password (detail: open db: bad key)' })
    await renderPage()
    await waitFor(() => screen.getByLabelText(/^password$/i))

    await userEvent.type(screen.getByLabelText(/^password$/i), 'WrongPass1!')
    await userEvent.click(screen.getByRole('button', { name: /unlock/i }))

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/incorrect password/i)
    )
  })

  it('switches to setup mode when Tauri structured error contains failed to read salt', async () => {
    mockUnlock.mockRejectedValue({ Internal: 'failed to read salt: No such file or directory' })
    await renderPage()
    await waitFor(() => screen.getByLabelText(/^password$/i))

    await userEvent.type(screen.getByLabelText(/^password$/i), 'AnyPass1!')
    await userEvent.click(screen.getByRole('button', { name: /unlock/i }))

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /create/i })).toBeInTheDocument()
    )
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument()
  })
})

describe('LockScreen — setup flow', () => {
  beforeEach(() => {
    mockHasPassword.mockResolvedValue(false)
  })

  it('calls setup and navigates when passwords match and meet strength rules', async () => {
    mockSetup.mockResolvedValue(undefined)
    await renderPage()
    await waitFor(() => screen.getByLabelText(/^master password/i))

    await userEvent.type(screen.getByLabelText(/^master password/i), 'ValidPass123!')
    await userEvent.type(screen.getByLabelText(/confirm password/i), 'ValidPass123!')
    await userEvent.click(screen.getByRole('button', { name: /create/i }))

    await waitFor(() => expect(mockSetup).toHaveBeenCalledWith('ValidPass123!'))
    expect(mockPush).toHaveBeenCalledWith('/dashboard')
  })

  it('shows error when passwords do not match', async () => {
    await renderPage()
    await waitFor(() => screen.getByLabelText(/^master password/i))

    await userEvent.type(screen.getByLabelText(/^master password/i), 'ValidPass123!')
    await userEvent.type(screen.getByLabelText(/confirm password/i), 'DifferentPass1!')
    await userEvent.click(screen.getByRole('button', { name: /create/i }))

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/do not match/i)
    )
    expect(mockSetup).not.toHaveBeenCalled()
  })

  it('shows strength error for weak password', async () => {
    await renderPage()
    await waitFor(() => screen.getByLabelText(/^master password/i))

    await userEvent.type(screen.getByLabelText(/^master password/i), 'short')
    await userEvent.type(screen.getByLabelText(/confirm password/i), 'short')
    await userEvent.click(screen.getByRole('button', { name: /create/i }))

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/at least 12 characters/i)
    )
  })
})

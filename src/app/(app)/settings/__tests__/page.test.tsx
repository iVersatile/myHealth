import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mockInvoke = vi.fn()
const mockLock = vi.fn()

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}))

vi.mock('../../../../hooks/useAuth', () => ({
  useAuth: () => ({ lock: mockLock }),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

async function renderPage() {
  const { default: SettingsPage } = await import('../page')
  return render(<SettingsPage />)
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.resetModules()
  mockInvoke.mockImplementation((cmd: string) => {
    if (cmd === 'settings_get') return Promise.resolve(null)
    if (cmd === 'settings_get_data_dir') return Promise.resolve('/home/user/.myhealth')
    if (cmd === 'settings_set') return Promise.resolve()
    if (cmd === 'auth_change_password') return Promise.resolve()
    if (cmd === 'settings_wipe_all_data') return Promise.resolve()
    if (cmd === 'auth_lock') return Promise.resolve()
    if (cmd === 'calendar_list_sources') return Promise.resolve([])
    if (cmd === 'calendar_toggle_source') return Promise.resolve()
    if (cmd === 'calendar_sync') return Promise.resolve(0)
    return Promise.resolve()
  })
})

describe('SettingsPage', () => {
  it('renders all three sections', async () => {
    await renderPage()
    expect(screen.getByText('Security')).toBeDefined()
    expect(screen.getByText('Appearance')).toBeDefined()
    expect(screen.getByText('Data')).toBeDefined()
  })

  it('loads data directory on mount', async () => {
    await renderPage()
    await waitFor(() => expect(screen.getByText('/home/user/.myhealth')).toBeDefined())
    expect(mockInvoke).toHaveBeenCalledWith('settings_get_data_dir')
  })

  it('loads theme setting on mount and checks matching radio', async () => {
    mockInvoke.mockImplementation((cmd: string, args?: Record<string, unknown>) => {
      if (cmd === 'settings_get' && args?.key === 'theme') return Promise.resolve('dark')
      if (cmd === 'settings_get') return Promise.resolve(null)
      if (cmd === 'settings_get_data_dir') return Promise.resolve('/data')
      if (cmd === 'calendar_list_sources') return Promise.resolve([])
      return Promise.resolve()
    })
    await renderPage()
    await waitFor(() => {
      const darkRadio = screen.getByDisplayValue('dark') as HTMLInputElement
      expect(darkRadio.checked).toBe(true)
    })
  })

  it('loads auto_lock_minutes on mount and sets select value', async () => {
    mockInvoke.mockImplementation((cmd: string, args?: Record<string, unknown>) => {
      if (cmd === 'settings_get' && args?.key === 'auto_lock_minutes') return Promise.resolve('30')
      if (cmd === 'settings_get') return Promise.resolve(null)
      if (cmd === 'settings_get_data_dir') return Promise.resolve('/data')
      if (cmd === 'calendar_list_sources') return Promise.resolve([])
      return Promise.resolve()
    })
    await renderPage()
    await waitFor(() => {
      const select = screen.getByLabelText(/auto-lock/i) as HTMLSelectElement
      expect(select.value).toBe('30')
    })
  })

  it('shows error when new passwords do not match', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'settings_get') return Promise.resolve(null)
      if (cmd === 'settings_get_data_dir') return Promise.resolve('/data')
      if (cmd === 'calendar_list_sources') return Promise.resolve([])
      return Promise.resolve()
    })
    const user = userEvent.setup()
    await renderPage()

    await user.type(screen.getByLabelText(/current password/i), 'oldpass123')
    await user.type(screen.getByLabelText(/^new password/i), 'newpass123')
    await user.type(screen.getByLabelText(/confirm new password/i), 'different456')

    fireEvent.click(screen.getByText('Change password'))

    await waitFor(() =>
      expect(screen.getByText('New passwords do not match.')).toBeDefined()
    )
    expect(mockInvoke).not.toHaveBeenCalledWith('auth_change_password', expect.anything())
  })

  it('shows error when new password is too short', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'settings_get') return Promise.resolve(null)
      if (cmd === 'settings_get_data_dir') return Promise.resolve('/data')
      if (cmd === 'calendar_list_sources') return Promise.resolve([])
      return Promise.resolve()
    })
    const user = userEvent.setup()
    await renderPage()

    await user.type(screen.getByLabelText(/current password/i), 'oldpass123')
    await user.type(screen.getByLabelText(/^new password/i), 'short')
    await user.type(screen.getByLabelText(/confirm new password/i), 'short')

    fireEvent.click(screen.getByText('Change password'))

    await waitFor(() =>
      expect(screen.getByText('Password must be at least 8 characters.')).toBeDefined()
    )
    expect(mockInvoke).not.toHaveBeenCalledWith('auth_change_password', expect.anything())
  })

  it('calls auth_change_password with correct args on valid submit', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'settings_get') return Promise.resolve(null)
      if (cmd === 'settings_get_data_dir') return Promise.resolve('/data')
      if (cmd === 'calendar_list_sources') return Promise.resolve([])
      if (cmd === 'auth_change_password') return Promise.resolve()
      return Promise.resolve()
    })
    const user = userEvent.setup()
    await renderPage()

    await user.type(screen.getByLabelText(/current password/i), 'oldpass123')
    await user.type(screen.getByLabelText(/^new password/i), 'newpass456')
    await user.type(screen.getByLabelText(/confirm new password/i), 'newpass456')

    fireEvent.click(screen.getByText('Change password'))

    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith('auth_change_password', {
        oldPassword: 'oldpass123',
        newPassword: 'newpass456',
      })
    )
    await waitFor(() =>
      expect(screen.getByText('Password changed successfully.')).toBeDefined()
    )
  })

  it('clears password fields after successful change', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'settings_get') return Promise.resolve(null)
      if (cmd === 'settings_get_data_dir') return Promise.resolve('/data')
      if (cmd === 'calendar_list_sources') return Promise.resolve([])
      if (cmd === 'auth_change_password') return Promise.resolve()
      return Promise.resolve()
    })
    const user = userEvent.setup()
    await renderPage()

    await user.type(screen.getByLabelText(/current password/i), 'oldpass123')
    await user.type(screen.getByLabelText(/^new password/i), 'newpass456')
    await user.type(screen.getByLabelText(/confirm new password/i), 'newpass456')

    fireEvent.click(screen.getByText('Change password'))

    await waitFor(() =>
      expect(screen.getByText('Password changed successfully.')).toBeDefined()
    )
    expect((screen.getByLabelText(/current password/i) as HTMLInputElement).value).toBe('')
    expect((screen.getByLabelText(/^new password/i) as HTMLInputElement).value).toBe('')
  })

  it('shows backend error when auth_change_password rejects', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'settings_get') return Promise.resolve(null)
      if (cmd === 'settings_get_data_dir') return Promise.resolve('/data')
      if (cmd === 'calendar_list_sources') return Promise.resolve([])
      if (cmd === 'auth_change_password') return Promise.reject(new Error('Wrong password'))
      return Promise.resolve()
    })
    const user = userEvent.setup()
    await renderPage()

    await user.type(screen.getByLabelText(/current password/i), 'wrongpass')
    await user.type(screen.getByLabelText(/^new password/i), 'newpass456')
    await user.type(screen.getByLabelText(/confirm new password/i), 'newpass456')

    fireEvent.click(screen.getByText('Change password'))

    await waitFor(() => expect(screen.getByText('Error: Wrong password')).toBeDefined())
  })

  it('shows Updating… while password change is in flight', async () => {
    let resolve!: () => void
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'settings_get') return Promise.resolve(null)
      if (cmd === 'settings_get_data_dir') return Promise.resolve('/data')
      if (cmd === 'calendar_list_sources') return Promise.resolve([])
      if (cmd === 'auth_change_password') return new Promise<void>((r) => { resolve = r })
      return Promise.resolve()
    })
    const user = userEvent.setup()
    await renderPage()

    await user.type(screen.getByLabelText(/current password/i), 'oldpass123')
    await user.type(screen.getByLabelText(/^new password/i), 'newpass456')
    await user.type(screen.getByLabelText(/confirm new password/i), 'newpass456')
    fireEvent.click(screen.getByText('Change password'))

    await waitFor(() => expect(screen.getByText('Updating…')).toBeDefined())
    resolve()
  })

  it('persists auto-lock selection via settings_set', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'settings_get') return Promise.resolve(null)
      if (cmd === 'settings_get_data_dir') return Promise.resolve('/data')
      if (cmd === 'calendar_list_sources') return Promise.resolve([])
      if (cmd === 'settings_set') return Promise.resolve()
      return Promise.resolve()
    })
    await renderPage()
    await waitFor(() => expect(screen.getByLabelText(/auto-lock/i)).toBeDefined())

    fireEvent.change(screen.getByLabelText(/auto-lock/i), { target: { value: '5' } })

    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith('settings_set', {
        key: 'auto_lock_minutes',
        value: '5',
      })
    )
  })

  it('persists theme selection via settings_set', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'settings_get') return Promise.resolve(null)
      if (cmd === 'settings_get_data_dir') return Promise.resolve('/data')
      if (cmd === 'calendar_list_sources') return Promise.resolve([])
      if (cmd === 'settings_set') return Promise.resolve()
      return Promise.resolve()
    })
    await renderPage()
    await waitFor(() => expect(screen.getByDisplayValue('dark')).toBeDefined())

    fireEvent.click(screen.getByDisplayValue('dark'))

    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith('settings_set', { key: 'theme', value: 'dark' })
    )
  })

  it('first click on Wipe shows confirmation UI', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'settings_get') return Promise.resolve(null)
      if (cmd === 'settings_get_data_dir') return Promise.resolve('/data')
      if (cmd === 'calendar_list_sources') return Promise.resolve([])
      return Promise.resolve()
    })
    await renderPage()
    await waitFor(() => expect(screen.getByText('Wipe all data')).toBeDefined())

    fireEvent.click(screen.getByText('Wipe all data'))

    expect(screen.getByText('Yes, wipe everything')).toBeDefined()
    expect(screen.getByText('Cancel')).toBeDefined()
    expect(mockInvoke).not.toHaveBeenCalledWith('settings_wipe_all_data')
  })

  it('Cancel resets wipe confirmation', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'settings_get') return Promise.resolve(null)
      if (cmd === 'settings_get_data_dir') return Promise.resolve('/data')
      if (cmd === 'calendar_list_sources') return Promise.resolve([])
      return Promise.resolve()
    })
    await renderPage()
    await waitFor(() => expect(screen.getByText('Wipe all data')).toBeDefined())

    fireEvent.click(screen.getByText('Wipe all data'))
    fireEvent.click(screen.getByText('Cancel'))

    expect(screen.getByText('Wipe all data')).toBeDefined()
    expect(screen.queryByText('Yes, wipe everything')).toBeNull()
  })

  it('second click calls settings_wipe_all_data then lock', async () => {
    mockLock.mockResolvedValue(undefined)
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'settings_get') return Promise.resolve(null)
      if (cmd === 'settings_get_data_dir') return Promise.resolve('/data')
      if (cmd === 'calendar_list_sources') return Promise.resolve([])
      if (cmd === 'settings_wipe_all_data') return Promise.resolve()
      return Promise.resolve()
    })
    await renderPage()
    await waitFor(() => expect(screen.getByText('Wipe all data')).toBeDefined())

    fireEvent.click(screen.getByText('Wipe all data'))
    fireEvent.click(screen.getByText('Yes, wipe everything'))

    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith('settings_wipe_all_data')
    )
    await waitFor(() => expect(mockLock).toHaveBeenCalledOnce())
  })

  it('renders Calendar Sync section', async () => {
    await renderPage()
    expect(screen.getByText('Calendar Sync')).toBeDefined()
  })

  it('shows "Loading calendars…" while fetching calendar list', async () => {
    let resolve!: () => void
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'settings_get') return Promise.resolve(null)
      if (cmd === 'settings_get_data_dir') return Promise.resolve('/data')
      if (cmd === 'calendar_list_sources') return new Promise<void>((r) => { resolve = r })
      return Promise.resolve()
    })
    await renderPage()
    await waitFor(() => expect(screen.getByText('Loading calendars…')).toBeDefined())
    resolve()
  })

  it('displays calendars with mock source data', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'settings_get') return Promise.resolve(null)
      if (cmd === 'settings_get_data_dir') return Promise.resolve('/data')
      if (cmd === 'calendar_list_sources') return Promise.resolve([
        {
          id: 'cal-1',
          external_id: 'ext-1',
          name: 'Personal',
          color_hex: '#FF5733',
          enabled: true,
          last_synced_at: '2025-04-22T10:30:00Z',
        },
        {
          id: 'cal-2',
          external_id: 'ext-2',
          name: 'Work',
          color_hex: '#3366FF',
          enabled: false,
          last_synced_at: null,
        },
      ])
      return Promise.resolve()
    })
    await renderPage()
    await waitFor(() => expect(screen.getByText('Personal')).toBeDefined())
    expect(screen.getByText('Work')).toBeDefined()
    expect(screen.getByText(/Last synced:/)).toBeDefined()
    expect(screen.getByText('Never synced')).toBeDefined()
  })

  it('toggle calls calendar_toggle_source with correct args', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'settings_get') return Promise.resolve(null)
      if (cmd === 'settings_get_data_dir') return Promise.resolve('/data')
      if (cmd === 'calendar_list_sources') return Promise.resolve([
        {
          id: 'cal-1',
          external_id: 'ext-1',
          name: 'Personal',
          color_hex: '#FF5733',
          enabled: true,
          last_synced_at: null,
        },
      ])
      if (cmd === 'calendar_toggle_source') return Promise.resolve()
      return Promise.resolve()
    })
    const user = userEvent.setup()
    await renderPage()
    await waitFor(() => expect(screen.getByText('Personal')).toBeDefined())

    const checkbox = screen.getByRole('checkbox', { name: /Enable Personal/i }) as HTMLInputElement
    expect(checkbox.checked).toBe(true)
    await user.click(checkbox)

    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith('calendar_toggle_source', {
        id: 'cal-1',
        enabled: false,
      })
    )
  })

  it('Sync Now button calls calendar_sync with enabled source IDs', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'settings_get') return Promise.resolve(null)
      if (cmd === 'settings_get_data_dir') return Promise.resolve('/data')
      if (cmd === 'calendar_list_sources') return Promise.resolve([
        {
          id: 'cal-1',
          external_id: 'ext-1',
          name: 'Personal',
          color_hex: '#FF5733',
          enabled: true,
          last_synced_at: null,
        },
        {
          id: 'cal-2',
          external_id: 'ext-2',
          name: 'Work',
          color_hex: '#3366FF',
          enabled: false,
          last_synced_at: null,
        },
      ])
      if (cmd === 'calendar_sync') return Promise.resolve(5)
      return Promise.resolve()
    })
    await renderPage()
    await waitFor(() => expect(screen.getByText('Personal')).toBeDefined())

    fireEvent.click(screen.getByText('Sync Now'))

    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith('calendar_sync', {
        sourceIds: ['cal-1'],
      })
    )
    await waitFor(() =>
      expect(screen.getByText('Synced 5 events')).toBeDefined()
    )
  })

  it('shows "macOS-only" message on calendar_list_sources error', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'settings_get') return Promise.resolve(null)
      if (cmd === 'settings_get_data_dir') return Promise.resolve('/data')
      if (cmd === 'calendar_list_sources') return Promise.reject(new Error('Platform not supported'))
      return Promise.resolve()
    })
    await renderPage()
    await waitFor(() =>
      expect(screen.getByText('Calendar sync is only supported on macOS.')).toBeDefined()
    )
  })

  it('shows "No calendars found" when list is empty', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'settings_get') return Promise.resolve(null)
      if (cmd === 'settings_get_data_dir') return Promise.resolve('/data')
      if (cmd === 'calendar_list_sources') return Promise.resolve([])
      return Promise.resolve()
    })
    await renderPage()
    await waitFor(() =>
      expect(screen.getByText('No calendars found.')).toBeDefined()
    )
  })

  it('shows "Synced N events" after successful sync', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'settings_get') return Promise.resolve(null)
      if (cmd === 'settings_get_data_dir') return Promise.resolve('/data')
      if (cmd === 'calendar_list_sources') return Promise.resolve([
        {
          id: 'cal-1',
          external_id: 'ext-1',
          name: 'Personal',
          color_hex: '#FF5733',
          enabled: true,
          last_synced_at: null,
        },
      ])
      if (cmd === 'calendar_sync') return Promise.resolve(3)
      return Promise.resolve()
    })
    await renderPage()
    await waitFor(() => expect(screen.getByText('Personal')).toBeDefined())

    fireEvent.click(screen.getByText('Sync Now'))

    await waitFor(() =>
      expect(screen.getByText('Synced 3 events')).toBeDefined()
    )
  })

  it('disables Sync Now button when no calendars are enabled', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'settings_get') return Promise.resolve(null)
      if (cmd === 'settings_get_data_dir') return Promise.resolve('/data')
      if (cmd === 'calendar_list_sources') return Promise.resolve([
        {
          id: 'cal-1',
          external_id: 'ext-1',
          name: 'Personal',
          color_hex: '#FF5733',
          enabled: false,
          last_synced_at: null,
        },
      ])
      return Promise.resolve()
    })
    await renderPage()
    await waitFor(() => expect(screen.getByText('Personal')).toBeDefined())

    const syncBtn = screen.getByText('Sync Now') as HTMLButtonElement
    expect(syncBtn.disabled).toBe(true)
  })
})

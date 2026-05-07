import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mockInvoke = vi.fn()
const mockLock = vi.fn()
const mockSave = vi.fn()
const mockOpen = vi.fn()

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}))

vi.mock('@tauri-apps/plugin-dialog', () => ({
  save: (...args: unknown[]) => mockSave(...args),
  open: (...args: unknown[]) => mockOpen(...args),
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
  mockSave.mockResolvedValue(null)
  mockOpen.mockResolvedValue(null)
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
    if (cmd === 'categories_list') return Promise.resolve([])
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

  it('renders Backup & Restore section', async () => {
    await renderPage()
    expect(screen.getByText('Backup & Restore')).toBeDefined()
    expect(screen.getByText('Export Backup')).toBeDefined()
    expect(screen.getByText('Import Backup')).toBeDefined()
  })

  it('export backup — dialog cancelled does nothing', async () => {
    mockSave.mockResolvedValue(null)
    await renderPage()

    fireEvent.click(screen.getByText('Export Backup'))

    await waitFor(() => expect(mockSave).toHaveBeenCalledOnce())
    expect(mockInvoke).not.toHaveBeenCalledWith('backup_export', expect.anything())
  })

  it('export backup — success calls backup_export and shows message', async () => {
    mockSave.mockResolvedValue('/tmp/myhealth-backup.myhealth')
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'settings_get') return Promise.resolve(null)
      if (cmd === 'settings_get_data_dir') return Promise.resolve('/data')
      if (cmd === 'calendar_list_sources') return Promise.resolve([])
      if (cmd === 'backup_export') return Promise.resolve()
      return Promise.resolve()
    })
    await renderPage()

    fireEvent.click(screen.getByText('Export Backup'))

    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith('backup_export', {
        destPath: '/tmp/myhealth-backup.myhealth',
      })
    )
    await waitFor(() =>
      expect(screen.getByText('Backup exported successfully.')).toBeDefined()
    )
  })

  it('export backup — backend error shows error message', async () => {
    mockSave.mockResolvedValue('/tmp/backup.myhealth')
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'settings_get') return Promise.resolve(null)
      if (cmd === 'settings_get_data_dir') return Promise.resolve('/data')
      if (cmd === 'calendar_list_sources') return Promise.resolve([])
      if (cmd === 'backup_export') return Promise.reject(new Error('Disk full'))
      return Promise.resolve()
    })
    await renderPage()

    fireEvent.click(screen.getByText('Export Backup'))

    await waitFor(() =>
      expect(screen.getByText('Error: Disk full')).toBeDefined()
    )
  })

  it('import backup — dialog cancelled does nothing', async () => {
    mockOpen.mockResolvedValue(null)
    await renderPage()

    fireEvent.click(screen.getByText('Import Backup'))

    await waitFor(() => expect(mockOpen).toHaveBeenCalledOnce())
    expect(screen.queryByText('Replace all data?')).toBeNull()
  })

  it('import backup — shows confirmation after file selected', async () => {
    mockOpen.mockResolvedValue('/tmp/backup.myhealth')
    await renderPage()

    fireEvent.click(screen.getByText('Import Backup'))

    await waitFor(() =>
      expect(screen.getByText('Yes, replace my data')).toBeDefined()
    )
    expect(screen.getByText('Replace all data?', { exact: false })).toBeDefined()
  })

  it('import backup — cancel confirmation dismisses dialog', async () => {
    mockOpen.mockResolvedValue('/tmp/backup.myhealth')
    await renderPage()

    fireEvent.click(screen.getByText('Import Backup'))
    await waitFor(() => expect(screen.getByText('Yes, replace my data')).toBeDefined())

    fireEvent.click(screen.getByText('Cancel'))

    expect(screen.queryByText('Yes, replace my data')).toBeNull()
  })

  it('import backup — confirm calls backup_import then lock and redirect', async () => {
    mockOpen.mockResolvedValue('/tmp/backup.myhealth')
    const mockPush = vi.fn()
    vi.doMock('next/navigation', () => ({
      useRouter: () => ({ push: mockPush }),
    }))
    mockLock.mockResolvedValue(undefined)
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'settings_get') return Promise.resolve(null)
      if (cmd === 'settings_get_data_dir') return Promise.resolve('/data')
      if (cmd === 'calendar_list_sources') return Promise.resolve([])
      if (cmd === 'backup_import') return Promise.resolve()
      return Promise.resolve()
    })
    await renderPage()

    fireEvent.click(screen.getByText('Import Backup'))
    await waitFor(() => expect(screen.getByText('Yes, replace my data')).toBeDefined())
    fireEvent.click(screen.getByText('Yes, replace my data'))

    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith('backup_import', {
        srcPath: '/tmp/backup.myhealth',
      })
    )
    await waitFor(() => expect(mockLock).toHaveBeenCalledOnce())
  })

  it('import backup — backend error shows error message', async () => {
    mockOpen.mockResolvedValue('/tmp/backup.myhealth')
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'settings_get') return Promise.resolve(null)
      if (cmd === 'settings_get_data_dir') return Promise.resolve('/data')
      if (cmd === 'calendar_list_sources') return Promise.resolve([])
      if (cmd === 'backup_import') return Promise.reject(new Error('Corrupt file'))
      return Promise.resolve()
    })
    await renderPage()

    fireEvent.click(screen.getByText('Import Backup'))
    await waitFor(() => expect(screen.getByText('Yes, replace my data')).toBeDefined())
    fireEvent.click(screen.getByText('Yes, replace my data'))

    await waitFor(() =>
      expect(screen.getByText('Error: Corrupt file')).toBeDefined()
    )
  })
})

describe('SettingsPage — Outlook Calendar Sync (Windows)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      configurable: true,
    })
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'settings_get') return Promise.resolve(null)
      if (cmd === 'settings_get_data_dir') return Promise.resolve('/data')
      if (cmd === 'calendar_list_sources') return Promise.resolve([])
      if (cmd === 'outlook_is_connected') return Promise.resolve(false)
      if (cmd === 'outlook_get_auth_url') return Promise.resolve({ url: 'https://login.microsoft.com/auth', code_verifier: 'verifier123' })
      if (cmd === 'outlook_exchange_code') return Promise.resolve()
      if (cmd === 'outlook_sync') return Promise.resolve(5)
      if (cmd === 'outlook_disconnect') return Promise.resolve()
      return Promise.resolve()
    })
  })

  afterEach(() => {
    Object.defineProperty(navigator, 'userAgent', {
      value: '',
      configurable: true,
    })
  })

  it('renders Outlook section on Windows', async () => {
    await renderPage()
    await waitFor(() => expect(screen.getByText('Outlook Calendar Sync')).toBeDefined())
    expect(screen.getByText('Connect Outlook')).toBeDefined()
  })

  it('calls outlook_is_connected on mount', async () => {
    await renderPage()
    await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith('outlook_is_connected', { userId: 'default' }))
  })

  it('shows connected state when outlook_is_connected returns true', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'settings_get') return Promise.resolve(null)
      if (cmd === 'settings_get_data_dir') return Promise.resolve('/data')
      if (cmd === 'calendar_list_sources') return Promise.resolve([])
      if (cmd === 'outlook_is_connected') return Promise.resolve(true)
      return Promise.resolve()
    })
    await renderPage()
    await waitFor(() => expect(screen.getByText('✓ Connected to Outlook')).toBeDefined())
  })

  it('transitions to awaiting_code after clicking Connect Outlook', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
    await renderPage()
    await waitFor(() => expect(screen.getByText('Connect Outlook')).toBeDefined())

    fireEvent.click(screen.getByText('Connect Outlook'))

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('outlook_get_auth_url')
      expect(screen.getByPlaceholderText('Paste code here…')).toBeDefined()
    })
    openSpy.mockRestore()
  })

  it('exchanges code and shows connected state', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
    await renderPage()
    await waitFor(() => expect(screen.getByText('Connect Outlook')).toBeDefined())

    fireEvent.click(screen.getByText('Connect Outlook'))
    await waitFor(() => expect(screen.getByPlaceholderText('Paste code here…')).toBeDefined())

    const input = screen.getByPlaceholderText('Paste code here…')
    await userEvent.type(input, 'auth-code-abc')

    fireEvent.click(screen.getByText('Authorize'))

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('outlook_exchange_code', expect.objectContaining({ code: 'auth-code-abc' }))
      expect(screen.getByText('Connected to Outlook successfully.')).toBeDefined()
    })
    openSpy.mockRestore()
  })

  it('syncs outlook and shows success message', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'settings_get') return Promise.resolve(null)
      if (cmd === 'settings_get_data_dir') return Promise.resolve('/data')
      if (cmd === 'calendar_list_sources') return Promise.resolve([])
      if (cmd === 'outlook_is_connected') return Promise.resolve(true)
      if (cmd === 'outlook_sync') return Promise.resolve(5)
      return Promise.resolve()
    })
    await renderPage()
    await waitFor(() => expect(screen.getByText('✓ Connected to Outlook')).toBeDefined())

    fireEvent.click(screen.getByText('Sync Now'))

    await waitFor(() =>
      expect(screen.getByText('Synced 5 events from Outlook.')).toBeDefined()
    )
  })

  it('disconnects outlook and returns to idle state', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'settings_get') return Promise.resolve(null)
      if (cmd === 'settings_get_data_dir') return Promise.resolve('/data')
      if (cmd === 'calendar_list_sources') return Promise.resolve([])
      if (cmd === 'outlook_is_connected') return Promise.resolve(true)
      if (cmd === 'outlook_disconnect') return Promise.resolve()
      return Promise.resolve()
    })
    await renderPage()
    await waitFor(() => expect(screen.getByText('✓ Connected to Outlook')).toBeDefined())

    fireEvent.click(screen.getByText('Disconnect'))

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('outlook_disconnect', { userId: 'default' })
      expect(screen.getByText('Disconnected from Outlook.')).toBeDefined()
    })
  })

  it('cancel button returns to idle from awaiting_code', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
    await renderPage()
    await waitFor(() => expect(screen.getByText('Connect Outlook')).toBeDefined())

    fireEvent.click(screen.getByText('Connect Outlook'))
    await waitFor(() => expect(screen.getByPlaceholderText('Paste code here…')).toBeDefined())

    fireEvent.click(screen.getByText('Cancel'))

    await waitFor(() => expect(screen.getByText('Connect Outlook')).toBeDefined())
    openSpy.mockRestore()
  })

  describe('show archived categories toggle', () => {
    const activeCategory = { id: 'cat-1', name: 'Cardiology', color_hex: '#FF0000', is_system: 0, sort_order: 1, is_archived: 0 }
    const archivedCategory = { id: 'cat-2', name: 'OldEmpty', color_hex: '#6B7280', is_system: 0, sort_order: 2, is_archived: 1 }

    function makeCategoriesInvoke(withArchived: boolean) {
      return (cmd: string, args?: Record<string, unknown>) => {
        if (cmd === 'settings_get') return Promise.resolve(null)
        if (cmd === 'settings_get_data_dir') return Promise.resolve('/tmp')
        if (cmd === 'settings_set') return Promise.resolve()
        if (cmd === 'calendar_list_sources') return Promise.resolve([])
        if (cmd === 'categories_list') {
          if (args?.includeArchived) return Promise.resolve([activeCategory, archivedCategory])
          return Promise.resolve([activeCategory])
        }
        return Promise.resolve()
      }
    }

    it('fetches archived categories and shows them when toggle enabled', async () => {
      mockInvoke.mockImplementation(makeCategoriesInvoke(true))
      await renderPage()
      const checkbox = screen.getByLabelText('Show archived categories') as HTMLInputElement
      expect(checkbox.checked).toBe(false)

      fireEvent.click(checkbox)

      await waitFor(() => {
        expect(screen.getAllByText('OldEmpty').length).toBeGreaterThan(0)
      })
      expect(mockInvoke).toHaveBeenCalledWith('categories_list', { includeArchived: true })
    })

    it('shows empty-state message when no archived categories exist', async () => {
      mockInvoke.mockImplementation((cmd: string, args?: Record<string, unknown>) => {
        if (cmd === 'settings_get') return Promise.resolve(null)
        if (cmd === 'settings_get_data_dir') return Promise.resolve('/tmp')
        if (cmd === 'settings_set') return Promise.resolve()
        if (cmd === 'calendar_list_sources') return Promise.resolve([])
        if (cmd === 'categories_list') return Promise.resolve([activeCategory])
        return Promise.resolve()
      })
      await renderPage()
      fireEvent.click(screen.getByLabelText('Show archived categories'))

      await waitFor(() => {
        expect(screen.getByText('No archived categories.')).toBeDefined()
      })
    })

    it('does not re-fetch when toggled on a second time', async () => {
      mockInvoke.mockImplementation(makeCategoriesInvoke(true))
      await renderPage()
      const checkbox = screen.getByLabelText('Show archived categories')
      fireEvent.click(checkbox)
      await waitFor(() => expect(screen.getAllByText('OldEmpty').length).toBeGreaterThan(0))
      const fetchCountAfterFirst = mockInvoke.mock.calls.filter(
        (c: unknown[]) => c[0] === 'categories_list' && (c[1] as Record<string, unknown>)?.includeArchived
      ).length

      fireEvent.click(checkbox) // off
      fireEvent.click(checkbox) // on again

      await waitFor(() => expect(screen.getAllByText('OldEmpty').length).toBeGreaterThan(0))
      const fetchCountAfterSecond = mockInvoke.mock.calls.filter(
        (c: unknown[]) => c[0] === 'categories_list' && (c[1] as Record<string, unknown>)?.includeArchived
      ).length
      expect(fetchCountAfterSecond).toBe(fetchCountAfterFirst)
    })
  })
})

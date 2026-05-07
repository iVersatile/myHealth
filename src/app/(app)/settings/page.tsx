'use client'

import { useEffect, useRef, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { save, open } from '@tauri-apps/plugin-dialog'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../../hooks/useAuth'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

type Theme = 'light' | 'dark' | 'system'

type Category = {
  id: string
  name: string
  color_hex: string
  is_system: boolean
  sort_order: number
}

type CalendarSourceRow = {
  id: string
  external_id: string
  name: string
  color_hex: string | null
  enabled: boolean
  last_synced_at: string | null
}

type CalendarEventDto = {
  id: string
  title: string
  start_at: string
  end_at: string | null
  location: string | null
  calendar_id: string
}

type ConflictPair = {
  event_a: CalendarEventDto
  event_b: CalendarEventDto
  overlap_minutes: number
}

const AUTO_LOCK_OPTIONS = [
  { label: '5 minutes', value: '5' },
  { label: '15 minutes', value: '15' },
  { label: '30 minutes', value: '30' },
  { label: '1 hour', value: '60' },
  { label: 'Never', value: '0' },
]

const sectionStyle: React.CSSProperties = {
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-lg)',
  padding: 'var(--space-5)',
  marginBottom: 'var(--space-5)',
  boxShadow: 'var(--shadow-sm)',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 'var(--text-sm)',
  fontWeight: 500,
  color: 'var(--color-text)',
  marginBottom: 'var(--space-1)',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: 'var(--space-2) var(--space-3)',
  fontSize: 'var(--text-sm)',
  background: 'var(--color-surface-sunken)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-md)',
  color: 'var(--color-text)',
  outline: 'none',
  boxSizing: 'border-box',
}

const btnPrimary: React.CSSProperties = {
  padding: 'var(--space-2) var(--space-4)',
  fontSize: 'var(--text-sm)',
  fontWeight: 600,
  background: 'var(--color-primary)',
  color: '#fff',
  border: 'none',
  borderRadius: 'var(--radius-md)',
  cursor: 'pointer',
}

const btnDanger: React.CSSProperties = {
  padding: 'var(--space-2) var(--space-4)',
  fontSize: 'var(--text-sm)',
  fontWeight: 600,
  background: 'var(--color-danger)',
  color: '#fff',
  border: 'none',
  borderRadius: 'var(--radius-md)',
  cursor: 'pointer',
}

const btnSecondary: React.CSSProperties = {
  padding: 'var(--space-2) var(--space-4)',
  fontSize: 'var(--text-sm)',
  fontWeight: 500,
  background: 'transparent',
  color: 'var(--color-text-muted)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-md)',
  cursor: 'pointer',
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--color-text)', marginBottom: 'var(--space-4)' }}>
      {children}
    </h2>
  )
}

function Field({ label, id, children }: { label: string; id?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 'var(--space-3)' }}>
      <label htmlFor={id} style={labelStyle}>{label}</label>
      {children}
    </div>
  )
}

function SortableCategoryItem({ cat }: { cat: Category }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: cat.id })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-2)',
    padding: 'var(--space-2) var(--space-3)',
    background: 'var(--color-surface-sunken)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
    marginBottom: 'var(--space-2)',
    userSelect: 'none',
    cursor: isDragging ? 'grabbing' : 'grab',
  }
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <span style={{ color: 'var(--color-text-muted)', fontSize: 12, flexShrink: 0 }}>⠿</span>
      <span style={{
        width: 12, height: 12, borderRadius: '50%',
        background: cat.color_hex, flexShrink: 0,
      }} />
      <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text)', flex: 1 }}>
        {cat.name}
      </span>
      {cat.is_system && (
        <span style={{ fontSize: 10, color: 'var(--color-text-muted)', background: 'var(--color-border)', borderRadius: 4, padding: '1px 5px' }}>
          system
        </span>
      )}
    </div>
  )
}

export default function SettingsPage() {
  const { lock } = useAuth()
  const router = useRouter()

  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwMsg, setPwMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [pwBusy, setPwBusy] = useState(false)

  const [autoLock, setAutoLock] = useState('15')
  const [theme, setTheme] = useState<Theme>('system')
  const [dataDir, setDataDir] = useState('')

  const [wipeConfirm, setWipeConfirm] = useState(false)
  const [wipeBusy, setWipeBusy] = useState(false)

  const [resetConfirm, setResetConfirm] = useState(false)
  const [resetBusy, setResetBusy] = useState(false)

  const [backupBusy, setBackupBusy] = useState(false)
  const [backupMsg, setBackupMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [importConfirm, setImportConfirm] = useState<string | null>(null)

  const [calendars, setCalendars] = useState<CalendarSourceRow[]>([])
  const [calendarsLoading, setCalendarsLoading] = useState(true)
  const [calendarsError, setCalendarsError] = useState<string | null>(null)
  const [syncBusy, setSyncBusy] = useState(false)
  const [syncMsg, setSyncMsg] = useState<{ text: string; ok: boolean } | null>(null)

  const [autoArchive, setAutoArchive] = useState(false)
  const [archiveMonths, setArchiveMonths] = useState(12)
  const [archiveBusy, setArchiveBusy] = useState(false)
  const [archiveMsg, setArchiveMsg] = useState<{ text: string; ok: boolean } | null>(null)

  const [categories, setCategories] = useState<Category[]>([])
  const reorderPending = useRef(false)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const [conflicts, setConflicts] = useState<ConflictPair[]>([])
  const [conflictsLoading, setConflictsLoading] = useState(false)
  const [showConflicts, setShowConflicts] = useState(false)

  const isWindows = typeof navigator !== 'undefined' && navigator.userAgent.includes('Windows')
  const [outlookConnected, setOutlookConnected] = useState(false)
  const [outlookBusy, setOutlookBusy] = useState(false)
  const [outlookMsg, setOutlookMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [outlookCodeVerifier, setOutlookCodeVerifier] = useState('')
  const [outlookAuthStep, setOutlookAuthStep] = useState<'idle' | 'awaiting_code'>('idle')
  const [outlookCode, setOutlookCode] = useState('')

  useEffect(() => {
    async function loadSettings() {
      const [t, al, dir, aa, am] = await Promise.all([
        invoke<string | null>('settings_get', { key: 'theme' }),
        invoke<string | null>('settings_get', { key: 'auto_lock_minutes' }),
        invoke<string>('settings_get_data_dir'),
        invoke<string | null>('settings_get', { key: 'auto_archive_categories' }),
        invoke<string | null>('settings_get', { key: 'auto_archive_months' }),
      ])
      if (t === 'light' || t === 'dark' || t === 'system') setTheme(t)
      if (al) setAutoLock(al)
      setDataDir(dir)
      setAutoArchive(aa === 'true')
      if (am) setArchiveMonths(parseInt(am, 10) || 12)

      const cats = await invoke<Category[]>('categories_list')
      setCategories(cats.slice().sort((a, b) => a.sort_order - b.sort_order))
    }
    void loadSettings()
  }, [])

  useEffect(() => {
    async function loadCalendars() {
      setCalendarsLoading(true)
      setCalendarsError(null)
      try {
        const sources = await invoke<CalendarSourceRow[]>('calendar_list_sources')
        setCalendars(sources)
      } catch (err) {
        setCalendarsError(String(err))
      } finally {
        setCalendarsLoading(false)
      }
    }
    void loadCalendars()
  }, [])

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'system') {
      root.removeAttribute('data-theme')
    } else {
      root.setAttribute('data-theme', theme)
    }
  }, [theme])

  async function handleThemeChange(t: Theme) {
    setTheme(t)
    await invoke('settings_set', { key: 'theme', value: t })
  }

  async function handleAutoLockChange(val: string) {
    setAutoLock(val)
    await invoke('settings_set', { key: 'auto_lock_minutes', value: val })
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault()
    if (newPw !== confirmPw) {
      setPwMsg({ text: 'New passwords do not match.', ok: false })
      return
    }
    if (newPw.length < 8) {
      setPwMsg({ text: 'Password must be at least 8 characters.', ok: false })
      return
    }
    setPwBusy(true)
    setPwMsg(null)
    try {
      await invoke('auth_change_password', { oldPassword: currentPw, newPassword: newPw })
      setPwMsg({ text: 'Password changed successfully.', ok: true })
      setCurrentPw('')
      setNewPw('')
      setConfirmPw('')
    } catch (err) {
      setPwMsg({ text: String(err), ok: false })
    } finally {
      setPwBusy(false)
    }
  }

  async function handleWipe() {
    if (!wipeConfirm) {
      setWipeConfirm(true)
      return
    }
    setWipeBusy(true)
    try {
      await invoke('settings_wipe_all_data')
      await lock()
    } catch (err) {
      console.error('Wipe failed', err)
      setWipeBusy(false)
      setWipeConfirm(false)
    }
  }

  async function handleReset() {
    if (!resetConfirm) {
      setResetConfirm(true)
      return
    }
    setResetBusy(true)
    try {
      await invoke('app_reset_data', { confirm: true })
      router.push('/')
    } catch (err) {
      console.error('Reset failed', err)
      setResetBusy(false)
      setResetConfirm(false)
    }
  }

  async function handleExportBackup() {
    setBackupMsg(null)
    const destPath = await save({
      title: 'Export Backup',
      defaultPath: `myhealth-backup-${new Date().toISOString().slice(0, 10)}.myhealth`,
      filters: [{ name: 'myHealth Backup', extensions: ['myhealth'] }],
    })
    if (!destPath) return
    setBackupBusy(true)
    try {
      await invoke('backup_export', { destPath })
      setBackupMsg({ text: 'Backup exported successfully.', ok: true })
    } catch (err) {
      setBackupMsg({ text: String(err), ok: false })
    } finally {
      setBackupBusy(false)
    }
  }

  async function handleImportBackup() {
    setBackupMsg(null)
    const selected = await open({
      title: 'Import Backup',
      multiple: false,
      filters: [{ name: 'myHealth Backup', extensions: ['myhealth'] }],
    })
    if (!selected) return
    const srcPath = typeof selected === 'string' ? selected : selected[0]
    if (!srcPath) return
    setImportConfirm(srcPath)
  }

  async function handleImportConfirm() {
    if (!importConfirm) return
    setBackupBusy(true)
    setImportConfirm(null)
    try {
      await invoke('backup_import', { srcPath: importConfirm })
      lock()
      router.push('/unlock')
    } catch (err) {
      setBackupMsg({ text: String(err), ok: false })
      setBackupBusy(false)
    }
  }

  async function handleCalendarToggle(id: string, enabled: boolean) {
    try {
      await invoke('calendar_toggle_source', { id, enabled })
      setCalendars(prev =>
        prev.map(cal => (cal.id === id ? { ...cal, enabled } : cal))
      )
    } catch (err) {
      setSyncMsg({ text: String(err), ok: false })
    }
  }

  async function handleAutoArchiveToggle(checked: boolean) {
    setAutoArchive(checked)
    await invoke('settings_set', { key: 'auto_archive_categories', value: String(checked) })
  }

  async function handleArchiveMonthsChange(val: number) {
    const clamped = Math.max(1, Math.min(120, val))
    setArchiveMonths(clamped)
    await invoke('settings_set', { key: 'auto_archive_months', value: String(clamped) })
  }

  async function handleRunArchive() {
    setArchiveBusy(true)
    setArchiveMsg(null)
    try {
      const count = await invoke<number>('categories_archive_stale', { monthsInactive: archiveMonths })
      setArchiveMsg({ text: `Archived ${count} inactive categor${count === 1 ? 'y' : 'ies'}.`, ok: true })
    } catch (err) {
      setArchiveMsg({ text: String(err), ok: false })
    } finally {
      setArchiveBusy(false)
    }
  }

  function handleCategoryDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = categories.findIndex(c => c.id === active.id)
    const newIndex = categories.findIndex(c => c.id === over.id)
    const reordered = arrayMove(categories, oldIndex, newIndex)
    setCategories(reordered)
    if (reorderPending.current) return
    reorderPending.current = true
    void invoke('categories_reorder', { orderedIds: reordered.map(c => c.id) }).finally(() => {
      reorderPending.current = false
    })
  }

  useEffect(() => {
    if (!isWindows) return
    async function checkOutlook() {
      try {
        const connected = await invoke<boolean>('outlook_is_connected', { userId: 'default' })
        setOutlookConnected(connected)
      } catch {
        // not connected or unsupported
      }
    }
    void checkOutlook()
  }, [isWindows])

  async function handleOutlookConnect() {
    setOutlookBusy(true)
    setOutlookMsg(null)
    try {
      const res = await invoke<{ url: string; code_verifier: string }>('outlook_get_auth_url')
      setOutlookCodeVerifier(res.code_verifier)
      window.open(res.url, '_blank')
      setOutlookAuthStep('awaiting_code')
    } catch (err) {
      setOutlookMsg({ text: String(err), ok: false })
    } finally {
      setOutlookBusy(false)
    }
  }

  async function handleOutlookExchangeCode() {
    if (!outlookCode.trim()) return
    setOutlookBusy(true)
    setOutlookMsg(null)
    try {
      await invoke('outlook_exchange_code', {
        code: outlookCode.trim(),
        codeVerifier: outlookCodeVerifier,
        redirectUri: 'http://localhost:62749',
        userId: 'default',
      })
      setOutlookConnected(true)
      setOutlookAuthStep('idle')
      setOutlookCode('')
      setOutlookMsg({ text: 'Connected to Outlook successfully.', ok: true })
    } catch (err) {
      setOutlookMsg({ text: String(err), ok: false })
    } finally {
      setOutlookBusy(false)
    }
  }

  async function handleOutlookSync() {
    setOutlookBusy(true)
    setOutlookMsg(null)
    try {
      const count = await invoke<number>('outlook_sync', { userId: 'default' })
      setOutlookMsg({ text: `Synced ${count} event${count === 1 ? '' : 's'} from Outlook.`, ok: true })
    } catch (err) {
      setOutlookMsg({ text: String(err), ok: false })
    } finally {
      setOutlookBusy(false)
    }
  }

  async function handleOutlookDisconnect() {
    setOutlookBusy(true)
    setOutlookMsg(null)
    try {
      await invoke('outlook_disconnect', { userId: 'default' })
      setOutlookConnected(false)
      setOutlookAuthStep('idle')
      setOutlookCode('')
      setOutlookMsg({ text: 'Disconnected from Outlook.', ok: true })
    } catch (err) {
      setOutlookMsg({ text: String(err), ok: false })
    } finally {
      setOutlookBusy(false)
    }
  }

  async function handleSync() {
    setSyncBusy(true)
    setSyncMsg(null)
    try {
      const enabledIds = calendars.filter(cal => cal.enabled).map(cal => cal.id)
      const synced = await invoke<number>('calendar_sync', { sourceIds: enabledIds })
      setSyncMsg({ text: `Synced ${synced} event${synced === 1 ? '' : 's'}`, ok: true })
    } catch (err) {
      setSyncMsg({ text: String(err), ok: false })
    } finally {
      setSyncBusy(false)
    }
  }

  async function loadConflicts() {
    setConflictsLoading(true)
    try {
      const pairs = await invoke<ConflictPair[]>('calendar_detect_conflicts')
      setConflicts(pairs)
      setShowConflicts(true)
    } catch (err) {
      setSyncMsg({ text: String(err), ok: false })
    } finally {
      setConflictsLoading(false)
    }
  }

  async function handleKeepEvent(deleteId: string, pairIndex: number) {
    try {
      await invoke('calendar_event_delete', { id: deleteId })
      setConflicts(prev => prev.filter((_, i) => i !== pairIndex))
    } catch (err) {
      setSyncMsg({ text: String(err), ok: false })
    }
  }

  function handleKeepBoth(pairIndex: number) {
    setConflicts(prev => prev.filter((_, i) => i !== pairIndex))
  }

  return (
    <div style={{ padding: 'var(--space-6)', maxWidth: 640 }}>
      <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: 'var(--color-text)', marginBottom: 'var(--space-6)' }}>
        Settings
      </h1>

      {/* Security */}
      <div style={sectionStyle}>
        <SectionTitle>Security</SectionTitle>

        <form onSubmit={(e) => { void handlePasswordChange(e) }}>
          <Field label="Current password" id="current-pw">
            <input
              id="current-pw"
              type="password"
              value={currentPw}
              onChange={e => setCurrentPw(e.target.value)}
              style={inputStyle}
              autoComplete="current-password"
            />
          </Field>
          <Field label="New password" id="new-pw">
            <input
              id="new-pw"
              type="password"
              value={newPw}
              onChange={e => setNewPw(e.target.value)}
              style={inputStyle}
              autoComplete="new-password"
            />
          </Field>
          <Field label="Confirm new password" id="confirm-pw">
            <input
              id="confirm-pw"
              type="password"
              value={confirmPw}
              onChange={e => setConfirmPw(e.target.value)}
              style={inputStyle}
              autoComplete="new-password"
            />
          </Field>
          {pwMsg && (
            <p style={{ fontSize: 'var(--text-sm)', color: pwMsg.ok ? 'var(--color-success)' : 'var(--color-danger)', marginBottom: 'var(--space-3)' }}>
              {pwMsg.text}
            </p>
          )}
          <button type="submit" style={btnPrimary} disabled={pwBusy}>
            {pwBusy ? 'Updating…' : 'Change password'}
          </button>
        </form>

        <hr style={{ border: 'none', borderTop: '1px solid var(--color-border)', margin: 'var(--space-4) 0' }} />

        <Field label="Auto-lock after inactivity" id="auto-lock">
          <select
            id="auto-lock"
            value={autoLock}
            onChange={e => { void handleAutoLockChange(e.target.value) }}
            style={{ ...inputStyle, cursor: 'pointer' }}
          >
            {AUTO_LOCK_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </Field>
      </div>

      {/* Appearance */}
      <div style={sectionStyle}>
        <SectionTitle>Appearance</SectionTitle>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-3)' }}>
          Choose a theme. &ldquo;System&rdquo; follows your OS preference.
        </p>
        <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
          {(['light', 'dark', 'system'] as Theme[]).map(t => (
            <label
              key={t}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                fontSize: 'var(--text-sm)',
                color: 'var(--color-text)',
                cursor: 'pointer',
                padding: 'var(--space-2) var(--space-3)',
                border: `1px solid ${theme === t ? 'var(--color-primary)' : 'var(--color-border)'}`,
                borderRadius: 'var(--radius-md)',
                background: theme === t ? 'color-mix(in srgb, var(--color-primary) 10%, transparent)' : 'transparent',
              }}
            >
              <input
                type="radio"
                name="theme"
                value={t}
                checked={theme === t}
                onChange={() => { void handleThemeChange(t) }}
                style={{ accentColor: 'var(--color-primary)' }}
              />
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </label>
          ))}
        </div>
      </div>

      {/* Data */}
      <div style={sectionStyle}>
        <SectionTitle>Data</SectionTitle>

        <Field label="Data directory">
          <p style={{
            fontSize: 'var(--text-xs)',
            fontFamily: 'var(--font-mono)',
            color: 'var(--color-text-muted)',
            background: 'var(--color-surface-sunken)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-2) var(--space-3)',
            wordBreak: 'break-all',
            margin: 0,
          }}>
            {dataDir || '—'}
          </p>
        </Field>

        <hr style={{ border: 'none', borderTop: '1px solid var(--color-border)', margin: 'var(--space-4) 0' }} />

        <p style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text)', marginBottom: 'var(--space-2)' }}>
          Backup &amp; Restore
        </p>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-3)' }}>
          Export an encrypted backup of all your data, or restore from a previous backup.
        </p>

        {importConfirm && (
          <div style={{ marginBottom: 'var(--space-3)', padding: 'var(--space-3)', border: '1px solid var(--color-warning, var(--color-primary))', borderRadius: 'var(--radius-md)', background: 'color-mix(in srgb, var(--color-primary) 8%, transparent)' }}>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text)', marginBottom: 'var(--space-3)' }}>
              <strong>Replace all data?</strong> Importing will overwrite all current data with the backup. This cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
              <button onClick={() => { void handleImportConfirm() }} style={btnDanger} disabled={backupBusy}>
                {backupBusy ? 'Importing…' : 'Yes, replace my data'}
              </button>
              <button onClick={() => setImportConfirm(null)} style={btnSecondary} disabled={backupBusy}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {backupMsg && (
          <p style={{ fontSize: 'var(--text-sm)', color: backupMsg.ok ? 'var(--color-success, green)' : 'var(--color-danger)', marginBottom: 'var(--space-3)' }}>
            {backupMsg.text}
          </p>
        )}

        <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
          <button onClick={() => { void handleExportBackup() }} style={btnPrimary} disabled={backupBusy}>
            {backupBusy ? 'Working…' : 'Export Backup'}
          </button>
          <button onClick={() => { void handleImportBackup() }} style={btnSecondary} disabled={backupBusy}>
            Import Backup
          </button>
        </div>

        <hr style={{ border: 'none', borderTop: '1px solid var(--color-border)', margin: 'var(--space-4) 0' }} />

        <p style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-danger)', marginBottom: 'var(--space-2)' }}>
          Danger zone
        </p>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-3)' }}>
          Permanently deletes all data, documents, and settings. This cannot be undone.
        </p>

        {wipeConfirm ? (
          <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
            <button onClick={() => { void handleWipe() }} style={btnDanger} disabled={wipeBusy}>
              {wipeBusy ? 'Wiping…' : 'Yes, wipe everything'}
            </button>
            <button onClick={() => setWipeConfirm(false)} style={btnSecondary} disabled={wipeBusy}>
              Cancel
            </button>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-danger)' }}>
              This cannot be undone.
            </span>
          </div>
        ) : (
          <button onClick={() => { void handleWipe() }} style={btnDanger}>
            Wipe all data
          </button>
        )}

        <hr style={{ border: 'none', borderTop: '1px solid var(--color-border)', margin: 'var(--space-4) 0' }} />

        <p style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-danger)', marginBottom: 'var(--space-2)' }}>
          Reset app
        </p>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-3)' }}>
          Resets the app to its initial state — clears all data, documents, and settings, then returns to the setup screen.
        </p>

        {resetConfirm ? (
          <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center', padding: 'var(--space-3)', border: '1px solid var(--color-danger)', borderRadius: 'var(--radius-md)', background: 'color-mix(in srgb, var(--color-danger) 8%, transparent)' }}>
            <span style={{ flex: 1, fontSize: 'var(--text-sm)', color: 'var(--color-danger)', fontWeight: 500 }}>
              All data will be permanently deleted. This cannot be undone.
            </span>
            <button onClick={() => { void handleReset() }} style={btnDanger} disabled={resetBusy}>
              {resetBusy ? 'Resetting…' : 'Yes, reset app'}
            </button>
            <button onClick={() => setResetConfirm(false)} style={btnSecondary} disabled={resetBusy}>
              Cancel
            </button>
          </div>
        ) : (
          <button onClick={() => { void handleReset() }} style={{ ...btnDanger, background: 'transparent', color: 'var(--color-danger)', border: '1px solid var(--color-danger)' }}>
            Reset app
          </button>
        )}
      </div>

      {/* Categories */}
      <div style={sectionStyle}>
        <SectionTitle>Categories</SectionTitle>

        {categories.length > 0 && (
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-2)', marginTop: 0 }}>
              Drag to reorder categories
            </p>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleCategoryDragEnd}>
              <SortableContext items={categories.map(c => c.id)} strategy={verticalListSortingStrategy}>
                {categories.map(cat => (
                  <SortableCategoryItem key={cat.id} cat={cat} />
                ))}
              </SortableContext>
            </DndContext>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
          <div>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text)', margin: 0, fontWeight: 500 }}>
              Auto-archive inactive categories
            </p>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', margin: '4px 0 0 0' }}>
              Categories with no linked documents or appointments are archived automatically.
            </p>
          </div>
          <input
            type="checkbox"
            checked={autoArchive}
            onChange={e => { void handleAutoArchiveToggle(e.target.checked) }}
            style={{ cursor: 'pointer', accentColor: 'var(--color-primary)', width: 18, height: 18, flexShrink: 0 }}
            aria-label="Auto-archive inactive categories"
          />
        </div>

        <Field label="Inactivity threshold (months)" id="archive-months">
          <input
            id="archive-months"
            type="number"
            min={1}
            max={120}
            value={archiveMonths}
            onChange={e => { void handleArchiveMonthsChange(parseInt(e.target.value, 10)) }}
            style={{ ...inputStyle, width: 100 }}
          />
        </Field>

        <button
          onClick={() => { void handleRunArchive() }}
          style={btnSecondary}
          disabled={archiveBusy}
        >
          {archiveBusy ? 'Archiving…' : 'Run Now'}
        </button>

        {archiveMsg && (
          <p style={{
            fontSize: 'var(--text-sm)',
            color: archiveMsg.ok ? 'var(--color-success)' : 'var(--color-danger)',
            marginTop: 'var(--space-3)',
          }}>
            {archiveMsg.text}
          </p>
        )}
      </div>

      {/* Outlook Calendar Sync — Windows only */}
      {isWindows && (
        <div style={sectionStyle}>
          <SectionTitle>Outlook Calendar Sync</SectionTitle>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-4)' }}>
            Connect your Microsoft Outlook account to import calendar events as appointments.
          </p>

          {!outlookConnected && outlookAuthStep === 'idle' && (
            <button onClick={() => { void handleOutlookConnect() }} style={btnPrimary} disabled={outlookBusy}>
              {outlookBusy ? 'Opening browser…' : 'Connect Outlook'}
            </button>
          )}

          {!outlookConnected && outlookAuthStep === 'awaiting_code' && (
            <div>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text)', marginBottom: 'var(--space-3)' }}>
                A browser window has opened. Sign in with your Microsoft account, then paste the authorization code from the redirect URL below.
              </p>
              <Field label="Authorization code" id="outlook-code">
                <input
                  id="outlook-code"
                  type="text"
                  value={outlookCode}
                  onChange={e => setOutlookCode(e.target.value)}
                  placeholder="Paste code here…"
                  style={inputStyle}
                />
              </Field>
              <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
                <button
                  onClick={() => { void handleOutlookExchangeCode() }}
                  style={btnPrimary}
                  disabled={outlookBusy || !outlookCode.trim()}
                >
                  {outlookBusy ? 'Authorizing…' : 'Authorize'}
                </button>
                <button
                  onClick={() => { setOutlookAuthStep('idle'); setOutlookCode('') }}
                  style={btnSecondary}
                  disabled={outlookBusy}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {outlookConnected && (
            <div>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-success)', marginBottom: 'var(--space-3)', fontWeight: 500 }}>
                ✓ Connected to Outlook
              </p>
              <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                <button onClick={() => { void handleOutlookSync() }} style={btnPrimary} disabled={outlookBusy}>
                  {outlookBusy ? 'Syncing…' : 'Sync Now'}
                </button>
                <button onClick={() => { void handleOutlookDisconnect() }} style={btnSecondary} disabled={outlookBusy}>
                  Disconnect
                </button>
              </div>
            </div>
          )}

          {outlookMsg && (
            <p style={{
              fontSize: 'var(--text-sm)',
              color: outlookMsg.ok ? 'var(--color-success)' : 'var(--color-danger)',
              marginTop: 'var(--space-3)',
            }}>
              {outlookMsg.text}
            </p>
          )}
        </div>
      )}

      {/* Calendar Sync */}
      <div style={sectionStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
          <h2 style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--color-text)', margin: 0 }}>
            Calendar Sync
          </h2>
          {conflicts.length > 0 && (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: '20px',
              height: '20px',
              padding: '0 6px',
              fontSize: '11px',
              fontWeight: 700,
              background: 'var(--color-danger)',
              color: '#fff',
              borderRadius: '10px',
            }}>
              {conflicts.length}
            </span>
          )}
        </div>

        {calendarsLoading && (
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
            Loading calendars…
          </p>
        )}

        {calendarsError && !calendarsLoading && (
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
            Calendar sync is only supported on macOS.
          </p>
        )}

        {!calendarsError && !calendarsLoading && calendars.length === 0 && (
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
            No calendars found.
          </p>
        )}

        {!calendarsError && !calendarsLoading && calendars.length > 0 && (
          <>
            <div style={{ marginBottom: 'var(--space-4)' }}>
              {calendars.map(cal => (
                <div
                  key={cal.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-3)',
                    padding: 'var(--space-3)',
                    background: 'var(--color-surface-sunken)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    marginBottom: 'var(--space-2)',
                  }}
                >
                  {/* Color dot */}
                  <div
                    style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      background: cal.color_hex || 'var(--color-text-muted)',
                      flexShrink: 0,
                    }}
                  />

                  {/* Calendar name and sync info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text)', margin: 0, fontWeight: 500 }}>
                      {cal.name}
                    </p>
                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', margin: '4px 0 0 0' }}>
                      {cal.last_synced_at ? `Last synced: ${new Date(cal.last_synced_at).toLocaleString()}` : 'Never synced'}
                    </p>
                  </div>

                  {/* Toggle switch */}
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-2)',
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={cal.enabled}
                      onChange={e => { void handleCalendarToggle(cal.id, e.target.checked) }}
                      aria-label={`Enable ${cal.name}`}
                      style={{ cursor: 'pointer', accentColor: 'var(--color-primary)' }}
                    />
                  </label>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                onClick={() => { void handleSync() }}
                style={btnPrimary}
                disabled={syncBusy || calendars.filter(c => c.enabled).length === 0}
              >
                {syncBusy ? 'Syncing…' : 'Sync Now'}
              </button>
              <button
                onClick={() => { void loadConflicts() }}
                style={btnSecondary}
                disabled={conflictsLoading}
              >
                {conflictsLoading ? 'Checking…' : 'Check Conflicts'}
              </button>
            </div>

            {syncMsg && (
              <p style={{
                fontSize: 'var(--text-sm)',
                color: syncMsg.ok ? 'var(--color-success)' : 'var(--color-danger)',
                marginTop: 'var(--space-3)',
              }}>
                {syncMsg.text}
              </p>
            )}

            {showConflicts && conflicts.length === 0 && (
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-success)', marginTop: 'var(--space-3)' }}>
                No conflicts found.
              </p>
            )}

            {showConflicts && conflicts.length > 0 && (
              <div style={{ marginTop: 'var(--space-4)' }}>
                <p style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text)', marginBottom: 'var(--space-3)' }}>
                  Resolve Conflicts ({conflicts.length})
                </p>
                {conflicts.map((pair, idx) => (
                  <div
                    key={`${pair.event_a.id}-${pair.event_b.id}`}
                    style={{
                      background: 'var(--color-surface-sunken)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-md)',
                      padding: 'var(--space-3)',
                      marginBottom: 'var(--space-3)',
                    }}
                  >
                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', margin: '0 0 var(--space-2) 0' }}>
                      Overlap: {pair.overlap_minutes} min
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
                      {([pair.event_a, pair.event_b] as const).map((ev, evIdx) => (
                        <div
                          key={ev.id}
                          style={{
                            background: 'var(--color-surface)',
                            border: '1px solid var(--color-border)',
                            borderRadius: 'var(--radius-sm)',
                            padding: 'var(--space-2)',
                          }}
                        >
                          <p style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text)', margin: '0 0 4px 0' }}>
                            {evIdx === 0 ? 'Event A' : 'Event B'}
                          </p>
                          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text)', margin: '0 0 2px 0' }}>
                            {ev.title}
                          </p>
                          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', margin: 0 }}>
                            {new Date(ev.start_at).toLocaleString()}
                            {ev.end_at ? ` – ${new Date(ev.end_at).toLocaleTimeString()}` : ''}
                          </p>
                          {ev.location && (
                            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', margin: '2px 0 0 0' }}>
                              {ev.location}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                      <button
                        style={{ ...btnPrimary, fontSize: '12px', padding: '4px 10px' }}
                        onClick={() => { void handleKeepEvent(pair.event_b.id, idx) }}
                      >
                        Keep A
                      </button>
                      <button
                        style={{ ...btnPrimary, fontSize: '12px', padding: '4px 10px' }}
                        onClick={() => { void handleKeepEvent(pair.event_a.id, idx) }}
                      >
                        Keep B
                      </button>
                      <button
                        style={{ ...btnSecondary, fontSize: '12px', padding: '4px 10px' }}
                        onClick={() => handleKeepBoth(idx)}
                      >
                        Keep Both
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

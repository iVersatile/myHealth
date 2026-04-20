'use client'

import { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { useAuth } from '../../../hooks/useAuth'

type Theme = 'light' | 'dark' | 'system'

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

export default function SettingsPage() {
  const { lock } = useAuth()

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

  useEffect(() => {
    async function loadSettings() {
      const [t, al, dir] = await Promise.all([
        invoke<string | null>('settings_get', { key: 'theme' }),
        invoke<string | null>('settings_get', { key: 'auto_lock_minutes' }),
        invoke<string>('settings_get_data_dir'),
      ])
      if (t === 'light' || t === 'dark' || t === 'system') setTheme(t)
      if (al) setAutoLock(al)
      setDataDir(dir)
    }
    void loadSettings()
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
      </div>
    </div>
  )
}

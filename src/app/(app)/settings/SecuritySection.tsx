'use client'

import { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { AUTO_LOCK_OPTIONS, Field, SectionTitle, btnPrimary, inputStyle, sectionStyle } from './settingsShared'

export function SecuritySection() {
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwMsg, setPwMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [pwBusy, setPwBusy] = useState(false)
  const [autoLock, setAutoLock] = useState('15')

  useEffect(() => {
    async function load() {
      const al = await invoke<string | null>('settings_get', { key: 'auto_lock_minutes' })
      if (al) setAutoLock(al)
    }
    void load()
  }, [])

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

  async function handleAutoLockChange(val: string) {
    setAutoLock(val)
    await invoke('settings_set', { key: 'auto_lock_minutes', value: val })
  }

  return (
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
  )
}

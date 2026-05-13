'use client'

import { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { Field, SectionTitle, btnPrimary, btnSecondary, inputStyle, sectionStyle } from './settingsShared'

export function OutlookSection() {
  const isWindows = typeof navigator !== 'undefined' && navigator.userAgent.includes('Windows')
  const [outlookConnected, setOutlookConnected] = useState(false)
  const [outlookBusy, setOutlookBusy] = useState(false)
  const [outlookMsg, setOutlookMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [outlookCodeVerifier, setOutlookCodeVerifier] = useState('')
  const [outlookAuthStep, setOutlookAuthStep] = useState<'idle' | 'awaiting_code'>('idle')
  const [outlookCode, setOutlookCode] = useState('')

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

  if (!isWindows) return null

  return (
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
  )
}

'use client'

import { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { save, open } from '@tauri-apps/plugin-dialog'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../../hooks/useAuth'
import { Field, SectionTitle, btnDanger, btnPrimary, btnSecondary, sectionStyle } from './settingsShared'
import { extractTauriError } from '@/lib/ipc'

export function DataSection() {
  const { lock } = useAuth()
  const router = useRouter()
  const [dataDir, setDataDir] = useState('')
  const [wipeConfirm, setWipeConfirm] = useState(false)
  const [wipeBusy, setWipeBusy] = useState(false)
  const [resetConfirm, setResetConfirm] = useState(false)
  const [resetBusy, setResetBusy] = useState(false)
  const [backupBusy, setBackupBusy] = useState(false)
  const [backupMsg, setBackupMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [importConfirm, setImportConfirm] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const dir = await invoke<string>('settings_get_data_dir')
      setDataDir(dir)
    }
    void load()
  }, [])

  async function handleWipe() {
    if (!wipeConfirm) {
      setWipeConfirm(true)
      return
    }
    setWipeBusy(true)
    try {
      await invoke('settings_wipe_all_data')
      await lock()
    } catch {
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
    } catch {
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
      setBackupMsg({ text: extractTauriError(err), ok: false })
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
      setBackupMsg({ text: extractTauriError(err), ok: false })
      setBackupBusy(false)
    }
  }

  return (
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
  )
}

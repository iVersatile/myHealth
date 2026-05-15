'use client'

import { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { type CalendarSourceRow, type CalendarEventDto, type ConflictPair, btnPrimary, btnSecondary, sectionStyle } from './settingsShared'
import { extractTauriError } from '@/lib/ipc'

export function CalendarSyncSection() {
  const [calendars, setCalendars] = useState<CalendarSourceRow[]>([])
  const [calendarsLoading, setCalendarsLoading] = useState(true)
  const [calendarsError, setCalendarsError] = useState<string | null>(null)
  const [syncBusy, setSyncBusy] = useState(false)
  const [syncMsg, setSyncMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [conflicts, setConflicts] = useState<ConflictPair[]>([])
  const [conflictsLoading, setConflictsLoading] = useState(false)
  const [showConflicts, setShowConflicts] = useState(false)

  useEffect(() => {
    async function loadCalendars() {
      setCalendarsLoading(true)
      setCalendarsError(null)
      try {
        const sources = await invoke<CalendarSourceRow[]>('calendar_list_sources')
        setCalendars(sources)
      } catch (err) {
        setCalendarsError(extractTauriError(err))
      } finally {
        setCalendarsLoading(false)
      }
    }
    void loadCalendars()
  }, [])

  async function handleCalendarToggle(id: string, enabled: boolean) {
    try {
      await invoke('calendar_toggle_source', { id, enabled })
      setCalendars(prev =>
        prev.map(cal => (cal.id === id ? { ...cal, enabled } : cal))
      )
    } catch (err) {
      setSyncMsg({ text: extractTauriError(err), ok: false })
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
      setSyncMsg({ text: extractTauriError(err), ok: false })
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
      setSyncMsg({ text: extractTauriError(err), ok: false })
    } finally {
      setConflictsLoading(false)
    }
  }

  async function handleKeepEvent(deleteId: string, pairIndex: number) {
    try {
      await invoke('calendar_event_delete', { id: deleteId })
      setConflicts(prev => prev.filter((_, i) => i !== pairIndex))
    } catch (err) {
      setSyncMsg({ text: extractTauriError(err), ok: false })
    }
  }

  function handleKeepBoth(pairIndex: number) {
    setConflicts(prev => prev.filter((_, i) => i !== pairIndex))
  }

  return (
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
                <div
                  style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    background: cal.color_hex || 'var(--color-text-muted)',
                    flexShrink: 0,
                  }}
                />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text)', margin: 0, fontWeight: 500 }}>
                    {cal.name}
                  </p>
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', margin: '4px 0 0 0' }}>
                    {cal.last_synced_at ? `Last synced: ${new Date(cal.last_synced_at).toLocaleString()}` : 'Never synced'}
                  </p>
                </div>

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
                    {([pair.event_a, pair.event_b] as [CalendarEventDto, CalendarEventDto]).map((ev, evIdx) => (
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
  )
}

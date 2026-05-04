'use client'

import { useCallback, useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'

interface TrashItem {
  entity_type: string
  id: string
  display_name: string
  deleted_at: string | null
}

type EntityType = 'clinic' | 'contact' | 'appointment' | 'note' | 'document'

const GROUP_LABELS: Record<EntityType, string> = {
  document: 'Documents',
  appointment: 'Appointments',
  note: 'Notes',
  contact: 'Contacts',
  clinic: 'Clinics',
}

const GROUP_ORDER: EntityType[] = ['document', 'appointment', 'note', 'contact', 'clinic']

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function groupItems(items: TrashItem[]): Map<EntityType, TrashItem[]> {
  const map = new Map<EntityType, TrashItem[]>()
  for (const item of items) {
    const key = item.entity_type as EntityType
    const existing = map.get(key) ?? []
    map.set(key, [...existing, item])
  }
  return map
}

export function TrashClient() {
  const [items, setItems] = useState<TrashItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [confirmEmpty, setConfirmEmpty] = useState(false)
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    try {
      const result = await invoke<TrashItem[]>('trash_list')
      setItems(result)
      setError(null)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function handleRestore(item: TrashItem) {
    setBusyIds((prev) => new Set(prev).add(item.id))
    try {
      await invoke('trash_restore', { entityType: item.entity_type, id: item.id })
      setItems((prev) => prev.filter((i) => !(i.id === item.id && i.entity_type === item.entity_type)))
    } catch (e) {
      setError(String(e))
    } finally {
      setBusyIds((prev) => {
        const next = new Set(prev)
        next.delete(item.id)
        return next
      })
    }
  }

  async function handleHardDelete(item: TrashItem) {
    setBusyIds((prev) => new Set(prev).add(item.id))
    try {
      await invoke('trash_hard_delete', { entityType: item.entity_type, id: item.id })
      setItems((prev) => prev.filter((i) => !(i.id === item.id && i.entity_type === item.entity_type)))
    } catch (e) {
      setError(String(e))
    } finally {
      setBusyIds((prev) => {
        const next = new Set(prev)
        next.delete(item.id)
        return next
      })
    }
  }

  async function handleEmptyTrash() {
    setConfirmEmpty(false)
    try {
      await invoke('trash_empty')
      setItems([])
    } catch (e) {
      setError(String(e))
    }
  }

  const grouped = groupItems(items)
  const isEmpty = items.length === 0

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-[var(--text-2xl)] font-semibold text-[var(--color-text)]">Trash</h1>
        {!isEmpty && (
          <button
            onClick={() => setConfirmEmpty(true)}
            className="px-4 py-2 rounded-[var(--radius-md)] border border-[var(--color-danger)] text-[var(--color-danger)] text-sm font-medium hover:bg-[var(--color-danger)]/10 transition-colors"
          >
            Empty Trash
          </button>
        )}
      </div>

      {error && <p className="mb-4 text-sm text-[var(--color-danger)]">{error}</p>}

      {confirmEmpty && (
        <div className="mb-6 p-4 rounded-[var(--radius-md)] border border-[var(--color-danger)] bg-[var(--color-danger)]/5">
          <p className="text-sm text-[var(--color-text)] mb-3">
            Permanently delete all {items.length} item{items.length !== 1 ? 's' : ''} in Trash? This cannot be undone.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => void handleEmptyTrash()}
              className="px-3 py-1.5 rounded-[var(--radius-sm)] bg-[var(--color-danger)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Delete All
            </button>
            <button
              onClick={() => setConfirmEmpty(false)}
              className="px-3 py-1.5 rounded-[var(--radius-sm)] border border-[var(--color-border)] text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-raised)] transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading && (
        <p className="text-sm text-[var(--color-text-muted)]">Loading…</p>
      )}

      {!loading && isEmpty && (
        <div className="text-center py-16 text-[var(--color-text-muted)]">
          <p className="text-lg mb-2">Trash is empty</p>
          <p className="text-sm">Deleted items will appear here for 30 days.</p>
        </div>
      )}

      {GROUP_ORDER.map((entityType) => {
        const group = grouped.get(entityType)
        if (!group || group.length === 0) return null
        return (
          <section key={entityType} className="mb-6">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                {GROUP_LABELS[entityType]}
              </span>
              <div className="flex-1 h-px bg-[var(--color-border)]" />
            </div>
            <div className="flex flex-col gap-2">
              {group.map((item) => {
                const busy = busyIds.has(item.id)
                return (
                  <div
                    key={`${item.entity_type}-${item.id}`}
                    className="flex items-center justify-between gap-3 px-4 py-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)]"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[var(--color-text)] truncate">
                        {item.display_name || 'Untitled'}
                      </p>
                      <p className="text-xs text-[var(--color-text-muted)]">
                        Deleted {formatDate(item.deleted_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => void handleRestore(item)}
                        disabled={busy}
                        className="px-3 py-1.5 rounded-[var(--radius-sm)] border border-[var(--color-border)] text-xs font-medium text-[var(--color-text)] hover:bg-[var(--color-surface-raised)] disabled:opacity-50 transition-colors"
                      >
                        Restore
                      </button>
                      <button
                        onClick={() => void handleHardDelete(item)}
                        disabled={busy}
                        className="px-3 py-1.5 rounded-[var(--radius-sm)] border border-[var(--color-danger)] text-xs font-medium text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10 disabled:opacity-50 transition-colors"
                      >
                        Delete Permanently
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}

'use client'

import { useEffect, useRef, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
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
import { Field, SectionTitle, btnSecondary, inputStyle, sectionStyle } from './settingsShared'
import { SecuritySection } from './SecuritySection'
import { AppearanceSection } from './AppearanceSection'
import { DataSection } from './DataSection'
import { OutlookSection } from './OutlookSection'
import { CalendarSyncSection } from './CalendarSyncSection'

type Category = {
  id: string
  name: string
  color_hex: string
  is_system: boolean
  sort_order: number
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
      <span style={{ width: 12, height: 12, borderRadius: '50%', background: cat.color_hex, flexShrink: 0 }} />
      <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text)', flex: 1 }}>{cat.name}</span>
      {cat.is_system && (
        <span style={{ fontSize: 10, color: 'var(--color-text-muted)', background: 'var(--color-border)', borderRadius: 4, padding: '1px 5px' }}>
          system
        </span>
      )}
    </div>
  )
}

export default function SettingsPage() {
  const [autoArchive, setAutoArchive] = useState(false)
  const [archiveMonths, setArchiveMonths] = useState(12)
  const [archiveBusy, setArchiveBusy] = useState(false)
  const [archiveMsg, setArchiveMsg] = useState<{ text: string; ok: boolean } | null>(null)

  const [categories, setCategories] = useState<Category[]>([])
  const [archivedCategories, setArchivedCategories] = useState<Category[]>([])
  const [showArchivedCategories, setShowArchivedCategories] = useState(false)
  const reorderPending = useRef(false)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  useEffect(() => {
    async function loadSettings() {
      const [aa, am] = await Promise.all([
        invoke<string | null>('settings_get', { key: 'auto_archive_categories' }),
        invoke<string | null>('settings_get', { key: 'auto_archive_months' }),
      ])
      setAutoArchive(aa === 'true')
      if (am) setArchiveMonths(parseInt(am, 10) || 12)

      const cats = ((await invoke<Category[]>('categories_list')) ?? []) as Category[]
      setCategories(cats.slice().sort((a, b) => a.sort_order - b.sort_order))
    }
    void loadSettings()
  }, [])

  async function handleAutoArchiveToggle(checked: boolean) {
    setAutoArchive(checked)
    await invoke('settings_set', { key: 'auto_archive_categories', value: String(checked) })
  }

  async function handleArchiveMonthsChange(val: number) {
    const clamped = Math.max(1, Math.min(120, val))
    setArchiveMonths(clamped)
    await invoke('settings_set', { key: 'auto_archive_months', value: String(clamped) })
  }

  async function handleShowArchivedToggle(show: boolean) {
    setShowArchivedCategories(show)
    if (show && archivedCategories.length === 0) {
      const all = ((await invoke<Category[]>('categories_list', { includeArchived: true })) ?? []) as Category[]
      setArchivedCategories(all.filter(c => !categories.some(a => a.id === c.id)))
    }
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

  return (
    <div style={{ padding: 'var(--space-6)', maxWidth: 640 }}>
      <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: 'var(--color-text)', marginBottom: 'var(--space-6)' }}>
        Settings
      </h1>

      <SecuritySection />
      <AppearanceSection />
      <DataSection />

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

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
          <input
            type="checkbox"
            id="show-archived-cats"
            checked={showArchivedCategories}
            onChange={e => { void handleShowArchivedToggle(e.target.checked) }}
            style={{ cursor: 'pointer', accentColor: 'var(--color-primary)', width: 16, height: 16 }}
          />
          <label htmlFor="show-archived-cats" style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', cursor: 'pointer' }}>
            Show archived categories
          </label>
        </div>

        {showArchivedCategories && archivedCategories.length > 0 && (
          <div style={{ marginBottom: 'var(--space-4)' }}>
            {archivedCategories.map(cat => (
              <div key={cat.id} style={{
                display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
                padding: 'var(--space-2) var(--space-3)',
                background: 'var(--color-surface-sunken)', border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-2)',
                opacity: 0.5,
              }}>
                <span style={{ width: 12, height: 12, borderRadius: '50%', background: cat.color_hex, flexShrink: 0 }} />
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text)', flex: 1, textDecoration: 'line-through' }}>{cat.name}</span>
                <span style={{ fontSize: 10, color: 'var(--color-text-muted)', background: 'var(--color-border)', borderRadius: 4, padding: '1px 5px' }}>archived</span>
              </div>
            ))}
          </div>
        )}

        {showArchivedCategories && archivedCategories.length === 0 && (
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-3)' }}>
            No archived categories.
          </p>
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

        <button onClick={() => { void handleRunArchive() }} style={btnSecondary} disabled={archiveBusy}>
          {archiveBusy ? 'Archiving…' : 'Run Now'}
        </button>

        {archiveMsg && (
          <p style={{ fontSize: 'var(--text-sm)', color: archiveMsg.ok ? 'var(--color-success)' : 'var(--color-danger)', marginTop: 'var(--space-3)' }}>
            {archiveMsg.text}
          </p>
        )}
      </div>

      <OutlookSection />
      <CalendarSyncSection />
    </div>
  )
}

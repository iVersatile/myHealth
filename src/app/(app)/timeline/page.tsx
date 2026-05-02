'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { invoke } from '@tauri-apps/api/core'
import { useDocuments } from '../../../hooks/useDocuments'
import { useAppointments } from '../../../hooks/useAppointments'
import { useNotes } from '../../../hooks/useNotes'
import type { Document } from '../../../store/documentsStore'
import type { Appointment } from '../../../store/appointmentsStore'
import type { Note } from '../../../store/notesStore'

// ── Types ─────────────────────────────────────────────────────────────────────

type EventType = 'document' | 'appointment' | 'note'
type ViewMode = 'chronological' | 'by-category' | 'by-doctor'
type TypeFilter = 'all' | EventType

interface TimelineEvent {
  id: string
  type: EventType
  date: Date
  title: string
  subtitle: string | null
  badge: string
  href: string
  rawId: string
}

interface Category {
  id: string
  name: string
  color_hex: string
}

interface DocumentLink {
  id: string
  document_id: string
  appointment_id: string
}

// ── Converters ────────────────────────────────────────────────────────────────

function buildDocTitle(d: Document): string {
  const eventDate = (d.activity_date ?? d.created_at).slice(0, 10)
  const tags: string[] = d.tags ?? []

  const specialty = tags.find(
    (t) => t === t.toUpperCase() && t.length > 2 && /^[A-Z]/.test(t),
  )
  const provider = tags.find((t) => /^[A-Z]/.test(t) && /[a-z]/.test(t))

  if (specialty && provider) return `${eventDate} ${specialty} with ${provider}`
  if (specialty) return `${eventDate} ${specialty}`
  if (provider) return `${eventDate} DOCUMENT with ${provider}`
  return `${eventDate} DOCUMENT`
}

function docToEvent(d: Document): TimelineEvent {
  const ext = d.filename.split('.').pop()?.toUpperCase() ?? 'FILE'
  const badge = ext === 'PDF' ? 'PDF' : ['JPG', 'JPEG', 'PNG', 'WEBP'].includes(ext) ? 'IMG' : ext
  return {
    id: `doc-${d.id}`,
    rawId: d.id,
    type: 'document',
    date: new Date(d.activity_date ?? d.created_at),
    title: buildDocTitle(d),
    subtitle: d.category.charAt(0).toUpperCase() + d.category.slice(1),
    badge,
    href: `/documents/view?id=${d.id}`,
  }
}

function apptToEvent(a: Appointment): TimelineEvent {
  const parts = [a.doctor_name, a.clinic_name].filter(Boolean)
  return {
    id: `appt-${a.id}`,
    rawId: a.id,
    type: 'appointment',
    date: new Date(a.appt_date),
    title: `${a.title} — ${a.status.charAt(0).toUpperCase() + a.status.slice(1)}`,
    subtitle: parts.length > 0 ? parts.join(' · ') : null,
    badge: '🗓',
    href: `/appointments`,
  }
}

function noteToEvent(n: Note): TimelineEvent {
  return {
    id: `note-${n.id}`,
    rawId: n.id,
    type: 'note',
    date: new Date(n.created_at),
    title: n.title || 'Untitled note',
    subtitle: n.tags.length > 0 ? n.tags.join(', ') : null,
    badge: '📝',
    href: `/notes/view?id=${n.id}`,
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function monthLabel(key: string) {
  const [year, month] = key.split('-')
  return `${MONTH_NAMES[Number(month) - 1] ?? month} ${year}`
}

function formatDay(date: Date) {
  return `${date.getDate()} ${MONTH_NAMES[date.getMonth()]?.slice(0, 3) ?? ''}`
}

// ── TimelineItem ──────────────────────────────────────────────────────────────

function TimelineItem({
  event,
  highlighted = false,
  badgeColor,
}: {
  event: TimelineEvent
  highlighted?: boolean
  badgeColor?: string
}) {
  const typeColor: Record<EventType, string> = {
    document: 'var(--color-accent)',
    appointment: '#10b981',
    note: '#f59e0b',
  }

  const badgeStyle = badgeColor
    ? { backgroundColor: badgeColor + '28', color: badgeColor, border: `1px solid ${badgeColor}60` }
    : { backgroundColor: 'var(--color-tag-bg)', color: 'var(--color-tag-text)' }

  return (
    <Link href={event.href} data-testid="timeline-entry" className="flex gap-4 no-underline group">
      <div className="flex flex-col items-center">
        <div
          className="w-2 h-2 rounded-full mt-1.5 shrink-0"
          style={{ backgroundColor: typeColor[event.type] }}
        />
        <div className="w-px flex-1 bg-[var(--color-border)] mt-1" />
      </div>

      <div className={`pb-5 min-w-0 flex-1 rounded-md px-2 -mx-2 transition-colors ${highlighted ? 'bg-[var(--color-tag-bg)]' : 'group-hover:bg-[var(--color-tag-bg)]'}`}>
        <div className="flex items-start gap-3">
          <span className="text-xs text-[var(--color-text-muted)] w-14 shrink-0 mt-0.5">
            {formatDay(event.date)}
          </span>
          <span
            className="text-xs px-1.5 py-0.5 rounded font-mono shrink-0"
            style={badgeStyle}
          >
            {event.badge}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-[var(--color-text)] truncate group-hover:text-[var(--color-accent)]">
              {event.title}
            </p>
            {event.subtitle && (
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5 truncate">
                {event.subtitle}
              </p>
            )}
          </div>
          {highlighted && (
            <span className="ml-auto shrink-0 text-xs px-1.5 py-0.5 rounded bg-[var(--color-accent)] text-white font-medium">
              linked
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}

// ── GroupHeader ───────────────────────────────────────────────────────────────

function GroupHeader({
  label,
  color,
  count,
  categoryId,
  onColorChange,
}: {
  label: string
  color?: string
  count: number
  categoryId?: string
  onColorChange?: (id: string, color: string) => void
}) {
  return (
    <div className="flex items-center gap-3 mb-4">
      {color && (
        categoryId && onColorChange
          ? (
            <label
              className="w-3 h-3 rounded-full shrink-0 cursor-pointer ring-offset-1 hover:ring-2 hover:ring-[var(--color-accent)] transition-shadow relative"
              title="Click to change category color"
            >
              <span
                className="block w-3 h-3 rounded-full"
                style={{ backgroundColor: color }}
              />
              <input
                type="color"
                className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                value={color}
                onChange={(e) => onColorChange(categoryId, e.target.value)}
              />
            </label>
          )
          : (
            <span
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: color }}
            />
          )
      )}
      <span className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">
        {label}
      </span>
      <span className="text-xs text-[var(--color-text-muted)]">({count})</span>
      <div className="flex-1 h-px bg-[var(--color-border)]" />
    </div>
  )
}

// ── TimelinePage ──────────────────────────────────────────────────────────────

export default function TimelinePage() {
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('chronological')

  // Extra data for grouped views (lazy-loaded on first entry)
  const [categories, setCategories] = useState<Category[]>([])
  const [docCategoryMap, setDocCategoryMap] = useState<Map<string, string[]>>(new Map())
  const [apptCategoryMap, setApptCategoryMap] = useState<Map<string, string[]>>(new Map())
  // appointmentId -> documentIds linked to it
  const [apptLinkedDocIds, setApptLinkedDocIds] = useState<Map<string, string[]>>(new Map())
  // contactId -> contact name (for by-doctor grouping via linked contacts)
  const [contactNameMap, setContactNameMap] = useState<Map<string, string>>(new Map())
  const [extraLoading, setExtraLoading] = useState(false)

  async function handleCategoryColorChange(categoryId: string, newColor: string) {
    setCategories((prev) =>
      prev.map((c) => (c.id === categoryId ? { ...c, color_hex: newColor } : c))
    )
    try {
      await invoke('categories_update', { input: { id: categoryId, color_hex: newColor } })
    } catch {
      // revert on failure
      setCategories((prev) =>
        prev.map((c) => (c.id === categoryId ? { ...c, color_hex: c.color_hex } : c))
      )
    }
  }

  const { documents, loading: docsLoading } = useDocuments()
  const { appointments, loading: apptsLoading } = useAppointments()
  const { notes, loading: notesLoading } = useNotes()

  const loading = docsLoading || apptsLoading || notesLoading

  const activeDocs = useMemo(() => documents.filter((d) => !d.is_deleted), [documents])

  // Fetch extra data when entering a grouped view for the first time
  useEffect(() => {
    if (viewMode === 'chronological' || loading) return
    if (viewMode === 'by-category' && categories.length > 0) return
    if (viewMode === 'by-doctor' && apptLinkedDocIds.size > 0) return

    let cancelled = false

    async function fetchExtra() {
      setExtraLoading(true)
      if (viewMode === 'by-category') {
        const [cats, ...catResults] = await Promise.all([
          invoke<Category[]>('categories_list'),
          ...activeDocs.map((d) =>
            invoke<string[]>('categories_for_document', { documentId: d.id })
              .then((ids) => ({ id: d.id, ids }))
              .catch(() => ({ id: d.id, ids: [] as string[] }))
          ),
          ...appointments.map((a) =>
            invoke<string[]>('categories_for_appointment', { appointmentId: a.id })
              .then((ids) => ({ id: a.id, ids }))
              .catch(() => ({ id: a.id, ids: [] as string[] }))
          ),
        ])

        if (cancelled) return

        const docMap = new Map<string, string[]>()
        const apptMap = new Map<string, string[]>()
        const docCount = activeDocs.length
        catResults.forEach((r, i) => {
          const result = r as { id: string; ids: string[] }
          if (i < docCount) docMap.set(result.id, result.ids)
          else apptMap.set(result.id, result.ids)
        })

        setCategories(cats as Category[])
        setDocCategoryMap(docMap)
        setApptCategoryMap(apptMap)
      } else if (viewMode === 'by-doctor') {
        const [contacts, ...linkResults] = await Promise.all([
          invoke<Array<{ id: string; name: string; role: string }>>('contacts_list').catch(() => []),
          ...appointments.map((a) =>
            invoke<DocumentLink[]>('links_list_for_appointment', { appointmentId: a.id })
              .then((links) => ({ apptId: a.id, links }))
              .catch(() => ({ apptId: a.id, links: [] as DocumentLink[] }))
          ),
        ])

        if (cancelled) return

        const DOCTOR_ROLES = new Set(['gp', 'specialist', 'dentist', 'physio'])
        const nameMap = new Map<string, string>()
        for (const c of contacts as Array<{ id: string; name: string; role: string }>) {
          if (DOCTOR_ROLES.has(c.role)) nameMap.set(c.id, c.name)
        }
        setContactNameMap(nameMap)

        const linkMap = new Map<string, string[]>()
        for (const r of linkResults) {
          const { apptId, links } = r as { apptId: string; links: DocumentLink[] }
          linkMap.set(apptId, links.map((l) => l.document_id))
        }
        setApptLinkedDocIds(linkMap)
      }

      setExtraLoading(false)
    }

    fetchExtra().catch(() => setExtraLoading(false))
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, loading])

  const allEvents = useMemo<TimelineEvent[]>(() => {
    const events: TimelineEvent[] = [
      ...activeDocs.map(docToEvent),
      ...appointments.map(apptToEvent),
      ...notes.map(noteToEvent),
    ]
    return events.sort((a, b) => b.date.getTime() - a.date.getTime())
  }, [activeDocs, appointments, notes])

  const filtered = useMemo(() => {
    return allEvents.filter((e) => {
      if (typeFilter !== 'all' && e.type !== typeFilter) return false
      if (fromDate) {
        const from = new Date(fromDate)
        from.setHours(0, 0, 0, 0)
        if (e.date < from) return false
      }
      if (toDate) {
        const to = new Date(toDate)
        to.setHours(23, 59, 59, 999)
        if (e.date > to) return false
      }
      return true
    })
  }, [allEvents, typeFilter, fromDate, toDate])

  // Chronological grouping (by month)
  const chronoGroups = useMemo(() => {
    const map = new Map<string, TimelineEvent[]>()
    for (const e of filtered) {
      const key = monthKey(e.date)
      const bucket = map.get(key) ?? []
      bucket.push(e)
      map.set(key, bucket)
    }
    return Array.from(map.entries())
  }, [filtered])

  // By-category grouping
  const categoryGroups = useMemo(() => {
    if (viewMode !== 'by-category' || categories.length === 0) return []

    const groups: Array<{ category: Category; events: TimelineEvent[] }> = []
    const uncategorized: TimelineEvent[] = []

    for (const cat of categories) {
      const catEvents: TimelineEvent[] = []
      for (const e of filtered) {
        const catIds =
          e.type === 'document'
            ? (docCategoryMap.get(e.rawId) ?? [])
            : e.type === 'appointment'
              ? (apptCategoryMap.get(e.rawId) ?? [])
              : []
        if (catIds.includes(cat.id)) catEvents.push(e)
      }
      if (catEvents.length > 0) {
        catEvents.sort((a, b) => b.date.getTime() - a.date.getTime())
        groups.push({ category: cat, events: catEvents })
      }
    }

    for (const e of filtered) {
      if (e.type === 'note') { uncategorized.push(e); continue }
      const catIds =
        e.type === 'document'
          ? (docCategoryMap.get(e.rawId) ?? [])
          : (apptCategoryMap.get(e.rawId) ?? [])
      if (catIds.length === 0) uncategorized.push(e)
    }

    if (uncategorized.length > 0) {
      uncategorized.sort((a, b) => b.date.getTime() - a.date.getTime())
      groups.push({
        category: { id: '__none__', name: 'Uncategorized', color_hex: '#9ca3af' },
        events: uncategorized,
      })
    }

    return groups
  }, [viewMode, categories, filtered, docCategoryMap, apptCategoryMap])

  // By-doctor grouping
  const doctorGroups = useMemo(() => {
    if (viewMode !== 'by-doctor') return []

    const groups = new Map<string, { appts: TimelineEvent[]; docs: TimelineEvent[]; linkedDocIds: Set<string> }>()

    for (const e of filtered) {
      if (e.type !== 'appointment') continue
      const appt = appointments.find((a) => a.id === e.rawId)
      const linkedContactName = (appt?.contact_ids ?? [])
        .map((id) => contactNameMap.get(id))
        .find((name) => name != null)
      const doctorKey = linkedContactName ?? (appt?.doctor_name?.trim() || 'No doctor assigned')
      if (!groups.has(doctorKey)) {
        groups.set(doctorKey, { appts: [], docs: [], linkedDocIds: new Set() })
      }
      const g = groups.get(doctorKey)!
      g.appts.push(e)

      const linkedIds = apptLinkedDocIds.get(e.rawId) ?? []
      for (const docId of linkedIds) g.linkedDocIds.add(docId)
    }

    // Attach linked documents to each doctor group
    for (const [, g] of groups) {
      for (const docId of g.linkedDocIds) {
        const docEvent = filtered.find((e) => e.type === 'document' && e.rawId === docId)
        if (docEvent) g.docs.push(docEvent)
      }
      g.appts.sort((a, b) => b.date.getTime() - a.date.getTime())
      g.docs.sort((a, b) => b.date.getTime() - a.date.getTime())
    }

    // Documents not linked to any appointment go under "No doctor assigned"
    const assignedDocIds = new Set<string>()
    for (const [, g] of groups) {
      for (const id of g.linkedDocIds) assignedDocIds.add(id)
    }
    const unlinkedDocs = filtered.filter(
      (e) => e.type === 'document' && !assignedDocIds.has(e.rawId)
    )
    if (unlinkedDocs.length > 0) {
      if (!groups.has('No doctor assigned')) {
        groups.set('No doctor assigned', { appts: [], docs: [], linkedDocIds: new Set() })
      }
      for (const d of unlinkedDocs) groups.get('No doctor assigned')!.docs.push(d)
    }

    return Array.from(groups.entries())
      .filter(([, g]) => g.appts.length + g.docs.length > 0)
      .sort((a, b) => {
        if (a[0] === 'No doctor assigned') return 1
        if (b[0] === 'No doctor assigned') return -1
        return a[0].localeCompare(b[0])
      })
  }, [viewMode, filtered, appointments, apptLinkedDocIds, contactNameMap])

  // ── Render ──────────────────────────────────────────────────────────────────

  const typeChips: Array<{ value: TypeFilter; label: string }> = [
    { value: 'all', label: 'All' },
    { value: 'document', label: 'Documents' },
    { value: 'appointment', label: 'Appointments' },
    { value: 'note', label: 'Notes' },
  ]

  const viewTabs: Array<{ value: ViewMode; label: string }> = [
    { value: 'chronological', label: 'Chronological' },
    { value: 'by-category', label: 'By Category' },
    { value: 'by-doctor', label: 'By Doctor' },
  ]

  const chipCls = (active: boolean) =>
    `px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
      active
        ? 'bg-[var(--color-accent)] text-white border-[var(--color-accent)]'
        : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]'
    }`

  const tabCls = (active: boolean) =>
    `px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
      active
        ? 'border-[var(--color-accent)] text-[var(--color-accent)]'
        : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
    }`

  const inputCls =
    'px-3 py-1.5 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]'

  const isEmpty = viewMode === 'chronological'
    ? filtered.length === 0
    : viewMode === 'by-category'
      ? categoryGroups.length === 0
      : doctorGroups.length === 0

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <h1 className="text-[var(--text-2xl)] font-semibold text-[var(--color-text)] mb-6">
        Timeline
      </h1>

      {/* View mode tabs */}
      <div className="flex border-b border-[var(--color-border)] mb-6">
        {viewTabs.map(({ value, label }) => (
          <button key={value} onClick={() => setViewMode(value)} className={tabCls(viewMode === value)}>
            {label}
          </button>
        ))}
      </div>

      {/* Type filter + date range */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        {typeChips.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setTypeFilter(value)}
            className={chipCls(typeFilter === value)}
          >
            {label}
          </button>
        ))}

        <div className="flex items-center gap-2 ml-auto">
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className={inputCls}
            title="From date"
          />
          <span className="text-[var(--color-text-muted)] text-sm">→</span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className={inputCls}
            title="To date"
          />
          {(fromDate || toDate) && (
            <button
              onClick={() => { setFromDate(''); setToDate('') }}
              className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {(loading || extraLoading) && allEvents.length === 0 && (
        <p className="text-sm text-[var(--color-text-muted)]">Loading…</p>
      )}

      {!loading && !extraLoading && isEmpty && (
        <div className="text-center py-16 text-[var(--color-text-muted)]">
          <p className="text-lg mb-2">No events found</p>
          <p className="text-sm">
            {allEvents.length === 0
              ? 'Add documents, appointments, or notes to see your timeline.'
              : 'Try adjusting the filters or date range.'}
          </p>
        </div>
      )}

      {/* Chronological view */}
      {viewMode === 'chronological' && chronoGroups.map(([key, events]) => (
        <div key={key} className="mb-8">
          <GroupHeader label={monthLabel(key)} count={events.length} />
          <div>
            {events.map((event) => (
              <TimelineItem key={event.id} event={event} />
            ))}
          </div>
        </div>
      ))}

      {/* By Category view */}
      {viewMode === 'by-category' && (
        extraLoading
          ? <p className="text-sm text-[var(--color-text-muted)]">Loading categories…</p>
          : categoryGroups.map(({ category, events }) => (
              <div key={category.id} className="mb-8">
                <GroupHeader
                  label={category.name}
                  color={category.color_hex}
                  count={events.length}
                  categoryId={category.id !== '__none__' ? category.id : undefined}
                  onColorChange={category.id !== '__none__' ? handleCategoryColorChange : undefined}
                />
                <div>
                  {events.map((event) => (
                    <TimelineItem
                      key={event.id}
                      event={event}
                      badgeColor={category.id !== '__none__' ? category.color_hex : undefined}
                    />
                  ))}
                </div>
              </div>
            ))
      )}

      {/* By Doctor view */}
      {viewMode === 'by-doctor' && (
        extraLoading
          ? <p className="text-sm text-[var(--color-text-muted)]">Loading links…</p>
          : doctorGroups.map(([doctorName, { appts, docs, linkedDocIds }]) => (
              <div key={doctorName} className="mb-8">
                <GroupHeader label={doctorName} count={appts.length + docs.length} />
                <div>
                  {appts.map((event) => (
                    <TimelineItem key={event.id} event={event} />
                  ))}
                  {docs.map((event) => (
                    <TimelineItem
                      key={event.id}
                      event={event}
                      highlighted={linkedDocIds.has(event.rawId)}
                    />
                  ))}
                </div>
              </div>
            ))
      )}
    </div>
  )
}

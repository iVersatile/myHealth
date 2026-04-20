'use client'

import { useState, useMemo } from 'react'
import { useDocuments } from '../../../hooks/useDocuments'
import { useAppointments } from '../../../hooks/useAppointments'
import { useNotes } from '../../../hooks/useNotes'
import type { Document } from '../../../store/documentsStore'
import type { Appointment } from '../../../store/appointmentsStore'
import type { Note } from '../../../store/notesStore'

// ── Types ─────────────────────────────────────────────────────────────────────

type EventType = 'document' | 'appointment' | 'note'

interface TimelineEvent {
  id: string
  type: EventType
  date: Date
  title: string
  subtitle: string | null
  badge: string
  href: string
}

// ── Converters ────────────────────────────────────────────────────────────────

function docToEvent(d: Document): TimelineEvent {
  const ext = d.filename.split('.').pop()?.toUpperCase() ?? 'FILE'
  const badge = ext === 'PDF' ? 'PDF' : ['JPG', 'JPEG', 'PNG', 'WEBP'].includes(ext) ? 'IMG' : ext
  return {
    id: `doc-${d.id}`,
    type: 'document',
    date: new Date(d.created_at),
    title: `${d.filename} uploaded`,
    subtitle: d.category.charAt(0).toUpperCase() + d.category.slice(1),
    badge,
    href: `/documents/view?id=${d.id}`,
  }
}

function apptToEvent(a: Appointment): TimelineEvent {
  const parts = [a.doctor_name, a.clinic_name].filter(Boolean)
  return {
    id: `appt-${a.id}`,
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

function TimelineItem({ event }: { event: TimelineEvent }) {
  const typeColor: Record<EventType, string> = {
    document: 'var(--color-accent)',
    appointment: '#10b981',
    note: '#f59e0b',
  }

  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <div
          className="w-2 h-2 rounded-full mt-1.5 shrink-0"
          style={{ backgroundColor: typeColor[event.type] }}
        />
        <div className="w-px flex-1 bg-[var(--color-border)] mt-1" />
      </div>

      <div className="pb-5 min-w-0 flex-1">
        <div className="flex items-start gap-3">
          <span className="text-xs text-[var(--color-text-muted)] w-14 shrink-0 mt-0.5">
            {formatDay(event.date)}
          </span>
          <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--color-tag-bg)] text-[var(--color-tag-text)] font-mono shrink-0">
            {event.badge}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-[var(--color-text)] truncate">
              {event.title}
            </p>
            {event.subtitle && (
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5 truncate">
                {event.subtitle}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── TimelinePage ──────────────────────────────────────────────────────────────

type TypeFilter = 'all' | EventType

export default function TimelinePage() {
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  const { documents, loading: docsLoading } = useDocuments()
  const { appointments, loading: apptsLoading } = useAppointments()
  const { notes, loading: notesLoading } = useNotes()

  const loading = docsLoading || apptsLoading || notesLoading

  const allEvents = useMemo<TimelineEvent[]>(() => {
    const events: TimelineEvent[] = [
      ...documents.filter((d) => !d.is_deleted).map(docToEvent),
      ...appointments.map(apptToEvent),
      ...notes.map(noteToEvent),
    ]
    return events.sort((a, b) => b.date.getTime() - a.date.getTime())
  }, [documents, appointments, notes])

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

  const grouped = useMemo(() => {
    const map = new Map<string, TimelineEvent[]>()
    for (const e of filtered) {
      const key = monthKey(e.date)
      const bucket = map.get(key) ?? []
      bucket.push(e)
      map.set(key, bucket)
    }
    return Array.from(map.entries())
  }, [filtered])

  const typeChips: Array<{ value: TypeFilter; label: string }> = [
    { value: 'all', label: 'All' },
    { value: 'document', label: 'Documents' },
    { value: 'appointment', label: 'Appointments' },
    { value: 'note', label: 'Notes' },
  ]

  const chipCls = (active: boolean) =>
    `px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
      active
        ? 'bg-[var(--color-accent)] text-white border-[var(--color-accent)]'
        : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]'
    }`

  const inputCls =
    'px-3 py-1.5 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]'

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <h1 className="text-[var(--text-2xl)] font-semibold text-[var(--color-text)] mb-6">
        Timeline
      </h1>

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

      {loading && allEvents.length === 0 && (
        <p className="text-sm text-[var(--color-text-muted)]">Loading…</p>
      )}

      {!loading && filtered.length === 0 && (
        <div className="text-center py-16 text-[var(--color-text-muted)]">
          <p className="text-lg mb-2">No events found</p>
          <p className="text-sm">
            {allEvents.length === 0
              ? 'Add documents, appointments, or notes to see your timeline.'
              : 'Try adjusting the filters or date range.'}
          </p>
        </div>
      )}

      {grouped.map(([key, events]) => (
        <div key={key} className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">
              {monthLabel(key)}
            </span>
            <div className="flex-1 h-px bg-[var(--color-border)]" />
          </div>

          <div>
            {events.map((event) => (
              <TimelineItem key={event.id} event={event} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

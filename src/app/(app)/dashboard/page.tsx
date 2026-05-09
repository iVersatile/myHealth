'use client'

import { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import Link from 'next/link'
import type { Appointment } from '../../../store/appointmentsStore'
import type { Document } from '../../../store/documentsStore'
import type { Note } from '../../../store/notesStore'
import { formatApptDate, docTypeLabel, formatBytes, stripHtml } from '../../../lib/formatting'
import { ENTITY_CONFIG } from '../../../lib/entities'

interface Stats {
  total_documents: number
  total_notes: number
  upcoming_appointments: number
}

interface StatsSummary {
  total_documents: number
  total_notes: number
  upcoming_appointments: number
}

function StatCard({ label, value, sub }: { label: string; value: number; sub: string }) {
  return (
    <div
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-5)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-1)' }}>
        {label}
      </p>
      <p style={{ fontSize: 'var(--text-3xl)', fontWeight: 700, color: 'var(--color-text)', lineHeight: 1 }}>
        {value}
      </p>
      <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: 'var(--space-1)' }}>
        {sub}
      </p>
    </div>
  )
}

function SectionHeading({ title, href, linkLabel }: { title: string; href?: string; linkLabel?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
      <h2 style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--color-text)' }}>{title}</h2>
      {href && linkLabel && (
        <Link
          href={href}
          style={{ fontSize: 'var(--text-sm)', color: 'var(--color-primary)', textDecoration: 'none' }}
        >
          {linkLabel}
        </Link>
      )}
    </div>
  )
}


export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>({ total_documents: 0, total_notes: 0, upcoming_appointments: 0 })
  const [nextAppt, setNextAppt] = useState<Appointment | null>(null)
  const [recentDocs, setRecentDocs] = useState<Document[]>([])
  const [pinnedNotes, setPinnedNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [statsData, docs, upcoming, notes] = await Promise.all([
          invoke<StatsSummary>('stats_summary'),
          invoke<Document[]>('documents_list', { category: null, page: 1, limit: 10 }),
          invoke<Appointment[]>('appointments_list_upcoming', { daysAhead: 365 }),
          invoke<Note[]>('notes_list'),
        ])

        setStats(statsData)
        setNextAppt(upcoming[0] ?? null)
        setRecentDocs(docs.slice(0, 3))
        setPinnedNotes(notes.filter(n => n.is_pinned))
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [])

  if (loading) {
    return (
      <div style={{ padding: 'var(--space-6)', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
        Loading…
      </div>
    )
  }

  return (
    <div style={{ padding: 'var(--space-6)', maxWidth: 900 }}>
      <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: 'var(--color-text)', marginBottom: 'var(--space-6)' }}>
        Dashboard
      </h1>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-4)', marginBottom: 'var(--space-8)' }}>
        <StatCard label="Documents" value={stats.total_documents} sub="total uploaded" />
        <StatCard label="Upcoming Appointments" value={stats.upcoming_appointments} sub="scheduled" />
        <StatCard label="Notes" value={stats.total_notes} sub="total notes" />
      </div>

      {/* Next Appointment */}
      <div style={{ marginBottom: 'var(--space-8)' }}>
        <SectionHeading title="Next Appointment" href="/appointments" linkLabel="View all" />
        {nextAppt ? (
          <div
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--space-4)',
              boxShadow: 'var(--shadow-sm)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <p style={{ fontWeight: 600, color: 'var(--color-text)', fontSize: 'var(--text-base)' }}>
                {nextAppt.title}
              </p>
              {nextAppt.doctor_name && (
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginTop: 'var(--space-1)' }}>
                  {nextAppt.doctor_name}{nextAppt.specialty ? ` · ${nextAppt.specialty}` : ''}
                </p>
              )}
              {nextAppt.location && (
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>{nextAppt.location}</p>
              )}
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--color-primary)' }}>
                {formatApptDate(nextAppt.appt_date)}
              </p>
              <Link
                href={`/appointments`}
                style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', textDecoration: 'none' }}
              >
                View →
              </Link>
            </div>
          </div>
        ) : (
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>No upcoming appointments.</p>
        )}
      </div>

      {/* Recent Documents */}
      <div style={{ marginBottom: 'var(--space-8)' }}>
        <SectionHeading title="Recent Documents" href="/documents" linkLabel="View all" />
        {recentDocs.length === 0 ? (
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>No documents yet.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-4)' }}>
            {recentDocs.map(doc => (
              <Link
                key={doc.id}
                href={`${ENTITY_CONFIG.document.route}?id=${doc.id}`}
                style={{ textDecoration: 'none' }}
              >
                <div
                  style={{
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    padding: 'var(--space-3)',
                    boxShadow: 'var(--shadow-sm)',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                    <span
                      style={{
                        fontSize: 'var(--text-xs)',
                        fontWeight: 600,
                        background: 'var(--color-primary)',
                        color: '#fff',
                        borderRadius: 'var(--radius-sm)',
                        padding: '2px 6px',
                      }}
                    >
                      {docTypeLabel(doc.mime_type)}
                    </span>
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                      {formatBytes(doc.file_size_bytes)}
                    </span>
                  </div>
                  <p
                    style={{
                      fontSize: 'var(--text-sm)',
                      color: 'var(--color-text)',
                      fontWeight: 500,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {doc.filename}
                  </p>
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: 'var(--space-1)' }}>
                    {doc.category}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Pinned Notes */}
      <div>
        <SectionHeading title="Pinned Notes" href="/notes" linkLabel="View all" />
        {pinnedNotes.length === 0 ? (
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>No pinned notes.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {pinnedNotes.map(note => (
              <Link key={note.id} href={`${ENTITY_CONFIG.note.route}?id=${note.id}`} style={{ textDecoration: 'none' }}>
                <div
                  style={{
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    padding: 'var(--space-3) var(--space-4)',
                    boxShadow: 'var(--shadow-sm)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: 'var(--space-4)',
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--color-text)' }}>
                      {note.title}
                    </p>
                    <p
                      style={{
                        fontSize: 'var(--text-xs)',
                        color: 'var(--color-text-muted)',
                        marginTop: 'var(--space-1)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {stripHtml(note.content).slice(0, 120)}
                    </p>
                  </div>
                  {note.tags.length > 0 && (
                    <div style={{ display: 'flex', gap: 'var(--space-1)', flexShrink: 0 }}>
                      {note.tags.slice(0, 2).map(tag => (
                        <span
                          key={tag}
                          style={{
                            fontSize: 'var(--text-xs)',
                            background: 'var(--color-surface-alt)',
                            color: 'var(--color-text-muted)',
                            borderRadius: 'var(--radius-sm)',
                            padding: '2px 6px',
                            border: '1px solid var(--color-border)',
                          }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

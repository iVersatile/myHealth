import { render } from '@testing-library/react'
import axe from 'axe-core'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) =>
    React.createElement('a', { href, className }, children),
}))

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../store/authStore', () => ({
  useAuthStore: (selector: (s: { setLocked: (v: boolean) => void }) => unknown) =>
    selector({ setLocked: vi.fn() }),
}))

// ── Helpers ───────────────────────────────────────────────────────────────────

async function expectNoViolations(container: HTMLElement) {
  const results = await axe.run(container)
  if (results.violations.length > 0) {
    const messages = results.violations
      .map((v) => `[${v.impact}] ${v.id}: ${v.description}\n  ${v.nodes.map((n) => n.html).join('\n  ')}`)
      .join('\n')
    throw new Error(`axe found ${results.violations.length} violation(s):\n${messages}`)
  }
  expect(results.violations).toHaveLength(0)
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Accessibility — axe-core (G-11)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('Sidebar has no axe violations', async () => {
    const { Sidebar } = await import('../components/layout/Sidebar')
    const { container } = render(React.createElement(Sidebar))
    await expectNoViolations(container)
  })

  it('DocumentCard has no axe violations', async () => {
    const { DocumentCard } = await import('../components/documents/DocumentCard')
    const doc = {
      id: 'doc-1',
      filename: 'blood-test.pdf',
      file_path: '/tmp/blood-test.pdf',
      mime_type: 'application/pdf',
      file_size_bytes: 204800,
      category: 'lab',
      thumbnail_path: null,
      notes: null,
      created_at: '2026-01-15T10:00:00Z',
      updated_at: '2026-01-15T10:00:00Z',
      is_deleted: false,
      document_date: '2026-01-15',
      activity_date: null,
      tags: [],
    }
    const { container } = render(React.createElement(DocumentCard, { document: doc, onDelete: vi.fn() }))
    await expectNoViolations(container)
  })

  it('AppointmentCard has no axe violations', async () => {
    const { AppointmentCard } = await import('../components/appointments/AppointmentCard')
    const appt = {
      id: 'appt-1',
      title: 'Annual checkup',
      doctor_name: 'Dr. Smith',
      clinic_name: 'City Clinic',
      specialty: 'General',
      appt_date: '2026-06-01T09:00:00Z',
      duration_min: 30,
      location: '123 Main St',
      notes: null,
      status: 'scheduled' as const,
      reminder_min: 60,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      document_ids: [],
      contact_ids: [],
      recurrence_series_id: null,
    }
    const { container } = render(
      React.createElement(AppointmentCard, { appointment: appt, onEdit: vi.fn(), onDelete: vi.fn() })
    )
    await expectNoViolations(container)
  })
})

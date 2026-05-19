export type Theme = 'light' | 'dark' | 'system'

export type CalendarSourceRow = {
  id: string
  external_id: string
  name: string
  color_hex: string | null
  enabled: boolean
  last_synced_at: string | null
}

export type CalendarEventDto = {
  id: string
  title: string
  start_at: string
  end_at: string | null
  location: string | null
  calendar_id: string
}

export type ConflictPair = {
  event_a: CalendarEventDto
  event_b: CalendarEventDto
  overlap_minutes: number
}

export const AUTO_LOCK_OPTIONS = [
  { label: '5 minutes', value: '5' },
  { label: '15 minutes', value: '15' },
  { label: '30 minutes', value: '30' },
  { label: '1 hour', value: '60' },
  { label: 'Never', value: '0' },
]

export const sectionStyle: React.CSSProperties = {
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-lg)',
  padding: 'var(--space-5)',
  marginBottom: 'var(--space-5)',
  boxShadow: 'var(--shadow-sm)',
}

export const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 'var(--text-sm)',
  fontWeight: 500,
  color: 'var(--color-text)',
  marginBottom: 'var(--space-1)',
}

export const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: 'var(--space-2) var(--space-3)',
  fontSize: 'var(--text-sm)',
  background: 'var(--color-surface-sunken)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-md)',
  color: 'var(--color-text)',
  outline: 'none',
  boxSizing: 'border-box',
}

export const btnPrimary: React.CSSProperties = {
  padding: 'var(--space-2) var(--space-4)',
  fontSize: 'var(--text-sm)',
  fontWeight: 600,
  background: 'var(--color-primary)',
  color: '#fff',
  border: 'none',
  borderRadius: 'var(--radius-md)',
  cursor: 'pointer',
}

export const btnDanger: React.CSSProperties = {
  padding: 'var(--space-2) var(--space-4)',
  fontSize: 'var(--text-sm)',
  fontWeight: 600,
  background: 'var(--color-danger)',
  color: '#fff',
  border: 'none',
  borderRadius: 'var(--radius-md)',
  cursor: 'pointer',
}

export const btnSecondary: React.CSSProperties = {
  padding: 'var(--space-2) var(--space-4)',
  fontSize: 'var(--text-sm)',
  fontWeight: 500,
  background: 'transparent',
  color: 'var(--color-text-muted)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-md)',
  cursor: 'pointer',
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--color-text)', marginBottom: 'var(--space-4)' }}>
      {children}
    </h2>
  )
}

export function Field({ label, id, children }: { label: string; id?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 'var(--space-3)' }}>
      <label htmlFor={id} style={labelStyle}>{label}</label>
      {children}
    </div>
  )
}

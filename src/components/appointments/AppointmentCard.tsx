import Link from 'next/link'
import { Appointment, STATUS_LABELS, AppointmentStatus } from '../../store/appointmentsStore'
import { ENTITY_CONFIG } from '../../lib/entities'

interface AppointmentCardProps {
  appointment: Appointment
  onDelete: (id: string) => void
}

const STATUS_COLORS: Record<AppointmentStatus, string> = {
  scheduled: 'bg-[var(--color-accent-muted)] text-[var(--color-accent)]',
  completed: 'bg-[var(--color-success-muted)] text-[var(--color-success)]',
  cancelled: 'bg-[var(--color-surface-sunken)] text-[var(--color-text-secondary)]',
  missed: 'bg-[var(--color-danger-muted)] text-[var(--color-danger)]',
}

function formatApptDate(iso: string): { date: string; time: string } {
  const d = new Date(iso)
  return {
    date: d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }),
    time: d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
  }
}

export function AppointmentCard({ appointment: appt, onDelete }: AppointmentCardProps) {
  const { time } = formatApptDate(appt.appt_date)
  const statusLabel = STATUS_LABELS[appt.status]
  const statusColor = STATUS_COLORS[appt.status]

  return (
    <article data-testid="appointment-card" className="flex items-start gap-4 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-4 shadow-[var(--shadow-sm)] transition-shadow duration-[var(--duration-fast)] hover:shadow-[var(--shadow-md)]">
      {/* Date block */}
      <div className="flex w-14 shrink-0 flex-col items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-surface-sunken)] py-2 text-center">
        <span className="text-[var(--text-xs)] font-medium uppercase tracking-wide text-[var(--color-text-secondary)]">
          {new Date(appt.appt_date).toLocaleDateString('en-GB', { month: 'short' })}
        </span>
        <span className="text-[var(--text-2xl)] font-bold leading-none text-[var(--color-text)]">
          {new Date(appt.appt_date).getDate()}
        </span>
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-[var(--text-base)] font-semibold text-[var(--color-text)]">
            {appt.title}
          </p>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[var(--text-xs)] font-medium ${statusColor}`}>
            {statusLabel}
          </span>
        </div>

        <p className="mt-0.5 text-[var(--text-sm)] text-[var(--color-text-secondary)]">
          {time}
          {appt.duration_min > 0 && ` · ${appt.duration_min} min`}
          {appt.doctor_name && ` · ${appt.doctor_name}`}
        </p>

        {appt.clinic_name && (
          <p className="mt-0.5 text-[var(--text-sm)] text-[var(--color-text-secondary)]">
            {appt.clinic_name}
            {appt.location && ` — ${appt.location}`}
          </p>
        )}

        {appt.document_ids.length > 0 && (
          <p className="mt-1 text-[var(--text-xs)] text-[var(--color-text-secondary)]">
            {appt.document_ids.length} linked document{appt.document_ids.length !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-2">
        <Link
          href={`${ENTITY_CONFIG.appointment.route}?id=${appt.id}`}
          className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-1 text-[var(--text-sm)] text-[var(--color-text)] transition-colors duration-[var(--duration-fast)] hover:bg-[var(--color-surface-sunken)]"
        >
          Open
        </Link>
        <button
          type="button"
          aria-label={`Delete ${appt.title}`}
          onClick={() => onDelete(appt.id)}
          className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-2 py-1 text-[var(--text-sm)] text-[var(--color-danger)] transition-colors duration-[var(--duration-fast)] hover:bg-[var(--color-surface-sunken)]"
        >
          ✕
        </button>
      </div>
    </article>
  )
}

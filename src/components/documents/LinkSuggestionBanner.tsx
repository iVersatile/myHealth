'use client'

interface Props {
  appointmentId: string
  appointmentTitle: string
  onConfirm: (appointmentId: string) => void
  onDismiss: () => void
}

export function LinkSuggestionBanner({
  appointmentId,
  appointmentTitle,
  onConfirm,
  onDismiss,
}: Props) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--color-primary)] bg-[var(--color-primary)]/10 px-4 py-3 text-sm">
      <span className="text-[var(--color-text)]">
        Link this document to <strong>{appointmentTitle}</strong>?
      </span>
      <div className="flex gap-2 shrink-0">
        <button
          type="button"
          onClick={() => onConfirm(appointmentId)}
          className="px-3 py-1 rounded-[var(--radius-sm)] bg-[var(--color-primary)] text-[var(--color-text-inverse)] text-xs font-medium hover:bg-[var(--color-primary-hover)] transition-colors"
        >
          Link
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="px-3 py-1 rounded-[var(--radius-sm)] border border-[var(--color-border)] text-[var(--color-text-muted)] text-xs hover:text-[var(--color-text)] transition-colors"
        >
          Dismiss
        </button>
      </div>
    </div>
  )
}

export interface AppointmentSuggestion {
  apptDate: string;
  title: string;
  doctorName: string | null;
  specialty: string | null;
}

interface Props {
  suggestion: AppointmentSuggestion;
  onConfirm: () => void;
  onDismiss: () => void;
  isLoading?: boolean;
}

export function ApptSuggestionBanner({ suggestion, onConfirm, onDismiss, isLoading }: Props) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
      <svg className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-blue-900">
          Appointment detected in this document
        </p>
        <p className="mt-0.5 text-sm text-blue-700">
          <span className="font-medium">{suggestion.title}</span>
          {' — '}
          {suggestion.apptDate}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          onClick={onConfirm}
          disabled={isLoading}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isLoading ? 'Creating…' : 'Create Appointment'}
        </button>
        <button
          onClick={onDismiss}
          disabled={isLoading}
          aria-label="Dismiss"
          className="rounded-md p-1.5 text-blue-400 hover:bg-blue-100 hover:text-blue-600 disabled:opacity-50"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  );
}

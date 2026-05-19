export interface ExtractedAddress {
  label: string | null
  line1: string
}

export interface ClinicSuggestion {
  name: string
  company_registration_number: string | null
  addresses: ExtractedAddress[]
  phone: string | null
  email: string | null
}

export interface ContactSuggestion {
  draft_id: string | null
  name: string
  title: string | null
  specialty: string | null
  clinic: string | null
  address: string | null
  phone: string | null
  email: string | null
}

export type FileQueueStatus = 'queued' | 'processing' | 'done' | 'error'

export interface FileQueueItem {
  path: string
  filename: string
  status: FileQueueStatus
  errorMessage?: string
}

export interface DuplicateCandidate {
  primary_contact_id: string
  contact: { id: string; name: string }
  similarity_score: number
  match_reason: string
}

export type ContactPhase =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'duplicate'; newId: string; match: DuplicateCandidate }
  | { kind: 'saved'; contactId: string }

export type ClinicPhase =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'saved' }
  | { kind: 'error'; message: string }
  | { kind: 'duplicate'; existingId: string }

export function buildTimelineDescription(
  activityDate: string | null,
  contact: ContactSuggestion | null,
): string {
  const date = activityDate?.slice(0, 10) ?? ''
  const specialty = contact?.specialty?.toUpperCase() ?? null
  const titlePart = contact?.title ? `${contact.title} ` : ''
  const providerName = contact ? `${titlePart}${contact.name}` : null
  if (specialty && providerName) return `${date} ${specialty} with ${providerName}`.trim()
  if (specialty) return `${date} ${specialty}`.trim()
  if (providerName) return `${date} DOCUMENT with ${providerName}`.trim()
  return date
}

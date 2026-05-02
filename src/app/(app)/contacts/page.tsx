'use client'

import { useRef, useState } from 'react'
import { confirm } from '@tauri-apps/plugin-dialog'
import { useContacts, ContactCreateInput, ContactUpdateInput, DuplicateCandidate } from '../../../hooks/useContacts'
import { Contact, CONTACT_ROLES, ROLE_LABELS, ContactRole } from '../../../store/contactsStore'
import { ContactForm } from '../../../components/contacts/ContactForm'

// ── CopyButton ────────────────────────────────────────────────────────────────

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <button
      onClick={() => void handleCopy()}
      title={`Copy ${label}`}
      className="text-xs px-2 py-0.5 rounded border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-accent)] hover:border-[var(--color-accent)] transition-colors"
    >
      {copied ? '✓' : label === 'phone' ? '📞' : '✉'} {value}
    </button>
  )
}

// ── ContactCard ───────────────────────────────────────────────────────────────

function ContactCard({
  contact,
  allContacts,
  onEdit,
  onDelete,
  onScrollTo,
  highlighted,
  cardRef,
}: {
  contact: Contact
  allContacts: Contact[]
  onEdit: (c: Contact) => void
  onDelete: (id: string) => void
  onScrollTo: (id: string) => void
  highlighted?: boolean
  cardRef?: (el: HTMLDivElement | null) => void
}) {
  const roleLabel = ROLE_LABELS[contact.role as ContactRole] ?? contact.role
  const linkedClinic = contact.contact_clinic_id
    ? allContacts.find((c) => c.id === contact.contact_clinic_id)
    : null

  return (
    <div
      ref={cardRef}
      className={`p-4 rounded-[var(--radius-md)] border bg-[var(--color-surface)] transition-colors duration-700 ${highlighted ? 'border-[var(--color-accent)]' : 'border-[var(--color-border)]'}`}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <div>
          <span className="font-medium text-[var(--color-text)]">{contact.name}</span>
          {contact.specialty && (
            <span className="ml-2 text-sm text-[var(--color-text-muted)]">{contact.specialty}</span>
          )}
        </div>
        <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--color-tag-bg)] text-[var(--color-tag-text)] shrink-0">
          {roleLabel}
        </span>
      </div>

      {linkedClinic && (
        <button
          type="button"
          onClick={() => onScrollTo(linkedClinic.id)}
          className="flex items-center gap-1 text-xs text-[var(--color-tag-text)] bg-[var(--color-tag-bg)] rounded px-2 py-0.5 w-fit mb-2 hover:opacity-80 transition-opacity cursor-pointer"
          title={`Go to ${linkedClinic.name}`}
        >
          <span>🏥</span>
          <span>{linkedClinic.name}</span>
          <span className="opacity-60">↗</span>
        </button>
      )}

      {!linkedClinic && contact.clinic && (
        <p className="text-sm text-[var(--color-text-muted)] mb-2">{contact.clinic}</p>
      )}

      <div className="flex flex-wrap gap-2 mb-3">
        {contact.phone && <CopyButton value={contact.phone} label="phone" />}
        {contact.email && <CopyButton value={contact.email} label="email" />}
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => onEdit(contact)}
          className="text-xs px-3 py-1 rounded border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-text-muted)] transition-colors"
        >
          Edit
        </button>
        <button
          onClick={() => onDelete(contact.id)}
          className="text-xs px-3 py-1 rounded border border-[var(--color-border)] text-[var(--color-danger)] hover:bg-[var(--color-danger)] hover:text-white transition-colors"
        >
          Delete
        </button>
      </div>
    </div>
  )
}

// ── DuplicateContactMini ──────────────────────────────────────────────────────

function DuplicateContactMini({ contact, label }: { contact: Contact; label: string }) {
  const roleLabel = ROLE_LABELS[contact.role as ContactRole] ?? contact.role
  return (
    <div className="flex-1 min-w-0 p-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)]">
      <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-2">{label}</p>
      <p className="font-medium text-[var(--color-text)] truncate">{contact.name}</p>
      <p className="text-xs text-[var(--color-text-muted)] mb-1">{roleLabel}{contact.specialty ? ` · ${contact.specialty}` : ''}</p>
      {contact.clinic && <p className="text-xs text-[var(--color-text-muted)] truncate">{contact.clinic}</p>}
      {contact.phone && <p className="text-xs text-[var(--color-text-muted)]">📞 {contact.phone}</p>}
      {contact.email && <p className="text-xs text-[var(--color-text-muted)] truncate">✉ {contact.email}</p>}
    </div>
  )
}

// ── DuplicateGroupCard ────────────────────────────────────────────────────────

interface DuplicateGroupCardProps {
  primary: Contact
  candidate: DuplicateCandidate
  onMerge: (primaryId: string, duplicateId: string) => Promise<void>
  onKeepBoth: (duplicateId: string) => void
}

function DuplicateGroupCard({ primary, candidate, onMerge, onKeepBoth }: DuplicateGroupCardProps) {
  const [merging, setMerging] = useState(false)
  const pct = Math.round(candidate.similarity_score * 100)

  async function handleMerge() {
    setMerging(true)
    try {
      await onMerge(primary.id, candidate.contact.id)
    } finally {
      setMerging(false)
    }
  }

  return (
    <div className="p-4 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--color-tag-bg)] text-[var(--color-tag-text)] font-medium">
          {pct}% match
        </span>
        <span className="text-xs text-[var(--color-text-muted)]">{candidate.match_reason}</span>
      </div>

      <div className="flex gap-3 mb-4">
        <DuplicateContactMini contact={primary} label="Keep (primary)" />
        <DuplicateContactMini contact={candidate.contact} label="Duplicate" />
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => void handleMerge()}
          disabled={merging}
          className="flex-1 px-3 py-1.5 rounded-[var(--radius-md)] bg-[var(--color-accent)] text-white text-xs font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {merging ? 'Merging…' : 'Merge into primary'}
        </button>
        <button
          onClick={() => onKeepBoth(candidate.contact.id)}
          className="px-3 py-1.5 rounded-[var(--radius-md)] border border-[var(--color-border)] text-xs text-[var(--color-text-muted)] hover:border-[var(--color-text-muted)] transition-colors"
        >
          Keep both
        </button>
      </div>
    </div>
  )
}

// ── ContactsPage ──────────────────────────────────────────────────────────────

type RoleFilter = 'all' | ContactRole

export default function ContactsPage() {
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all')
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Contact | null>(null)
  const [duplicates, setDuplicates] = useState<DuplicateCandidate[]>([])
  const [scanning, setScanning] = useState(false)
  const [showDuplicates, setShowDuplicates] = useState(false)
  const [dupError, setDupError] = useState<string | null>(null)
  const [highlightedId, setHighlightedId] = useState<string | null>(null)
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  const { contacts, loading, error, createContact, updateContact, deleteContact, findDuplicateContacts, mergeContacts } =
    useContacts(roleFilter === 'all' ? undefined : roleFilter)

  const filtered = contacts.filter((c) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      c.name.toLowerCase().includes(q) ||
      (c.specialty ?? '').toLowerCase().includes(q) ||
      (c.clinic ?? '').toLowerCase().includes(q)
    )
  })

  async function handleSave(data: ContactCreateInput | ContactUpdateInput) {
    if ('id' in data && data.id) {
      await updateContact(data as ContactUpdateInput)
    } else {
      await createContact(data as ContactCreateInput)
    }
    setShowForm(false)
    setEditing(null)
  }

  function openEdit(c: Contact) {
    setEditing(c)
    setShowForm(true)
  }

  function openNew() {
    setEditing(null)
    setShowForm(true)
  }

  async function handleDelete(id: string) {
    if (!await confirm('Delete this contact?')) return
    await deleteContact(id)
  }

  function scrollToContact(id: string) {
    setRoleFilter('all')
    setSearch('')
    setHighlightedId(id)
    setTimeout(() => {
      cardRefs.current.get(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setTimeout(() => setHighlightedId(null), 1500)
    }, 50)
  }

  async function handleFindDuplicates() {
    setScanning(true)
    setDupError(null)
    try {
      const results = await findDuplicateContacts()
      setDuplicates(results)
      setShowDuplicates(true)
    } catch (err: unknown) {
      setDupError(err instanceof Error ? err.message : String(err))
    } finally {
      setScanning(false)
    }
  }

  async function handleMerge(primaryId: string, duplicateId: string) {
    await mergeContacts(primaryId, [duplicateId])
    setDuplicates((prev) => prev.filter((d) => d.contact.id !== duplicateId))
  }

  function handleKeepBoth(duplicateId: string) {
    setDuplicates((prev) => prev.filter((d) => d.contact.id !== duplicateId))
  }

  const chips: Array<{ value: RoleFilter; label: string }> = [
    { value: 'all', label: 'All' },
    ...CONTACT_ROLES.map((r) => ({ value: r as RoleFilter, label: ROLE_LABELS[r] })),
  ]

  // Build a lookup map for primary contacts
  const contactById = new Map(contacts.map((c) => [c.id, c]))

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-[var(--text-2xl)] font-semibold text-[var(--color-text)]">Contacts</h1>
        <div className="flex gap-2">
          {showDuplicates ? (
            <button
              onClick={() => setShowDuplicates(false)}
              className="px-4 py-2 rounded-[var(--radius-md)] border border-[var(--color-border)] text-sm text-[var(--color-text-muted)] hover:border-[var(--color-text-muted)] transition-colors"
            >
              ← Back
            </button>
          ) : (
            <button
              onClick={() => void handleFindDuplicates()}
              disabled={scanning}
              className="px-4 py-2 rounded-[var(--radius-md)] border border-[var(--color-border)] text-sm text-[var(--color-text-muted)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] disabled:opacity-50 transition-colors"
            >
              {scanning ? 'Scanning…' : 'Find Duplicates'}
            </button>
          )}
          {!showDuplicates && (
            <button
              onClick={openNew}
              className="px-4 py-2 rounded-[var(--radius-md)] bg-[var(--color-accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
            >
              + New
            </button>
          )}
        </div>
      </div>

      {dupError && <p className="mb-4 text-sm text-[var(--color-danger)]">{dupError}</p>}

      {showDuplicates ? (
        <div>
          <p className="text-sm text-[var(--color-text-muted)] mb-4">
            {duplicates.length === 0
              ? 'No duplicates found — your contacts look clean.'
              : `${duplicates.length} possible duplicate${duplicates.length === 1 ? '' : 's'} found. Review each pair below.`}
          </p>
          <div className="flex flex-col gap-4">
            {duplicates.map((d) => {
              const primary = contactById.get(d.primary_contact_id)
              if (!primary) return null
              return (
                <DuplicateGroupCard
                  key={`${d.primary_contact_id}-${d.contact.id}`}
                  primary={primary}
                  candidate={d}
                  onMerge={handleMerge}
                  onKeepBoth={handleKeepBoth}
                />
              )
            })}
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2 mb-4">
            {chips.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setRoleFilter(value)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  roleFilter === value
                    ? 'bg-[var(--color-accent)] text-white border-[var(--color-accent)]'
                    : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="mb-5">
            <input
              type="search"
              placeholder="Search contacts…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3 py-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]"
            />
          </div>

          {error && <p className="mb-4 text-sm text-[var(--color-danger)]">{error}</p>}

          {loading && contacts.length === 0 && (
            <p className="text-sm text-[var(--color-text-muted)]">Loading…</p>
          )}

          {!loading && filtered.length === 0 && (
            <div className="text-center py-16 text-[var(--color-text-muted)]">
              <p className="text-lg mb-2">No contacts found</p>
              <p className="text-sm">
                {contacts.length === 0
                  ? 'Add your first contact to get started.'
                  : 'Try a different filter or search.'}
              </p>
            </div>
          )}

          <div className="flex flex-col gap-3">
            {filtered.map((c) => (
              <ContactCard
                key={c.id}
                contact={c}
                allContacts={contacts}
                onEdit={openEdit}
                onDelete={(id) => void handleDelete(id)}
                onScrollTo={scrollToContact}
                highlighted={highlightedId === c.id}
                cardRef={(el) => {
                  if (el) cardRefs.current.set(c.id, el)
                  else cardRefs.current.delete(c.id)
                }}
              />
            ))}
          </div>
        </>
      )}

      {showForm && (
        <ContactForm
          initial={editing}
          onSave={(data) => handleSave(data)}
          onCancel={() => {
            setShowForm(false)
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}

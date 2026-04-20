'use client'

import { useState } from 'react'
import { useContacts, ContactCreateInput, ContactUpdateInput } from '../../../hooks/useContacts'
import { Contact, CONTACT_ROLES, ROLE_LABELS, ContactRole } from '../../../store/contactsStore'

// ── ContactCard ───────────────────────────────────────────────────────────────

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

function ContactCard({
  contact,
  onEdit,
  onDelete,
}: {
  contact: Contact
  onEdit: (c: Contact) => void
  onDelete: (id: string) => void
}) {
  const roleLabel = ROLE_LABELS[contact.role as ContactRole] ?? contact.role

  return (
    <div className="p-4 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)]">
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

      {contact.clinic && (
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

// ── ContactForm ───────────────────────────────────────────────────────────────

interface ContactFormProps {
  initial?: Contact | null
  onSave: (data: ContactCreateInput | ContactUpdateInput) => Promise<void>
  onCancel: () => void
}

function ContactForm({ initial, onSave, onCancel }: ContactFormProps) {
  const [name, setName] = useState(initial?.name ?? '')
  const [role, setRole] = useState(initial?.role ?? 'gp')
  const [specialty, setSpecialty] = useState(initial?.specialty ?? '')
  const [phone, setPhone] = useState(initial?.phone ?? '')
  const [email, setEmail] = useState(initial?.email ?? '')
  const [clinic, setClinic] = useState(initial?.clinic ?? '')
  const [address, setAddress] = useState(initial?.address ?? '')
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setErr('Name is required'); return }
    setSaving(true)
    setErr(null)
    try {
      const payload = {
        ...(initial ? { id: initial.id } : {}),
        name: name.trim(),
        role,
        specialty: specialty.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
        clinic: clinic.trim() || null,
        address: address.trim() || null,
        notes: notes.trim() || null,
      }
      await onSave(payload as ContactCreateInput | ContactUpdateInput)
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  const fieldCls =
    'w-full px-3 py-2 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]'
  const labelCls = 'block text-xs font-medium text-[var(--color-text-muted)] mb-1'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="w-full max-w-md bg-[var(--color-bg)] rounded-[var(--radius-lg)] border border-[var(--color-border)] p-6 shadow-xl mx-4"
      >
        <h2 className="text-lg font-semibold text-[var(--color-text)] mb-4">
          {initial ? 'Edit Contact' : 'New Contact'}
        </h2>

        {err && <p className="mb-3 text-sm text-[var(--color-danger)]">{err}</p>}

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="col-span-2">
            <label className={labelCls}>Name *</label>
            <input className={fieldCls} value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div>
            <label className={labelCls}>Role *</label>
            <select className={fieldCls} value={role} onChange={(e) => setRole(e.target.value)}>
              {CONTACT_ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelCls}>Specialty</label>
            <input className={fieldCls} value={specialty} onChange={(e) => setSpecialty(e.target.value)} />
          </div>

          <div>
            <label className={labelCls}>Phone</label>
            <input className={fieldCls} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>

          <div>
            <label className={labelCls}>Email</label>
            <input className={fieldCls} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>

          <div className="col-span-2">
            <label className={labelCls}>Clinic / Hospital</label>
            <input className={fieldCls} value={clinic} onChange={(e) => setClinic(e.target.value)} />
          </div>

          <div className="col-span-2">
            <label className={labelCls}>Address</label>
            <input className={fieldCls} value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>

          <div className="col-span-2">
            <label className={labelCls}>Notes</label>
            <textarea
              className={`${fieldCls} resize-none`}
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm rounded-[var(--radius-md)] border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--color-accent)] text-white font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
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

  const { contacts, loading, error, createContact, updateContact, deleteContact } = useContacts(
    roleFilter === 'all' ? undefined : roleFilter,
  )

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
    if (!confirm('Delete this contact?')) return
    await deleteContact(id)
  }

  const chips: Array<{ value: RoleFilter; label: string }> = [
    { value: 'all', label: 'All' },
    ...CONTACT_ROLES.map((r) => ({ value: r as RoleFilter, label: ROLE_LABELS[r] })),
  ]

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-[var(--text-2xl)] font-semibold text-[var(--color-text)]">Contacts</h1>
        <button
          onClick={openNew}
          className="px-4 py-2 rounded-[var(--radius-md)] bg-[var(--color-accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
        >
          + New
        </button>
      </div>

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
            onEdit={openEdit}
            onDelete={(id) => void handleDelete(id)}
          />
        ))}
      </div>

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

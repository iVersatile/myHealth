'use client'

import { useState } from 'react'
import { Contact, CONTACT_ROLES, ROLE_LABELS } from '../../store/contactsStore'
import type { ContactCreateInput, ContactUpdateInput } from '../../hooks/useContacts'
import { extractTauriError } from '../../lib/ipc'

export interface ContactFormProps {
  initial?: Contact | null
  onSave: (data: ContactCreateInput | ContactUpdateInput) => Promise<void>
  onCancel: () => void
}

export function ContactForm({ initial, onSave, onCancel }: ContactFormProps) {
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
      setErr(extractTauriError(e))
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

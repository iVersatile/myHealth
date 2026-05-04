'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { invoke } from '@tauri-apps/api/core'
import { AddressList, type Address } from '@/components/shared/AddressList'

interface Clinic {
  id: string
  name: string
  address: string | null
  phone: string | null
  company_registration_number: string | null
  created_at: string
}

interface LinkedContact {
  id: string
  name: string
  role: string | null
  specialty: string | null
  phone: string | null
}

interface LinkedDocument {
  id: string
  filename: string
  category: string | null
  document_date: string | null
}

export function ClinicEditClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const id = searchParams.get('id') ?? ''

  const [clinic, setClinic] = useState<Clinic | null>(null)
  const [loading, setLoading] = useState(() => !!id)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [crn, setCrn] = useState('')

  const [linkedContacts, setLinkedContacts] = useState<LinkedContact[]>([])
  const [linkedDocuments, setLinkedDocuments] = useState<LinkedDocument[]>([])
  const [addresses, setAddresses] = useState<Address[]>([])

  useEffect(() => {
    if (!id) {
      return
    }
    invoke<Clinic>('clinics_get', { id })
      .then((c) => {
        setClinic(c)
        setName(c.name)
        setAddress(c.address ?? '')
        setPhone(c.phone ?? '')
        setCrn(c.company_registration_number ?? '')
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load clinic')
      })
      .finally(() => setLoading(false))

    invoke<LinkedContact[]>('clinics_get_linked_contacts', { clinicId: id })
      .then(setLinkedContacts)
      .catch(() => {})

    invoke<LinkedDocument[]>('clinics_get_linked_documents', { clinicId: id })
      .then(setLinkedDocuments)
      .catch(() => {})

    invoke<Address[]>('clinic_addresses_list', { clinicId: id })
      .then(setAddresses)
      .catch(() => {})
  }, [id])

  function reloadAddresses() {
    invoke<Address[]>('clinic_addresses_list', { clinicId: id })
      .then(setAddresses)
      .catch(() => {})
  }

  async function handleSave() {
    if (!clinic) return
    setSaving(true)
    setSaveError(null)
    try {
      await invoke('clinics_update', {
        input: {
          id: clinic.id,
          name: name.trim() || null,
          address: address.trim() || null,
          phone: phone.trim() || null,
          company_registration_number: crn.trim() || null,
        },
      })
      router.push('/clinics')
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save clinic')
    } finally {
      setSaving(false)
    }
  }

  if (!id) {
    return (
      <div>
        <p className="text-red-500 text-sm mb-4">No clinic ID specified.</p>
        <button
          onClick={() => router.push('/clinics')}
          className="text-sm text-[var(--color-accent)] hover:opacity-80"
        >
          ← Back to Clinics
        </button>
      </div>
    )
  }

  if (loading) return <p className="text-[var(--color-text-muted)] text-sm">Loading…</p>

  if (error) {
    return (
      <div>
        <p className="text-red-500 text-sm mb-4">{error}</p>
        <button
          onClick={() => router.push('/clinics')}
          className="text-sm text-[var(--color-accent)] hover:opacity-80"
        >
          ← Back to Clinics
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-lg">
      <div className="mb-6 flex items-center gap-3">
        <button
          onClick={() => router.push('/clinics')}
          className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
          aria-label="Back to clinics"
        >
          ←
        </button>
        <h1 className="text-[var(--text-2xl)] font-semibold text-[var(--color-text)]">
          Edit Clinic
        </h1>
      </div>

      <div className="flex flex-col gap-4">
        <div>
          <label
            htmlFor="clinic-name"
            className="block text-sm font-medium text-[var(--color-text)] mb-1"
          >
            Name
          </label>
          <input
            id="clinic-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
          />
        </div>

        <div>
          <label
            htmlFor="clinic-address"
            className="block text-sm font-medium text-[var(--color-text)] mb-1"
          >
            Address
          </label>
          <input
            id="clinic-address"
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
          />
        </div>

        <div>
          <label
            htmlFor="clinic-phone"
            className="block text-sm font-medium text-[var(--color-text)] mb-1"
          >
            Phone
          </label>
          <input
            id="clinic-phone"
            type="text"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
          />
        </div>

        <div>
          <label
            htmlFor="clinic-crn"
            className="block text-sm font-medium text-[var(--color-text)] mb-1"
          >
            Company Registration Number
          </label>
          <input
            id="clinic-crn"
            type="text"
            value={crn}
            onChange={(e) => setCrn(e.target.value)}
            className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--color-text)] mb-2">
            Addresses
          </label>
          <AddressList
            addresses={addresses}
            entityId={id}
            entityType="clinic"
            onChanged={reloadAddresses}
          />
        </div>

        {saveError && <p className="text-sm text-red-500">{saveError}</p>}

        <div className="flex gap-3 pt-2">
          <button
            onClick={() => void handleSave()}
            disabled={saving || !name.trim()}
            className="px-4 py-2 rounded-[var(--radius-sm)] bg-[var(--color-accent)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            onClick={() => router.push('/clinics')}
            className="px-4 py-2 rounded-[var(--radius-sm)] border border-[var(--color-border)] text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>

      {linkedContacts.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold text-[var(--color-text)] mb-3">Linked Contacts</h2>
          <ul className="flex flex-col gap-2">
            {linkedContacts.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/contacts/${c.id}`}
                  className="text-sm text-[var(--color-accent)] hover:opacity-80"
                >
                  {c.name}
                </Link>
                {(c.role ?? c.specialty) && (
                  <span className="text-sm text-[var(--color-text-muted)] ml-2">
                    {[c.role, c.specialty].filter(Boolean).join(' · ')}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {linkedDocuments.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold text-[var(--color-text)] mb-3">Linked Documents</h2>
          <ul className="flex flex-col gap-2">
            {linkedDocuments.map((d) => (
              <li key={d.id}>
                <Link
                  href={`/documents/view/${d.id}`}
                  className="text-sm text-[var(--color-accent)] hover:opacity-80"
                >
                  {d.filename}
                </Link>
                {d.document_date && (
                  <span className="text-sm text-[var(--color-text-muted)] ml-2">
                    {d.document_date}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

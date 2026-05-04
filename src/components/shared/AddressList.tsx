'use client'

import { invoke } from '@tauri-apps/api/core'
import { useState } from 'react'

export interface Address {
  id: string
  label: string | null
  line1: string
  line2: string | null
  city: string | null
  postcode: string | null
  country: string | null
  is_primary: boolean
  created_at: string
}

interface AddressListProps {
  addresses: Address[]
  entityId: string
  entityType: 'clinic' | 'contact'
  onChanged: () => void
}

interface AddressFormState {
  label: string
  line1: string
  line2: string
  city: string
  postcode: string
  country: string
}

const EMPTY_FORM: AddressFormState = {
  label: '',
  line1: '',
  line2: '',
  city: '',
  postcode: '',
  country: 'GB',
}

function entityKey(entityType: 'clinic' | 'contact') {
  return entityType === 'clinic' ? 'clinicId' : 'contactId'
}

function createCmd(entityType: 'clinic' | 'contact') {
  return entityType === 'clinic' ? 'clinic_address_create' : 'contact_address_create'
}

function updateCmd(entityType: 'clinic' | 'contact') {
  return entityType === 'clinic' ? 'clinic_address_update' : 'contact_address_update'
}

function deleteCmd(entityType: 'clinic' | 'contact') {
  return entityType === 'clinic' ? 'clinic_address_delete' : 'contact_address_delete'
}

function setPrimaryCmd(entityType: 'clinic' | 'contact') {
  return entityType === 'clinic' ? 'clinic_address_set_primary' : 'contact_address_set_primary'
}

function toForm(addr: Address): AddressFormState {
  return {
    label: addr.label ?? '',
    line1: addr.line1,
    line2: addr.line2 ?? '',
    city: addr.city ?? '',
    postcode: addr.postcode ?? '',
    country: addr.country ?? 'GB',
  }
}

interface AddressFieldsProps {
  form: AddressFormState
  onChange: (field: keyof AddressFormState, value: string) => void
}

function AddressFields({ form, onChange }: AddressFieldsProps) {
  const input = 'w-full rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400'
  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="col-span-2">
        <input
          className={input}
          placeholder="Label (e.g. MAIN RECEPTION)"
          value={form.label}
          onChange={e => onChange('label', e.target.value)}
        />
      </div>
      <div className="col-span-2">
        <input
          className={input}
          placeholder="Line 1 *"
          value={form.line1}
          onChange={e => onChange('line1', e.target.value)}
          required
        />
      </div>
      <div className="col-span-2">
        <input
          className={input}
          placeholder="Line 2"
          value={form.line2}
          onChange={e => onChange('line2', e.target.value)}
        />
      </div>
      <input
        className={input}
        placeholder="City"
        value={form.city}
        onChange={e => onChange('city', e.target.value)}
      />
      <input
        className={input}
        placeholder="Postcode"
        value={form.postcode}
        onChange={e => onChange('postcode', e.target.value)}
      />
      <div className="col-span-2">
        <input
          className={input}
          placeholder="Country"
          value={form.country}
          onChange={e => onChange('country', e.target.value)}
        />
      </div>
    </div>
  )
}

export function AddressList({ addresses, entityId, entityType, onChanged }: AddressListProps) {
  const [editId, setEditId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<AddressFormState>(EMPTY_FORM)
  const [adding, setAdding] = useState(false)
  const [addForm, setAddForm] = useState<AddressFormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function startEdit(addr: Address) {
    setEditId(addr.id)
    setEditForm(toForm(addr))
    setAdding(false)
    setError(null)
  }

  function cancelEdit() {
    setEditId(null)
    setError(null)
  }

  function startAdd() {
    setAdding(true)
    setAddForm(EMPTY_FORM)
    setEditId(null)
    setError(null)
  }

  function cancelAdd() {
    setAdding(false)
    setError(null)
  }

  async function saveEdit() {
    if (!editId) return
    if (!editForm.line1.trim()) { setError('Line 1 is required'); return }
    setSaving(true)
    setError(null)
    try {
      await invoke(updateCmd(entityType), {
        id: editId,
        label: editForm.label.trim() || null,
        line1: editForm.line1.trim(),
        line2: editForm.line2.trim() || null,
        city: editForm.city.trim() || null,
        postcode: editForm.postcode.trim() || null,
        country: editForm.country.trim() || null,
      })
      setEditId(null)
      onChanged()
    } catch (e) {
      setError(String(e))
    } finally {
      setSaving(false)
    }
  }

  async function saveAdd() {
    if (!addForm.line1.trim()) { setError('Line 1 is required'); return }
    setSaving(true)
    setError(null)
    try {
      await invoke(createCmd(entityType), {
        [entityKey(entityType)]: entityId,
        label: addForm.label.trim() || null,
        line1: addForm.line1.trim(),
        line2: addForm.line2.trim() || null,
        city: addForm.city.trim() || null,
        postcode: addForm.postcode.trim() || null,
        country: addForm.country.trim() || null,
      })
      setAdding(false)
      onChanged()
    } catch (e) {
      setError(String(e))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    setSaving(true)
    setError(null)
    try {
      await invoke(deleteCmd(entityType), { id })
      onChanged()
    } catch (e) {
      setError(String(e))
    } finally {
      setSaving(false)
    }
  }

  async function handleSetPrimary(id: string) {
    setSaving(true)
    setError(null)
    try {
      await invoke(setPrimaryCmd(entityType), { id, [entityKey(entityType)]: entityId })
      onChanged()
    } catch (e) {
      setError(String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-2">
      {addresses.map(addr => (
        <div key={addr.id} className="rounded border border-gray-200 bg-white p-3">
          {editId === addr.id ? (
            <div className="space-y-2">
              <AddressFields
                form={editForm}
                onChange={(f, v) => setEditForm(prev => ({ ...prev, [f]: v }))}
              />
              <div className="flex gap-2">
                <button
                  onClick={saveEdit}
                  disabled={saving}
                  className="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  Save
                </button>
                <button
                  onClick={cancelEdit}
                  className="rounded border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-start justify-between gap-2">
              <div className="text-sm">
                {addr.label && (
                  <div className="font-medium text-gray-700">{addr.label}</div>
                )}
                <div>{addr.line1}</div>
                {addr.line2 && <div>{addr.line2}</div>}
                {(addr.city || addr.postcode) && (
                  <div>{[addr.city, addr.postcode].filter(Boolean).join(', ')}</div>
                )}
                {addr.country && addr.country !== 'GB' && (
                  <div className="text-gray-500">{addr.country}</div>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  onClick={() => handleSetPrimary(addr.id)}
                  disabled={saving || addr.is_primary}
                  title={addr.is_primary ? 'Primary address' : 'Set as primary'}
                  className={`rounded p-1 text-base leading-none ${addr.is_primary ? 'text-yellow-500' : 'text-gray-300 hover:text-yellow-400'} disabled:cursor-default`}
                >
                  ★
                </button>
                <button
                  onClick={() => startEdit(addr)}
                  disabled={saving}
                  title="Edit"
                  className="rounded p-1 text-sm text-gray-400 hover:text-blue-600 disabled:opacity-50"
                >
                  ✎
                </button>
                <button
                  onClick={() => handleDelete(addr.id)}
                  disabled={saving}
                  title="Delete"
                  className="rounded p-1 text-sm text-gray-400 hover:text-red-600 disabled:opacity-50"
                >
                  ✕
                </button>
              </div>
            </div>
          )}
        </div>
      ))}

      {adding ? (
        <div className="rounded border border-blue-200 bg-blue-50 p-3 space-y-2">
          <AddressFields
            form={addForm}
            onChange={(f, v) => setAddForm(prev => ({ ...prev, [f]: v }))}
          />
          <div className="flex gap-2">
            <button
              onClick={saveAdd}
              disabled={saving}
              className="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Add
            </button>
            <button
              onClick={cancelAdd}
              className="rounded border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={startAdd}
          className="rounded border border-dashed border-gray-300 px-3 py-1.5 text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600"
        >
          + Add address
        </button>
      )}

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
    </div>
  )
}

import { useCallback, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { Contact, useContactsStore } from '../store/contactsStore'

export interface DuplicateCandidate {
  primary_contact_id: string
  contact: Contact
  similarity_score: number
  match_reason: string
}

export interface ContactCreateInput {
  name: string
  role: string
  specialty?: string | null
  phone?: string | null
  email?: string | null
  clinic?: string | null
  address?: string | null
  notes?: string | null
}

export interface ContactUpdateInput {
  id: string
  name?: string | null
  role?: string | null
  specialty?: string | null
  phone?: string | null
  email?: string | null
  clinic?: string | null
  address?: string | null
  notes?: string | null
  contact_clinic_id?: string | null
}

export function useContacts(roleFilter?: string) {
  const { contacts, loading, error, setContacts, setLoading, setError, upsertContact, removeContact } =
    useContactsStore()

  const fetchContacts = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await invoke<Contact[]>('contacts_list', roleFilter ? { role: roleFilter } : {})
      setContacts(result)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [roleFilter, setContacts, setLoading, setError])

  useEffect(() => {
    void fetchContacts()
  }, [fetchContacts])

  async function createContact(input: ContactCreateInput): Promise<Contact> {
    const contact = await invoke<Contact>('contacts_create', { input })
    upsertContact(contact)
    return contact
  }

  async function updateContact(input: ContactUpdateInput): Promise<Contact> {
    const contact = await invoke<Contact>('contacts_update', { input })
    upsertContact(contact)
    return contact
  }

  async function deleteContact(id: string): Promise<void> {
    await invoke('contacts_delete', { id })
    removeContact(id)
  }

  async function findDuplicateContacts(contactId?: string): Promise<DuplicateCandidate[]> {
    return invoke<DuplicateCandidate[]>('find_duplicate_contacts', {
      userId: '',
      contactId: contactId ?? null,
    })
  }

  async function mergeContacts(primaryId: string, duplicateIds: string[]): Promise<Contact> {
    const contact = await invoke<Contact>('merge_contacts', {
      userId: '',
      primaryId,
      duplicateIds,
    })
    upsertContact(contact)
    duplicateIds.forEach(removeContact)
    return contact
  }

  return {
    contacts,
    loading,
    error,
    createContact,
    updateContact,
    deleteContact,
    findDuplicateContacts,
    mergeContacts,
    refresh: fetchContacts,
  }
}

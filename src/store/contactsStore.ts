import { create } from 'zustand'

export interface Contact {
  id: string
  name: string
  role: string
  specialty: string | null
  phone: string | null
  email: string | null
  clinic: string | null
  address: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export const CONTACT_ROLES = [
  'gp',
  'specialist',
  'dentist',
  'physio',
  'pharmacist',
  'hospital',
  'clinic',
  'other',
] as const

export type ContactRole = (typeof CONTACT_ROLES)[number]

export const ROLE_LABELS: Record<ContactRole, string> = {
  gp: 'GP',
  specialist: 'Specialist',
  dentist: 'Dentist',
  physio: 'Physio',
  pharmacist: 'Pharmacist',
  hospital: 'Hospital',
  clinic: 'Clinic',
  other: 'Other',
}

interface ContactsState {
  contacts: Contact[]
  loading: boolean
  error: string | null
  setContacts: (contacts: Contact[]) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  upsertContact: (contact: Contact) => void
  removeContact: (id: string) => void
}

export const useContactsStore = create<ContactsState>((set) => ({
  contacts: [],
  loading: false,
  error: null,

  setContacts: (contacts) => set({ contacts }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),

  upsertContact: (contact) =>
    set((s) => {
      const idx = s.contacts.findIndex((c) => c.id === contact.id)
      if (idx === -1) return { contacts: [contact, ...s.contacts] }
      const next = [...s.contacts]
      next[idx] = contact
      return { contacts: next }
    }),

  removeContact: (id) => set((s) => ({ contacts: s.contacts.filter((c) => c.id !== id) })),
}))

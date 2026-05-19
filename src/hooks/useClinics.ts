'use client'

import { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { extractTauriError } from '../lib/ipc'

export interface LinkedContact {
  id: string
  name: string
  role: string
}

export interface ClinicWithContacts {
  id: string
  name: string
  address: string | null
  phone: string | null
  created_at: string
  company_registration_number: string | null
  linked_contacts: LinkedContact[]
}

export function useClinics() {
  const [clinics, setClinics] = useState<ClinicWithContacts[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const data = await invoke<ClinicWithContacts[]>('clinics_list_with_contacts')
      setClinics(data)
    } catch (err: unknown) {
      setError(extractTauriError(err, 'Failed to load clinics'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [])

  return { clinics, loading, error, reload: load }
}

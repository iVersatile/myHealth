'use client'

import { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'

export interface Medication {
  id: string
  name: string
  dosage: string | null
  frequency: string | null
  start_date: string | null
  end_date: string | null
  notes: string | null
  deleted_at: string | null
  created_at: string
  updated_at: string
}

export interface MedicationCreateInput {
  name: string
  dosage?: string | null
  frequency?: string | null
  start_date?: string | null
  end_date?: string | null
  notes?: string | null
}

export interface MedicationUpdateInput {
  name?: string | null
  dosage?: string | null
  frequency?: string | null
  start_date?: string | null
  end_date?: string | null
  notes?: string | null
}

export function useMedications() {
  const [medications, setMedications] = useState<Medication[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const data = await invoke<Medication[]>('medications_list')
      setMedications(data)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load medications')
    } finally {
      setLoading(false)
    }
  }

  async function createMedication(input: MedicationCreateInput): Promise<Medication> {
    const m = await invoke<Medication>('medications_create', { input })
    await load()
    return m
  }

  async function updateMedication(id: string, input: MedicationUpdateInput): Promise<Medication> {
    const m = await invoke<Medication>('medications_update', { id, input })
    await load()
    return m
  }

  async function deleteMedication(id: string): Promise<void> {
    await invoke('medications_delete', { id })
    await load()
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [])

  return { medications, loading, error, reload: load, createMedication, updateMedication, deleteMedication }
}

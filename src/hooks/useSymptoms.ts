'use client'

import { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { extractTauriError } from '../lib/ipc'

export interface Symptom {
  id: string
  name: string
  severity: number | null
  onset_date: string | null
  notes: string | null
  deleted_at: string | null
  created_at: string
  updated_at: string
}

export interface SymptomCreateInput {
  name: string
  severity?: number | null
  onset_date?: string | null
  notes?: string | null
}

export interface SymptomUpdateInput {
  name?: string | null
  severity?: number | null
  onset_date?: string | null
  notes?: string | null
}

export function useSymptoms() {
  const [symptoms, setSymptoms] = useState<Symptom[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const data = await invoke<Symptom[]>('symptoms_list')
      setSymptoms(data)
    } catch (err: unknown) {
      setError(extractTauriError(err, 'Failed to load symptoms'))
    } finally {
      setLoading(false)
    }
  }

  async function createSymptom(input: SymptomCreateInput): Promise<Symptom> {
    const s = await invoke<Symptom>('symptoms_create', { input })
    await load()
    return s
  }

  async function updateSymptom(id: string, input: SymptomUpdateInput): Promise<Symptom> {
    const s = await invoke<Symptom>('symptoms_update', { id, input })
    await load()
    return s
  }

  async function deleteSymptom(id: string): Promise<void> {
    await invoke('symptoms_delete', { id })
    await load()
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [])

  return { symptoms, loading, error, reload: load, createSymptom, updateSymptom, deleteSymptom }
}

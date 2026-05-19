import { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { Appointment } from '../../../../store/appointmentsStore'
import type { Category } from '../../../../components/categories/CategoryPicker'
import { AppointmentInput } from '../../../../hooks/useAppointments'
import type { Note } from '../../../../store/notesStore'

export interface LinkedDocument {
  document_id: string
  filename: string
  category: string
  document_date: string | null
  score: number
  created_at: string
}

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

export interface Icd10Suggestion {
  code: string
  description: string
  confidence: number
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function formatApptDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function useAppointmentDetail(id: string) {
  const [appt, setAppt] = useState<Appointment | null>(null)
  const [linkedDocs, setLinkedDocs] = useState<LinkedDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [unlinking, setUnlinking] = useState<string | null>(null)

  const [allCategories, setAllCategories] = useState<Category[]>([])
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([])

  const [linkedNotes, setLinkedNotes] = useState<Note[]>([])

  const [linkedSymptoms, setLinkedSymptoms] = useState<Symptom[]>([])
  const [allSymptoms, setAllSymptoms] = useState<Symptom[]>([])
  const [selectedSymptomId, setSelectedSymptomId] = useState('')

  const [linkedMedications, setLinkedMedications] = useState<Medication[]>([])
  const [allMedications, setAllMedications] = useState<Medication[]>([])
  const [selectedMedicationId, setSelectedMedicationId] = useState('')

  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  const [summary, setSummary] = useState<string[] | null>(null)
  const [summarizing, setSummarizing] = useState(false)
  const [summaryError, setSummaryError] = useState<string | null>(null)
  const [summaryOpen, setSummaryOpen] = useState(false)

  const [savedTags, setSavedTags] = useState<string[]>([])
  const [suggestions, setSuggestions] = useState<Icd10Suggestion[]>([])
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set())
  const [suggesting, setSuggesting] = useState(false)
  const [suggestError, setSuggestError] = useState<string | null>(null)
  const [savingTags, setSavingTags] = useState(false)

  useEffect(() => {
    if (!id) return
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const [fetchedAppt, fetchedLinks, catRows, assignedIds, fetchedTags, fetchedNotes, fetchedSymptoms, fetchedMedications, allSym, allMed] = await Promise.all([
          invoke<Appointment>('appointments_get', { id }),
          invoke<LinkedDocument[]>('get_appointment_links', { userId: '', appointmentId: id }),
          invoke<Array<{ id: string; name: string; parent_id: string | null; color_hex: string; is_system: boolean; sort_order: number }>>('categories_list'),
          invoke<string[]>('categories_for_appointment', { appointmentId: id }),
          invoke<string[]>('appointment_tags_get', { appointmentId: id }),
          invoke<Note[]>('notes_for_entity', { entityType: 'appointment', entityId: id }),
          invoke<Symptom[]>('symptoms_for_entity', { entityType: 'appointment', entityId: id }),
          invoke<Medication[]>('medications_for_entity', { entityType: 'appointment', entityId: id }),
          invoke<Symptom[]>('symptoms_list'),
          invoke<Medication[]>('medications_list'),
        ])
        setAppt(fetchedAppt)
        setLinkedDocs(fetchedLinks)
        setSavedTags(fetchedTags)
        setLinkedNotes(fetchedNotes)
        setLinkedSymptoms(fetchedSymptoms)
        setLinkedMedications(fetchedMedications)
        setAllSymptoms(allSym.filter((s) => !s.deleted_at))
        setAllMedications(allMed.filter((m) => !m.deleted_at))
        setAllCategories(catRows.map(r => ({
          id: r.id,
          name: r.name,
          parentId: r.parent_id,
          colorHex: r.color_hex,
          isSystem: r.is_system,
          sortOrder: r.sort_order,
        })))
        setSelectedCategoryIds(assignedIds)
      } catch (e) {
        setError(String(e))
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [id])

  async function handleLinkSymptom() {
    if (!selectedSymptomId) return
    try {
      await invoke('symptom_link', { symptomId: selectedSymptomId, toType: 'appointment', toId: id })
      const refreshed = await invoke<Symptom[]>('symptoms_for_entity', { entityType: 'appointment', entityId: id })
      setLinkedSymptoms(refreshed)
      setSelectedSymptomId('')
    } catch (e) {
      setError(String(e))
    }
  }

  async function handleUnlinkSymptom(symptomId: string) {
    try {
      await invoke('symptom_unlink', { symptomId, toType: 'appointment', toId: id })
      setLinkedSymptoms((prev) => prev.filter((s) => s.id !== symptomId))
    } catch (e) {
      setError(String(e))
    }
  }

  async function handleLinkMedication() {
    if (!selectedMedicationId) return
    try {
      await invoke('medication_link', { medicationId: selectedMedicationId, toType: 'appointment', toId: id })
      const refreshed = await invoke<Medication[]>('medications_for_entity', { entityType: 'appointment', entityId: id })
      setLinkedMedications(refreshed)
      setSelectedMedicationId('')
    } catch (e) {
      setError(String(e))
    }
  }

  async function handleUnlinkMedication(medicationId: string) {
    try {
      await invoke('medication_unlink', { medicationId, toType: 'appointment', toId: id })
      setLinkedMedications((prev) => prev.filter((m) => m.id !== medicationId))
    } catch (e) {
      setError(String(e))
    }
  }

  async function handleUnlink(documentId: string) {
    setUnlinking(documentId)
    try {
      await invoke('unlink_document_from_appointment', {
        userId: '',
        documentId,
        appointmentId: id,
      })
      setLinkedDocs((prev) => prev.filter((d) => d.document_id !== documentId))
    } catch (e) {
      setError(String(e))
    } finally {
      setUnlinking(null)
    }
  }

  async function handleSummarize() {
    setSummarizing(true)
    setSummaryError(null)
    try {
      const sentences = await invoke<string[]>('summarize_appointment_notes', {
        userId: '',
        appointmentId: id,
      })
      setSummary(sentences)
      setSummaryOpen(true)
    } catch (e) {
      setSummaryError(String(e))
    } finally {
      setSummarizing(false)
    }
  }

  async function handleSuggestIcd10() {
    if (!appt) return
    setSuggesting(true)
    setSuggestError(null)
    setSuggestions([])
    setSelectedCodes(new Set())
    try {
      const text = [appt.title, appt.specialty, appt.notes].filter(Boolean).join(' ')
      const results = await invoke<Icd10Suggestion[]>('icd10_suggest', { text })
      setSuggestions(results)
    } catch (e) {
      setSuggestError(String(e))
    } finally {
      setSuggesting(false)
    }
  }

  function toggleSuggestion(code: string) {
    setSelectedCodes((prev) => {
      const next = new Set(prev)
      if (next.has(code)) next.delete(code)
      else next.add(code)
      return next
    })
  }

  async function handleSaveTags() {
    const merged = Array.from(new Set([...savedTags, ...Array.from(selectedCodes)]))
    setSavingTags(true)
    try {
      await invoke('appointment_tags_set', { appointmentId: id, tags: merged })
      setSavedTags(merged)
      setSuggestions([])
      setSelectedCodes(new Set())
    } catch (e) {
      setSuggestError(String(e))
    } finally {
      setSavingTags(false)
    }
  }

  async function handleRemoveTag(tag: string) {
    const next = savedTags.filter((t) => t !== tag)
    try {
      await invoke('appointment_tags_set', { appointmentId: id, tags: next })
      setSavedTags(next)
    } catch (e) {
      setError(String(e))
    }
  }

  async function handleCategoryChange(nextIds: string[]) {
    const toAdd = nextIds.filter(cid => !selectedCategoryIds.includes(cid))
    const toRemove = selectedCategoryIds.filter(cid => !nextIds.includes(cid))
    try {
      await Promise.all([
        ...toAdd.map(categoryId =>
          invoke('assign_category_to_appointment', { userId: '', appointmentId: id, categoryId })
        ),
        ...toRemove.map(categoryId =>
          invoke('unassign_category_from_appointment', { userId: '', appointmentId: id, categoryId })
        ),
      ])
      setSelectedCategoryIds(nextIds)
    } catch (e) {
      setError(String(e))
    }
  }

  async function handleEditSave(input: AppointmentInput) {
    setSaving(true)
    try {
      const updated = await invoke<Appointment>('appointments_update', {
        id,
        input: {
          title: input.title,
          appt_date: input.appt_date,
          doctor_name: input.doctor_name ?? null,
          clinic_name: input.clinic_name ?? null,
          specialty: input.specialty ?? null,
          location: input.location ?? null,
          duration_min: input.duration_min ?? 0,
          notes: input.notes ?? null,
          status: input.status ?? 'scheduled',
          reminder_min: input.reminder_min ?? 60,
        },
      })
      setAppt(updated)
      setIsEditing(false)
    } catch (e) {
      setError(String(e))
    } finally {
      setSaving(false)
    }
  }

  return {
    appt,
    linkedDocs,
    loading,
    error,
    unlinking,
    allCategories,
    selectedCategoryIds,
    linkedNotes,
    linkedSymptoms,
    allSymptoms,
    selectedSymptomId,
    setSelectedSymptomId,
    linkedMedications,
    allMedications,
    selectedMedicationId,
    setSelectedMedicationId,
    isEditing,
    setIsEditing,
    saving,
    summary,
    summarizing,
    summaryError,
    summaryOpen,
    setSummaryOpen,
    savedTags,
    suggestions,
    selectedCodes,
    suggesting,
    suggestError,
    savingTags,
    handleLinkSymptom,
    handleUnlinkSymptom,
    handleLinkMedication,
    handleUnlinkMedication,
    handleUnlink,
    handleSummarize,
    handleSuggestIcd10,
    toggleSuggestion,
    handleSaveTags,
    handleRemoveTag,
    handleCategoryChange,
    handleEditSave,
  }
}

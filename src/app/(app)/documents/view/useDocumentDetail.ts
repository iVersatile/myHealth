'use client'

import { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import type { Document } from '../../../../store/documentsStore'
import type { Category } from '../../../../components/categories/CategoryPicker'
import type { Appointment } from '../../../../store/appointmentsStore'
import type { Note } from '../../../../store/notesStore'
import { downloadReport, type ReportData } from '../../../../components/documents/DocumentReport'
import { extractTauriError } from '@/lib/ipc'

export interface DocumentEntity {
  id: string
  document_id: string
  entity_type: string
  name: string
  value: string | null
  unit: string | null
  raw_text: string
  created_at: string
}

export interface DocumentLink {
  id: string
  document_id: string
  appointment_id: string
  link_type: string
  confidence: string
  created_at: string
}

export interface LinkSuggestion {
  appointment_id: string
  appointment_title: string
  score: number
  reasons: string[]
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

interface Clinic {
  id: string
  name: string
  address: string | null
  phone: string | null
  created_at: string
  company_registration_number: string | null
}

export function useDocumentDetail(id: string) {
  const [doc, setDoc] = useState<Document | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tags, setTags] = useState<string[]>([])
  const [newTag, setNewTag] = useState('')
  const [notes, setNotes] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)
  const [notesSaved, setNotesSaved] = useState(false)
  const [savingTags, setSavingTags] = useState(false)
  const [activityDate, setActivityDate] = useState('')
  const [savingActivityDate, setSavingActivityDate] = useState(false)
  const [activityDateSaved, setActivityDateSaved] = useState(false)
  const [allCategories, setAllCategories] = useState<Category[]>([])
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([])
  const [links, setLinks] = useState<DocumentLink[]>([])
  const [allAppointments, setAllAppointments] = useState<Appointment[]>([])
  const [selectedApptId, setSelectedApptId] = useState('')
  const [linkingAppt, setLinkingAppt] = useState(false)
  const [clinicEntityExists, setClinicEntityExists] = useState<boolean | null>(null)
  const [savingClinic, setSavingClinic] = useState(false)
  const [clinicSaveError, setClinicSaveError] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<LinkSuggestion[]>([])
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set())
  const [linkedNotes, setLinkedNotes] = useState<Note[]>([])
  const [entities, setEntities] = useState<DocumentEntity[]>([])
  const [linkedSymptoms, setLinkedSymptoms] = useState<Symptom[]>([])
  const [allSymptoms, setAllSymptoms] = useState<Symptom[]>([])
  const [selectedSymptomId, setSelectedSymptomId] = useState('')
  const [linkedMedications, setLinkedMedications] = useState<Medication[]>([])
  const [allMedications, setAllMedications] = useState<Medication[]>([])
  const [selectedMedicationId, setSelectedMedicationId] = useState('')
  const [exportingReport, setExportingReport] = useState(false)
  const [icd10Tags, setIcd10Tags] = useState<Array<{ code: string; description: string; confidence: number }>>([])

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const [
          fetched,
          catRows,
          assignedIds,
          existingLinks,
          appts,
          scored,
          fetchedNotes,
          fetchedEntities,
          fetchedSymptoms,
          fetchedMedications,
          allSym,
          allMed,
          fetchedIcd10Tags,
        ] = await Promise.all([
          invoke<Document>('documents_get', { id }),
          invoke<Array<{ id: string; name: string; parent_id: string | null; color_hex: string; is_system: boolean; sort_order: number }>>('categories_list'),
          invoke<string[]>('categories_for_document', { documentId: id }),
          invoke<DocumentLink[]>('links_list_for_document', { documentId: id }),
          invoke<Appointment[]>('appointments_list', { month: null, status: null }),
          invoke<LinkSuggestion[]>('links_score_candidates', { documentId: id }),
          invoke<Note[]>('notes_for_entity', { entityType: 'document', entityId: id }),
          invoke<DocumentEntity[]>('document_entities_get', { documentId: id }),
          invoke<Symptom[]>('symptoms_for_entity', { entityType: 'document', entityId: id }),
          invoke<Medication[]>('medications_for_entity', { entityType: 'document', entityId: id }),
          invoke<Symptom[]>('symptoms_list'),
          invoke<Medication[]>('medications_list'),
          invoke<Array<{ code: string; description: string; confidence: number }>>('documents_get_icd10_tags', { documentId: id }),
        ])

        setDoc(fetched)
        setTags(fetched.tags)
        setNotes(fetched.notes ?? '')
        setActivityDate(fetched.activity_date?.slice(0, 10) ?? '')

        if (fetched.clinic_name) {
          const allClinics = await invoke<Clinic[]>('clinics_list')
          const match = allClinics.some((c) => c.name.toLowerCase() === fetched.clinic_name!.toLowerCase())
          setClinicEntityExists(match)
        }

        setAllCategories(
          catRows.map((r) => ({
            id: r.id,
            name: r.name,
            parentId: r.parent_id,
            colorHex: r.color_hex,
            isSystem: r.is_system,
            sortOrder: r.sort_order,
          })),
        )
        setSelectedCategoryIds(assignedIds)
        setLinks(existingLinks)
        setAllAppointments(appts)
        setSuggestions(scored)
        setLinkedNotes(fetchedNotes)
        setEntities(fetchedEntities)
        setLinkedSymptoms(fetchedSymptoms)
        setLinkedMedications(fetchedMedications)
        setAllSymptoms(allSym.filter((s) => !s.deleted_at))
        setAllMedications(allMed.filter((m) => !m.deleted_at))
        setIcd10Tags(fetchedIcd10Tags)
      } catch (err: unknown) {
        setError(extractTauriError(err))
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [id])

  async function handleSaveClinicEntity() {
    if (!doc?.clinic_name) return
    setSavingClinic(true)
    setClinicSaveError(null)
    try {
      await invoke('clinics_create_if_not_exists', {
        name: doc.clinic_name,
        address: null,
        phone: null,
        companyRegistrationNumber: null,
        addresses: [],
      })
      setClinicEntityExists(true)
    } catch {
      setClinicSaveError('Failed to create clinic. Please try again.')
    } finally {
      setSavingClinic(false)
    }
  }

  async function handleSaveActivityDate() {
    if (!doc) return
    setSavingActivityDate(true)
    try {
      await invoke('documents_update', { id: doc.id, activityDate: activityDate || null })
      setDoc({ ...doc, activity_date: activityDate || null })
      setActivityDateSaved(true)
      setTimeout(() => setActivityDateSaved(false), 2000)
    } finally {
      setSavingActivityDate(false)
    }
  }

  async function handleSaveNotes() {
    if (!doc) return
    setSavingNotes(true)
    try {
      await invoke('documents_update', { id: doc.id, notes: notes.trim() || null })
      setNotesSaved(true)
      setTimeout(() => setNotesSaved(false), 2000)
    } finally {
      setSavingNotes(false)
    }
  }

  async function handleAddTag() {
    const tag = newTag.trim()
    if (!tag || !doc || tags.includes(tag)) return
    const next = [...tags, tag]
    setSavingTags(true)
    try {
      await invoke('documents_tags_set', { id: doc.id, tags: next })
      setTags(next)
      setNewTag('')
    } finally {
      setSavingTags(false)
    }
  }

  async function handleRemoveTag(tag: string) {
    if (!doc) return
    const next = tags.filter((t) => t !== tag)
    setSavingTags(true)
    try {
      await invoke('documents_tags_set', { id: doc.id, tags: next })
      setTags(next)
    } finally {
      setSavingTags(false)
    }
  }

  async function handleCategoryChange(nextIds: string[]) {
    if (!doc) return
    const toAdd = nextIds.filter((cid) => !selectedCategoryIds.includes(cid))
    const toRemove = selectedCategoryIds.filter((cid) => !nextIds.includes(cid))
    try {
      await Promise.all([
        ...toAdd.map((categoryId) =>
          invoke('assign_category_to_document', { userId: '', documentId: doc.id, categoryId }),
        ),
        ...toRemove.map((categoryId) =>
          invoke('unassign_category_from_document', { userId: '', documentId: doc.id, categoryId }),
        ),
      ])
      setSelectedCategoryIds(nextIds)
    } catch (err: unknown) {
      setError(extractTauriError(err))
    }
  }

  async function handleLinkAppointment() {
    if (!doc || !selectedApptId) return
    setLinkingAppt(true)
    try {
      const link = await invoke<DocumentLink>('links_create', {
        input: { document_id: doc.id, appointment_id: selectedApptId, link_type: 'related', confidence: 'manual' },
      })
      setLinks((prev) => [...prev, link])
      setSelectedApptId('')
    } catch (err: unknown) {
      setError(extractTauriError(err))
    } finally {
      setLinkingAppt(false)
    }
  }

  async function handleUnlinkAppointment(linkId: string) {
    try {
      await invoke('links_delete', { id: linkId })
      setLinks((prev) => prev.filter((l) => l.id !== linkId))
    } catch (err: unknown) {
      setError(extractTauriError(err))
    }
  }

  async function handleLinkSymptom() {
    if (!doc || !selectedSymptomId) return
    try {
      await invoke('symptom_link', { symptomId: selectedSymptomId, toType: 'document', toId: doc.id })
      const refreshed = await invoke<Symptom[]>('symptoms_for_entity', { entityType: 'document', entityId: doc.id })
      setLinkedSymptoms(refreshed)
      setSelectedSymptomId('')
    } catch (err: unknown) {
      setError(extractTauriError(err))
    }
  }

  async function handleUnlinkSymptom(symptomId: string) {
    if (!doc) return
    try {
      await invoke('symptom_unlink', { symptomId, toType: 'document', toId: doc.id })
      setLinkedSymptoms((prev) => prev.filter((s) => s.id !== symptomId))
    } catch (err: unknown) {
      setError(extractTauriError(err))
    }
  }

  async function handleLinkMedication() {
    if (!doc || !selectedMedicationId) return
    try {
      await invoke('medication_link', { medicationId: selectedMedicationId, toType: 'document', toId: doc.id })
      const refreshed = await invoke<Medication[]>('medications_for_entity', { entityType: 'document', entityId: doc.id })
      setLinkedMedications(refreshed)
      setSelectedMedicationId('')
    } catch (err: unknown) {
      setError(extractTauriError(err))
    }
  }

  async function handleUnlinkMedication(medicationId: string) {
    if (!doc) return
    try {
      await invoke('medication_unlink', { medicationId, toType: 'document', toId: doc.id })
      setLinkedMedications((prev) => prev.filter((m) => m.id !== medicationId))
    } catch (err: unknown) {
      setError(extractTauriError(err))
    }
  }

  async function handleConfirmSuggestion(suggestion: LinkSuggestion) {
    if (!doc) return
    try {
      await invoke('link_document_to_appointment', {
        userId: '',
        documentId: doc.id,
        appointmentId: suggestion.appointment_id,
        score: suggestion.score,
      })
      const refreshed = await invoke<DocumentLink[]>('links_list_for_document', { documentId: doc.id })
      setLinks(refreshed)
      setSuggestions((prev) => prev.filter((s) => s.appointment_id !== suggestion.appointment_id))
    } catch (err: unknown) {
      setError(extractTauriError(err))
    }
  }

  function handleDismissSuggestion(appointmentId: string) {
    setDismissedIds((prev) => new Set([...prev, appointmentId]))
  }

  async function handleExportReport() {
    if (!doc) return
    setExportingReport(true)
    try {
      const data = await invoke<ReportData>('documents_export_report', { documentId: doc.id })
      await downloadReport(data)
    } catch (err: unknown) {
      setError(extractTauriError(err))
    } finally {
      setExportingReport(false)
    }
  }

  return {
    doc,
    loading,
    error,
    tags,
    newTag,
    setNewTag,
    savingTags,
    handleAddTag,
    handleRemoveTag,
    notes,
    setNotes,
    savingNotes,
    notesSaved,
    handleSaveNotes,
    activityDate,
    setActivityDate,
    savingActivityDate,
    activityDateSaved,
    handleSaveActivityDate,
    allCategories,
    selectedCategoryIds,
    handleCategoryChange,
    links,
    allAppointments,
    selectedApptId,
    setSelectedApptId,
    linkingAppt,
    handleLinkAppointment,
    handleUnlinkAppointment,
    clinicEntityExists,
    savingClinic,
    clinicSaveError,
    handleSaveClinicEntity,
    suggestions,
    dismissedIds,
    handleConfirmSuggestion,
    handleDismissSuggestion,
    linkedNotes,
    entities,
    linkedSymptoms,
    allSymptoms,
    selectedSymptomId,
    setSelectedSymptomId,
    handleLinkSymptom,
    handleUnlinkSymptom,
    linkedMedications,
    allMedications,
    selectedMedicationId,
    setSelectedMedicationId,
    handleLinkMedication,
    handleUnlinkMedication,
    exportingReport,
    handleExportReport,
    icd10Tags,
  }
}

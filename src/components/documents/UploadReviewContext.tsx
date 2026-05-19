'use client'

import { createContext, useContext } from 'react'
import type { Document, DocumentCategory } from '../../store/documentsStore'
import type { Category } from '../categories/CategoryPicker'
import type { ContactSuggestion, ClinicSuggestion, ContactPhase, ClinicPhase } from './uploadTypes'

export interface UploadReviewContextValue {
  uploadedDoc: Document
  category: DocumentCategory
  setCategory: React.Dispatch<React.SetStateAction<DocumentCategory>>
  tags: string[]
  setTags: React.Dispatch<React.SetStateAction<string[]>>
  tagInput: string
  setTagInput: React.Dispatch<React.SetStateAction<string>>
  notes: string
  setNotes: React.Dispatch<React.SetStateAction<string>>
  allCategories: Category[]
  selectedCategoryIds: string[]
  setSelectedCategoryIds: React.Dispatch<React.SetStateAction<string[]>>
  categorySuggestion: string | null
  categorySuggestionDismissed: boolean
  setCategorySuggestionDismissed: React.Dispatch<React.SetStateAction<boolean>>
  contactSuggestions: ContactSuggestion[]
  contactPhases: Map<string, ContactPhase>
  setContactPhases: React.Dispatch<React.SetStateAction<Map<string, ContactPhase>>>
  dismissedContacts: Set<string>
  setDismissedContacts: React.Dispatch<React.SetStateAction<Set<string>>>
  clinicSuggestions: ClinicSuggestion[]
  clinicPhase: ClinicPhase
  setClinicPhase: React.Dispatch<React.SetStateAction<ClinicPhase>>
  dismissedClinics: Set<string>
  setDismissedClinics: React.Dispatch<React.SetStateAction<Set<string>>>
  timelineDescription: string
  setTimelineDescription: React.Dispatch<React.SetStateAction<string>>
  activityDate: string | null
  setActivityDate: React.Dispatch<React.SetStateAction<string | null>>
  confirming: boolean
  confirmError: string | null
  docCategories: string[]
  extractedTextPreview: string | null
}

export const UploadReviewContext = createContext<UploadReviewContextValue | null>(null)

export function useUploadReview(): UploadReviewContextValue {
  const ctx = useContext(UploadReviewContext)
  if (!ctx) throw new Error('useUploadReview must be used inside UploadReviewContext.Provider')
  return ctx
}

'use client'

import { useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { invoke } from '@tauri-apps/api/core'
import { useNotes } from '../../../../hooks/useNotes'
import { ENTITY_CONFIG } from '../../../../lib/entities'

export default function NewNotePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { createNote } = useNotes()
  const creating = useRef(false)

  useEffect(() => {
    if (creating.current) return
    creating.current = true

    const linkedDocumentId = searchParams.get('linkedDocumentId')

    async function init() {
      const note = await createNote()
      if (linkedDocumentId) {
        await invoke('note_link', {
          noteId: note.id,
          entityType: 'document',
          entityId: linkedDocumentId,
        })
      }
      const dest = linkedDocumentId
        ? `${ENTITY_CONFIG.note.route}?id=${note.id}&linkedDocumentId=${linkedDocumentId}`
        : `${ENTITY_CONFIG.note.route}?id=${note.id}`
      router.replace(dest)
    }

    void init()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex h-full items-center justify-center text-[var(--color-text-muted)] text-[var(--text-sm)]">
      Creating note…
    </div>
  )
}

'use client'

import { useState } from 'react'
import { DocumentList } from '../../../components/documents/DocumentList'
import { UploadDialog } from '../../../components/documents/UploadDialog'
import { useDocumentsStore } from '../../../store/documentsStore'
import type { Document } from '../../../store/documentsStore'

export default function DocumentsPage() {
  const [uploadOpen, setUploadOpen] = useState(false)
  const { documents, total, setDocuments } = useDocumentsStore()

  function handleUploaded(doc: Document) {
    setDocuments([doc, ...documents], total + 1)
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-[var(--text-2xl)] font-semibold text-[var(--color-text)]">
          Documents
        </h1>
        <button
          type="button"
          onClick={() => setUploadOpen(true)}
          className="flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--color-primary)] px-4 py-2 text-[var(--text-sm)] font-medium text-[var(--color-text-inverse)] transition-colors duration-[var(--duration-fast)] hover:bg-[var(--color-primary-hover)]"
        >
          ↑ Upload
        </button>
      </div>
      <DocumentList />
      {uploadOpen && (
        <UploadDialog
          onClose={() => setUploadOpen(false)}
          onUploaded={handleUploaded}
        />
      )}
    </div>
  )
}

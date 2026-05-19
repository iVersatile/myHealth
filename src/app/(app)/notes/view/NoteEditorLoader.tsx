'use client'

import dynamic from 'next/dynamic'

const NoteEditorClient = dynamic(() => import('./NoteEditorClient'), { ssr: false })

export default function NoteEditorLoader() {
  return <NoteEditorClient />
}

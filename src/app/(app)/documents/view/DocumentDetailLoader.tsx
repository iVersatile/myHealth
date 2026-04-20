'use client'

import dynamic from 'next/dynamic'

const DocumentDetailClient = dynamic(() => import('./DocumentDetailClient'), { ssr: false })

export default function DocumentDetailLoader() {
  return <DocumentDetailClient />
}

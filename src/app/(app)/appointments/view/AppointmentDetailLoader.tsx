'use client'

import dynamic from 'next/dynamic'

const AppointmentDetailClient = dynamic(() => import('./AppointmentDetailClient'), { ssr: false })

export default function AppointmentDetailLoader() {
  return <AppointmentDetailClient />
}

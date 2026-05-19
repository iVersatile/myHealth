import { Suspense } from 'react'
import { ClinicEditClient } from './ClinicEditClient'

export default function ClinicEditPage() {
  return (
    <Suspense fallback={<p className="text-[var(--color-text-muted)] text-sm">Loading…</p>}>
      <ClinicEditClient />
    </Suspense>
  )
}

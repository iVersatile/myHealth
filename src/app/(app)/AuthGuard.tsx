'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '../../store/authStore'
import { AppShell } from '../../components/layout/AppShell'
import { IdleLockProvider } from '../../components/providers/IdleLockProvider'

const SKIP_AUTH = process.env.NEXT_PUBLIC_SKIP_AUTH === '1'

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const isLocked = useAuthStore((s) => s.isLocked)
  const router = useRouter()

  useEffect(() => {
    if (!SKIP_AUTH && isLocked) {
      router.replace('/')
    }
  }, [isLocked, router])

  if (!SKIP_AUTH && isLocked) return null

  return (
    <IdleLockProvider>
      <AppShell>{children}</AppShell>
    </IdleLockProvider>
  )
}

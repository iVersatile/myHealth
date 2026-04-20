'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '../../store/authStore'
import { AppShell } from '../../components/layout/AppShell'

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const isLocked = useAuthStore((s) => s.isLocked)
  const router = useRouter()

  useEffect(() => {
    if (isLocked) {
      router.replace('/')
    }
  }, [isLocked, router])

  if (isLocked) return null

  return <AppShell>{children}</AppShell>
}

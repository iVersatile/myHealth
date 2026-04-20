'use client'

import { useIdleLock } from '../../hooks/useIdleLock'

interface IdleLockProviderProps {
  children: React.ReactNode
}

export function IdleLockProvider({ children }: IdleLockProviderProps) {
  useIdleLock()
  return <>{children}</>
}

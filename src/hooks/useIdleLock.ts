import { useEffect, useRef } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { useAuthStore } from '../store/authStore'

const IDLE_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'] as const

export function useIdleLock(timeoutMs = 15 * 60 * 1000) {
  const isLocked = useAuthStore((s) => s.isLocked)
  const setLocked = useAuthStore((s) => s.setLocked)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (isLocked) {
      if (timerRef.current) clearTimeout(timerRef.current)
      return
    }

    async function performLock() {
      try {
        await invoke('auth_lock')
      } catch {
        // non-Tauri environment; update store only
      }
      setLocked(true)
    }

    function resetTimer() {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(performLock, timeoutMs)
    }

    resetTimer()
    IDLE_EVENTS.forEach((ev) => document.addEventListener(ev, resetTimer, { passive: true }))

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      IDLE_EVENTS.forEach((ev) => document.removeEventListener(ev, resetTimer))
    }
  }, [isLocked, timeoutMs, setLocked])
}

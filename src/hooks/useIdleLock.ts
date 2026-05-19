import { useEffect, useRef, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { useAuthStore } from '../store/authStore'

const IDLE_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'] as const

export function useIdleLock() {
  const isLocked = useAuthStore((s) => s.isLocked)
  const setLocked = useAuthStore((s) => s.setLocked)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [timeoutMs, setTimeoutMs] = useState<number | undefined>()

  // Load auto-lock setting from backend on mount
  useEffect(() => {
    async function loadSetting() {
      try {
        const minutes = await invoke<number>('settings_get', { key: 'auto_lock_minutes' })
        if (minutes && minutes > 0) {
          setTimeoutMs(minutes * 60 * 1000)
        } else {
          // If setting is 0 or not set, disable auto-lock
          setTimeoutMs(undefined)
        }
      } catch {
        // Default to 15 minutes if setting retrieval fails
        setTimeoutMs(15 * 60 * 1000)
      }
    }
    loadSetting()
  }, [])

  useEffect(() => {
    if (isLocked || timeoutMs === undefined) {
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

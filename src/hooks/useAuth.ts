import { invoke } from '@tauri-apps/api/core'
import { useAuthStore } from '../store/authStore'

export function useAuth() {
  const setLocked = useAuthStore((s) => s.setLocked)

  async function hasPassword(): Promise<boolean> {
    return invoke<boolean>('auth_has_password')
  }

  async function unlock(password: string): Promise<void> {
    await invoke('auth_unlock', { password })
    setLocked(false)
  }

  async function setup(password: string): Promise<void> {
    await invoke('auth_set_password', { password })
    setLocked(false)
  }

  async function lock(): Promise<void> {
    await invoke('auth_lock')
    setLocked(true)
  }

  return { unlock, setup, lock, hasPassword }
}

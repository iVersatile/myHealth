import { invoke } from '@tauri-apps/api/core'
import { useAuthStore } from '../store/authStore'

export interface UserEntry {
  id: string
  display_name: string
}

export function useAuth() {
  const setLocked = useAuthStore((s) => s.setLocked)

  async function hasPassword(): Promise<boolean> {
    return invoke<boolean>('auth_has_password')
  }

  async function listUsers(): Promise<UserEntry[]> {
    return invoke<UserEntry[]>('auth_list_users')
  }

  async function unlock(password: string): Promise<void> {
    await invoke('auth_unlock', { password })
    setLocked(false)
  }

  async function setup(password: string): Promise<void> {
    await invoke('auth_set_password', { password })
    setLocked(false)
  }

  async function switchUser(userId: string, password: string): Promise<void> {
    await invoke('auth_switch_user', { userId, password })
    setLocked(false)
  }

  async function lock(): Promise<void> {
    await invoke('auth_lock')
    setLocked(true)
  }

  return { unlock, setup, lock, hasPassword, listUsers, switchUser }
}

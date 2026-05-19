import { create } from 'zustand'

interface AuthState {
  isLocked: boolean
  setLocked: (locked: boolean) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  isLocked: true,
  setLocked: (locked) => set({ isLocked: locked }),
}))

import { create } from 'zustand'

export type Theme = 'calm' | 'coffee' | 'mint'

const STORAGE_KEY = 'theme'

function applyTheme(theme: Theme) {
  const html = document.documentElement
  html.classList.remove('theme-calm', 'theme-coffee', 'theme-mint')
  html.classList.add(`theme-${theme}`)
}

interface ThemeState {
  theme: Theme
  setTheme: (theme: Theme) => void
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: 'calm',
  setTheme: (theme) => {
    localStorage.setItem(STORAGE_KEY, theme)
    applyTheme(theme)
    set({ theme })
  },
}))

export function initTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY) as Theme | null
  const theme: Theme =
    stored === 'coffee' || stored === 'mint' ? stored : 'calm'
  applyTheme(theme)
  useThemeStore.setState({ theme })
  return theme
}

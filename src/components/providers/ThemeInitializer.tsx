'use client'

import { useEffect } from 'react'
import { initTheme } from '../../store/themeStore'

export function ThemeInitializer() {
  useEffect(() => {
    initTheme()
  }, [])

  return null
}

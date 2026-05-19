'use client'

import { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { type Theme, SectionTitle, sectionStyle } from './settingsShared'
import { ThemePicker } from '../../../components/ui/ThemePicker'

export function AppearanceSection() {
  const [theme, setTheme] = useState<Theme>('system')

  useEffect(() => {
    async function load() {
      const t = await invoke<string | null>('settings_get', { key: 'theme' })
      if (t === 'light' || t === 'dark' || t === 'system') setTheme(t)
    }
    void load()
  }, [])

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'system') {
      root.removeAttribute('data-theme')
    } else {
      root.setAttribute('data-theme', theme)
    }
  }, [theme])

  async function handleThemeChange(t: Theme) {
    setTheme(t)
    await invoke('settings_set', { key: 'theme', value: t })
  }

  return (
    <div style={sectionStyle}>
      <SectionTitle>Appearance</SectionTitle>
      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-3)' }}>
        Choose a theme. &ldquo;System&rdquo; follows your OS preference.
      </p>
      <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
        {(['light', 'dark', 'system'] as Theme[]).map(t => (
          <label
            key={t}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              fontSize: 'var(--text-sm)',
              color: 'var(--color-text)',
              cursor: 'pointer',
              padding: 'var(--space-2) var(--space-3)',
              border: `1px solid ${theme === t ? 'var(--color-primary)' : 'var(--color-border)'}`,
              borderRadius: 'var(--radius-md)',
              background: theme === t ? 'color-mix(in srgb, var(--color-primary) 10%, transparent)' : 'transparent',
            }}
          >
            <input
              type="radio"
              name="theme"
              value={t}
              checked={theme === t}
              onChange={() => { void handleThemeChange(t) }}
              style={{ accentColor: 'var(--color-primary)' }}
            />
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </label>
        ))}
      </div>
      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', margin: 'var(--space-4) 0 var(--space-2)' }}>
        Color scheme
      </p>
      <ThemePicker />
    </div>
  )
}

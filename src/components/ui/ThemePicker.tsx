'use client'

import { useThemeStore, type Theme } from '../../store/themeStore'

const THEMES: { id: Theme; label: string; surface: string; primary: string }[] = [
  { id: 'calm',   label: 'Calm',   surface: 'oklch(99% 0 0)',       primary: 'oklch(52% 0.18 240)' },
  { id: 'coffee', label: 'Coffee', surface: 'oklch(97% 0.01 80)',   primary: 'oklch(50% 0.11 55)'  },
  { id: 'mint',   label: 'Mint',   surface: 'oklch(98% 0.01 175)',  primary: 'oklch(48% 0.14 175)' },
]

export function ThemePicker() {
  const { theme, setTheme } = useThemeStore()

  return (
    <div data-testid="theme-picker" style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
      {THEMES.map(({ id, label, surface, primary }) => {
        const active = theme === id
        return (
          <button
            key={id}
            data-testid={`theme-option-${id}`}
            onClick={() => setTheme(id)}
            aria-pressed={active}
            title={label}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 'var(--space-1)',
              padding: 'var(--space-2)',
              border: `2px solid ${active ? 'var(--color-primary)' : 'var(--color-border)'}`,
              borderRadius: 'var(--radius-md)',
              background: 'transparent',
              cursor: 'pointer',
            }}
          >
            <span
              style={{
                display: 'block',
                width: 40,
                height: 28,
                borderRadius: 'var(--radius-sm)',
                background: surface,
                border: `3px solid ${primary}`,
              }}
            />
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>
              {label}
            </span>
          </button>
        )
      })}
    </div>
  )
}

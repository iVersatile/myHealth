import { describe, it, expect, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useThemeStore, initTheme, type Theme } from './themeStore'

const STORAGE_KEY = 'theme'

function resetStore() {
  useThemeStore.setState({ theme: 'calm' })
  localStorage.clear()
  document.documentElement.className = ''
}

describe('themeStore', () => {
  beforeEach(() => {
    act(() => resetStore())
  })

  it('defaults to calm', () => {
    const { result } = renderHook(() => useThemeStore())
    expect(result.current.theme).toBe('calm')
  })

  it('setTheme updates store state', () => {
    const { result } = renderHook(() => useThemeStore())
    act(() => result.current.setTheme('coffee'))
    expect(result.current.theme).toBe('coffee')
  })

  it('setTheme persists to localStorage', () => {
    const { result } = renderHook(() => useThemeStore())
    act(() => result.current.setTheme('mint'))
    expect(localStorage.getItem(STORAGE_KEY)).toBe('mint')
  })

  it('setTheme applies class to document.documentElement', () => {
    const { result } = renderHook(() => useThemeStore())
    act(() => result.current.setTheme('coffee'))
    expect(document.documentElement.classList.contains('theme-coffee')).toBe(true)
    expect(document.documentElement.classList.contains('theme-calm')).toBe(false)
    expect(document.documentElement.classList.contains('theme-mint')).toBe(false)
  })

  it('initTheme reads stored value and applies it', () => {
    localStorage.setItem(STORAGE_KEY, 'mint')
    const theme = initTheme()
    expect(theme).toBe('mint')
    expect(useThemeStore.getState().theme).toBe('mint')
    expect(document.documentElement.classList.contains('theme-mint')).toBe(true)
  })

  it('initTheme falls back to calm for unknown value', () => {
    localStorage.setItem(STORAGE_KEY, 'banana' as Theme)
    const theme = initTheme()
    expect(theme).toBe('calm')
    expect(document.documentElement.classList.contains('theme-calm')).toBe(true)
  })

  it('initTheme falls back to calm when storage empty', () => {
    const theme = initTheme()
    expect(theme).toBe('calm')
  })
})

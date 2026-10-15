import { describe, it, expect, beforeEach } from 'vitest'
import { THEME_KEY, applyTheme, resolveTheme, useThemeStore } from '../src/lib/theme'

function themeMeta() {
  return document.querySelector('meta[name="theme-color"]')
}

describe('dark mode', () => {
  beforeEach(() => {
    window.localStorage.clear()
    document.documentElement.className = ''
    if (!themeMeta()) {
      const meta = document.createElement('meta')
      meta.setAttribute('name', 'theme-color')
      document.head.appendChild(meta)
    }
    useThemeStore.setState({ mode: 'light' })
  })

  it('sets the html class, theme-colour meta and remembers the choice', () => {
    useThemeStore.getState().setMode('dark')

    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(themeMeta()?.getAttribute('content')).toBe('#0B121B')
    expect(window.localStorage.getItem(THEME_KEY)).toBe('dark')
    expect(useThemeStore.getState().mode).toBe('dark')
  })

  it('toggles back to light', () => {
    useThemeStore.getState().setMode('dark')
    useThemeStore.getState().toggle()

    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(themeMeta()?.getAttribute('content')).toBe('#0F766E')
    expect(window.localStorage.getItem(THEME_KEY)).toBe('light')
    expect(useThemeStore.getState().mode).toBe('light')
  })

  it('prefers the stored choice, then falls back to the system setting', () => {
    window.localStorage.setItem(THEME_KEY, 'dark')
    expect(resolveTheme()).toBe('dark')

    window.localStorage.setItem(THEME_KEY, 'light')
    expect(resolveTheme()).toBe('light')

    window.localStorage.removeItem(THEME_KEY)
    expect(['light', 'dark']).toContain(resolveTheme())
  })

  it('paints the class it is given', () => {
    applyTheme('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)

    applyTheme('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })
})

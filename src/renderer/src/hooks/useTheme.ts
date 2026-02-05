import { useState, useEffect, useCallback } from 'react'
import { applyTheme, THEMES, THEME_IDS, type ThemeId } from '../themes'

const THEME_STORAGE_KEY = 'theme'

export function useTheme() {
  const [themeId, setThemeIdState] = useState<ThemeId>('primary')
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    const loadSavedTheme = async () => {
      try {
        const saved = await (window.api?.settings?.get?.(THEME_STORAGE_KEY) ?? window.electron?.ipcRenderer?.invoke?.('settings-get', THEME_STORAGE_KEY))
        const id = typeof saved === 'string' && THEME_IDS.includes(saved as ThemeId) ? (saved as ThemeId) : 'primary'
        setThemeIdState(id)
        applyTheme(id)
      } catch {
        applyTheme('primary')
      } finally {
        setIsLoaded(true)
      }
    }
    loadSavedTheme()
  }, [])

  const setTheme = useCallback(async (id: ThemeId) => {
    setThemeIdState(id)
    applyTheme(id)
    try {
      await (window.api?.settings?.set?.(THEME_STORAGE_KEY, id) ?? window.electron?.ipcRenderer?.invoke?.('settings-set', THEME_STORAGE_KEY, id))
      await (window.api?.setTitleBarTheme?.(id) ?? window.electron?.ipcRenderer?.invoke?.('set-title-bar-theme', id))
    } catch (e) {
      console.error('Failed to save theme:', e)
    }
  }, [])

  return { themeId, setTheme, theme: THEMES[themeId], themes: THEMES, themeIds: THEME_IDS, isLoaded }
}

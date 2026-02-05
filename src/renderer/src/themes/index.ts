/**
 * Modular theme system for Locus.
 * Add new themes by extending THEMES and exporting them.
 */

export type ThemeId = 'primary' | 'ocean' | 'forest' | 'rose'

export type ThemeColors = {
  background: string
  foreground: string
  sidebar: string
  border: string
  primary: string
  secondary: string
  accent: string
  muted: string
  /** Slightly lighter than background for code blocks, menus */
  surface: string
  /** Line numbers in code blocks */
  lineNumbers: string
}

export type ThemeDefinition = {
  id: ThemeId
  name: string
  colors: ThemeColors
  fontFamily: string
  /** BlockNote editor theme format */
  blockNote: {
    colors: {
      editor: { text: string; background: string }
      menu: { text: string; background: string }
      tooltip: { text: string; background: string }
      hovered: { text: string; background: string }
      selected: { text: string; background: string }
      disabled: { text: string; background: string }
    }
    fontFamily: string
  }
}

const primaryTheme: ThemeDefinition = {
  id: 'primary',
  name: 'Primary',
  colors: {
    background: '#2a241d',
    foreground: '#d7c097',
    sidebar: '#231e1a',
    border: '#423d33',
    primary: '#4d9cbc',
    secondary: '#e8b840',
    accent: '#d55f6f',
    muted: '#767069',
    surface: '#2e2b26',
    lineNumbers: '#767069'
  },
  fontFamily: 'Karla, sans-serif',
  blockNote: {
    colors: {
      editor: { text: '#d7c097', background: '#2a241d' },
      menu: { text: '#d7c097', background: '#2e2b26' },
      tooltip: { text: '#27241f', background: '#e8b840' },
      hovered: { text: '#d7c097', background: '#423d33' },
      selected: { text: '#d7c097', background: '#4d9cbc33' },
      disabled: { text: '#767069', background: '#2e2b26' }
    },
    fontFamily: 'Karla, sans-serif'
  }
}

const oceanTheme: ThemeDefinition = {
  id: 'ocean',
  name: 'Ocean',
  colors: {
    background: '#0f172a',
    foreground: '#e2e8f0',
    sidebar: '#0c1222',
    border: '#1e293b',
    primary: '#38bdf8',
    secondary: '#818cf8',
    accent: '#f472b6',
    muted: '#64748b',
    surface: '#1e293b',
    lineNumbers: '#64748b'
  },
  fontFamily: 'Inter, system-ui, sans-serif',
  blockNote: {
    colors: {
      editor: { text: '#e2e8f0', background: '#0f172a' },
      menu: { text: '#e2e8f0', background: '#1e293b' },
      tooltip: { text: '#0f172a', background: '#38bdf8' },
      hovered: { text: '#e2e8f0', background: '#1e293b' },
      selected: { text: '#e2e8f0', background: '#38bdf833' },
      disabled: { text: '#64748b', background: '#1e293b' }
    },
    fontFamily: 'Inter, system-ui, sans-serif'
  }
}

const forestTheme: ThemeDefinition = {
  id: 'forest',
  name: 'Forest',
  colors: {
    background: '#1a1f1a',
    foreground: '#c8e6c9',
    sidebar: '#141914',
    border: '#2d3a2d',
    primary: '#66bb6a',
    secondary: '#aed581',
    accent: '#ff8a65',
    muted: '#81c784',
    surface: '#232b23',
    lineNumbers: '#81c784'
  },
  fontFamily: 'Georgia, serif',
  blockNote: {
    colors: {
      editor: { text: '#c8e6c9', background: '#1a1f1a' },
      menu: { text: '#c8e6c9', background: '#232b23' },
      tooltip: { text: '#1a1f1a', background: '#66bb6a' },
      hovered: { text: '#c8e6c9', background: '#2d3a2d' },
      selected: { text: '#c8e6c9', background: '#66bb6a33' },
      disabled: { text: '#81c784', background: '#232b23' }
    },
    fontFamily: 'Georgia, serif'
  }
}

const roseTheme: ThemeDefinition = {
  id: 'rose',
  name: 'Rose',
  colors: {
    background: '#1c1917',
    foreground: '#faf5f5',
    sidebar: '#171412',
    border: '#292524',
    primary: '#f472b6',
    secondary: '#fb923c',
    accent: '#a78bfa',
    muted: '#a8a29e',
    surface: '#292524',
    lineNumbers: '#a8a29e'
  },
  fontFamily: 'Inter, system-ui, sans-serif',
  blockNote: {
    colors: {
      editor: { text: '#faf5f5', background: '#1c1917' },
      menu: { text: '#faf5f5', background: '#292524' },
      tooltip: { text: '#1c1917', background: '#f472b6' },
      hovered: { text: '#faf5f5', background: '#292524' },
      selected: { text: '#faf5f5', background: '#f472b633' },
      disabled: { text: '#a8a29e', background: '#292524' }
    },
    fontFamily: 'Inter, system-ui, sans-serif'
  }
}

export const THEMES: Record<ThemeId, ThemeDefinition> = {
  primary: primaryTheme,
  ocean: oceanTheme,
  forest: forestTheme,
  rose: roseTheme
}

export const THEME_IDS: ThemeId[] = ['primary', 'ocean', 'forest', 'rose']

/** CSS variable names used by the app */
export const THEME_CSS_VARS = [
  'background',
  'foreground',
  'sidebar',
  'border',
  'primary',
  'secondary',
  'accent',
  'muted',
  'surface',
  'lineNumbers'
] as const

/** Apply theme to document by setting CSS variables */
export function applyTheme(themeId: ThemeId): void {
  const theme = THEMES[themeId]
  if (!theme) return

  const root = document.documentElement
  const { colors, fontFamily } = theme

  root.style.setProperty('--theme-background', colors.background)
  root.style.setProperty('--theme-foreground', colors.foreground)
  root.style.setProperty('--theme-sidebar', colors.sidebar)
  root.style.setProperty('--theme-border', colors.border)
  root.style.setProperty('--theme-primary', colors.primary)
  root.style.setProperty('--theme-secondary', colors.secondary)
  root.style.setProperty('--theme-accent', colors.accent)
  root.style.setProperty('--theme-muted', colors.muted)
  root.style.setProperty('--theme-surface', colors.surface)
  root.style.setProperty('--theme-line-numbers', colors.lineNumbers)
  root.style.setProperty('--theme-font-family', fontFamily)
  root.setAttribute('data-theme', themeId)
}

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/**/*.{js,ts,jsx,tsx}', './index.html'],
  theme: {
    extend: {
      colors: {
        // Theme colors - values come from CSS variables set by active theme
        background: 'var(--theme-background)',
        foreground: 'var(--theme-foreground)',
        sidebar: 'var(--theme-sidebar)',
        border: 'var(--theme-border)',
        primary: 'var(--theme-primary)',
        secondary: 'var(--theme-secondary)',
        accent: 'var(--theme-accent)',
        muted: 'var(--theme-muted)'
      },
      fontFamily: {
        sans: ['var(--theme-font-family)', 'sans-serif']
      }
    }
  },
  plugins: []
}


import { useState, useEffect } from 'react'

type Theme = 'light' | 'dark'

function getInitialTheme(): Theme {
  const saved = localStorage.getItem('rider-theme') as Theme | null
  if (saved) return saved
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('rider-theme', theme)
  }, [theme])

  const toggle = () => setTheme(t => (t === 'dark' ? 'light' : 'dark'))

  return { theme, toggle }
}

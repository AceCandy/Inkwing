import { useState, useEffect } from 'react'
import { useEditorStore } from '../stores/editorStore'
import logoLight from '../assets/logo-light-v2.png'
import logoDark from '../assets/logo-dark-v2.png'

export function useAppLogo() {
  const { currentTheme } = useEditorStore()
  const [logoSrc, setLogoSrc] = useState(logoLight)

  useEffect(() => {
    const timer = setTimeout(() => {
      const bodyBg = window.getComputedStyle(document.body).backgroundColor
      const htmlBg = window.getComputedStyle(document.documentElement).backgroundColor
      const bg = (bodyBg && bodyBg !== 'rgba(0, 0, 0, 0)' && bodyBg !== 'transparent') ? bodyBg : htmlBg

      const match = bg.match(/\d+/g)
      if (match && match.length >= 3) {
        const r = parseInt(match[0], 10)
        const g = parseInt(match[1], 10)
        const b = parseInt(match[2], 10)
        const brightness = 0.299 * r + 0.587 * g + 0.114 * b
        if (brightness < 140) {
          setLogoSrc(logoDark)
          return
        }
      }

      const themeId = currentTheme.toLowerCase()
      if (themeId.includes('light') || themeId.includes('latte')) {
        setLogoSrc(logoLight)
      } else if (themeId.includes('dark') || themeId.includes('night') || themeId.includes('nord') || themeId.includes('mocha')) {
        setLogoSrc(logoDark)
      } else {
        setLogoSrc(logoLight)
      }
    }, 100)

    return () => clearTimeout(timer)
  }, [currentTheme])

  return logoSrc
}

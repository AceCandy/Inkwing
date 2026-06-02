export { defaultTheme, defaultLightTheme, themeToCSSVariables } from './default'
export type { Theme } from './default'
export type { TyporaThemeOption } from './typora/types'

// 主题注册表
import { defaultTheme, defaultLightTheme, type Theme } from './default'
import { listTyporaThemes } from './typora/api'
import { applyTyporaTheme, clearTyporaTheme } from './typora/runtime'
import type { TyporaThemeOption } from './typora/types'

const themes = new Map<string, Theme>()
let externalThemes: TyporaThemeOption[] = []

export type BuiltinTheme = Theme & { type?: 'builtin' }
export type ThemeOption = BuiltinTheme | TyporaThemeOption

// 注册默认主题
themes.set('default', defaultTheme)
themes.set('light', defaultLightTheme)

// 注册主题
export function registerTheme(theme: Theme) {
  themes.set(theme.id, theme)
}

// 应用主题到页面
export function applyTheme(theme: Theme) {
  const root = document.documentElement
  const { colors, typography } = theme

  // 1. 应用主题 CSS 变量（--theme-xxx）
  Object.entries(colors).forEach(([key, value]) => {
    const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase()
    root.style.setProperty(`--theme-${cssKey}`, value)
  })

  Object.entries(typography).forEach(([key, value]) => {
    const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase()
    root.style.setProperty(`--theme-${cssKey}`, value)
  })

  // 2. 映射并覆盖全局 CSS 基础变量，使非编辑器/预览区（如 sidebar、header 等）自适应
  const globalMapping: Record<string, string> = {
    editorBg: '--bg-primary',
    editorBgSecondary: '--bg-secondary',
    blockquoteBg: '--bg-surface',
    textPrimary: '--text-primary',
    textSecondary: '--text-secondary',
    accent: '--accent',
    accentHover: '--accent-hover',
    border: '--border',
    success: '--success',
    warning: '--warning',
    error: '--error',
  }

  Object.entries(globalMapping).forEach(([themeKey, globalVar]) => {
    const colorValue = colors[themeKey as keyof typeof colors]
    if (colorValue) {
      root.style.setProperty(globalVar, colorValue)
    }
  })
}

// 获取主题
export function getTheme(id: string): Theme {
  return themes.get(id) || defaultTheme
}

export async function refreshExternalThemes(): Promise<TyporaThemeOption[]> {
  const packages = await listTyporaThemes()

  // 将后端返回的 Typora 包按 variant 展平为前端可直接使用的 option。
  externalThemes = packages.flatMap((pkg) =>
    pkg.variants.map((variant) => ({
      type: 'typora' as const,
      id: `typora:${pkg.id}:${variant.id}`,
      name: `${pkg.name} / ${variant.name}`,
      packageId: pkg.id,
      packageName: pkg.name,
      cssFile: variant.cssFile,
      basePath: pkg.basePath,
    })),
  )

  return externalThemes
}

// 获取所有可选主题，包括内置主题和已导入的 Typora 主题变体。
export function getAllThemes(): ThemeOption[] {
  return [...(Array.from(themes.values()) as BuiltinTheme[]), ...externalThemes]
}

export const getAllThemeOptions = getAllThemes

export function getThemeOption(id: string): ThemeOption {
  const externalTheme = externalThemes.find((theme) => theme.id === id)
  if (externalTheme) {
    return externalTheme
  }

  const builtinTheme = themes.get(id)
  if (builtinTheme) {
    return builtinTheme as BuiltinTheme
  }

  return defaultTheme
}

export async function applyThemeOption(theme: ThemeOption): Promise<void> {
  if (theme.type === 'typora') {
    await applyTyporaTheme(theme)
    return
  }

  clearTyporaTheme()
  applyTheme(theme)
}

// 从外部 CSS 加载主题
export async function loadExternalTheme(id: string, cssUrl: string): Promise<void> {
  // 动态加载 CSS
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = cssUrl
  link.dataset.themeId = id
  document.head.appendChild(link)
}

// 切换主题 CSS
export function switchThemeCSS(id: string) {
  // 移除其他外部主题
  document.querySelectorAll('link[data-theme-id]').forEach((el) => {
    el.remove()
  })

  // 只移除已有的 theme-* 类，保留页面上其他非主题类名
  const root = document.documentElement
  Array.from(root.classList).forEach((className) => {
    if (className.startsWith('theme-')) {
      root.classList.remove(className)
    }
  })

  // 应用当前主题类
  root.classList.add(`theme-${id}`)
}

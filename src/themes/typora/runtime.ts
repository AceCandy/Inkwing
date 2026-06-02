import { convertFileSrc } from '@tauri-apps/api/core'

import { adaptTyporaCss, extractTyporaShellVariables } from './cssAdapter'
import { readTyporaThemeCss } from './api'
import type { TyporaThemeOption } from './types'

const ACTIVE_TYPORA_THEME_STYLE_ID = 'inkwing-active-typora-theme'
const ACTIVE_TYPORA_SHELL_STYLE_ID = 'inkwing-active-typora-shell-theme'
const TYPORA_BODY_CLASS = 'typora-theme-scope'

function normalizeFilePath(filePath: string): string {
  return filePath.replace(/\\/g, '/')
}

function getOrCreateStyleElement(id: string): HTMLStyleElement {
  const existing = document.getElementById(id)
  if (existing instanceof HTMLStyleElement) {
    return existing
  }

  if (existing) {
    existing.remove()
  }

  const style = document.createElement('style')
  style.id = id
  document.head.appendChild(style)
  return style
}

function setStyleContent(id: string, content: string) {
  const existing = document.getElementById(id)

  if (!content.trim()) {
    existing?.remove()
    return
  }

  const style = getOrCreateStyleElement(id)
  style.textContent = content
}

function buildShellThemeCss(variables: Record<string, string>): string {
  const declarations = Object.entries(variables)
    .map(([name, value]) => `${name}: ${value};`)
    .join(' ')

  if (!declarations) {
    return ''
  }

  return `body.${TYPORA_BODY_CLASS} { ${declarations} }`
}

export function clearTyporaTheme() {
  document.body?.classList.remove(TYPORA_BODY_CLASS)
  document.getElementById(ACTIVE_TYPORA_THEME_STYLE_ID)?.remove()
  document.getElementById(ACTIVE_TYPORA_SHELL_STYLE_ID)?.remove()
}

export async function applyTyporaTheme(theme: TyporaThemeOption) {
  const body = document.body
  if (!body) {
    return
  }

  // 先把所有可能抛错的计算都做完，避免进入半应用状态。
  const { css, basePath } = await readTyporaThemeCss(theme.packageId, theme.cssFile)
  const assetBasePath = basePath || theme.basePath
  const adaptedCss = adaptTyporaCss(css, {
    assetBasePath,
    toAssetUrl: (path) => convertFileSrc(normalizeFilePath(path)),
  })
  const shellVariables = extractTyporaShellVariables(css)
  const shellThemeCss = buildShellThemeCss(shellVariables)

  try {
    // 所有内容都准备好后，再清空旧状态并应用新主题。
    clearTyporaTheme()
    body.classList.add(TYPORA_BODY_CLASS)
    setStyleContent(ACTIVE_TYPORA_THEME_STYLE_ID, adaptedCss)
    setStyleContent(ACTIVE_TYPORA_SHELL_STYLE_ID, shellThemeCss)
  } catch (error) {
    clearTyporaTheme()
    throw error
  }
}

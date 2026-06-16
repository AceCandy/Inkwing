import { convertFileSrc, isTauri } from '@tauri-apps/api/core'

import { adaptTyporaCss, extractTyporaShellVariables } from './cssAdapter'
import { readTyporaThemeCss } from './api'
import type { TyporaThemeOption } from './types'
import typoraBaseCss from './base.css.txt?raw'
import typoraBaseControlCss from './base-control.css.txt?raw'
import typoraShellCss from './shell.css.txt?raw'

const ACTIVE_TYPORA_THEME_STYLE_ID = 'inkwing-active-typora-theme'
const ACTIVE_TYPORA_SHELL_STYLE_ID = 'inkwing-active-typora-shell-theme'
const TYPORA_BODY_CLASS = 'typora-theme-scope'
const TYPORA_APPLYING_CLASS = 'typora-theme-applying'
const TYPORA_BODY_STATE_CLASSES = [
  TYPORA_APPLYING_CLASS,
  'typora-node',
  'no-collapse-outline',
  'no-animation',
  'active-tab-files',
  'allow-file-tree-scroll',
  'active-tab-outline',
  'html-for-mac',
  'mac-os-11',
  'mac-os',
  'mac-seamless-mode',
  'os-windows',
  'pin-outline',
  'ty-on-search',
  'ty-show-search',
]
const TYPORA_RUNTIME_DEFAULT_SIDEBAR_WIDTH = '245px'
const TYPORA_RUNTIME_DEFAULT_FONT_SIZE = '17px'
const TYPORA_RUNTIME_DEFAULT_LINE_HEIGHT = '1.42857143'
const TYPORA_BASE_VARIABLES = extractTyporaShellVariables(typoraBaseCss)
const TYPORA_BASE_CONTROL_VARIABLES = extractTyporaShellVariables(typoraBaseControlCss)

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
  const shellVariables = {
    ...getTyporaRuntimeShellVariables(),
    ...variables,
  }
  const declarations = Object.entries(shellVariables)
    .map(([name, value]) => `${name}: ${value};`)
    .join(' ')

  if (!declarations) {
    return ''
  }

  const adaptedShellCss = adaptTyporaCss(typoraShellCss, {
    assetBasePath: '',
    toAssetUrl: normalizeFilePath,
  })

  return [
    `body.${TYPORA_APPLYING_CLASS} #typora-sidebar { transition: none !important; }`,
    `:root {`,
    declarations,
    `}`,
    `body.${TYPORA_BODY_CLASS} {`,
    declarations,
    `font-size: var(--typora-font-size);`,
    `line-height: var(--typora-line-height);`,
    '}',
    adaptedShellCss,
  ].join(' ')
}

export function getTyporaRuntimeShellVariables(
  platform = globalThis.navigator?.platform ?? '',
  userAgent = globalThis.navigator?.userAgent ?? '',
): Record<string, string> {
  const isMac = getTyporaPlatformBodyClass(platform, userAgent) === 'mac-os'

  return {
    ...TYPORA_BASE_VARIABLES,
    ...TYPORA_BASE_CONTROL_VARIABLES,
    '--sidebar-width': TYPORA_RUNTIME_DEFAULT_SIDEBAR_WIDTH,
    '--title-bar-height': isMac ? '28px' : '20px',
    '--typora-font-size': TYPORA_RUNTIME_DEFAULT_FONT_SIZE,
    '--typora-line-height': TYPORA_RUNTIME_DEFAULT_LINE_HEIGHT,
  }
}

function getTyporaPlatformBodyClass(platform: string, userAgent: string): string | null {
  const platformValue = platform.toLowerCase()
  const userAgentValue = userAgent.toLowerCase()

  if (platformValue.includes('mac') || userAgentValue.includes('macintosh')) {
    return 'mac-os'
  }

  if (platformValue.includes('win') || userAgentValue.includes('windows')) {
    return 'os-windows'
  }

  return null
}

export function getTyporaRuntimeBodyClasses(
  platform = globalThis.navigator?.platform ?? '',
  userAgent = globalThis.navigator?.userAgent ?? '',
): string[] {
  const platformClass = getTyporaPlatformBodyClass(platform, userAgent)
  const classes = [TYPORA_BODY_CLASS, 'typora-node', 'no-collapse-outline']

  if (platformClass === 'mac-os') {
    classes.push('allow-file-tree-scroll', 'html-for-mac', 'no-animation', 'mac-os-11', 'mac-os', 'mac-seamless-mode')
  } else if (platformClass) {
    classes.push('no-animation', platformClass)
  } else {
    classes.push('no-animation')
  }
  classes.push('pin-outline', 'active-tab-outline')

  return classes
}

export function clearTyporaTheme() {
  document.body?.classList.remove(TYPORA_BODY_CLASS, ...TYPORA_BODY_STATE_CLASSES)
  document.getElementById(ACTIVE_TYPORA_THEME_STYLE_ID)?.remove()
  document.getElementById(ACTIVE_TYPORA_SHELL_STYLE_ID)?.remove()
}

function clearTyporaApplyingClassAfterPaint(body: HTMLElement) {
  let cleared = false
  const clear = () => {
    if (cleared) {
      return
    }
    cleared = true
    body.classList.remove(TYPORA_APPLYING_CLASS)
  }

  if (typeof window.requestAnimationFrame === 'function') {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(clear)
    })
  }

  window.setTimeout(clear, 120)
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
    toAssetUrl: resolveThemeAssetUrl,
  })
  const shellVariables = extractTyporaShellVariables(css)
  const shellThemeCss = buildShellThemeCss(shellVariables)

  try {
    // 所有内容都准备好后，再清空旧状态并应用新主题。
    clearTyporaTheme()
    body.classList.add(TYPORA_APPLYING_CLASS)
    setStyleContent(ACTIVE_TYPORA_SHELL_STYLE_ID, shellThemeCss)
    setStyleContent(ACTIVE_TYPORA_THEME_STYLE_ID, adaptedCss)
    body.classList.add(...getTyporaRuntimeBodyClasses())
    clearTyporaApplyingClassAfterPaint(body)
  } catch (error) {
    clearTyporaTheme()
    throw error
  }
}

function resolveThemeAssetUrl(path: string): string {
  const normalizedPath = normalizeFilePath(path)

  try {
    if (isTauri()) {
      return convertFileSrc(normalizedPath)
    }
  } catch {
    // 非 Tauri 的 Safari/Vite 调试态没有 asset protocol，直接使用开发服务器可访问的主题路径。
  }

  return normalizedPath
}

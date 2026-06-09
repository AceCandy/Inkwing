import { convertFileSrc } from '@tauri-apps/api/core'

import { adaptTyporaCss, extractTyporaShellVariables } from './cssAdapter'
import { readTyporaThemeCss } from './api'
import type { TyporaThemeOption } from './types'

const ACTIVE_TYPORA_THEME_STYLE_ID = 'inkwing-active-typora-theme'
const ACTIVE_TYPORA_SHELL_STYLE_ID = 'inkwing-active-typora-shell-theme'
const TYPORA_BODY_CLASS = 'typora-theme-scope'
const TYPORA_BODY_STATE_CLASSES = [
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

  return [
    `body.${TYPORA_BODY_CLASS} {`,
    declarations,
    `font-size: var(--typora-font-size, ${TYPORA_RUNTIME_DEFAULT_FONT_SIZE});`,
    '}',
  ].join(' ')
}

export function getTyporaRuntimeShellVariables(
  platform = globalThis.navigator?.platform ?? '',
  userAgent = globalThis.navigator?.userAgent ?? '',
): Record<string, string> {
  const isMac = getTyporaPlatformBodyClass(platform, userAgent) === 'mac-os'

  return {
    '--sidebar-width': TYPORA_RUNTIME_DEFAULT_SIDEBAR_WIDTH,
    '--title-bar-height': isMac ? '28px' : '20px',
    '--typora-font-size': TYPORA_RUNTIME_DEFAULT_FONT_SIZE,
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
  const classes = [TYPORA_BODY_CLASS, 'typora-node']

  // 当前大纲支持折叠，不能默认挂 no-collapse-outline，否则 Claude 等主题会走扁平大纲样式分支。
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
    body.classList.add(...getTyporaRuntimeBodyClasses())
    setStyleContent(ACTIVE_TYPORA_THEME_STYLE_ID, adaptedCss)
    setStyleContent(ACTIVE_TYPORA_SHELL_STYLE_ID, shellThemeCss)
  } catch (error) {
    clearTyporaTheme()
    throw error
  }
}

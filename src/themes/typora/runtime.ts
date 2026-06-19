import { convertFileSrc, isTauri } from '@tauri-apps/api/core'

import { rewriteCssAssetUrls, extractTyporaShellVariables } from './cssUtils'
import { readTyporaThemeCss } from './api'
import type { TyporaThemeOption } from './types'
import typoraBaseCss from './base.css.txt?raw'
import typoraBaseControlCss from './base-control.css.txt?raw'
import typoraMacCss from './mac.css.txt?raw'
import typoraShellCss from './shell.css.txt?raw'
import typoraWindowCss from './window.css.txt?raw'

// 方案 A：Typora 原生骨架直供。CSS 原样注入，不做作用域重写（删掉了 cssAdapter.ts）。
// 注入顺序对齐 Typora index.html 的 head：
//   base → base-control → mac → window → shell（本项目补偿）→ theme（用户主题）
// 所有 CSS 选择器保持 Typora 原样（#typora-sidebar / #outline-content / #write 等全局生效），
// body 用 Typora 原生 class（no-collapse-outline / mac-os / pin-outline 等），不再用 .typora-theme-scope。
const ACTIVE_TYPORA_THEME_STYLE_ID = 'inkwing-active-typora-theme'
const ACTIVE_TYPORA_SHELL_STYLE_ID = 'inkwing-active-typora-shell-theme'
const ACTIVE_TYPORA_BASE_STYLE_ID = 'inkwing-active-typora-base-theme'
const TYPORA_APPLYING_CLASS = 'typora-theme-applying'

// Typora index.html body 的静态 class（174 行）。
const TYPORA_BODY_STATIC_CLASSES = ['no-collapse-outline', 'allow-file-tree-scroll', 'html-for-mac', 'no-animation']
// 运行时由 applyTyporaTheme 管理的 body class（对齐 main.js 启动阶段）。
// 注意：pin-outline / active-tab-* / ty-on-* / ty-show-* 是组件交互态，
// 由 TyporaShell 运行时切换，clearTyporaTheme 不应触碰它们（否则会清掉 sidebar 显示）。
const TYPORA_RUNTIME_BODY_STATE_CLASSES = [
  TYPORA_APPLYING_CLASS,
  'typora-node',
  'mac-os',
  'mac-os-11',
  'mac-seamless-mode',
  'os-windows',
]

const TYPORA_RUNTIME_DEFAULT_SIDEBAR_WIDTH = '270px'
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

  // url() 重写仍需（shell.css.txt 里可能引用资源），但不做作用域重写。
  const rewrittenShellCss = rewriteCssAssetUrls(typoraShellCss, {
    assetBasePath: '',
    toAssetUrl: normalizeFilePath,
  })

  return [
    `body.${TYPORA_APPLYING_CLASS} #typora-sidebar { transition: none !important; }`,
    // 变量挂在 :root（对齐 Typora base.css 的 :root 定义），不再坍缩到 .typora-theme-scope。
    `:root {`,
    declarations,
    `}`,
    `body {`,
    declarations,
    `font-size: var(--typora-font-size);`,
    `line-height: var(--typora-line-height);`,
    '}',
    rewrittenShellCss,
  ].join(' ')
}

// 构建 Typora 实物基线 CSS（base + base-control + mac + window），原样注入，不经适配。
// 这四份是 Typora 原版字节级副本，全局选择器直接生效。
function buildTyporaBaseCss(): string {
  return [
    rewriteCssAssetUrls(typoraBaseCss, { assetBasePath: '', toAssetUrl: normalizeFilePath }),
    rewriteCssAssetUrls(typoraBaseControlCss, { assetBasePath: '', toAssetUrl: normalizeFilePath }),
    rewriteCssAssetUrls(typoraMacCss, { assetBasePath: '', toAssetUrl: normalizeFilePath }),
    rewriteCssAssetUrls(typoraWindowCss, { assetBasePath: '', toAssetUrl: normalizeFilePath }),
  ].join('\n')
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
  // 对齐 Typora window.css 依赖的 body class：
  //   - .typora-node：window.css 大量规则前缀（#typora-sidebar 的 left/position、
  //     content 定位等都依赖它），Typora app 启动时必加，本项目等价必须加。
  //   - no-collapse-outline / allow-file-tree-scroll / html-for-mac / no-animation：
  //     Typora index.html body 静态 class（174 行）。
  //   - mac 平台 class：claude.css 等主题的 .mac-os / .mac-seamless-mode 前缀规则依赖。
  // sidebar 可见性由 pin-outline 控制，由 TyporaShell 组件运行时切换（不在这里固定）。
  const classes = ['typora-node', ...TYPORA_BODY_STATIC_CLASSES]

  if (platformClass === 'mac-os') {
    classes.push('mac-os-11', 'mac-os', 'mac-seamless-mode')
  } else if (platformClass) {
    classes.push(platformClass)
  }

  return classes
}

export function clearTyporaTheme() {
  const body = document.body
  if (body) {
    body.classList.remove(...TYPORA_BODY_STATIC_CLASSES, ...TYPORA_RUNTIME_BODY_STATE_CLASSES)
  }
  document.getElementById(ACTIVE_TYPORA_THEME_STYLE_ID)?.remove()
  document.getElementById(ACTIVE_TYPORA_SHELL_STYLE_ID)?.remove()
  document.getElementById(ACTIVE_TYPORA_BASE_STYLE_ID)?.remove()
}

function clearTyporaApplyingClassAfterPaint(body: HTMLElement) {
  let cleared = false
  const clear = () => {
    if (cleared) return
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
  if (!body) return

  const { css, basePath } = await readTyporaThemeCss(theme.packageId, theme.cssFile)
  const assetBasePath = basePath || theme.basePath
  // 主题 CSS 原样注入，仅重写 url()。不再做选择器作用域重写。
  const rewrittenCss = rewriteCssAssetUrls(css, {
    assetBasePath,
    toAssetUrl: resolveThemeAssetUrl,
  })
  const shellVariables = extractTyporaShellVariables(css)
  const shellThemeCss = buildShellThemeCss(shellVariables)

  try {
    clearTyporaTheme()
    body.classList.add(TYPORA_APPLYING_CLASS)
    setStyleContent(ACTIVE_TYPORA_BASE_STYLE_ID, buildTyporaBaseCss())
    setStyleContent(ACTIVE_TYPORA_SHELL_STYLE_ID, shellThemeCss)
    setStyleContent(ACTIVE_TYPORA_THEME_STYLE_ID, rewrittenCss)
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

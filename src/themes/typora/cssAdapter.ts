import type { TyporaCssAdaptOptions } from './types'

const TYPORA_SCOPE = '.typora-theme-scope'
const TYPORA_BODY_SCOPE = 'body.typora-theme-scope'
const TYPORA_EDITOR_SCOPE = `${TYPORA_SCOPE} .milkdown .editor`
const TYPORA_PREVIEW_SCOPE = `${TYPORA_SCOPE} .preview-content`
const TYPORA_SIDEBAR_SCOPE = `${TYPORA_BODY_SCOPE} #typora-sidebar`
const TYPORA_RESIZER_SCOPE = `${TYPORA_BODY_SCOPE} #typora-sidebar-resizer`
const TYPORA_OUTLINE_SCOPE = `${TYPORA_BODY_SCOPE} #outline-content`
const TYPORA_CONTENT_SCOPES = [TYPORA_EDITOR_SCOPE, TYPORA_PREVIEW_SCOPE] as const
const TYPORA_APP_CONTENT_SCOPES = [
  `${TYPORA_BODY_SCOPE} .milkdown .editor`,
  `${TYPORA_BODY_SCOPE} .preview-content`,
] as const

const TYPORA_CONTENT_RESET_CSS = `
${TYPORA_CONTENT_SCOPES.map((scope) => `${scope} h1`).join(', ')}{border-bottom:0;padding-bottom:0;}
${TYPORA_CONTENT_SCOPES.map((scope) => `${scope} h1, ${scope} h2, ${scope} h3, ${scope} h4, ${scope} h5, ${scope} h6`).join(', ')}{color:inherit;}
${TYPORA_CONTENT_SCOPES.map((scope) => `${scope} blockquote`).join(', ')}{background:transparent;border-radius:0;}
${TYPORA_CONTENT_SCOPES.map((scope) => `${scope} blockquote p`).join(', ')}{color:inherit;}
${TYPORA_CONTENT_SCOPES.map((scope) => `${scope} pre`).join(', ')}{position:relative;background:transparent;border:0;border-radius:0;}
${TYPORA_CONTENT_SCOPES.map((scope) => `${scope} pre code`).join(', ')}{background:transparent;border:0;color:inherit;padding:0;}
`

// 这些规则补齐 Inkwing 与 Typora shell 的结构差异，避免组件默认样式压过导入主题。
const TYPORA_APP_COMPAT_CSS = `
${TYPORA_APP_CONTENT_SCOPES.join(', ')}{box-sizing:border-box;}
${TYPORA_APP_CONTENT_SCOPES.map((scope) => `${scope} > *`).join(', ')}{max-width:100%;}
${TYPORA_BODY_SCOPE} .milkdown-editor,
${TYPORA_BODY_SCOPE} .preview-container{padding:0;background-color:var(--bg-primary, var(--theme-editor-bg));}
${TYPORA_BODY_SCOPE} #typora-sidebar{--typora-sidebar-toolbar-height:120px;position:relative;width:calc(var(--sidebar-width, 245px) - 15px);margin:15px 0 15px 15px;height:calc(100% - 30px);padding-top:0;background-image:linear-gradient(to top, var(--sidebar-gradient-from, rgba(245, 244, 237, 0.05)), var(--sidebar-gradient-to, rgba(245, 244, 237, 0.3)));border:0.5px solid var(--border-color-15, rgba(31, 30, 29, 0.14));border-radius:15px;box-shadow:var(--box-shadow-userinput, 0 18px 48px -28px rgb(31 30 29 / 32%), 0 8px 18px -14px rgb(31 30 29 / 18%));font-family:var(--font-sans);}
${TYPORA_BODY_SCOPE} #typora-sidebar-resizer{left:var(--sidebar-width, 245px);}
${TYPORA_BODY_SCOPE} #typora-sidebar:hover{box-shadow:var(--box-shadow-userinput-hover, var(--box-shadow-userinput, 0 18px 48px -28px rgb(31 30 29 / 32%)));}
${TYPORA_BODY_SCOPE} #typora-sidebar .sidebar-osx-tab{position:absolute;top:0;right:0;left:0;z-index:60;height:var(--typora-sidebar-toolbar-height, 120px);display:block;background:inherit;border-bottom:1px solid var(--border-color-15, rgba(31, 30, 29, 0.14));}
${TYPORA_BODY_SCOPE} #typora-sidebar .sidebar-tabs{position:relative;display:block;height:100%;padding:0;color:var(--sidebar-font-color, var(--text-secondary));font-size:0;line-height:normal;}
${TYPORA_BODY_SCOPE} #typora-sidebar .sidebar-tab{display:none;}
${TYPORA_BODY_SCOPE} #typora-sidebar #sidepanel-segmented-input-outline{position:absolute;top:0;right:84px;left:84px;display:flex;align-items:center;justify-content:center;height:100%;min-width:0;padding:0;color:var(--font-color, var(--text-primary));font-size:24px;font-weight:500;line-height:1;}
${TYPORA_BODY_SCOPE} #typora-sidebar #switch-sidebar-icon,
${TYPORA_BODY_SCOPE} #typora-sidebar #sidebar-search-btn{position:absolute;top:0;bottom:0;display:flex;align-items:center;justify-content:center;width:84px;height:100%;color:var(--sidebar-font-color, var(--text-secondary));}
${TYPORA_BODY_SCOPE} #typora-sidebar #switch-sidebar-icon{left:0;}
${TYPORA_BODY_SCOPE} #typora-sidebar #sidebar-search-btn{right:0;}
${TYPORA_BODY_SCOPE} #typora-sidebar #switch-sidebar-icon .ty-file-tree,
${TYPORA_BODY_SCOPE} #typora-sidebar #sidebar-search-btn .ion-ios7-search-strong{position:relative;display:block;width:32px;height:32px;color:inherit;}
${TYPORA_BODY_SCOPE} #typora-sidebar #switch-sidebar-icon .ty-file-tree::before{content:"";position:absolute;left:7px;top:7px;width:18px;height:4px;background:currentColor;box-shadow:0 8px 0 currentColor,0 16px 0 currentColor;}
${TYPORA_BODY_SCOPE} #typora-sidebar #switch-sidebar-icon .ty-file-tree::after{content:"";position:absolute;left:7px;top:7px;width:4px;height:20px;background:currentColor;}
${TYPORA_BODY_SCOPE} #typora-sidebar #sidebar-search-btn .ion-ios7-search-strong::before{content:"";position:absolute;left:5px;top:5px;width:16px;height:16px;border:3px solid currentColor;border-radius:50%;box-sizing:border-box;}
${TYPORA_BODY_SCOPE} #typora-sidebar #sidebar-search-btn .ion-ios7-search-strong::after{content:"";position:absolute;left:20px;top:20px;width:11px;height:3px;background:currentColor;border-radius:999px;transform:rotate(45deg);transform-origin:left center;}
${TYPORA_BODY_SCOPE} #typora-sidebar .sidebar-content{position:absolute;top:var(--typora-sidebar-toolbar-height, 120px)!important;right:0;bottom:15px;left:0;padding:0;overflow:auto;min-height:0;}
${TYPORA_BODY_SCOPE}.mac-os #typora-sidebar .sidebar-content,
${TYPORA_BODY_SCOPE}.mac-seamless-mode #typora-sidebar .sidebar-content{top:var(--typora-sidebar-toolbar-height, 120px)!important;}
${TYPORA_OUTLINE_SCOPE}{height:100%;max-height:100%;box-sizing:border-box;overflow:auto!important;padding:14px 14px 22px 17px;font-size:14px!important;color:var(--sidebar-font-color, var(--text-secondary));}
${TYPORA_OUTLINE_SCOPE}{list-style:none;margin:0;}
${TYPORA_OUTLINE_SCOPE} ul{list-style:none;margin:0;padding-left:0;}
${TYPORA_OUTLINE_SCOPE} li{position:relative;z-index:30;margin:0;padding:0;}
${TYPORA_OUTLINE_SCOPE} li ul{position:relative;z-index:48;margin-left:18px;margin-top:0!important;padding:0;}
${TYPORA_OUTLINE_SCOPE} li .outline-item{display:block!important;position:relative;z-index:50;margin:0 0 3px 7px;width:calc(100% - 4px);border:none;border-radius:5px;line-height:1;padding:0 0 0 4px;background:transparent;}
${TYPORA_BODY_SCOPE} .outline-item > .outline-expander{display:block!important;float:left;width:auto;height:0;min-width:0;padding-left:0;background:transparent;color:var(--sidebar-font-color, var(--text-secondary));}
${TYPORA_OUTLINE_SCOPE} li .outline-label{display:inline-block;max-width:calc(100% - 12px);border-radius:4px;padding:7px 7px 7px 8px;font-size:14px!important;font-weight:var(--sidebar-font-weight, 430)!important;line-height:1.2;overflow:hidden;text-overflow:ellipsis;overflow-wrap:normal;word-wrap:normal;word-break:keep-all;white-space:nowrap;text-decoration:none;color:var(--sidebar-font-color, var(--text-secondary));opacity:1;}
${TYPORA_BODY_SCOPE} .outline-item-single .outline-label,
${TYPORA_BODY_SCOPE} .outline-item-single.outline-item-open .outline-label{padding-left:0!important;}
${TYPORA_BODY_SCOPE} .outline-item-open > .outline-item > .outline-label{padding-left:11px;}
${TYPORA_BODY_SCOPE} .outline-item:hover,
${TYPORA_BODY_SCOPE} .outline-item:hover > .outline-label,
${TYPORA_BODY_SCOPE} .outline-item-active,
${TYPORA_BODY_SCOPE} .outline-item-active > .outline-label{background:var(--hover-color)!important;}
`

const CODE_FENCE_BLOCK_TARGETS = [
  `${TYPORA_EDITOR_SCOPE} pre`,
  `${TYPORA_PREVIEW_SCOPE} pre`,
]
const CODE_FENCE_CODE_TARGETS = CODE_FENCE_BLOCK_TARGETS.map((selector) => `${selector} code`)

const TYPORA_VARIABLE_MAP: Record<string, readonly string[]> = {
  '--bg-color': ['--bg-primary', '--bg-secondary', '--theme-editor-bg', '--theme-preview-bg'],
  '--hover-color': ['--bg-surface', '--theme-blockquote-bg', '--theme-table-row-hover'],
  '--font-color': ['--text-primary', '--theme-text-primary'],
  '--sidebar-font-color': ['--text-secondary', '--theme-text-secondary'],
  '--border-color': ['--border', '--theme-border', '--theme-table-border'],
  '--table-th-border': ['--theme-table-border'],
  '--table-td-border': ['--theme-table-border'],
  '--code-bg-color': ['--theme-inline-code-bg'],
  '--code-font-color': ['--theme-inline-code-text'],
  '--code-border': ['--theme-inline-code-border'],
  '--pre-bg-color': ['--theme-code-bg'],
  '--pre-border-color': ['--theme-code-border'],
  '--pre-inputfont-color': ['--theme-code-text'],
  '--hr-color': ['--theme-hr-color', '--theme-border'],
  '--quote-font-color': ['--theme-text-secondary'],
  '--quote-boder': ['--theme-blockquote-border'],
  '--LOGO-color': ['--accent', '--theme-accent', '--theme-link', '--theme-link-hover', '--theme-blockquote-border'],
  '--font-serif': ['--theme-font-family'],
  '--font-sans': ['--font-sans'],
  '--font-mono': ['--font-mono', '--theme-font-family-mono'],
}

const TYPORA_SHELL_SELECTOR_PATTERNS = [
  /(^|[^\w-])#typora-/i,
  /(^|[^\w-])\.ty-/i,
  /(^|[^\w-])\.CodeMirror(?:$|[-\w])/i,
]

const PASSTHROUGH_AT_RULES = new Set(['@font-face', '@keyframes', '@-webkit-keyframes', '@-moz-keyframes'])
const TYPORA_BODY_STATE_CLASSES = new Set([
  'active-tab-files',
  'active-tab-outline',
  'allow-file-tree-scroll',
  'html-for-mac',
  'mac-os-11',
  'mac-os',
  'mac-seamless-mode',
  'no-collapse-outline',
  'os-windows',
  'pin-outline',
  'ty-on-outline-filter',
  'ty-on-search',
  'ty-show-outline-filter',
  'ty-show-search',
])

export function rewriteCssAssetUrls(
  css: string,
  assetBasePath: string,
  toAssetUrl: (path: string) => string,
): string {
  return css.replace(/url\(\s*(?:(["'])(.*?)\1|([^)]*?))\s*\)/gi, (match, quoted, quotedUrl, bareUrl) => {
    const url = String((quotedUrl ?? bareUrl ?? '')).trim()

    if (!url || shouldKeepOriginalUrl(url)) {
      return match
    }

    const rewritten = toAssetUrl(joinAssetPath(assetBasePath, url))
    return `url("${rewritten}")`
  })
}

export function extractTyporaShellVariables(css: string): Record<string, string> {
  const result: Record<string, string> = {}
  const cleanedCss = css.replace(/\/\*[\s\S]*?\*\//g, '')

  cleanedCss.replace(/--[A-Za-z0-9_-]+\s*:\s*[^;{}]+;/g, (declaration) => {
    const match = declaration.match(/(--[A-Za-z0-9_-]+)\s*:\s*([^;{}]+);/)
    if (!match) {
      return declaration
    }

    const [, variableName, value] = match
    const mappedVariables = TYPORA_VARIABLE_MAP[variableName]

    if (!mappedVariables) {
      return declaration
    }

    mappedVariables.forEach((mappedVariable) => {
      result[mappedVariable] = value.trim()
    })

    return declaration
  })

  return result
}

export function adaptTyporaCss(css: string, options: TyporaCssAdaptOptions): string {
  const cssWithAssetsRewritten = rewriteCssAssetUrls(css, options.assetBasePath, options.toAssetUrl)
  return `${TYPORA_CONTENT_RESET_CSS}${transformStylesheet(cssWithAssetsRewritten)}${TYPORA_APP_COMPAT_CSS}`
}

function transformStylesheet(css: string): string {
  let output = ''
  let cursor = 0

  while (cursor < css.length) {
    const nextBlockStart = findNextTopLevelBlockStart(css, cursor)

    if (nextBlockStart === -1) {
      output += transformTextChunk(css.slice(cursor))
      break
    }

    output += transformTextChunk(css.slice(cursor, nextBlockStart.start))

    const blockEnd = findMatchingBrace(css, nextBlockStart.braceIndex)
    if (blockEnd === -1) {
      output += transformTextChunk(css.slice(nextBlockStart.start))
      break
    }

    const prelude = css.slice(nextBlockStart.start, nextBlockStart.braceIndex).trim()
    const body = css.slice(nextBlockStart.braceIndex + 1, blockEnd)

    output += transformRule(prelude, body)
    cursor = blockEnd + 1
  }

  return output
}

function transformRule(prelude: string, body: string): string {
  const normalizedPrelude = stripCssComments(prelude).trim()

  if (!normalizedPrelude) {
    return `{${transformStylesheet(body)}}`
  }

  if (normalizedPrelude.startsWith('@')) {
    if (PASSTHROUGH_AT_RULES.has(normalizedPrelude.split(/\s+/)[0])) {
      return `${normalizedPrelude}{${body}}`
    }

    return `${normalizedPrelude}{${transformStylesheet(body)}}`
  }

  const selectors = splitSelectors(normalizedPrelude)
  const transformedSelectors = selectors.flatMap((selector) => transformSelector(selector)).filter(Boolean)

  if (transformedSelectors.length === 0) {
    return ''
  }

  return `${transformedSelectors.join(', ')}{${transformRuleBody(body)}}`
}

function transformRuleBody(body: string): string {
  let nextBody = body

  nextBody = nextBody.replace(/var\(\s*(--[A-Za-z0-9_-]+)\s*\)/g, (match, variableName) => {
    const targetVariable = TYPORA_VARIABLE_MAP[variableName]?.[0]
    return targetVariable ? `var(${targetVariable})` : match
  })

  nextBody = nextBody.replace(/--[A-Za-z0-9_-]+\s*:\s*[^;{}]+;/g, (declaration) => {
    const match = declaration.match(/(--[A-Za-z0-9_-]+)\s*:\s*([^;{}]+);/)
    if (!match) {
      return declaration
    }

    const [, variableName, value] = match
    const mappedVariables = TYPORA_VARIABLE_MAP[variableName]
    if (!mappedVariables) {
      return declaration
    }

    return [
      declaration.trim(),
      ...mappedVariables.map((mappedVariable) => `${mappedVariable}: ${value.trim()};`),
    ].join(' ')
  })

  return nextBody
}

function transformSelector(selector: string): string[] {
  const trimmedSelector = selector.trim()
  if (!trimmedSelector) {
    return []
  }

  const typoraCodeFenceSelectors = transformTyporaCodeFenceSelector(trimmedSelector)
  if (typoraCodeFenceSelectors) {
    return typoraCodeFenceSelectors
  }

  const resizerSelectors = transformTyporaSidebarResizerSelector(trimmedSelector)
  if (resizerSelectors) {
    return resizerSelectors
  }

  const sidebarSelectors = transformTyporaSidebarSelector(trimmedSelector)
  if (sidebarSelectors) {
    return sidebarSelectors
  }

  const outlineSelectors = transformTyporaOutlineSelector(trimmedSelector)
  if (outlineSelectors) {
    return outlineSelectors
  }

  const inlineSelectors = transformTyporaInlineSelector(trimmedSelector)
  if (inlineSelectors) {
    return inlineSelectors
  }

  const bodyStateSelectors = transformTyporaBodyStateSelector(trimmedSelector)
  if (bodyStateSelectors) {
    return bodyStateSelectors
  }

  if (isTyporaShellSelector(trimmedSelector)) {
    return []
  }

  if (trimmedSelector === 'code' || trimmedSelector === 'tt') {
    return [
      `${TYPORA_EDITOR_SCOPE} :not(pre) > ${trimmedSelector}`,
      `${TYPORA_PREVIEW_SCOPE} :not(pre) > ${trimmedSelector}`,
    ]
  }

  if (trimmedSelector.includes('#write')) {
    const editorSelector = trimmedSelector.replace(/#write\b/g, TYPORA_EDITOR_SCOPE)
    const previewSelector = trimmedSelector.replace(/#write\b/g, TYPORA_PREVIEW_SCOPE)
    return dedupeSelectors([editorSelector, previewSelector])
  }

  const writeSelectors = transformWriteSelector(trimmedSelector)
  if (writeSelectors) {
    return writeSelectors
  }

  const contentSelectors = transformContentElementSelector(trimmedSelector)
  if (contentSelectors) {
    return contentSelectors
  }

  if (trimmedSelector === 'body' || trimmedSelector === 'html' || trimmedSelector === ':root') {
    return [TYPORA_SCOPE]
  }

  return [scopeSelector(trimmedSelector)]
}

function transformTyporaSidebarResizerSelector(selector: string): string[] | null {
  if (!/(^|[^\w-])#typora-sidebar-resizer\b/.test(selector)) {
    return null
  }

  const bodyStateSelector = extractLeadingTyporaBodyStateSelector(selector)
  if (bodyStateSelector) {
    const resizerSelector = bodyStateSelector.selector.replace(
      /(^|[^\w-])#typora-sidebar-resizer\b/g,
      (_match, prefix) => `${prefix}#typora-sidebar-resizer`,
    )

    return [`${buildTyporaBodyScope(bodyStateSelector.classes)} ${resizerSelector}`]
  }

  return [
    selector.replace(
      /(^|[^\w-])#typora-sidebar-resizer\b/g,
      (_match, prefix) => `${prefix}${TYPORA_RESIZER_SCOPE}`,
    ),
  ]
}

function transformTyporaBodyStateSelector(selector: string): string[] | null {
  const bodyStateSelector = extractLeadingTyporaBodyStateSelector(selector)
  if (!bodyStateSelector) {
    return null
  }

  return [`${buildTyporaBodyScope(bodyStateSelector.classes)} ${bodyStateSelector.selector}`]
}

function transformTyporaSidebarSelector(selector: string): string[] | null {
  if (!/(^|[^\w-])#typora-sidebar\b/.test(selector)) {
    return null
  }

  const bodyStateSelector = extractLeadingTyporaBodyStateSelector(selector)
  if (bodyStateSelector) {
    const sidebarSelector = bodyStateSelector.selector.replace(
      /(^|[^\w-])#typora-sidebar\b/g,
      (_match, prefix) => `${prefix}#typora-sidebar`,
    )

    return [
      `${buildTyporaBodyScope(bodyStateSelector.classes)} ${sidebarSelector}`,
    ]
  }

  return [
    selector.replace(/(^|[^\w-])#typora-sidebar\b/g, (_match, prefix) => `${prefix}${TYPORA_SIDEBAR_SCOPE}`),
  ]
}

function transformTyporaOutlineSelector(selector: string): string[] | null {
  if (!/(^|[^\w-])(?:#outline-content|\.outline-content)\b/.test(selector)) {
    return null
  }

  const bodyStateSelector = extractLeadingTyporaBodyStateSelector(selector)
  if (bodyStateSelector) {
    const outlineSelector = replaceTyporaOutlineRootSelector(bodyStateSelector.selector, '#outline-content')

    return [
      `${buildTyporaBodyScope(bodyStateSelector.classes)} ${outlineSelector}`,
    ]
  }

  return [
    replaceTyporaOutlineRootSelector(selector, TYPORA_OUTLINE_SCOPE),
  ]
}

function replaceTyporaOutlineRootSelector(selector: string, target: string): string {
  return selector.replace(
    /(^|[^\w-])(?:#outline-content|\.outline-content)\b/g,
    (_match, prefix) => `${prefix}${target}`,
  )
}

function extractLeadingTyporaBodyStateSelector(selector: string): { classes: string[]; selector: string } | null {
  const tokens = selector.trim().split(/\s+/)
  const classes: string[] = []
  let selectorStartIndex = 0

  for (let index = 0; index < tokens.length; index++) {
    const tokenClasses = parseClassOnlySelector(tokens[index])
    if (!tokenClasses || !tokenClasses.every((className) => TYPORA_BODY_STATE_CLASSES.has(className))) {
      break
    }

    classes.push(...tokenClasses)
    selectorStartIndex = index + 1
  }

  if (classes.length === 0 || selectorStartIndex >= tokens.length) {
    return null
  }

  return {
    classes,
    selector: tokens.slice(selectorStartIndex).join(' '),
  }
}

function parseClassOnlySelector(selector: string): string[] | null {
  if (!/^(?:\.[A-Za-z0-9_-]+)+$/.test(selector)) {
    return null
  }

  // Typora 主题常把平台、侧栏 tab、搜索等状态类挂在 body 上。
  return Array.from(selector.matchAll(/\.([A-Za-z0-9_-]+)/g)).map((item) => item[1])
}

function buildTyporaBodyScope(classes: string[]): string {
  return `${TYPORA_BODY_SCOPE}${classes.map((className) => `.${className}`).join('')}`
}

function transformTyporaInlineSelector(selector: string): string[] | null {
  const inlineTarget = getTyporaInlineTarget(selector)
  if (!inlineTarget) {
    return null
  }

  return TYPORA_CONTENT_SCOPES.map((scope) => `${scope} ${inlineTarget}`)
}

function getTyporaInlineTarget(selector: string): string | null {
  if (
    /span\[md-inline=(?:"|')highlight(?:"|')\]\s+mark/.test(selector) ||
    /(^|[^\w-])\.md-pair-s\s+mark/.test(selector)
  ) {
    return 'mark'
  }

  if (/span\[md-inline=(?:"|')underline(?:"|')\]\s+u/.test(selector)) {
    return 'u'
  }

  return null
}

function transformWriteSelector(selector: string): string[] | null {
  if (!/(^|[^\w-])\.write\b/.test(selector)) {
    return null
  }

  return TYPORA_CONTENT_SCOPES.map((scope) =>
    selector.replace(/(^|[^\w-])\.write\b/g, (_match, prefix) => `${prefix}${scope}`),
  )
}

function transformContentElementSelector(selector: string): string[] | null {
  if (!/^(blockquote|hr|figure|figcaption|img|table|thead|tbody|tfoot|tr|th|td|ul|ol|li|p|pre|a)(?=$|[\s>+~:#.[\]])/i.test(selector)) {
    return null
  }

  return TYPORA_CONTENT_SCOPES.map((scope) => `${scope} ${selector}`)
}

function scopeSelector(selector: string): string {
  if (selector.startsWith(TYPORA_SCOPE)) {
    return selector
  }

  if (selector === 'body' || selector === 'html' || selector === ':root') {
    return `${TYPORA_SCOPE} ${selector}`
  }

  return `${TYPORA_SCOPE} ${selector}`
}

function transformTyporaCodeFenceSelector(selector: string): string[] | null {
  const isCodeMirrorSelector = selector.includes('.CodeMirror') || /(^|[^\w-])\.cm-[\w-]+/.test(selector)
  const isFenceSelector = selector.includes('.md-fences')

  if (!isCodeMirrorSelector && !isFenceSelector) {
    return null
  }

  if (isCodeMirrorSelector) {
    return CODE_FENCE_CODE_TARGETS
  }

  if (selector.includes(' .') || selector.includes(' #')) {
    return []
  }

  let suffix = selector
    .replace(/^\.md-fences/, '')
    .replace(/\.md-fences-advanced/g, '')
    .replace(/\.md-focus/g, '')
    .replace(/\.md-tooltip-remove/g, '')

  if (suffix.includes(':has(')) {
    return []
  }

  if (suffix.includes('[lang]::before')) {
    suffix = suffix.replace('[lang]::before', '[lang]::before')
  }

  return CODE_FENCE_BLOCK_TARGETS.map((target) => `${target}${suffix}`)
}

function isTyporaShellSelector(selector: string): boolean {
  return TYPORA_SHELL_SELECTOR_PATTERNS.some((pattern) => pattern.test(selector))
}

function splitSelectors(selectorList: string): string[] {
  const selectors: string[] = []
  let current = ''
  let depth = 0
  let quote: string | null = null

  for (let index = 0; index < selectorList.length; index++) {
    const character = selectorList[index]

    if (quote) {
      current += character
      if (character === quote && selectorList[index - 1] !== '\\') {
        quote = null
      }
      continue
    }

    if (character === '"' || character === "'") {
      quote = character
      current += character
      continue
    }

    if (character === '(' || character === '[') {
      depth += 1
      current += character
      continue
    }

    if (character === ')' || character === ']') {
      depth = Math.max(0, depth - 1)
      current += character
      continue
    }

    if (character === ',' && depth === 0) {
      selectors.push(current)
      current = ''
      continue
    }

    current += character
  }

  if (current) {
    selectors.push(current)
  }

  return selectors
}

function dedupeSelectors(selectors: string[]): string[] {
  return Array.from(new Set(selectors.map((selector) => selector.trim()).filter(Boolean)))
}

function shouldKeepOriginalUrl(url: string): boolean {
  if (
    url.startsWith('data:') ||
    url.startsWith('http:') ||
    url.startsWith('https:') ||
    url.startsWith('//') ||
    url.startsWith('blob:') ||
    url.startsWith('file:') ||
    url.startsWith('#') ||
    url.startsWith('/')
  ) {
    return true
  }

  if (/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(url)) {
    return true
  }

  return url.includes('(') || url.includes(')')
}

function joinAssetPath(assetBasePath: string, relativePath: string): string {
  const normalizedRelativePath = relativePath.replace(/\\/g, '/')
  const queryIndex = findFirstQueryOrHashIndex(normalizedRelativePath)
  const pathPart = queryIndex === -1 ? normalizedRelativePath : normalizedRelativePath.slice(0, queryIndex)
  const suffix = queryIndex === -1 ? '' : normalizedRelativePath.slice(queryIndex)

  return `${joinPosixPath(assetBasePath, pathPart)}${suffix}`
}

function joinPosixPath(basePath: string, relativePath: string): string {
  const normalizedBasePath = basePath.replace(/\\/g, '/')
  const baseSegments = normalizedBasePath.split('/').filter(Boolean)
  const relativeSegments = relativePath.split('/')

  const resolvedSegments = [...baseSegments]
  const hasLeadingSlash = normalizedBasePath.startsWith('/')

  relativeSegments.forEach((segment) => {
    if (!segment || segment === '.') {
      return
    }

    if (segment === '..') {
      if (resolvedSegments.length > 0) {
        resolvedSegments.pop()
      }
      return
    }

    resolvedSegments.push(segment)
  })

  const joinedPath = resolvedSegments.join('/')
  return hasLeadingSlash ? `/${joinedPath}` : joinedPath
}

function findFirstQueryOrHashIndex(value: string): number {
  const queryIndex = value.indexOf('?')
  const hashIndex = value.indexOf('#')

  if (queryIndex === -1) {
    return hashIndex
  }

  if (hashIndex === -1) {
    return queryIndex
  }

  return Math.min(queryIndex, hashIndex)
}

function findNextTopLevelBlockStart(css: string, fromIndex: number): { start: number; braceIndex: number } | -1 {
  let quote: string | null = null
  let inComment = false

  for (let index = fromIndex; index < css.length; index++) {
    const character = css[index]
    const nextCharacter = css[index + 1]

    if (inComment) {
      if (character === '*' && nextCharacter === '/') {
        inComment = false
        index += 1
      }
      continue
    }

    if (quote) {
      if (character === quote && css[index - 1] !== '\\') {
        quote = null
      }
      continue
    }

    if (character === '/' && nextCharacter === '*') {
      inComment = true
      index += 1
      continue
    }

    if (character === '"' || character === "'") {
      quote = character
      continue
    }

    if (character === '{') {
      return { start: fromIndex, braceIndex: index }
    }
  }

  return -1
}

function findMatchingBrace(css: string, openBraceIndex: number): number {
  let depth = 0
  let quote: string | null = null
  let inComment = false

  for (let index = openBraceIndex; index < css.length; index++) {
    const character = css[index]
    const nextCharacter = css[index + 1]

    if (inComment) {
      if (character === '*' && nextCharacter === '/') {
        inComment = false
        index += 1
      }
      continue
    }

    if (quote) {
      if (character === quote && css[index - 1] !== '\\') {
        quote = null
      }
      continue
    }

    if (character === '/' && nextCharacter === '*') {
      inComment = true
      index += 1
      continue
    }

    if (character === '"' || character === "'") {
      quote = character
      continue
    }

    if (character === '{') {
      depth += 1
      continue
    }

    if (character === '}') {
      depth -= 1
      if (depth === 0) {
        return index
      }
    }
  }

  return -1
}

function transformTextChunk(text: string): string {
  return text
}

function stripCssComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '')
}

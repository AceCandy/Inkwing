import type { TyporaCssAdaptOptions } from './types'

const TYPORA_SCOPE = '.typora-theme-scope'
const TYPORA_BODY_SCOPE = 'body.typora-theme-scope'
const TYPORA_EDITOR_SCOPE = `${TYPORA_BODY_SCOPE} #write`
const TYPORA_PREVIEW_SCOPE = `${TYPORA_SCOPE} .preview-content`
const TYPORA_SIDEBAR_SCOPE = `${TYPORA_BODY_SCOPE} #typora-sidebar`
const TYPORA_RESIZER_SCOPE = `${TYPORA_BODY_SCOPE} #typora-sidebar-resizer`
const TYPORA_OUTLINE_ID_SCOPE = `${TYPORA_BODY_SCOPE} #outline-content`
const TYPORA_OUTLINE_CLASS_SCOPE = `${TYPORA_BODY_SCOPE} .outline-content`
const TYPORA_LINE_HEIGHT_VARIABLE = '--typora-line-height'
const TYPORA_CONTENT_SCOPES = [TYPORA_EDITOR_SCOPE, TYPORA_PREVIEW_SCOPE] as const

const CODE_FENCE_BLOCK_TARGETS = [
  `${TYPORA_EDITOR_SCOPE} pre`,
  `${TYPORA_PREVIEW_SCOPE} pre`,
]
const CODE_FENCE_CODE_TARGETS = CODE_FENCE_BLOCK_TARGETS.map((selector) => `${selector} code`)

const TYPORA_SHELL_SELECTOR_PATTERNS = [
  /(^|[^\w-])#typora-/i,
  /(^|[^\w-])\.ty-/i,
  /(^|[^\w-])\.CodeMirror(?:$|[-\w])/i,
]
const TYPORA_SUPPORTED_SHELL_SELECTOR_PATTERNS = [
  /(^|[^\w-])\.stopselect\.dropmenu\.sidebar-menu\b/i,
  /(^|[^\w-])\.ty-sidebar-search-panel\b/i,
  /(^|[^\w-])#ty-sidebar-search-tabs\b/i,
  /(^|[^\w-])#ty-sidebar-search-back-btn\b/i,
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
  'no-animation',
  'no-collapse-outline',
  'os-windows',
  'pin-outline',
  'ty-on-outline-filter',
  'ty-on-search',
  'ty-show-outline-filter',
  'ty-show-search',
])
const TYPORA_SIDEBAR_STATE_CLASSES = new Set([
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

  let cursor = 0
  while (cursor < cleanedCss.length) {
    const nextBlockStart = findNextTopLevelBlockStart(cleanedCss, cursor)
    if (nextBlockStart === -1) {
      break
    }

    const blockEnd = findMatchingBrace(cleanedCss, nextBlockStart.braceIndex)
    if (blockEnd === -1) {
      break
    }

    const prelude = cleanedCss.slice(nextBlockStart.start, nextBlockStart.braceIndex).trim()
    if (prelude && !prelude.startsWith('@')) {
      const selectors = splitSelectors(prelude)
      if (selectors.some(isTyporaRootVariableSelector)) {
        const body = cleanedCss.slice(nextBlockStart.braceIndex + 1, blockEnd)
        body.replace(/--[A-Za-z0-9_-]+\s*:\s*[^;{}]+;/g, (declaration) => {
          const match = declaration.match(/(--[A-Za-z0-9_-]+)\s*:\s*([^;{}]+);/)
          if (match) {
            result[match[1]] = match[2].trim()
          }
          return declaration
        })
      }
    }

    cursor = blockEnd + 1
  }

  const rootLineHeight = extractTyporaRootLineHeight(cleanedCss)
  if (rootLineHeight) {
    result[TYPORA_LINE_HEIGHT_VARIABLE] = rootLineHeight
  }

  return result
}

function extractTyporaRootLineHeight(css: string): string | null {
  let cursor = 0
  let lineHeight: string | null = null

  while (cursor < css.length) {
    const nextBlockStart = findNextTopLevelBlockStart(css, cursor)

    if (nextBlockStart === -1) {
      break
    }

    const blockEnd = findMatchingBrace(css, nextBlockStart.braceIndex)
    if (blockEnd === -1) {
      break
    }

    const prelude = stripCssComments(css.slice(nextBlockStart.start, nextBlockStart.braceIndex)).trim()
    if (prelude && !prelude.startsWith('@')) {
      const selectors = splitSelectors(prelude)
      if (selectors.some(isTyporaRootLineHeightSelector)) {
        const body = css.slice(nextBlockStart.braceIndex + 1, blockEnd)
        const match = body.match(/(?:^|[;\s])line-height\s*:\s*([^;{}]+);/i)
        const nextLineHeight = match?.[1].trim()
        if (nextLineHeight && isConcreteTyporaLineHeightValue(nextLineHeight)) {
          lineHeight = nextLineHeight
        }
      }
    }

    cursor = blockEnd + 1
  }

  return lineHeight
}

function isTyporaRootVariableSelector(selector: string): boolean {
  const normalizedSelector = selector.trim()
  return (
    normalizedSelector === 'html' ||
    normalizedSelector === 'body' ||
    normalizedSelector === ':root' ||
    normalizedSelector === ':host' ||
    normalizedSelector === 'html body'
  )
}

function isConcreteTyporaLineHeightValue(value: string): boolean {
  return !/^(?:inherit|initial|unset|revert|revert-layer)$/i.test(value.trim())
}

function isTyporaRootLineHeightSelector(selector: string): boolean {
  const normalizedSelector = selector.trim()
  return (
    normalizedSelector === 'html' ||
    normalizedSelector === 'body' ||
    normalizedSelector === ':root' ||
    normalizedSelector === ':host'
  )
}

export function adaptTyporaCss(css: string, options: TyporaCssAdaptOptions): string {
  const cssWithAssetsRewritten = rewriteCssAssetUrls(css, options.assetBasePath, options.toAssetUrl)
  return transformStylesheet(cssWithAssetsRewritten)
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
  const transformedSelectors = dedupeSelectors(
    selectors
      .flatMap((selector) => transformSelector(selector))
      .flatMap((selector) => expandTyporaOutlineActiveWrapperSelector(selector))
      .filter(Boolean),
  )

  if (transformedSelectors.length === 0) {
    return ''
  }

  return `${transformedSelectors.join(', ')}{${transformRuleBody(body)}}`
}

function expandTyporaOutlineActiveWrapperSelector(selector: string): string[] {
  const expandedSelector = selector.replace(
    /\.outline-item-active\s*>\s*\.outline-item\b/g,
    '.outline-item-active',
  )

  if (expandedSelector === selector) {
    return [selector]
  }

  return [selector, expandedSelector]
}

function transformRuleBody(body: string): string {
  return body
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

  const supportedShellSelectors = transformSupportedTyporaShellSelector(trimmedSelector)
  if (supportedShellSelectors) {
    return supportedShellSelectors
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

  const bodyClasses = bodyStateSelector.classes.filter((className) => !TYPORA_SIDEBAR_STATE_CLASSES.has(className))
  const sidebarClasses = bodyStateSelector.classes.filter((className) => TYPORA_SIDEBAR_STATE_CLASSES.has(className))
  if (sidebarClasses.length > 0) {
    return [
      `${buildTyporaBodyScope(bodyClasses)} ${buildTyporaSidebarStateScope(sidebarClasses)} ${bodyStateSelector.selector}`,
    ]
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
    const outlineSelector = replaceTyporaOutlineRootSelector(
      bodyStateSelector.selector,
      '#outline-content',
      '.outline-content',
    )

    return [
      `${buildTyporaBodyScope(bodyStateSelector.classes)} ${outlineSelector}`,
    ]
  }

  return [
    replaceTyporaOutlineRootSelector(selector, TYPORA_OUTLINE_ID_SCOPE, TYPORA_OUTLINE_CLASS_SCOPE),
  ]
}

function replaceTyporaOutlineRootSelector(selector: string, idTarget: string, classTarget: string): string {
  return selector.replace(
    /(^|[^\w-])(#outline-content|\.outline-content)\b/g,
    (_match, prefix, outlineRoot) => `${prefix}${outlineRoot === '#outline-content' ? idTarget : classTarget}`,
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

function buildTyporaSidebarStateScope(classes: string[]): string {
  return `#typora-sidebar${classes.map((className) => `.${className}`).join('')}`
}

function transformSupportedTyporaShellSelector(selector: string): string[] | null {
  if (!TYPORA_SUPPORTED_SHELL_SELECTOR_PATTERNS.some((pattern) => pattern.test(selector))) {
    return null
  }

  return [scopeSelector(selector)]
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

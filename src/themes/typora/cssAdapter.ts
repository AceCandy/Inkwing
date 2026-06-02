import type { TyporaCssAdaptOptions } from './types'

const TYPORA_SCOPE = '.typora-theme-scope'
const TYPORA_EDITOR_SCOPE = `${TYPORA_SCOPE} .milkdown .editor`
const TYPORA_PREVIEW_SCOPE = `${TYPORA_SCOPE} .preview-content`

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
  if (!prelude) {
    return `{${transformStylesheet(body)}}`
  }

  if (prelude.startsWith('@')) {
    if (PASSTHROUGH_AT_RULES.has(prelude.split(/\s+/)[0])) {
      return `${prelude}{${body}}`
    }

    return `${prelude}{${transformStylesheet(body)}}`
  }

  const selectors = splitSelectors(prelude)
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

    return mappedVariables.map((mappedVariable) => `${mappedVariable}: ${value.trim()};`).join(' ')
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

  if (trimmedSelector === 'body' || trimmedSelector === 'html' || trimmedSelector === ':root') {
    return [TYPORA_SCOPE]
  }

  return [scopeSelector(trimmedSelector)]
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

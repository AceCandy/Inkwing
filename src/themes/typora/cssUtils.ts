// CSS 工具：从已删除的 cssAdapter.ts 中保留的非作用域化纯函数。
// 方案 A 不再做选择器作用域重写（Typora CSS 原样注入），但这两个工具仍是必要的：
//   - rewriteCssAssetUrls：重写主题 CSS 里的相对 url() 到 Tauri asset 协议
//   - extractTyporaShellVariables：从主题 :root/html/body 提取 CSS 变量

export function rewriteCssAssetUrls(
  css: string,
  options: { assetBasePath: string; toAssetUrl: (path: string) => string },
): string {
  const { assetBasePath, toAssetUrl } = options
  return css.replace(/url\(\s*(?:(["'])(.*?)\1|([^)]*?))\s*\)/gi, (match, quoted, quotedUrl, bareUrl) => {
    const url = String(quotedUrl ?? bareUrl ?? '').trim()

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
    if (nextBlockStart === -1) break

    const blockEnd = findMatchingBrace(cleanedCss, nextBlockStart.braceIndex)
    if (blockEnd === -1) break

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
    result['--typora-line-height'] = rootLineHeight
  }

  return result
}

function extractTyporaRootLineHeight(css: string): string | null {
  let cursor = 0
  let lineHeight: string | null = null

  while (cursor < css.length) {
    const nextBlockStart = findNextTopLevelBlockStart(css, cursor)
    if (nextBlockStart === -1) break

    const blockEnd = findMatchingBrace(css, nextBlockStart.braceIndex)
    if (blockEnd === -1) break

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
    if (!segment || segment === '.') return
    if (segment === '..') {
      if (resolvedSegments.length > 0) resolvedSegments.pop()
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
  if (queryIndex === -1) return hashIndex
  if (hashIndex === -1) return queryIndex
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
      if (character === quote && css[index - 1] !== '\\') quote = null
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
      if (character === quote && css[index - 1] !== '\\') quote = null
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
      if (depth === 0) return index
    }
  }

  return -1
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
      if (character === quote && selectorList[index - 1] !== '\\') quote = null
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

  if (current) selectors.push(current)
  return selectors
}

function stripCssComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '')
}

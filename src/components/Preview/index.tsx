import React, { useMemo } from 'react'
import katex from 'katex'
import { Renderer, marked } from 'marked'
import { useEditorStore } from '../../stores/editorStore'
import { replaceEmojiShortcodes } from '../Editor/typoraDecorations'
import './styles.css'

/**
 * 渲染数学公式为 HTML 字符串
 */
function renderMathToHTML(tex: string, displayMode: boolean): string {
  try {
    return katex.renderToString(tex, {
      displayMode,
      throwOnError: false,
      errorColor: '#f38ba8',
      strict: false,
    })
  } catch {
    const delimiters = displayMode ? '$$' : '$'
    return `<span class="math-error">${delimiters}${tex}${delimiters}</span>`
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replace(/"/g, '&quot;')
}

function renderCodeFence(markdownFence: string): string {
  const match = markdownFence.match(/^```([^\n`]*)\n?([\s\S]*?)```$/)
  const language = match?.[1]?.trim() ?? ''
  const code = match?.[2] ?? markdownFence
  const langAttr = language ? ` lang="${escapeAttribute(language)}"` : ''

  return `<pre class="md-fences"${langAttr}><code>${escapeHtml(code.trim())}</code></pre>`
}

function protectCode(markdown: string): { markdown: string; restore: (value: string) => string } {
  const placeholders: string[] = []
  let nextMarkdown = markdown.replace(/```[\s\S]*?```/g, (match) => {
    const placeholder = `%%CODE_BLOCK_${placeholders.length}%%`
    placeholders.push(match)
    return placeholder
  })

  nextMarkdown = nextMarkdown.replace(/`([^`]+)`/g, (match) => {
    const placeholder = `%%CODE_INLINE_${placeholders.length}%%`
    placeholders.push(match)
    return placeholder
  })

  return {
    markdown: nextMarkdown,
    restore: (value: string) => placeholders.reduce(
      (result, code, index) => result.replace(`%%CODE_${code.startsWith('```') ? 'BLOCK' : 'INLINE'}_${index}%%`, code),
      value,
    ),
  }
}

function applyTyporaInlineSyntax(markdown: string): string {
  return replaceEmojiShortcodes(markdown)
    .replace(/==([^=\n][\s\S]*?[^=\n])==/g, (_match, text) => `<mark>${escapeHtml(text)}</mark>`)
    .replace(/(?<!~)~([^~\s][^~\n]*?)~(?!~)/g, (_match, text) => `<sub>${escapeHtml(text)}</sub>`)
    .replace(/\^([^\^\s][^\^\n]*?)\^/g, (_match, text) => `<sup>${escapeHtml(text)}</sup>`)
}

// 简易 Markdown 转 HTML（支持数学公式）
export function simpleMarkdownToHTML(markdown: string): string {
  // 占位符映射，保护数学公式不被其他规则破坏
  const mathPlaceholders: string[] = []

  const protectMath = (html: string): string => {
    // 先处理块级公式 $$...$$（支持跨行）
    html = html.replace(/\$\$([\s\S]*?)\$\$/g, (_match, tex) => {
      const rendered = renderMathToHTML(tex.trim(), true)
      const placeholder = `%%MATH_BLOCK_${mathPlaceholders.length}%%`
      mathPlaceholders.push(`<div class="math-block">${rendered}</div>`)
      return placeholder
    })
    // 再处理行内公式 $...$（不匹配转义的 \$ 和空内容）
    html = html.replace(/(?<![\\$])\$([^\$\n]+?)\$(?!\$)/g, (_match, tex) => {
      const rendered = renderMathToHTML(tex.trim(), false)
      const placeholder = `%%MATH_INLINE_${mathPlaceholders.length}%%`
      mathPlaceholders.push(`<span class="math-inline">${rendered}</span>`)
      return placeholder
    })
    return html
  }

  const protectedCode = protectCode(markdown)
  const preparedMarkdown = protectedCode.restore(applyTyporaInlineSyntax(protectMath(protectedCode.markdown)))
  const renderer = new Renderer()
  renderer.code = (token) => {
    const language = token.lang?.trim() ?? ''
    const langAttr = language ? ` lang="${escapeAttribute(language)}"` : ''
    return `<pre class="md-fences"${langAttr}><code>${escapeHtml(token.text.trim())}</code></pre>`
  }
  renderer.listitem = function (token) {
    const body = this.parser.parse(token.tokens)

    if (!token.task) {
      return `<li>${body}</li>\n`
    }

    return `<li class="md-task-list-item">${body}</li>\n`
  }
  renderer.table = function (token) {
    const header = token.header.map((cell) => this.tablecell(cell)).join('')
    const rows = token.rows
      .map((row) => this.tablerow({ text: row.map((cell) => this.tablecell(cell)).join('') }))
      .join('')
    const tableBody = rows ? `<tbody>${rows}</tbody>` : ''

    return [
      '<figure class="md-table-fig table-figure">',
      '<table>',
      '<thead>',
      this.tablerow({ text: header }),
      '</thead>',
      tableBody,
      '</table>',
      '</figure>',
      '',
    ].join('\n')
  }

  let html = marked.parse(preparedMarkdown, {
    async: false,
    gfm: true,
    renderer,
  }) as string

  mathPlaceholders.forEach((math, index) => {
    html = html.replace(`<p>%%MATH_BLOCK_${index}%%</p>`, math)
    html = html.replace(`%%MATH_BLOCK_${index}%%`, math)
    html = html.replace(`%%MATH_INLINE_${index}%%`, math)
  })

  return html
}

export const Preview: React.FC = () => {
  const { content } = useEditorStore()

  const htmlContent = useMemo(() => simpleMarkdownToHTML(content), [content])

  return (
    <div className="preview-container">
      <div
        className="preview-content"
        dangerouslySetInnerHTML={{ __html: htmlContent }}
      />
    </div>
  )
}

export default Preview

import React, { useMemo } from 'react'
import katex from 'katex'
import { useEditorStore } from '../../stores/editorStore'
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

  // 先保护代码块
  const codePlaceholders: string[] = []
  let html = markdown.replace(/```[\s\S]*?```/g, (match) => {
    const placeholder = `%%CODE_BLOCK_${codePlaceholders.length}%%`
    codePlaceholders.push(renderCodeFence(match))
    return placeholder
  })

  // 保护行内代码
  html = html.replace(/`([^`]+)`/g, (_match, code) => {
    const placeholder = `%%CODE_INLINE_${codePlaceholders.length}%%`
    codePlaceholders.push(`<code>${escapeHtml(code)}</code>`)
    return placeholder
  })

  // 保护数学公式
  html = protectMath(html)

  // Markdown 转换
  html = html
    // 标题
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    // 粗体和斜体
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    // 链接
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    // 图片
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />')
    // 引用块
    .replace(/^\> (.*$)/gim, '<blockquote><p>$1</p></blockquote>')
    // 分割线
    .replace(/^---$/gim, '<hr />')
    // 无序列表
    .replace(/^\s*[\-\*]\s+(.*$)/gim, '<li>$1</li>')
    // 有序列表
    .replace(/^\s*\d+\.\s+(.*$)/gim, '<li>$1</li>')
    // 段落
    .replace(/\n\n/g, '</p><p>')
    // 换行
    .replace(/\n/g, '<br />')

  // 包装在段落中
  html = `<p>${html}</p>`

  // 清理空段落和嵌套标签
  html = html.replace(/<p><\/p>/g, '')
  html = html.replace(/<p>(<h[1-6]>)/g, '$1')
  html = html.replace(/(<\/h[1-6]>)<\/p>/g, '$1')
  html = html.replace(/<p>(<hr\s*\/?>)/g, '$1')
  html = html.replace(/(<hr\s*\/?>)<\/p>/g, '$1')
  html = html.replace(/<p>(<blockquote>)/g, '$1')
  html = html.replace(/(<\/blockquote>)<\/p>/g, '$1')
  html = html.replace(/<p>(<div class="math-block">)/g, '$1')
  html = html.replace(/(<\/div>)<\/p>/g, '$1')

  // 恢复占位符
  codePlaceholders.forEach((code, index) => {
    html = html.replace(`%%CODE_BLOCK_${index}%%`, code)
    html = html.replace(`%%CODE_INLINE_${index}%%`, code)
  })
  mathPlaceholders.forEach((math, index) => {
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

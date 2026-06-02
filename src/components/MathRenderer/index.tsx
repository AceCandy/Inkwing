import React, { useMemo } from 'react'
import katex from 'katex'

interface MathRendererProps {
  math: string
  displayMode?: boolean
}

/**
 * KaTeX 数学公式渲染组件
 * 支持行内公式（displayMode=false）和块级公式（displayMode=true）
 */
export const MathRenderer: React.FC<MathRendererProps> = ({ math, displayMode = false }) => {
  const html = useMemo(() => {
    try {
      return katex.renderToString(math, {
        displayMode,
        throwOnError: false,
        errorColor: '#f38ba8',
        strict: false,
      })
    } catch {
      return `<span class="math-error" style="color: #f38ba8;">${displayMode ? '$$' : '$'}${math}${displayMode ? '$$' : '$'}</span>`
    }
  }, [math, displayMode])

  const className = displayMode ? 'math-block' : 'math-inline'

  return (
    <span
      className={className}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

export default MathRenderer

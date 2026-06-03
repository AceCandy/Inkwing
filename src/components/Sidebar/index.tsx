import React, { useMemo, useCallback, useState } from 'react'
import { useEditorStore } from '../../stores/editorStore'
import { useLanguage } from '../../i18n'
import { useAppLogo } from '../../hooks/useAppLogo'
import './styles.css'

// 从 Markdown 内容提取标题生成大纲
function extractHeadings(content: string): Array<{ level: number; text: string }> {
  const headings: Array<{ level: number; text: string }> = []
  const lines = content.split('\n')

  for (const line of lines) {
    const match = line.match(/^(#{1,6})\s+(.+)$/)
    if (match) {
      headings.push({
        level: match[1].length,
        text: match[2].trim(),
      })
    }
  }

  return headings
}

type HeadingNode = {
  level: number
  text: string
  originalIndex: number
  children: HeadingNode[]
}

// 将扁平标题序列还原为 Typora 大纲 CSS 期望的树形结构。
function buildHeadingTree(headings: Array<{ level: number; text: string }>): HeadingNode[] {
  const roots: HeadingNode[] = []
  const stack: HeadingNode[] = []

  headings.forEach((heading, originalIndex) => {
    const node: HeadingNode = {
      ...heading,
      originalIndex,
      children: [],
    }

    while (stack.length > 0 && stack[stack.length - 1].level >= node.level) {
      stack.pop()
    }

    const parent = stack[stack.length - 1]
    if (parent) {
      parent.children.push(node)
    } else {
      roots.push(node)
    }

    stack.push(node)
  })

  return roots
}

function flattenVisibleHeadings(
  nodes: HeadingNode[],
  collapsedIndices: Record<number, boolean>,
): Array<{ level: number; text: string; originalIndex: number; hasChildren: boolean }> {
  const result: Array<{ level: number; text: string; originalIndex: number; hasChildren: boolean }> = []

  nodes.forEach((node) => {
    const hasChildren = node.children.length > 0
    result.push({
      level: node.level,
      text: node.text,
      originalIndex: node.originalIndex,
      hasChildren,
    })

    if (hasChildren && !collapsedIndices[node.originalIndex]) {
      result.push(...flattenVisibleHeadings(node.children, collapsedIndices))
    }
  })

  return result
}

// 展开/折叠小箭头组件
const ArrowIcon: React.FC<{ collapsed: boolean }> = ({ collapsed }) => (
  <svg
    viewBox="0 0 24 24"
    width="12"
    height="12"
    stroke="currentColor"
    strokeWidth="2.5"
    fill="none"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{
      transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
      transition: 'transform 0.2s ease',
      color: 'var(--text-secondary)',
      display: 'block'
    }}
  >
    <polyline points="6 9 12 15 18 9" />
  </svg>
)

export const Sidebar: React.FC = () => {
  const { showSidebar, content } = useEditorStore()
  const { t } = useLanguage()
  const logoSmall = useAppLogo()

  const headings = useMemo(() => extractHeadings(content), [content])
  const headingTree = useMemo(() => buildHeadingTree(headings), [headings])

  // 记录哪些索引的大纲项被折叠了
  const [collapsedIndices, setCollapsedIndices] = useState<Record<number, boolean>>({})

  // 搜索相关状态
  const [isSearching, setIsSearching] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // 切换折叠状态
  const toggleCollapse = useCallback((index: number, e: React.MouseEvent) => {
    e.stopPropagation() // 阻止触发跳转
    setCollapsedIndices(prev => ({
      ...prev,
      [index]: !prev[index],
    }))
  }, [])

  // 点击大纲项跳转到编辑器中对应的标题
  const handleHeadingClick = useCallback((text: string) => {
    const editorRoot = document.querySelector('.milkdown .editor')
    if (!editorRoot) return

    const headingElements = editorRoot.querySelectorAll('h1, h2, h3, h4, h5, h6')
    for (const el of headingElements) {
      if (el.textContent?.trim() === text) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
        break
      }
    }
  }, [])

  // 计算当前可见的大纲项
  const visibleHeadings = useMemo(() => {
    return flattenVisibleHeadings(headingTree, collapsedIndices)
  }, [headingTree, collapsedIndices])

  // 过滤后的大纲列表（实时搜索）
  const filteredHeadings = useMemo(() => {
    if (!searchQuery.trim()) return visibleHeadings

    const query = searchQuery.toLowerCase().trim()
    return visibleHeadings.filter(heading =>
      heading.text.toLowerCase().includes(query)
    )
  }, [visibleHeadings, searchQuery])

  if (!showSidebar) {
    return null
  }

  const renderOutlineNodes = (nodes: HeadingNode[]): React.ReactNode =>
    nodes.map((node) => {
      const hasChildren = node.children.length > 0
      const isCollapsed = !!collapsedIndices[node.originalIndex]
      const isActive = node.originalIndex === 0
      const stateClass = hasChildren
        ? (isCollapsed ? 'outline-item-close' : 'outline-item-open')
        : 'outline-item-signle outline-item-single'

      return (
        <li
          key={node.originalIndex}
          className={`outline-item-wrapper outline-h${node.level} level-${node.level} ${stateClass}`}
        >
          <div
            className={`outline-item${isActive ? ' outline-item-active' : ''}`}
            onClick={() => handleHeadingClick(node.text)}
          >
            <span
              className="outline-expander outline-arrow-container"
              onClick={(e) => {
                if (hasChildren) {
                  toggleCollapse(node.originalIndex, e)
                }
              }}
            >
              {hasChildren ? (
                <ArrowIcon collapsed={isCollapsed} />
              ) : (
                <span className="outline-arrow-spacer" />
              )}
            </span>
            <span
              className={`outline-label outline-text${isActive ? ' outline-active' : ''}`}
              data-ref={`n${node.originalIndex}`}
            >
              {node.text}
            </span>
          </div>
          <ul className="outline-children">
            {hasChildren && !isCollapsed ? renderOutlineNodes(node.children) : null}
          </ul>
        </li>
      )
    })

  const renderSearchResults = (): React.ReactNode =>
    filteredHeadings.map((heading) => {
      const isCollapsed = !!collapsedIndices[heading.originalIndex]

      return (
        <li
          key={heading.originalIndex}
          className={`outline-item-wrapper outline-h${heading.level} level-${heading.level} outline-item-signle outline-item-single`}
          style={{ paddingLeft: `${(heading.level - 1) * 12}px` }}
        >
          <div className="outline-item" onClick={() => handleHeadingClick(heading.text)}>
            <span
              className="outline-expander outline-arrow-container"
              onClick={(e) => {
                if (heading.hasChildren) {
                  toggleCollapse(heading.originalIndex, e)
                }
              }}
            >
              {heading.hasChildren ? (
                <ArrowIcon collapsed={isCollapsed} />
              ) : (
                <span className="outline-arrow-spacer" />
              )}
            </span>
            <span className="outline-label outline-text" data-ref={`n${heading.originalIndex}`}>
              {heading.text}
            </span>
          </div>
        </li>
      )
    })

  return (
    <aside id="typora-sidebar" className="sidebar stopselect dropmenu sidebar-menu active-tab-outline open" role="menu">
      <div className="sidebar-header">
        {isSearching ? (
          <div className="sidebar-search-header">
            <button className="search-back-btn" onClick={() => { setIsSearching(false); setSearchQuery(''); }} title="返回">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
            </button>
            <input
              className="search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索大纲..."
              autoFocus
            />
          </div>
        ) : (
          <div className="sidebar-title-header">
            <div className="sidebar-title-container">
              <img src={logoSmall} alt="Logo" className="sidebar-title-logo" />
              <h3>大纲</h3>
            </div>
            <button className="sidebar-header-search-btn" onClick={() => setIsSearching(true)} title="搜索">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </button>
          </div>
        )}
      </div>
      <div id="sidebar-content" className="sidebar-content">
        {headings.length === 0 ? (
          <p className="sidebar-empty">{t('sidebar.empty')}</p>
        ) : filteredHeadings.length === 0 ? (
          <p className="sidebar-empty">无匹配结果</p>
        ) : (
          <ul
            id="outline-content"
            className="outline-list outline-content sidebar-content-content"
            data-after-content="大纲内容为空"
          >
            {searchQuery.trim() ? renderSearchResults() : renderOutlineNodes(headingTree)}
          </ul>
        )}
      </div>
    </aside>
  )
}

export default Sidebar

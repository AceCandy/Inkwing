import React, { useMemo, useCallback, useState } from 'react'
import { useEditorStore } from '../../stores/editorStore'
import { useLanguage } from '../../i18n'
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

  const headings = useMemo(() => extractHeadings(content), [content])

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

  // 判断原始列表中某个节点是否有子标题
  const hasChildren = useCallback((originalIndex: number) => {
    const current = headings[originalIndex]
    const next = headings[originalIndex + 1]
    return next && next.level > current.level
  }, [headings])

  // 计算当前可见的大纲项
  const visibleHeadings = useMemo(() => {
    const visible: Array<{ level: number; text: string; originalIndex: number }> = []
    let currentHiddenLevel = 999

    for (let i = 0; i < headings.length; i++) {
      const heading = headings[i]

      // 如果当前级别小于等于折叠的父级别，说明出了折叠范围，重置隐藏限制
      if (heading.level <= currentHiddenLevel) {
        currentHiddenLevel = 999
      }

      if (currentHiddenLevel === 999) {
        visible.push({
          ...heading,
          originalIndex: i,
        })
      }

      // 如果当前节点被折叠，更新隐藏的最大层级
      if (collapsedIndices[i]) {
        currentHiddenLevel = Math.min(currentHiddenLevel, heading.level)
      }
    }
    return visible;
  }, [headings, collapsedIndices])

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

  return (
    <aside className="sidebar">
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
            <h3>大纲</h3>
            <button className="sidebar-header-search-btn" onClick={() => setIsSearching(true)} title="搜索">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </button>
          </div>
        )}
      </div>
      <div className="sidebar-content">
        {headings.length === 0 ? (
          <p className="sidebar-empty">{t('sidebar.empty')}</p>
        ) : filteredHeadings.length === 0 ? (
          <p className="sidebar-empty">无匹配结果</p>
        ) : (
          <ul className="outline-list">
            {filteredHeadings.map((heading) => {
              const showArrow = hasChildren(heading.originalIndex)
              const isCollapsed = !!collapsedIndices[heading.originalIndex]
              return (
                <li
                  key={heading.originalIndex}
                  className={`outline-item level-${heading.level}`}
                  style={{ paddingLeft: `${(heading.level - 1) * 12}px` }}
                  onClick={() => handleHeadingClick(heading.text)}
                >
                  <span
                    className="outline-arrow-container"
                    onClick={(e) => {
                      if (showArrow) {
                        toggleCollapse(heading.originalIndex, e)
                      }
                    }}
                  >
                    {showArrow ? (
                      <ArrowIcon collapsed={isCollapsed} />
                    ) : (
                      <span className="outline-arrow-spacer" />
                    )}
                  </span>
                  <span className="outline-text">{heading.text}</span>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </aside>
  )
}

export default Sidebar

import React, { useMemo, useCallback, useState } from 'react'
import { useEditorStore } from '../../stores/editorStore'
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

export const Sidebar: React.FC = () => {
  const { showSidebar, content } = useEditorStore()

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
          className={`outline-item-wrapper outline-h${node.level} ${stateClass}`}
        >
          <div
            className={`outline-item${isActive ? ' outline-item-active' : ''}`}
            onClick={() => handleHeadingClick(node.text)}
          >
            <span
              className="outline-expander"
              onClick={(e) => {
                if (hasChildren) {
                  toggleCollapse(node.originalIndex, e)
                }
              }}
            />
            <span
              className={`outline-label${isActive ? ' outline-active' : ''}`}
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
      return (
        <li
          key={heading.originalIndex}
          className={`outline-item-wrapper outline-h${heading.level} outline-item-signle outline-item-single`}
        >
          <div className="outline-item" onClick={() => handleHeadingClick(heading.text)}>
            <span
              className="outline-expander"
              onClick={(e) => {
                if (heading.hasChildren) {
                  toggleCollapse(heading.originalIndex, e)
                }
              }}
            />
            <span className="outline-label" data-ref={`n${heading.originalIndex}`}>
              {heading.text}
            </span>
          </div>
        </li>
      )
    })

  return (
    <>
      <div aria-hidden="true" className="dropdown-menu stopselect dropmenu" id="toc-dropmenu" role="menu">
        <div className="outline-title-wrapper">
          <span className="outline-title" data-localize="Outline" data-lg="Front">大纲</span>
          <span className="btn fa fa-arrow-circle-left" id="pin-outline-btn" />
        </div>
        <div className="divider outline-title-divider" />
        <div role="list" id="toc-content" className="outline-content" data-after-content="大纲内容为空" />
      </div>

      <div
        aria-hidden="true"
        className="stopselect dropmenu sidebar-menu open use-file-tree-style active-tab-outline"
        id="typora-sidebar"
        role="menu"
      >
      <div className="info-panel-tab-wrapper ty-tab-wrapper">
        <div style={{ flex: 1 }} />
        <div className="info-panel-tab" id="info-panel-tab-file">
          <div className="info-panel-tab-title" data-localize="Files" data-lg="Front">文件</div>
          <div className="info-panel-tab-border" />
        </div>
        <div className="info-panel-tab" id="info-panel-tab-search-back">
          <div className="info-panel-tab-title" data-localize="Files" data-lg="Front">文件</div>
          <div className="info-panel-tab-border" />
        </div>
        <div style={{ flex: 1 }} />
        <div className="info-panel-tab" id="info-panel-tab-outline">
          <div className="info-panel-tab-title" data-localize="Outline" data-lg="Front">大纲</div>
          <div className="info-panel-tab-border" />
        </div>
        <div className="info-panel-tab" id="info-panel-tab-search">
          <div className="info-panel-tab-title" data-localize="Search" data-lg="Front">查找</div>
          <div className="info-panel-tab-border" />
        </div>
        <div style={{ flex: 1 }} />
      </div>

      <div className={`sidebar-osx-tab ty-tab-wrapper${isSearching ? ' searching' : ''}`}>
        <div className="sidebar-tabs">
          <div
            aria-label="切换到文件树视图"
            className="sidebar-tab-btn"
            id="switch-sidebar-icon"
            ty-hint="切换到文件树视图"
          >
            <span className="ty-icon ty-file-tree" />
          </div>
          <div className="sidebar-tab" id="sidepanel-segmented-input-files">文件</div>
          <div
            className="sidebar-tab active"
            data-localize="Outline"
            data-lg="Front"
            id="sidepanel-segmented-input-outline"
          >
            大纲
          </div>
          <div
            aria-label="查找"
            className="sidebar-tab-btn"
            id="sidebar-search-btn"
            onClick={() => setIsSearching(true)}
            ty-hint="查找"
          >
            <span className="ion-ios7-search-strong" />
          </div>
        </div>
        <div className="ty-sidebar-search-panel" id="ty-sidebar-search-tabs">
          <div className="sidebar-tab-btn" id="ty-sidebar-search-back-btn" onClick={() => { setIsSearching(false); setSearchQuery('') }}>
            <span className="ty-icon ty-left-arrow" ty-hint="Close Search" aria-label="Close Search" />
          </div>
          <input
            type="search"
            id="file-library-search-input"
            placeholder="Search"
            aria-label="Search files"
            autoComplete="off"
            data-localize="Search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
          <span
            ty-hint="区分大小写"
            id="filesearch-case-option-btn"
            className="searchpanel-search-option-btn"
            aria-label="区分大小写"
          >
            <svg className="icon">
              <use xlinkHref="#find-and-replace-icon-case" />
            </svg>
          </span>
          <span
            ty-hint="查找整个单词"
            id="filesearch-word-option-btn"
            className="searchpanel-search-option-btn"
            aria-label="查找整个单词"
          >
            <svg className="icon">
              <use xlinkHref="#find-and-replace-icon-word" />
            </svg>
          </span>
          <span
            ty-hint="正则表达式"
            id="filesearch-regexp-option-btn"
            className="searchpanel-search-option-btn"
            aria-label="正则表达式"
          >
            <svg className="icon">
              <use xlinkHref="#find-and-replace-icon-regexp" />
            </svg>
          </span>
          <span
            className="btn close-btn"
            aria-label="Close outline filter"
            id="close-outline-filter-btn"
            style={{ display: 'none' }}
          >
            <span className="ion-close-round" />
          </span>
        </div>
      </div>

      <div id="sidebar-content" className="sidebar-content">
        <div id="file-library-search">
          <div id="file-library-search-result" />
        </div>
        <div
          id="outline-content"
          className="outline-content sidebar-content-content"
          data-after-content="大纲内容为空"
        >
          {searchQuery.trim() ? renderSearchResults() : renderOutlineNodes(headingTree)}
        </div>
        <div id="file-library" className="sidebar-content-content">
          <div id="file-library-tree" className="no-selection" data-state="" data-after-content="没有打开的文件夹" />
          <div id="file-library-list" className="no-selection" data-state="">
            <div id="file-library-list-children" data-after-content="文件列表为空" />
          </div>
        </div>
        <div id="file-info-content" className="sidebar-content-content" style={{ display: 'none' }} />
      </div>

      <div className="sidebar-footer no-selection" id="ty-sidebar-footer">
        <div style={{ display: 'flex', background: 'inherit' }}>
          <div
            aria-label="新建文件"
            className="sidebar-footer-item footer-item-right footer-btn file-action-item not-empty-menu-group"
            id="sidebar-new-file-btn"
            ty-hint="新建文件"
          >
            <span className="ty-icon ty-add" style={{ position: 'relative', top: 1 }} />
          </div>
          <div
            aria-label="关闭大纲视图"
            className="sidebar-footer-item footer-item-left footer-btn outline-action-item"
            id="unpin-outline-btn"
            ty-hint="关闭大纲视图"
          >
            <span>
              <span className="ty-icon ty-export1" />
              <span />
            </span>
          </div>
          <div className="sidebar-footer-main-item" id="sidebar-menu-btn">
            <span className="sidebar-footer-item">
              <span className="sidebar-footer-main-item-label" id="sidebar-footer-main-item-label">Outline</span>
              <span className="footer-btn">
                <span className="ty-icon ty-dots-v" aria-hidden="true" />
              </span>
            </span>
            <ul id="sidebar-files-menu" className="dropdown-menu" role="menu" aria-labelledby="drop5" tabIndex={-1}>
              <li role="presentation" className="menuitem-group-label file-action-item not-empty-menu-group">
                <span data-localize="Action" data-lg="Front">操作</span>
                <span className="ty-icon ty-delete-button" ty-hint="关闭" id="close-sidebar-menu-btn" aria-label="关闭" />
              </li>
              <li role="presentation" className="file-action-item not-empty-menu-group">
                <a role="menuitem" tabIndex={-1} href="#" id="new-file-from-sidebar-menu" data-localize="New File" data-lg="Front">新建文件</a>
              </li>
              <li role="presentation" className="file-action-item not-empty-menu-group">
                <a role="menuitem" tabIndex={-1} href="#" id="search-from-sidebar-menu" data-localize="Search" data-lg="Menu">搜索</a>
              </li>
            </ul>
          </div>
          <div
            aria-label="切换列表／树视图"
            className="sidebar-footer-item footer-item-right footer-btn file-action-item not-empty-menu-group"
            id="switch-file-list-btn"
            ty-hint="切换列表／树视图"
          >
            <span className="switch-file-list-btn-to-list">
              <span className="ty-icon ty-three-cells" />
            </span>
            <span className="switch-file-list-btn-to-tree">
              <span className="ty-icon ty-file-tree" />
            </span>
          </div>
        </div>
      </div>
      </div>
    </>
  )
}

export default Sidebar

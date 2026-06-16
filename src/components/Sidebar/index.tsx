import React, { useMemo, useCallback, useEffect, useRef, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
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

type RenderableHeading = {
  level: number
  text: string
  originalIndex: number
  hasChildren: boolean
}

type SidebarTab = 'files' | 'outline'

type FileTreeNode = {
  name: string
  path: string
  is_dir: boolean
  children: FileTreeNode[]
}

const TYPORA_SIDEBAR_BODY_STATE_CLASSES = [
  'active-tab-outline',
  'active-tab-files',
  'ty-show-outline-filter',
  'ty-on-outline-filter',
  'ty-show-search',
  'ty-on-search',
] as const

export function resolveNextSidebarTab(tab: SidebarTab): SidebarTab {
  return tab === 'outline' ? 'files' : 'outline'
}

function getTyporaSidebarSwitchIconClass(activeSidebarTab: SidebarTab): string {
  return activeSidebarTab === 'outline' ? 'ty-icon ty-three-cells' : 'ty-icon ty-file-tree'
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
  depth = 0,
): RenderableHeading[] {
  const result: RenderableHeading[] = []

  nodes.forEach((node) => {
    const hasChildren = node.children.length > 0
    result.push({
      level: node.level,
      text: node.text,
      originalIndex: node.originalIndex,
      hasChildren,
    })

    if (hasChildren && !isHeadingNodeCollapsed(node, collapsedIndices, depth)) {
      result.push(...flattenVisibleHeadings(node.children, collapsedIndices, depth + 1))
    }
  })

  return result
}

function flattenSearchableHeadings(nodes: HeadingNode[]): RenderableHeading[] {
  const result: RenderableHeading[] = []

  nodes.forEach((node) => {
    result.push({
      level: node.level,
      text: node.text,
      originalIndex: node.originalIndex,
      hasChildren: node.children.length > 0,
    })
    result.push(...flattenSearchableHeadings(node.children))
  })

  return result
}

function isHeadingNodeCollapsed(
  node: HeadingNode,
  collapsedIndices: Record<number, boolean>,
  depth: number,
): boolean {
  if (node.children.length === 0) {
    return false
  }

  const explicitState = collapsedIndices[node.originalIndex]
  if (explicitState !== undefined) {
    return explicitState
  }

  // 对齐 Typora 当前 no-collapse-outline 骨架：默认不折叠任何层级。
  return false
}

function filterFileTreeByFileName(node: FileTreeNode, normalizedQuery: string): FileTreeNode | null {
  if (!normalizedQuery) {
    return node
  }

  if (!node.is_dir) {
    return node.name.toLowerCase().includes(normalizedQuery) ? node : null
  }

  const filteredChildren = node.children
    .map((child) => filterFileTreeByFileName(child, normalizedQuery))
    .filter((child): child is FileTreeNode => child !== null)

  // 文件搜索只命中文件名；目录只作为命中文件的父路径保留。
  if (filteredChildren.length === 0) {
    return null
  }

  return {
    ...node,
    children: filteredChildren,
  }
}

function splitFileNodeTitle(name: string, isDirectory: boolean): { namePart: string; extPart: string } {
  // 对齐 Typora 运行时：目录或无后缀文件名整体作为名称部分，扩展名部分留空。
  let splitIndex = name.lastIndexOf('.')
  if (splitIndex < 0 || isDirectory) {
    splitIndex = name.length
  }

  return {
    namePart: name.slice(0, splitIndex),
    extPart: name.slice(splitIndex),
  }
}

export function resolveActiveHeadingIndex(headingTops: number[], referenceTop: number): number | null {
  if (headingTops.length === 0) {
    return null
  }

  let activeIndex = 0
  for (let index = 0; index < headingTops.length; index++) {
    if (headingTops[index] > referenceTop) {
      break
    }
    activeIndex = index
  }

  return activeIndex
}

export const Sidebar: React.FC = () => {
  const { showSidebar, content, filePath, openFile } = useEditorStore()

  const headings = useMemo(() => extractHeadings(content), [content])
  const headingTree = useMemo(() => buildHeadingTree(headings), [headings])

  // 记录哪些索引的大纲项被折叠了
  const [collapsedIndices, setCollapsedIndices] = useState<Record<number, boolean>>({})
  const [activeHeadingIndex, setActiveHeadingIndex] = useState<number | null>(null)

  // 搜索相关状态
  const [isSearching, setIsSearching] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeSidebarTab, setActiveSidebarTab] = useState<SidebarTab>('outline')
  const [fileTree, setFileTree] = useState<FileTreeNode | null>(null)
  const [fileTreeError, setFileTreeError] = useState<string | null>(null)
  const [isFileTreeLoading, setIsFileTreeLoading] = useState(false)
  const [expandedFileTreePaths, setExpandedFileTreePaths] = useState<Record<string, boolean>>({})
  const searchInputRef = useRef<HTMLInputElement>(null)

  const sidebarTitle = activeSidebarTab === 'outline' ? 'Outline' : 'Files'
  const switchSidebarLabel = activeSidebarTab === 'outline' ? 'Switch to File List view' : 'Switch to Outline view'
  const normalizedSearchQuery = searchQuery.toLowerCase().trim()
  const isOutlineSearchActive = isSearching && activeSidebarTab === 'outline' && normalizedSearchQuery.length > 0
  const isFileSearchActive = isSearching && activeSidebarTab === 'files' && normalizedSearchQuery.length > 0
  const searchStateClass = isSearching
    ? activeSidebarTab === 'outline'
      ? 'ty-show-outline-filter ty-on-outline-filter'
      : 'ty-show-search ty-on-search'
    : ''
  const searchControls = (
    <>
      <input
        ref={searchInputRef}
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
        ty-hint="Case Sensitive"
        id="filesearch-case-option-btn"
        className="searchpanel-search-option-btn"
        aria-label="Case Sensitive"
      >
        <svg className="icon">
          <use xlinkHref="#find-and-replace-icon-case" />
        </svg>
      </span>
      <span
        ty-hint="Whole Word"
        id="filesearch-word-option-btn"
        className="searchpanel-search-option-btn"
        aria-label="Whole Word"
      >
        <svg className="icon">
          <use xlinkHref="#find-and-replace-icon-word" />
        </svg>
      </span>
      <span
        ty-hint="Regular Expression"
        id="filesearch-regexp-option-btn"
        className="searchpanel-search-option-btn"
        aria-label="Regular Expression"
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
    </>
  )

  useEffect(() => {
    const body = document.body

    body.classList.toggle('active-tab-outline', activeSidebarTab === 'outline')
    body.classList.toggle('active-tab-files', activeSidebarTab === 'files')
    body.classList.toggle('ty-show-outline-filter', isSearching && activeSidebarTab === 'outline')
    body.classList.toggle('ty-on-outline-filter', isSearching && activeSidebarTab === 'outline')
    body.classList.toggle('ty-show-search', isSearching && activeSidebarTab === 'files')
    body.classList.toggle('ty-on-search', isSearching && activeSidebarTab === 'files')

    return () => {
      body.classList.remove(...TYPORA_SIDEBAR_BODY_STATE_CLASSES)
    }
  }, [activeSidebarTab, isSearching])

  // 切换折叠状态
  const toggleCollapse = useCallback((index: number, isCollapsed: boolean, e: React.MouseEvent) => {
    e.stopPropagation() // 阻止触发跳转
    setCollapsedIndices(prev => ({
      ...prev,
      [index]: !isCollapsed,
    }))
  }, [])

  const toggleFileTreeDirectory = useCallback((path: string, e: React.SyntheticEvent) => {
    e.stopPropagation()
    setExpandedFileTreePaths(prev => ({
      ...prev,
      [path]: !prev[path],
    }))
  }, [])

  // 点击大纲项跳转到编辑器中对应的标题
  const handleHeadingClick = useCallback((text: string, index: number) => {
    setActiveHeadingIndex(index)

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

  const syncActiveHeadingFromViewport = useCallback(() => {
    const editorRoot = document.querySelector('.milkdown .editor')
    if (!editorRoot) {
      setActiveHeadingIndex(headings.length > 0 ? 0 : null)
      return
    }

    const headingElements = Array.from(editorRoot.querySelectorAll('h1, h2, h3, h4, h5, h6'))
    if (headingElements.length === 0) {
      setActiveHeadingIndex(headings.length > 0 ? 0 : null)
      return
    }

    const editorContainer = document.querySelector('.milkdown-editor')
    const referenceTop = (editorContainer?.getBoundingClientRect().top ?? 0) + 72
    const headingTops = headingElements.map((element) => element.getBoundingClientRect().top)
    setActiveHeadingIndex(resolveActiveHeadingIndex(headingTops, referenceTop))
  }, [headings.length])

  useEffect(() => {
    let frame = window.requestAnimationFrame(syncActiveHeadingFromViewport)

    const scheduleSync = () => {
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(syncActiveHeadingFromViewport)
    }

    // Typora 会随正文滚动同步 outline active，这里只读编辑器标题位置，不额外改变文档状态。
    const scrollContainers = [
      document.querySelector('.milkdown-editor'),
    ].filter((element): element is Element => element instanceof Element)

    scrollContainers.forEach((element) => {
      element.addEventListener('scroll', scheduleSync, { passive: true })
    })
    window.addEventListener('resize', scheduleSync)

    return () => {
      window.cancelAnimationFrame(frame)
      scrollContainers.forEach((element) => {
        element.removeEventListener('scroll', scheduleSync)
      })
      window.removeEventListener('resize', scheduleSync)
    }
  }, [content, syncActiveHeadingFromViewport])

  useEffect(() => {
    if (isSearching) {
      searchInputRef.current?.focus()
    }
  }, [isSearching])

  useEffect(() => {
    setCollapsedIndices({})
    setActiveHeadingIndex(headings.length > 0 ? 0 : null)
  }, [content, headings.length])

  useEffect(() => {
    if (activeSidebarTab !== 'files') {
      return
    }

    if (!filePath) {
      setFileTree(null)
      setFileTreeError(null)
      setIsFileTreeLoading(false)
      setExpandedFileTreePaths({})
      return
    }

    let cancelled = false
    setIsFileTreeLoading(true)
    setFileTreeError(null)

    invoke<FileTreeNode>('list_file_tree', { filePath })
      .then((tree) => {
        if (!cancelled) {
          setFileTree(tree)
          setExpandedFileTreePaths({})
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setFileTree(null)
          setFileTreeError(error instanceof Error ? error.message : String(error))
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsFileTreeLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [activeSidebarTab, filePath])

  const handleFileTreeFileClick = useCallback(async (node: FileTreeNode) => {
    if (node.is_dir) {
      return
    }

    try {
      const nextContent = await invoke<string>('read_file', { path: node.path })
      const nextFileName = await invoke<string>('get_file_name', { path: node.path })
      openFile(node.path, nextContent, nextFileName)
    } catch (error) {
      setFileTreeError(error instanceof Error ? error.message : String(error))
    }
  }, [openFile])

  // 计算当前可见的大纲项
  const visibleHeadings = useMemo(() => {
    return flattenVisibleHeadings(headingTree, collapsedIndices)
  }, [headingTree, collapsedIndices])

  const searchableHeadings = useMemo(() => {
    return flattenSearchableHeadings(headingTree)
  }, [headingTree])

  // 过滤后的大纲列表（实时搜索）
  const filteredHeadings = useMemo(() => {
    if (!normalizedSearchQuery) return visibleHeadings

    return searchableHeadings.filter(heading =>
      heading.text.toLowerCase().includes(normalizedSearchQuery)
    )
  }, [visibleHeadings, searchableHeadings, normalizedSearchQuery])

  const visibleFileTree = useMemo(() => {
    if (!fileTree) {
      return null
    }

    return isFileSearchActive
      ? filterFileTreeByFileName(fileTree, normalizedSearchQuery)
      : fileTree
  }, [fileTree, isFileSearchActive, normalizedSearchQuery])

  if (!showSidebar) {
    return null
  }

  const renderOutlineNodes = (nodes: HeadingNode[], depth = 0): React.ReactNode =>
    nodes.map((node) => {
      const hasChildren = node.children.length > 0
      const isCollapsed = isHeadingNodeCollapsed(node, collapsedIndices, depth)
      const isActive = activeHeadingIndex === node.originalIndex
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
            onClick={() => handleHeadingClick(node.text, node.originalIndex)}
          >
            <span
              className="outline-expander"
              onClick={(e) => {
                if (hasChildren) {
                  toggleCollapse(node.originalIndex, isCollapsed, e)
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
            {hasChildren && !isCollapsed ? renderOutlineNodes(node.children, depth + 1) : null}
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
          <div
            className={`outline-item${activeHeadingIndex === heading.originalIndex ? ' outline-item-active' : ''}`}
            onClick={() => handleHeadingClick(heading.text, heading.originalIndex)}
          >
            <span
              className="outline-expander"
              onClick={(e) => {
                if (heading.hasChildren) {
                  toggleCollapse(
                    heading.originalIndex,
                    collapsedIndices[heading.originalIndex] ?? true,
                    e,
                  )
                }
              }}
            />
            <span
              className={`outline-label${activeHeadingIndex === heading.originalIndex ? ' outline-active' : ''}`}
              data-ref={`n${heading.originalIndex}`}
            >
              {heading.text}
            </span>
          </div>
        </li>
      )
    })

  // 严格对齐 Typora `#file-library-node-template` + 运行时填充的 DOM：
  // 外层 `.file-library-node.file-tree-node`，运行时按节点形态追加
  // `file-node-root` / `file-library-file-node` / `file-node-expanded|collapsed` / `active`。
  // 不再使用项目自造的 `.file-tree-*` 别名与 `data-file-tree-path`，让 Typora 主题 CSS 直接命中。
  const renderFileTreeNode = (node: FileTreeNode, isRoot = false, forceOpen = false): React.ReactNode => {
    const isActive = !node.is_dir && node.path === filePath
    const hasChildren = node.is_dir && node.children.length > 0
    const isOpen = isRoot || forceOpen || !!expandedFileTreePaths[node.path]
    const titleParts = splitFileNodeTitle(node.name, node.is_dir)
    // 对齐 Typora 运行时：根节点用 history 图标，目录用 folder，文件用 file-text-o。
    const iconClass = isRoot ? 'fa fa-history' : node.is_dir ? 'fa fa-folder' : 'fa fa-file-text-o'
    const className = [
      'file-library-node',
      'file-tree-node',
      isRoot ? 'file-node-root' : '',
      node.is_dir ? '' : 'file-library-file-node',
      hasChildren ? (isOpen ? 'file-node-expanded' : 'file-node-collapsed') : '',
      isActive ? 'active' : '',
    ].filter(Boolean).join(' ')
    const toggleIfExpandable = (event: React.SyntheticEvent) => {
      if (hasChildren && !isRoot) {
        toggleFileTreeDirectory(node.path, event)
      }
    }

    return (
      <div
        key={node.path}
        className={className}
        data-path={node.path}
        data-has-sub={String(hasChildren)}
        data-is-directory={String(node.is_dir)}
        tabIndex={-1}
        onClick={(event) => {
          if (node.is_dir) {
            toggleIfExpandable(event)
            return
          }

          void handleFileTreeFileClick(node)
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            if (node.is_dir) {
              toggleIfExpandable(event)
            } else {
              void handleFileTreeFileClick(node)
            }
          }
        }}
      >
        <div className="file-node-background" />
        <div className="file-node-content" draggable>
          <span
            className="file-node-open-state"
            aria-hidden="true"
            onClick={(event) => toggleIfExpandable(event)}
          >
            <i className="fa fa-caret-right" />
            <i className="fa fa-caret-down" />
          </span>
          <i className={`file-node-icon ${iconClass}`} aria-hidden="true" />
          <span className="file-node-title" title={node.path}>
            <span className="file-node-title-name-part">{titleParts.namePart}</span>
            <span className="file-node-title-ext-part">{titleParts.extPart}</span>
          </span>
          <div className="file-tree-rename-div">
            <input className="file-tree-rename-input" />
          </div>
        </div>
        {hasChildren && isOpen && (
          <div className="file-node-children">
            {node.children.map((child) => renderFileTreeNode(child, false, forceOpen))}
          </div>
        )}
      </div>
    )
  }

  const renderFileTree = (): React.ReactNode => {
    if (isFileTreeLoading) {
      return <div className="file-tree-message" data-localize="Loading" data-lg="Front">Loading</div>
    }

    if (fileTreeError) {
      return <div className="file-tree-message error">{fileTreeError}</div>
    }

    if (!visibleFileTree) {
      if (isFileSearchActive) {
        return <div className="file-tree-message" data-localize="No result found." data-lg="Front">No result found.</div>
      }
      return null
    }

    return renderFileTreeNode(visibleFileTree, true, isFileSearchActive)
  }

  return (
    <>
      <div aria-hidden="true" className="dropdown-menu stopselect dropmenu" id="toc-dropmenu" role="menu">
        <div className="outline-title-wrapper">
          <span className="outline-title" data-localize="Outline" data-lg="Front">Outline</span>
          <span className="btn fa fa-arrow-circle-left" id="pin-outline-btn" />
        </div>
        <div className="divider outline-title-divider" />
        <div role="list" id="toc-content" className="outline-content" data-after-content="Outline is Empty." />
      </div>

      <div
        aria-hidden="true"
        className={[
          'stopselect dropmenu sidebar-menu open use-file-tree-style',
          `active-tab-${activeSidebarTab}`,
          searchStateClass,
        ].filter(Boolean).join(' ')}
        data-sidebar-tab={activeSidebarTab}
        id="typora-sidebar"
        role="menu"
      >
      <div className="info-panel-tab-wrapper ty-tab-wrapper">
        <div className="ty-sidebar-tab-spacer" />
        <div className="info-panel-tab" id="info-panel-tab-file">
          <div className="info-panel-tab-title" data-localize="Files" data-lg="Front">Files</div>
          <div className="info-panel-tab-border" />
        </div>
        <div className="info-panel-tab" id="info-panel-tab-search-back">
          <div className="info-panel-tab-title" data-localize="Files" data-lg="Front">Files</div>
          <div className="info-panel-tab-border" />
        </div>
        <div className="ty-sidebar-tab-spacer" />
        <div className="info-panel-tab" id="info-panel-tab-outline">
          <div className="info-panel-tab-title" data-localize="Outline" data-lg="Front">Outline</div>
          <div className="info-panel-tab-border" />
        </div>
        <div className="info-panel-tab" id="info-panel-tab-search">
          <div className="info-panel-tab-title" data-localize="Search" data-lg="Front">Search</div>
          <div className="info-panel-tab-border" />
        </div>
        <div className="ty-sidebar-tab-spacer" />
      </div>

      <div className="sidebar-osx-tab ty-tab-wrapper">
        <div className="sidebar-tabs">
          <div
            className="sidebar-tab-btn sidebar-hover-action sidebar-left-action"
            id="switch-sidebar-icon"
            onMouseDown={(event) => event.stopPropagation()}
            onClick={() => {
              setActiveSidebarTab(prev => resolveNextSidebarTab(prev))
              setIsSearching(false)
              setSearchQuery('')
            }}
            ty-hint={switchSidebarLabel}
          >
            <span className={getTyporaSidebarSwitchIconClass(activeSidebarTab)} />
          </div>
          <div
            className={`sidebar-tab ${activeSidebarTab === 'files' ? 'active sidebar-tab-current' : ''}`}
            data-localize="Files"
            data-lg="Front"
            id="sidepanel-segmented-input-files"
          >
            {activeSidebarTab === 'files' ? sidebarTitle : ''}
          </div>
          <div
            className={`sidebar-tab ${activeSidebarTab === 'outline' ? 'active sidebar-tab-current' : ''}`}
            data-localize="Outline"
            data-lg="Front"
            id="sidepanel-segmented-input-outline"
          >
            {activeSidebarTab === 'outline' ? sidebarTitle : ''}
          </div>
          <div
            className="sidebar-tab-btn sidebar-hover-action sidebar-right-action"
            id="sidebar-search-btn"
            onMouseDown={(event) => event.stopPropagation()}
            onClick={() => setIsSearching(true)}
            ty-hint="Search"
          >
            <span className="ion-ios7-search-strong" />
          </div>
        </div>
        <div className="ty-sidebar-search-panel" id="ty-sidebar-search-tabs">
          <div className="sidebar-tab-btn" id="ty-sidebar-search-back-btn" onMouseDown={(event) => event.stopPropagation()} onClick={() => { setIsSearching(false); setSearchQuery('') }}>
            <span className="ty-icon ty-left-arrow" ty-hint="Close Search" aria-label="Close Search" />
          </div>
          {searchControls}
        </div>
      </div>

      <div id="sidebar-content" className="sidebar-content">
        <div id="file-library-search">
          <div id="file-library-search-result" />
        </div>
        <div
          id="outline-content"
          className="outline-content sidebar-content-content"
          data-after-content="Outline is Empty."
        >
          {isOutlineSearchActive ? renderSearchResults() : renderOutlineNodes(headingTree)}
        </div>
        <div id="file-library" className="sidebar-content-content">
          <div id="file-library-tree" className="no-selection" data-state="" data-after-content="No Folder is Opened.">
            {renderFileTree()}
          </div>
          <div id="file-library-list" className="no-selection" data-state="">
            <div id="sidebar-loading-template" className="file-list-item">
              <div className="sidebar-loading">
                <div className="typora-quick-open-info">
                  <span data-localize="Loading" data-lg="Front">Loading</span>
                </div>
                <div className="typora-search-spinner">
                  <div className="rect1" />
                  <div className="rect2" />
                  <div className="rect3" />
                  <div className="rect4" />
                  <div className="rect5" />
                </div>
              </div>
              <div className="oversize-list-template">
                <div className="oversize-list-template-mark">
                  <i className="fa fa-exclamation-triangle" aria-hidden="true" />
                </div>
                <div
                  data-localize="Selected folders contains too many files. \nPlease switch to <a id='switch-to-tree-on-oversize'>File Tree view</a> for better performance."
                  data-lg="Front"
                  data-lt="html"
                >
                  Selected folders contains too many files.
                  Please switch to <a id="switch-to-tree-on-oversize">File Tree view</a> for better performance.
                </div>
              </div>
            </div>
            <div id="file-library-list-children" data-after-content="No Files Available" />
          </div>
        </div>
        <div id="file-info-content" className="sidebar-content-content" style={{ display: 'none' }} />
      </div>

      <div className="sidebar-footer no-selection" id="ty-sidebar-footer">
        <div style={{ display: '-webkit-flex', background: 'inherit' }}>
          <div
            className="sidebar-footer-item footer-item-right footer-btn file-action-item not-empty-menu-group"
            id="sidebar-new-file-btn"
            ty-hint="New File"
          >
            <span className="ty-icon ty-add" style={{ position: 'relative', top: '1px' }} />
          </div>
          <div
            className="sidebar-footer-item footer-item-left footer-btn outline-action-item"
            id="unpin-outline-btn"
            ty-hint="Unpin Outline Panel"
          >
            <span>
              <span className="ty-icon ty-export1" />
              <span />
            </span>
          </div>
          <div className="sidebar-footer-main-item" id="sidebar-menu-btn">
            <span className="sidebar-footer-item">
              <span className="sidebar-footer-main-item-label" id="sidebar-footer-main-item-label">Open Folder...</span>
              <span className="footer-btn">
                <span className="ty-icon ty-dots-v" aria-hidden="true" />
              </span>
            </span>
            <ul id="sidebar-files-menu" className="dropdown-menu" role="menu" aria-labelledby="drop5" tabIndex={-1}>
              <li role="presentation" className="menuitem-group-label file-action-item not-empty-menu-group">
                <span data-localize="Action" data-lg="Front">Action</span>
                <span className="ty-icon ty-delete-button" ty-hint="Close Sidebar Menu" id="close-sidebar-menu-btn" />
              </li>
              <li role="presentation" className="file-action-item not-empty-menu-group">
                <a role="menuitem" tabIndex={-1} href="#" id="new-file-from-sidebar-menu" data-localize="New File" data-lg="Front">New File</a>
              </li>
              <li role="presentation" className="file-action-item not-empty-menu-group">
                <a role="menuitem" tabIndex={-1} href="#" id="search-from-sidebar-menu" data-localize="Search" data-lg="Menu">Search</a>
              </li>
              <li role="presentation" className="file-action-item not-empty-menu-group">
                <a role="menuitem" tabIndex={-1} href="#" id="reveal-folder-from-sidebar-menu" data-localize="Reveal in Finder" data-lg="Front">Reveal in Finder</a>
              </li>
              <li role="presentation" className="file-action-item not-empty-menu-group">
                <a role="menuitem" tabIndex={-1} href="#" id="open-folder-from-sidebar-menu" data-localize="Open Folder..." data-lg="Front">Open Folder...</a>
              </li>
              <li role="presentation" className="file-action-item not-empty-menu-group">
                <a role="menuitem" tabIndex={-1} href="#" id="refresh-from-sidebar-menu" data-localize="Refresh Folder" data-lg="Front">Refresh Folder</a>
              </li>
              <li role="presentation" className="menuitem-group-label file-action-item file-sort-item not-empty-menu-group">
                <span data-localize="Sort" data-lg="Front">Sort</span>
                <span className="sort-button-area">
                  <span>
                    <span id="ty-group-by-folder-btn" className="ty-icon ty-package ty-side-sort-btn active" ty-hint="Group By Folder" />
                  </span>
                  <span>
                    <span id="ty-sort-by-natural-btn" className="ty-icon ty-sort-by-natural ty-side-sort-btn ty-side-sort-btn2 active" ty-hint="Sort Naturally (Ascending)" />
                    <span id="ty-sort-by-name-btn" className="ty-icon ty-sort-by-alphabet-a ty-side-sort-btn ty-side-sort-btn2" ty-hint="Sort by Name (Ascending)" />
                    <span id="ty-sort-by-date-btn" className="ty-icon ty-sort-by-date-a ty-side-sort-btn ty-side-sort-btn2" ty-hint="Sort by Modification Date (Ascending)" />
                    <span id="ty-sort-by-create-btn" className="ty-icon ty-sort-new-up ty-side-sort-btn ty-side-sort-btn2" ty-hint="Sort by Creation Date (Ascending)" />
                  </span>
                </span>
                <div className="clearfix" />
              </li>
              <li role="presentation" className="menuitem-group-label file-action-item folder-menu-group show">
                <span data-localize="Recent Locations" data-lg="Menu">Recent Locations</span>
              </li>
              <li role="presentation" className="folder-menu-item folder-menu-group selected-folder-menu-item file-action-item show">
                <a role="menuitem" tabIndex={-1} href="#">
                  <i className="fa fa-folder-o" />
                  <span />
                </a>
              </li>
              <li role="presentation" className="menuitem-group-label file-action-item empty-menu-group" id="folder-menu-item-after">
                <span data-localize="Location" data-lg="Front">Location</span>
              </li>
              <li role="presentation" className="file-action-item empty-menu-group">
                <a role="menuitem" tabIndex={-1} href="#" id="open-folder-from-sidebar-menu" data-localize="Open Folder..." data-lg="Front">Open Folder...</a>
              </li>
            </ul>
          </div>
          <div
            className="sidebar-footer-item footer-item-right footer-btn file-action-item not-empty-menu-group"
            id="switch-file-list-btn"
            ty-hint="Switch File List/Tree View"
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

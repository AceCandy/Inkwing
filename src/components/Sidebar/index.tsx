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

const TYPORA_FILE_TREE_ICON_PATH = 'M1024 320v256h-704v-64h-128v192h576v256h-768v-256h128v-640h192v-128h704v256h-704v-64h-128v320h128v-128z'
const TYPORA_THREE_CELLS_ICON_PATH = 'M945.231 960h-945.231v-1024h945.231v1024zM78.769 645.204v236.027h787.692v-236.027h-787.692zM78.769 330.127v236.027h787.692v-236.027h-787.692zM78.769 15.050v236.027h787.692v-236.027h-787.692z'
const TYPORA_SIDEBAR_BODY_STATE_CLASSES = [
  'active-tab-outline',
  'active-tab-files',
] as const

export function resolveNextSidebarTab(tab: SidebarTab): SidebarTab {
  return tab === 'outline' ? 'files' : 'outline'
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

function TyporaSidebarSwitchIcon({ activeSidebarTab }: { activeSidebarTab: SidebarTab }) {
  const isOutline = activeSidebarTab === 'outline'

  return (
    <svg
      aria-hidden="true"
      className={isOutline
        ? 'ty-icon ty-file-tree sidebar-switch-glyph sidebar-switch-glyph-typora'
        : 'ty-icon ty-three-cells sidebar-switch-glyph sidebar-switch-glyph-outline'}
      focusable="false"
      viewBox="0 0 1024 1024"
    >
      <g transform="translate(0 960) scale(1 -1)">
        <path d={isOutline ? TYPORA_FILE_TREE_ICON_PATH : TYPORA_THREE_CELLS_ICON_PATH} />
      </g>
    </svg>
  )
}

function TyporaSearchIcon() {
  return (
    <svg
      aria-hidden="true"
      className="ion-ios7-search-strong sidebar-search-glyph"
      focusable="false"
      viewBox="0 0 24 24"
    >
      <circle className="typora-search-ring" cx="10.4" cy="10.4" r="6.6" />
      <path className="typora-search-handle" d="M15.6 15.6 21 21" />
    </svg>
  )
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

  // 对齐 Typora 当前大纲骨架：根分支默认展开，嵌套分支默认折叠。
  return depth > 0
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

function splitFileNodeTitle(name: string): { namePart: string; extPart: string } {
  const lastDotIndex = name.lastIndexOf('.')
  if (lastDotIndex <= 0) {
    return { namePart: name, extPart: '' }
  }

  return {
    namePart: name.slice(0, lastDotIndex),
    extPart: name.slice(lastDotIndex),
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

  const sidebarTitle = activeSidebarTab === 'outline' ? '大纲' : '文件'
  const switchSidebarLabel = activeSidebarTab === 'outline' ? '切换到文件树视图' : '切换到大纲视图'
  const normalizedSearchQuery = searchQuery.toLowerCase().trim()
  const isOutlineSearchActive = isSearching && activeSidebarTab === 'outline' && normalizedSearchQuery.length > 0
  const isFileSearchActive = isSearching && activeSidebarTab === 'files' && normalizedSearchQuery.length > 0
  const searchInputLabel = activeSidebarTab === 'outline' ? '搜索大纲' : '搜索文件'

  useEffect(() => {
    const body = document.body

    body.classList.toggle('active-tab-outline', activeSidebarTab === 'outline')
    body.classList.toggle('active-tab-files', activeSidebarTab === 'files')

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
      setActiveHeadingIndex(null)
      return
    }

    const headingElements = Array.from(editorRoot.querySelectorAll('h1, h2, h3, h4, h5, h6'))
    if (headingElements.length === 0) {
      setActiveHeadingIndex(null)
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
      document.querySelector('.preview-container'),
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
  }, [content])

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

  const renderFileTreeNode = (node: FileTreeNode, isRoot = false, forceOpen = false): React.ReactNode => {
    const isActive = !node.is_dir && node.path === filePath
    const hasChildren = node.is_dir && node.children.length > 0
    const isOpen = isRoot || forceOpen || !!expandedFileTreePaths[node.path]
    const titleParts = splitFileNodeTitle(node.name)
    const className = [
      'file-library-node',
      'file-tree-node',
      isRoot ? 'file-tree-root file-node-root' : '',
      node.is_dir ? 'file-tree-directory' : 'file-tree-file file-library-file-node',
      hasChildren ? (isOpen ? 'file-tree-open file-node-expanded' : 'file-tree-close file-node-collapsed') : '',
      isActive ? 'active' : '',
    ].filter(Boolean).join(' ')

    return (
      <div
        key={node.path}
        className={className}
        data-has-sub={String(hasChildren)}
        data-is-directory={String(node.is_dir)}
        data-path={node.path}
        data-file-tree-path={node.path}
        onClick={(event) => {
          if (node.is_dir) {
            if (hasChildren && !isRoot) {
              toggleFileTreeDirectory(node.path, event)
            }
            return
          }

          void handleFileTreeFileClick(node)
        }}
        onKeyDown={(event) => {
          if (!node.is_dir && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault()
            void handleFileTreeFileClick(node)
          } else if (node.is_dir && hasChildren && !isRoot && (event.key === 'Enter' || event.key === ' ')) {
            toggleFileTreeDirectory(node.path, event)
          }
        }}
        role={node.is_dir ? 'treeitem' : 'button'}
        tabIndex={node.is_dir ? -1 : 0}
        title={node.path}
      >
        <div className="file-node-background" />
        <div className="file-node-content file-tree-item" draggable>
          <span
            className="file-node-open-state file-tree-expander"
            aria-hidden="true"
            onClick={(event) => {
              if (hasChildren && !isRoot) {
                toggleFileTreeDirectory(node.path, event)
              }
            }}
          >
            {hasChildren && (
              <>
                <i className="fa fa-caret-right" />
                <i className="fa fa-caret-down" />
              </>
            )}
          </span>
          <span className="file-node-icon" aria-hidden="true">
            {node.is_dir && <i className="fa fa-folder" />}
          </span>
          <span className="file-node-title file-tree-name">
            <span className="file-node-title-name-part">{titleParts.namePart}</span>
            <span className="file-node-title-ext-part">{titleParts.extPart}</span>
          </span>
        </div>
        {hasChildren && isOpen && (
          <div className="file-node-children file-tree-children" role="group">
            {node.children.map((child) => renderFileTreeNode(child, false, forceOpen))}
          </div>
        )}
      </div>
    )
  }

  const renderFileTree = (): React.ReactNode => {
    if (isFileTreeLoading) {
      return <div className="file-tree-message">正在读取文件夹...</div>
    }

    if (fileTreeError) {
      return <div className="file-tree-message error">{fileTreeError}</div>
    }

    if (!visibleFileTree) {
      if (isFileSearchActive) {
        return <div className="file-tree-message">没有匹配的文件</div>
      }
      return null
    }

    return renderFileTreeNode(visibleFileTree, true, isFileSearchActive)
  }

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
        className={[
          'stopselect dropmenu sidebar-menu open use-file-tree-style',
          `active-tab-${activeSidebarTab}`,
          isSearching ? 'ty-show-search ty-on-search' : '',
        ].filter(Boolean).join(' ')}
        data-sidebar-tab={activeSidebarTab}
        id="typora-sidebar"
        role="menu"
      >
      <div className="info-panel-tab-wrapper ty-tab-wrapper">
        <div className="ty-sidebar-tab-spacer" />
        <div className="info-panel-tab" id="info-panel-tab-file">
          <div className="info-panel-tab-title" data-localize="Files" data-lg="Front">文件</div>
          <div className="info-panel-tab-border" />
        </div>
        <div className="info-panel-tab" id="info-panel-tab-search-back">
          <div className="info-panel-tab-title" data-localize="Files" data-lg="Front">文件</div>
          <div className="info-panel-tab-border" />
        </div>
        <div className="ty-sidebar-tab-spacer" />
        <div className="info-panel-tab" id="info-panel-tab-outline">
          <div className="info-panel-tab-title" data-localize="Outline" data-lg="Front">大纲</div>
          <div className="info-panel-tab-border" />
        </div>
        <div className="info-panel-tab" id="info-panel-tab-search">
          <div className="info-panel-tab-title" data-localize="Search" data-lg="Front">查找</div>
          <div className="info-panel-tab-border" />
        </div>
        <div className="ty-sidebar-tab-spacer" />
      </div>

      <div className={`sidebar-osx-tab ty-tab-wrapper${isSearching ? ' searching' : ''}`}>
        <div className="sidebar-tabs">
          <button
            aria-label={switchSidebarLabel}
            className="sidebar-tab-btn sidebar-hover-action sidebar-left-action"
            id="switch-sidebar-icon"
            onMouseDown={(event) => event.stopPropagation()}
            onClick={() => {
              setActiveSidebarTab(prev => resolveNextSidebarTab(prev))
              setIsSearching(false)
              setSearchQuery('')
            }}
            title={switchSidebarLabel}
            type="button"
            ty-hint={switchSidebarLabel}
          >
            <TyporaSidebarSwitchIcon activeSidebarTab={activeSidebarTab} />
          </button>
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
          <button
            aria-label="查找"
            className="sidebar-tab-btn sidebar-hover-action sidebar-right-action"
            id="sidebar-search-btn"
            onMouseDown={(event) => event.stopPropagation()}
            onClick={() => setIsSearching(true)}
            title="查找"
            type="button"
            ty-hint="查找"
          >
            <TyporaSearchIcon />
          </button>
        </div>
        <div className="ty-sidebar-search-panel" id="ty-sidebar-search-tabs">
          <button className="sidebar-tab-btn" id="ty-sidebar-search-back-btn" onMouseDown={(event) => event.stopPropagation()} onClick={() => { setIsSearching(false); setSearchQuery('') }} type="button">
            <span className="ty-icon ty-left-arrow" ty-hint="Close Search" aria-label="Close Search" />
          </button>
          <input
            ref={searchInputRef}
            type="search"
            id="file-library-search-input"
            placeholder={searchInputLabel}
            aria-label={searchInputLabel}
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
            hidden
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
          {isOutlineSearchActive ? renderSearchResults() : renderOutlineNodes(headingTree)}
        </div>
        <div id="file-library" className="sidebar-content-content">
          <div id="file-library-tree" className="no-selection" data-state="" data-after-content="没有打开的文件夹">
            {renderFileTree()}
          </div>
          <div id="file-library-list" className="no-selection" data-state="">
            <div id="file-library-list-children" data-after-content="文件列表为空" />
          </div>
        </div>
        <div id="file-info-content" className="sidebar-content-content" hidden />
      </div>

      <div className="sidebar-footer no-selection" id="ty-sidebar-footer">
        <div className="sidebar-footer-shell">
          <div
            aria-label="新建文件"
            className="sidebar-footer-item footer-item-right footer-btn file-action-item not-empty-menu-group"
            id="sidebar-new-file-btn"
            ty-hint="新建文件"
          >
            <span className="ty-icon ty-add sidebar-footer-add-icon" />
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

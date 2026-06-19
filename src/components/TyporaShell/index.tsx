import React, { useMemo, useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { invoke } from '@tauri-apps/api/core'
import { useEditorStore } from '../../stores/editorStore'

// 方案 A：Typora 原生骨架直供。本组件不再渲染 sidebar 的骨架 DOM（骨架由
// mountTyporaSkeleton 注入 document.body），只通过 React portal 把动态内容
// （大纲树/文件树/搜索结果/file-info）塞进骨架的对应容器节点，并用命令式 DOM
// 操作切换骨架节点的 class（active-tab-*/ty-on-*/pin-outline），对齐 Typora main.js。
//
// 骨架节点查询：所有查询都基于已注入的骨架，挂载在 #typora-skeleton-host 下。
function shellRoot(): ParentNode {
  return document.getElementById('typora-skeleton-host') ?? document
}

function query<T extends Element = Element>(selector: string): T | null {
  return shellRoot().querySelector<T>(selector)
}

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

type SidebarTab = 'files' | 'outline'

type FileTreeNode = {
  name: string
  path: string
  is_dir: boolean
  children: FileTreeNode[]
}

type SearchHit = {
  path: string
  name: string
  parent_dir: string
  line_number: number
  line_text: string
  match_text: string
  is_filename_hit: boolean
}

type SearchHitGroup = {
  path: string
  name: string
  parentDir: string
  namePart: string
  extPart: string
  count: number
  isFilenameHit: boolean
  matches: Array<{ lineNumber: number; lineText: string; matchText: string }>
}

const TYPORA_BODY_STATE_CLASSES = [
  'active-tab-outline',
  'active-tab-files',
  'ty-show-outline-filter',
  'ty-on-outline-filter',
  'ty-show-search',
  'ty-on-search',
] as const

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

function nodeOrDescendantMatches(node: HeadingNode, normalizedQuery: string): boolean {
  if (!normalizedQuery) {
    return true
  }

  if (node.text.toLowerCase().includes(normalizedQuery)) {
    return true
  }

  return node.children.some((child) => nodeOrDescendantMatches(child, normalizedQuery))
}

function splitOutlineLabelByQuery(text: string, normalizedQuery: string): Array<{ text: string; hit: boolean }> {
  if (!normalizedQuery) {
    return [{ text, hit: false }]
  }

  const segments: Array<{ text: string; hit: boolean }> = []
  const lowerText = text.toLowerCase()
  const query = normalizedQuery
  let cursor = 0

  while (cursor < text.length) {
    const index = lowerText.indexOf(query, cursor)
    if (index < 0) {
      segments.push({ text: text.slice(cursor), hit: false })
      break
    }

    if (index > cursor) {
      segments.push({ text: text.slice(cursor, index), hit: false })
    }
    segments.push({ text: text.slice(index, index + query.length), hit: true })
    cursor = index + query.length
  }

  return segments
}

function isHeadingNodeCollapsed(
  node: HeadingNode,
  collapsedIndices: Record<number, boolean>,
): boolean {
  if (node.children.length === 0) {
    return false
  }

  const explicitState = collapsedIndices[node.originalIndex]
  if (explicitState !== undefined) {
    return explicitState
  }

  return false
}

function groupSearchHits(hits: SearchHit[]): SearchHitGroup[] {
  const groups: SearchHitGroup[] = []
  const indexByPath = new Map<string, number>()

  for (const hit of hits) {
    const titleParts = splitFileNodeTitle(hit.name, false)
    let groupIndex = indexByPath.get(hit.path)
    if (groupIndex === undefined) {
      groupIndex = groups.length
      indexByPath.set(hit.path, groupIndex)
      groups.push({
        path: hit.path,
        name: hit.name,
        parentDir: hit.parent_dir,
        namePart: titleParts.namePart,
        extPart: titleParts.extPart,
        count: 0,
        isFilenameHit: false,
        matches: [],
      })
    }

    const group = groups[groupIndex]
    if (!hit.is_filename_hit) {
      group.count += 1
    }
    if (hit.is_filename_hit) {
      group.isFilenameHit = true
    }
    group.matches.push({
      lineNumber: hit.line_number,
      lineText: hit.line_text,
      matchText: hit.match_text,
    })
  }

  return groups
}

function splitLineByMatch(lineText: string, matchText: string): Array<{ text: string; hit: boolean }> {
  if (!matchText) {
    return [{ text: lineText, hit: false }]
  }

  const index = lineText.indexOf(matchText)
  if (index < 0) {
    return [{ text: lineText, hit: false }]
  }

  return [
    { text: lineText.slice(0, index), hit: false },
    { text: lineText.slice(index, index + matchText.length), hit: true },
    { text: lineText.slice(index + matchText.length), hit: false },
  ]
}

function splitFileNodeTitle(name: string, isDirectory: boolean): { namePart: string; extPart: string } {
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

export function resolveNextSidebarTab(tab: SidebarTab): SidebarTab {
  return tab === 'outline' ? 'files' : 'outline'
}

// 与 Typora 实际行为一致：useTreeStyle 恒为树形，大纲视图显示「切到文件树」图标
// ty-file-tree；files 视图显示「切到大纲」图标 ty-list。
function getTyporaSidebarSwitchIconClass(activeSidebarTab: SidebarTab): string {
  return activeSidebarTab === 'outline' ? 'ty-icon ty-file-tree' : 'ty-icon ty-list'
}

export const TyporaShell: React.FC = () => {
  const { showSidebar, content, filePath, fileName, isModified, openFile } = useEditorStore()

  const headings = useMemo(() => extractHeadings(content), [content])
  const headingTree = useMemo(() => buildHeadingTree(headings), [headings])

  const fileStats = useMemo(() => {
    const trimmed = content.trim()
    const characters = trimmed.length
    const cjk = (trimmed.match(/[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/g) || []).length
    const western = (trimmed.match(/[a-zA-Z0-9]+/g) || []).length
    const words = cjk + western
    const minutes = Math.max(0, Math.round(words / 300))
    return { words, characters, minutes }
  }, [content])

  const [collapsedIndices, setCollapsedIndices] = useState<Record<number, boolean>>({})
  const [activeHeadingIndex, setActiveHeadingIndex] = useState<number | null>(null)

  const [isSearching, setIsSearching] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeSidebarTab, setActiveSidebarTab] = useState<SidebarTab>('outline')
  const [fileTree, setFileTree] = useState<FileTreeNode | null>(null)
  const [fileTreeError, setFileTreeError] = useState<string | null>(null)
  const [isFileTreeLoading, setIsFileTreeLoading] = useState(false)
  const [expandedFileTreePaths, setExpandedFileTreePaths] = useState<Record<string, boolean>>({})
  const searchInputRef = useRef<HTMLInputElement>(null)

  const [searchHits, setSearchHits] = useState<SearchHit[]>([])
  const [isContentSearchLoading, setIsContentSearchLoading] = useState(false)
  const [searchCaseSensitive, setSearchCaseSensitive] = useState(false)
  const [searchWholeWord, setSearchWholeWord] = useState(false)
  const [collapsedSearchItems, setCollapsedSearchItems] = useState<Record<string, boolean>>({})

  const sidebarTitle = activeSidebarTab === 'outline' ? 'Outline' : 'Files'
  const switchSidebarLabel = activeSidebarTab === 'outline' ? 'Switch to File Tree view' : 'Switch to Outline view'
  const normalizedSearchQuery = searchQuery.toLowerCase().trim()
  const isOutlineSearchActive = isSearching && activeSidebarTab === 'outline' && normalizedSearchQuery.length > 0
  const isFileSearchActive = isSearching && activeSidebarTab === 'files' && normalizedSearchQuery.length > 0

  // portal 目标节点：骨架注入后的容器。若尚未挂载则不渲染 portal（等挂载后 state 变化触发重渲）。
  const [portalTargets, setPortalTargets] = useState<{
    outline: HTMLElement | null
    fileTree: HTMLElement | null
    searchResult: HTMLElement | null
    fileInfo: HTMLElement | null
  }>({ outline: null, fileTree: null, searchResult: null, fileInfo: null })

  useEffect(() => {
    // 骨架由 mountTyporaSkeleton 在应用启动时注入；这里只做 portal 目标解析。
    let raf = requestAnimationFrame(() => {
      setPortalTargets({
        outline: query('#outline-content'),
        fileTree: query('#file-library-tree'),
        searchResult: query('#file-library-search-result'),
        fileInfo: query('#file-info-content'),
      })
    })
    return () => cancelAnimationFrame(raf)
  }, [])

  // body class + sidebar class 切换：对齐 Typora main.js。
  // active-tab-* 挂 #typora-sidebar（探查确认）；ty-on-*/ty-show-*/pin-outline 挂 body。
  useEffect(() => {
    const sidebar = query<HTMLElement>('#typora-sidebar')
    const body = document.body

    body.classList.toggle('pin-outline', showSidebar)
    body.classList.toggle('ty-show-outline-filter', isSearching && activeSidebarTab === 'outline')
    body.classList.toggle('ty-on-outline-filter', isOutlineSearchActive)
    body.classList.toggle('ty-show-search', isSearching && activeSidebarTab === 'files')
    body.classList.toggle('ty-on-search', isSearching && activeSidebarTab === 'files')

    if (sidebar) {
      sidebar.classList.toggle('active-tab-outline', activeSidebarTab === 'outline')
      sidebar.classList.toggle('active-tab-files', activeSidebarTab === 'files')
      sidebar.classList.toggle('use-file-tree-style', true)
      sidebar.classList.toggle('open', showSidebar)
    }

    return () => {
      TYPORA_BODY_STATE_CLASSES.forEach((cls) => body.classList.remove(cls))
      body.classList.remove('pin-outline')
    }
  }, [activeSidebarTab, isSearching, isOutlineSearchActive, showSidebar])

  const switchSidebarTab = useCallback((tab: SidebarTab) => {
    setActiveSidebarTab(tab)
    setIsSearching(false)
    setSearchQuery('')
  }, [])

  const toggleCollapse = useCallback((index: number, isCollapsed: boolean, e: React.MouseEvent) => {
    e.stopPropagation()
    setCollapsedIndices((prev) => ({ ...prev, [index]: !isCollapsed }))
  }, [])

  const toggleFileTreeDirectory = useCallback((path: string, e: React.SyntheticEvent) => {
    e.stopPropagation()
    setExpandedFileTreePaths((prev) => ({ ...prev, [path]: !prev[path] }))
  }, [])

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

    const scrollContainers = [document.querySelector('.milkdown-editor')].filter(
      (element): element is Element => element instanceof Element,
    )

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
    if (isSearching && searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [isSearching])

  // 接管骨架里已有的静态 <input id="file-library-search-input">：把它注册为受控 input。
  // 骨架是静态 HTML，React 不直接管理；这里用 effect 绑定 input 事件回写 state，
  // 同时把 searchInputRef 指向它（供 isSearching 时的 focus）。
  const mutableSearchInputRef = searchInputRef as React.MutableRefObject<HTMLInputElement | null>
  useEffect(() => {
    const input = query<HTMLInputElement>('#file-library-search-input')
    if (!input) return

    mutableSearchInputRef.current = input
    input.value = searchQuery
    const onInput = () => setSearchQuery(input.value)
    input.addEventListener('input', onInput)
    return () => {
      input.removeEventListener('input', onInput)
    }
  }, [searchQuery, mutableSearchInputRef])

  useEffect(() => {
    setCollapsedIndices({})
    setActiveHeadingIndex(headings.length > 0 ? 0 : null)
  }, [content, headings.length])

  useEffect(() => {
    if (activeSidebarTab !== 'files') return

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
        if (!cancelled) setIsFileTreeLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [activeSidebarTab, filePath])

  useEffect(() => {
    if (!isFileSearchActive || !fileTree) {
      setSearchHits([])
      setIsContentSearchLoading(false)
      return
    }

    let cancelled = false
    const timer = window.setTimeout(() => {
      setIsContentSearchLoading(true)
      invoke<SearchHit[]>('search_in_files', {
        folderPath: fileTree.path,
        query: searchQuery,
        caseSensitive: searchCaseSensitive,
        wholeWord: searchWholeWord,
      })
        .then((hits) => {
          if (!cancelled) setSearchHits(hits)
        })
        .catch((error) => {
          if (!cancelled) {
            setSearchHits([])
            setFileTreeError(error instanceof Error ? error.message : String(error))
          }
        })
        .finally(() => {
          if (!cancelled) setIsContentSearchLoading(false)
        })
    }, 250)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [isFileSearchActive, fileTree, searchQuery, searchCaseSensitive, searchWholeWord])

  const handleFileTreeFileClick = useCallback(
    async (node: FileTreeNode) => {
      if (node.is_dir) return
      try {
        const nextContent = await invoke<string>('read_file', { path: node.path })
        const nextFileName = await invoke<string>('get_file_name', { path: node.path })
        openFile(node.path, nextContent, nextFileName)
      } catch (error) {
        setFileTreeError(error instanceof Error ? error.message : String(error))
      }
    },
    [openFile],
  )

  const handleSearchResultClick = useCallback(
    async (path: string) => {
      if (path === filePath) return
      try {
        const nextContent = await invoke<string>('read_file', { path })
        const nextFileName = await invoke<string>('get_file_name', { path })
        openFile(path, nextContent, nextFileName)
      } catch (error) {
        setFileTreeError(error instanceof Error ? error.message : String(error))
      }
    },
    [filePath, openFile],
  )

  const outlineFilterQuery = isOutlineSearchActive ? normalizedSearchQuery : ''

  const renderOutlineNodes = (
    nodes: HeadingNode[],
    filterQuery = '',
  ): React.ReactNode =>
    nodes.map((node) => {
      const hasChildren = node.children.length > 0
      const isActive = activeHeadingIndex === node.originalIndex

      if (!nodeOrDescendantMatches(node, filterQuery)) {
        return null
      }

      const isSelfHit = filterQuery ? node.text.toLowerCase().includes(filterQuery) : false
      const itemFilterClass = filterQuery && !isSelfHit ? 'ty-outline-miss' : ''
      const isCollapsed = filterQuery ? false : isHeadingNodeCollapsed(node, collapsedIndices)
      const stateClass = hasChildren
        ? isCollapsed
          ? 'outline-item-close'
          : 'outline-item-open'
        : 'outline-item-signle outline-item-single'

      return (
        <li
          key={node.originalIndex}
          className={`outline-item-wrapper outline-h${node.level} ${stateClass}`.trim()}
        >
          <div
            className={`outline-item${isActive ? ' outline-item-active' : ''}${
              itemFilterClass ? ` ${itemFilterClass}` : ''
            }`}
            onClick={() => handleHeadingClick(node.text, node.originalIndex)}
          >
            <span
              className="outline-expander"
              onClick={(e) => {
                if (hasChildren && !filterQuery) {
                  toggleCollapse(node.originalIndex, isCollapsed, e)
                }
              }}
            />
            <span
              className={`outline-label${isActive ? ' outline-active' : ''}`}
              data-ref={`n${node.originalIndex}`}
            >
              {splitOutlineLabelByQuery(node.text, filterQuery).map((segment, segmentIndex) =>
                segment.hit ? (
                  <mark className="ty-outline-hit" key={segmentIndex}>
                    {segment.text}
                  </mark>
                ) : (
                  <React.Fragment key={segmentIndex}>{segment.text}</React.Fragment>
                ),
              )}
            </span>
          </div>
          <ul className="outline-children">
            {hasChildren && !isCollapsed ? renderOutlineNodes(node.children, filterQuery) : null}
          </ul>
        </li>
      )
    })

  const renderFileTreeNode = (node: FileTreeNode, isRoot = false, forceOpen = false): React.ReactNode => {
    const isActive = !node.is_dir && node.path === filePath
    const hasChildren = node.is_dir && node.children.length > 0
    const isOpen = isRoot || forceOpen || !!expandedFileTreePaths[node.path]
    const titleParts = splitFileNodeTitle(node.name, node.is_dir)
    const iconClass = isRoot
      ? node.path === filePath
        ? 'fa fa-history'
        : 'fa fa-folder'
      : node.is_dir
        ? 'fa fa-folder'
        : 'fa fa-file-text-o'
    const className = [
      'file-library-node',
      'file-tree-node',
      isRoot ? 'file-node-root' : '',
      node.is_dir ? '' : 'file-library-file-node',
      hasChildren ? (isOpen ? 'file-node-expanded' : 'file-node-collapsed') : '',
      isActive ? 'active' : '',
    ]
      .filter(Boolean)
      .join(' ')
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
          {isRoot ? null : (
            <span
              className="file-node-open-state"
              aria-hidden="true"
              onClick={(event) => toggleIfExpandable(event)}
            >
              <i className="fa fa-caret-right" />
              <i className="fa fa-caret-down" />
            </span>
          )}
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
      return <div data-localize="Loading" data-lg="Front">Loading</div>
    }
    if (fileTreeError) {
      return <div className="file-tree-message error">{fileTreeError}</div>
    }
    if (!fileTree) return null
    return renderFileTreeNode(fileTree, true, false)
  }

  const searchHitGroups = useMemo(() => groupSearchHits(searchHits), [searchHits])

  const renderFileSearchResult = (): React.ReactNode => {
    if (!isFileSearchActive) return null
    if (isContentSearchLoading) {
      return <div data-localize="Loading" data-lg="Front">Loading</div>
    }
    if (searchHitGroups.length === 0) {
      return <div data-localize="No result found." data-lg="Front">No result found.</div>
    }

    const COLLAPSE_THRESHOLD = 6
    return searchHitGroups.map((group) => {
      const totalMatches = group.matches.length
      const isOverThreshold = totalMatches > COLLAPSE_THRESHOLD
      const isCollapsed = isOverThreshold && collapsedSearchItems[group.path] === true
      const itemStateClass = isOverThreshold
        ? isCollapsed
          ? 'ty-search-item-collapse'
          : 'ty-search-item-expand'
        : ''

      return (
        <div
          key={group.path}
          className={`ty-search-item ${itemStateClass}`.trim()}
          data-path={group.path}
          onClick={() => handleSearchResultClick(group.path)}
        >
          <div className="ty-search-item-summary">
            <div
              className="ty-search-item-collapse-icon"
              onClick={(event) => {
                if (!isOverThreshold) return
                event.stopPropagation()
                setCollapsedSearchItems((prev) => ({ ...prev, [group.path]: !prev[group.path] }))
              }}
            >
              <i className="fa fa-caret-right" />
              <i className="fa fa-caret-down" />
            </div>
            <div style={{ display: 'flex' }}>
              <div className="file-list-item-file-name">
                <span className="file-list-item-file-name-part">{group.namePart}</span>
                <span className="file-list-item-file-ext-part">{group.extPart}</span>
              </div>
              <div className="file-list-item-right">
                <span className="file-list-item-count">{group.count > 20 ? '20+' : group.count}</span>
              </div>
            </div>
            <div className="file-list-item-parent-loc">{group.parentDir}</div>
          </div>
          <div className="ty-search-item-matches">
            {group.matches.map((match, matchIndex) => {
              const segments = splitLineByMatch(match.lineText, match.matchText)
              return (
                <div
                  key={matchIndex}
                  className="ty-search-item-line"
                  data-line={match.lineNumber - 1}
                  data-linetext={match.lineText}
                  data-match={match.matchText}
                >
                  {segments.map((segment, segmentIndex) =>
                    segment.hit ? (
                      <span className="ty-file-search-match-text" key={segmentIndex}>
                        {segment.text}
                      </span>
                    ) : (
                      <span key={segmentIndex}>{segment.text}</span>
                    ),
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )
    })
  }

  // portal 目标未就绪时不渲染任何 portal（骨架挂载后 state 变化会重渲）。
  if (!showSidebar) {
    // sidebar 隐藏时仍需清理 body class（已由上面的 effect 处理）。
    return null
  }

  return (
    <>
      {/* 大纲树：塞进骨架 #outline-content，结构与 Typora renderOutput 1:1（顶层 <li>，无外层 <ul>）。 */}
      {portalTargets.outline &&
        createPortal(renderOutlineNodes(headingTree, outlineFilterQuery), portalTargets.outline)}

      {/* 文件树：塞进骨架 #file-library-tree。 */}
      {portalTargets.fileTree && createPortal(renderFileTree(), portalTargets.fileTree)}

      {/* 搜索结果：塞进骨架 #file-library-search-result。 */}
      {portalTargets.searchResult && createPortal(renderFileSearchResult(), portalTargets.searchResult)}

      {/* file-info 面板：塞进骨架 #file-info-content 的各字段。骨架已有结构，这里只填值。
          为简化，整体覆盖 file-info-content 的子节点。 */}
      {portalTargets.fileInfo &&
        createPortal(
          <React.Fragment>
            <div id="file-info-meta-group">
              <div id="file-info-last-saved-sub" className="file-info-item-subtitle">
                {isModified ? 'Modified' : 'Saved'}
              </div>
              <div className="file-info-title file-info-field ">
                <div id="file-info-filename" className="file-info-field-value">
                  {fileName || 'Untitled.md'}
                </div>
                <div
                  id="file-info-filename-input-area"
                  className="file-info-field-value"
                  style={{ display: 'none' }}
                >
                  <input id="file-info-filename-input" /> <span id="file-info-filename-input-ext" />
                </div>
              </div>
              <div className="file-info-field" id="file-info-file-path">
                <i className="fa fa-folder-o file-info-field-key" />
                <span className="file-info-field-value">{filePath || ''}</span>
              </div>
              <div className="file-info-field" id="file-info-last-modified">
                <i className="fa fa-clock-o file-info-field-key" />
                <span className="file-info-field-value" />
              </div>
            </div>
            <div id="file-info-save-group">
              <div className="file-info-item-subtitle">
                {filePath ? (isModified ? 'Unsaved Changes' : 'All Changes Saved') : 'This is a New Document'}
              </div>
              <div id="file-info-save-btn" className="file-info-save-btn">Save Now</div>
            </div>
            <div id="file-info-contet-group">
              <div className="file-info-item-subtitle">Content</div>
              <div className="file-info-field file-info-field-read">
                <span className="file-info-field-read-value" id="file-info-field-read-value-minutes">
                  {fileStats.minutes}
                </span>
                minutes
              </div>
              <div className="file-info-field file-info-field-read">
                <span className="file-info-field-read-value" id="file-info-field-read-value-word">
                  {fileStats.words}
                </span>
                words
              </div>
              <div className="file-info-field file-info-field-read">
                <span className="file-info-field-read-value" id="file-info-field-read-value-ch">
                  {fileStats.characters}
                </span>
                characters
              </div>
            </div>
          </React.Fragment>,
          portalTargets.fileInfo,
        )}

      {/* sidebar-tabs 区域的交互态：骨架已有静态按钮，这里通过事件委托/查询挂载交互。
          为保持简洁，tab 切换/搜索按钮等交互通过下面的隐藏控件层实现（命令式绑定）。 */}
      <ShellInteractionLayer
        activeSidebarTab={activeSidebarTab}
        switchSidebarLabel={switchSidebarLabel}
        sidebarTitle={sidebarTitle}
        isSearching={isSearching}
        searchCaseSensitive={searchCaseSensitive}
        searchWholeWord={searchWholeWord}
        switchSidebarTab={switchSidebarTab}
        setActiveSidebarTab={setActiveSidebarTab}
        setIsSearching={setIsSearching}
        setSearchQuery={setSearchQuery}
        setSearchCaseSensitive={setSearchCaseSensitive}
        setSearchWholeWord={setSearchWholeWord}
        getTyporaSidebarSwitchIconClass={getTyporaSidebarSwitchIconClass}
      />
    </>
  )
}

// 骨架里静态按钮的交互绑定层。骨架按钮没有 React 事件，这里用 effect 通过 querySelector
// 绑定 click/focus，触发上层 state 变化。这保留了 Typora 骨架的原始 DOM（id/class 不动），
// 同时获得 React 的状态管理。
type ShellInteractionLayerProps = {
  activeSidebarTab: SidebarTab
  switchSidebarLabel: string
  sidebarTitle: string
  isSearching: boolean
  searchCaseSensitive: boolean
  searchWholeWord: boolean
  switchSidebarTab: (tab: SidebarTab) => void
  setActiveSidebarTab: React.Dispatch<React.SetStateAction<SidebarTab>>
  setIsSearching: React.Dispatch<React.SetStateAction<boolean>>
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>
  setSearchCaseSensitive: React.Dispatch<React.SetStateAction<boolean>>
  setSearchWholeWord: React.Dispatch<React.SetStateAction<boolean>>
  getTyporaSidebarSwitchIconClass: (tab: SidebarTab) => string
}

const ShellInteractionLayer: React.FC<ShellInteractionLayerProps> = ({
  activeSidebarTab,
  switchSidebarLabel,
  sidebarTitle,
  isSearching,
  searchCaseSensitive,
  searchWholeWord,
  switchSidebarTab,
  setActiveSidebarTab,
  setIsSearching,
  setSearchQuery,
  setSearchCaseSensitive,
  setSearchWholeWord,
  getTyporaSidebarSwitchIconClass,
}) => {
  // 绑定骨架静态按钮的交互。
  useEffect(() => {
    const switchIcon = query<HTMLElement>('#switch-sidebar-icon')
    const filesTab = query<HTMLElement>('#sidepanel-segmented-input-files')
    const outlineTab = query<HTMLElement>('#sidepanel-segmented-input-outline')
    const searchBtn = query<HTMLElement>('#sidebar-search-btn')
    const searchBackBtn = query<HTMLElement>('#ty-sidebar-search-back-btn')
    const caseBtn = query<HTMLElement>('#filesearch-case-option-btn')
    const wordBtn = query<HTMLElement>('#filesearch-word-option-btn')
    const closeFilterBtn = query<HTMLElement>('#close-outline-filter-btn')

    const handlers: Array<{ el: HTMLElement | null; evt: string; fn: (e: Event) => void }> = [
      {
        el: switchIcon,
        evt: 'click',
        fn: () => {
          setActiveSidebarTab((prev) => resolveNextSidebarTab(prev))
          setIsSearching(false)
          setSearchQuery('')
        },
      },
      { el: filesTab, evt: 'click', fn: () => switchSidebarTab('files') },
      { el: outlineTab, evt: 'click', fn: () => switchSidebarTab('outline') },
      { el: searchBtn, evt: 'click', fn: () => setIsSearching(true) },
      {
        el: searchBackBtn,
        evt: 'click',
        fn: () => {
          setIsSearching(false)
          setSearchQuery('')
        },
      },
      { el: caseBtn, evt: 'click', fn: () => setSearchCaseSensitive((v) => !v) },
      { el: wordBtn, evt: 'click', fn: () => setSearchWholeWord((v) => !v) },
      {
        el: closeFilterBtn,
        evt: 'click',
        fn: () => {
          setIsSearching(false)
          setSearchQuery('')
        },
      },
    ]

    handlers.forEach(({ el, evt, fn }) => {
      if (el) el.addEventListener(evt, fn)
    })

    return () => {
      handlers.forEach(({ el, evt, fn }) => {
        if (el) el.removeEventListener(evt, fn)
      })
    }
  }, [
    switchSidebarTab,
    setActiveSidebarTab,
    setIsSearching,
    setSearchQuery,
    setSearchCaseSensitive,
    setSearchWholeWord,
  ])

  // 同步骨架按钮的视觉态（受 React state 驱动）。
  useEffect(() => {
    const switchIconSpan = query<HTMLElement>('#switch-sidebar-icon span')
    if (switchIconSpan) {
      switchIconSpan.className = getTyporaSidebarSwitchIconClass(activeSidebarTab)
      switchIconSpan.setAttribute('ty-hint', switchSidebarLabel)
    }

    // Typora：files/outline tab 显示当前激活的标题文字。
    const filesTab = query<HTMLElement>('#sidepanel-segmented-input-files')
    const outlineTab = query<HTMLElement>('#sidepanel-segmented-input-outline')
    if (filesTab) {
      filesTab.classList.toggle('active', activeSidebarTab === 'files')
      filesTab.classList.toggle('sidebar-tab-current', activeSidebarTab === 'files')
      filesTab.textContent = activeSidebarTab === 'files' ? sidebarTitle : ''
    }
    if (outlineTab) {
      outlineTab.classList.toggle('active', activeSidebarTab === 'outline')
      outlineTab.classList.toggle('sidebar-tab-current', activeSidebarTab === 'outline')
      // outline tab 在 Typora 骨架里有静态 "Outline" 文字，激活时替换为标题。
      outlineTab.textContent = activeSidebarTab === 'outline' ? sidebarTitle : 'Outline'
    }

    // 选项按钮的 select 态。
    const caseBtn = query<HTMLElement>('#filesearch-case-option-btn')
    const wordBtn = query<HTMLElement>('#filesearch-word-option-btn')
    if (caseBtn) caseBtn.classList.toggle('select', searchCaseSensitive)
    if (wordBtn) wordBtn.classList.toggle('select', searchWholeWord)
  }, [
    activeSidebarTab,
    sidebarTitle,
    switchSidebarLabel,
    searchCaseSensitive,
    searchWholeWord,
    isSearching,
    getTyporaSidebarSwitchIconClass,
  ])

  return null
}

export default TyporaShell

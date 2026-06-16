// @vitest-environment happy-dom

import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { resolveActiveHeadingIndex, resolveNextSidebarTab } from './index'
import { Sidebar } from './index'

const sidebarTestState = vi.hoisted(() => ({
  filePath: '/Users/demo/Documents/notes/current.md',
  invoke: vi.fn(),
  openFile: vi.fn(),
}))

vi.mock('@tauri-apps/api/core', () => ({
  invoke: sidebarTestState.invoke,
}))

vi.mock('../../stores/editorStore', () => ({
  useEditorStore: () => ({
    showSidebar: true,
    filePath: sidebarTestState.filePath,
    openFile: sidebarTestState.openFile,
    content: [
      '# 三层架构 + 热点下钻：设计文档',
      '## 架构总览',
      '## L0：领域级 — 领域模型 & 规则',
      '### 职责',
      '### 举例：电商平台',
      '## L1：功能级 — Index + Graph',
    ].join('\n'),
  }),
}))

vi.mock('../../i18n', () => ({
  useLanguage: () => ({
    t: (key: string) => key,
  }),
}))

let root: Root | null = null
let container: HTMLDivElement | null = null

beforeEach(() => {
  document.body.classList.remove(
    'active-tab-outline',
    'active-tab-files',
    'ty-show-outline-filter',
    'ty-on-outline-filter',
    'ty-show-search',
    'ty-on-search',
  )
  sidebarTestState.invoke.mockResolvedValue({
    name: 'notes',
    path: '/Users/demo/Documents/notes',
    is_dir: true,
    children: [],
  })
})

afterEach(() => {
  if (root) {
    act(() => {
      root?.unmount()
    })
  }
  sidebarTestState.invoke.mockReset()
  sidebarTestState.openFile.mockReset()
  document.body.classList.remove('active-tab-outline', 'active-tab-files', 'ty-show-search', 'ty-on-search')
  document.body.classList.remove('ty-show-outline-filter', 'ty-on-outline-filter')
  container?.remove()
  root = null
  container = null
})

function renderSidebar() {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)

  act(() => {
    root?.render(<Sidebar />)
  })

  return container
}

function changeSearchInput(rendered: HTMLElement, value: string) {
  const input = rendered.querySelector('#file-library-search-input') as HTMLInputElement
  const inputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set

  act(() => {
    inputValueSetter?.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

describe('Sidebar', () => {
  it('resolves the active outline item from the latest heading above the viewport reference line', () => {
    expect(resolveActiveHeadingIndex([], 120)).toBeNull()
    expect(resolveActiveHeadingIndex([140, 260, 420], 120)).toBe(0)
    expect(resolveActiveHeadingIndex([80, 160, 320], 180)).toBe(1)
    expect(resolveActiveHeadingIndex([80, 160, 320], 360)).toBe(2)
  })

  it('toggles between Typora outline and file tree sidebar tabs', () => {
    expect(resolveNextSidebarTab('outline')).toBe('files')
    expect(resolveNextSidebarTab('files')).toBe('outline')
  })

  it('renders Typora-compatible nested outline markup', () => {
    const html = renderToStaticMarkup(<Sidebar />)

    expect(html).toContain('id="toc-dropmenu"')
    expect(html).toContain('id="toc-content"')
    expect(html).toContain('class="stopselect dropmenu sidebar-menu open use-file-tree-style active-tab-outline"')
    expect(html).toContain('id="typora-sidebar"')
    expect(html).toContain('class="info-panel-tab-wrapper ty-tab-wrapper"')
    expect(html).toContain('id="info-panel-tab-outline"')
    const headerShell = html.match(/<div class="sidebar-osx-tab ty-tab-wrapper"[^>]*>/)?.[0] ?? ''
    const headerTabs = html.match(/<div class="sidebar-tabs"[^>]*>/)?.[0] ?? ''
    const switchControl = html.match(/<div class="sidebar-tab-btn sidebar-hover-action sidebar-left-action"[^>]+id="switch-sidebar-icon"[^>]*>/)?.[0] ?? ''
    const searchControl = html.match(/<div class="sidebar-tab-btn sidebar-hover-action sidebar-right-action"[^>]+id="sidebar-search-btn"[^>]*>/)?.[0] ?? ''
    const titleTab = html.match(/<div class="sidebar-tab active sidebar-tab-current"[^>]*>/)?.[0] ?? ''

    expect(headerShell).not.toContain('data-tauri-drag-region')
    expect(headerTabs).not.toContain('data-tauri-drag-region')
    expect(switchControl).not.toContain('data-tauri-drag-region')
    expect(searchControl).not.toContain('data-tauri-drag-region')
    expect(titleTab).not.toContain('data-tauri-drag-region')
    expect(html).not.toContain('class="sidebar-osx-tab ty-tab-wrapper searching"')
    expect(html).toContain('data-sidebar-tab="outline"')
    expect(html).toContain('id="sidepanel-segmented-input-files"')
    expect(html).toContain('id="sidepanel-segmented-input-outline">Outline</div>')
    expect(html).not.toContain('sidebar-tab-title')
    expect(html).toContain('id="switch-sidebar-icon"')
    expect(html).toContain('class="sidebar-tab-btn sidebar-hover-action sidebar-left-action"')
    expect(html).not.toContain('<button')
    expect(html).toContain('Switch to File List view')
    expect(html).toContain('class="ty-icon ty-three-cells"')
    expect(html).not.toContain('sidebar-switch-glyph')
    expect(html).not.toContain('viewBox="0 0 1024 1024"')
    expect(html).toContain('class="sidebar-tab active sidebar-tab-current"')
    expect(html).toContain('id="sidepanel-segmented-input-outline"')
    expect(html).toContain('id="ty-sidebar-search-tabs"')
    expect(html).toContain('class="sidebar-tab-btn sidebar-hover-action sidebar-right-action"')
    expect(html).toContain('class="ion-ios7-search-strong"')
    expect(html).not.toContain('sidebar-search-glyph')
    expect(html).not.toContain('class="typora-search-ring"')
    expect(html).not.toContain('class="typora-search-handle"')
    expect(html.indexOf('id="ty-sidebar-search-tabs"')).toBeLessThan(
      html.indexOf('id="file-library-search-input"'),
    )
    expect(html.indexOf('id="file-library-search-input"')).toBeLessThan(
      html.indexOf('id="sidebar-content"'),
    )
    expect(html.indexOf('<div id="file-library-search">')).toBeLessThan(
      html.indexOf('id="file-library-search-result"'),
    )
    expect(html).toContain('id="filesearch-case-option-btn"')
    expect(html).toContain('id="filesearch-word-option-btn"')
    expect(html).toContain('id="filesearch-regexp-option-btn"')
    expect(html).toContain('id="close-outline-filter-btn"')
    expect(html).toContain('id="file-library-search"')
    expect(html).not.toContain('id="file-library-search-panel"')
    expect(html).toContain('id="file-library-search-result"')
    expect(html).toContain('id="sidebar-loading-template" class="file-list-item"')
    expect(html).toContain('id="file-library-list-children" data-after-content="No Files Available"')
    expect(html).toContain('id="file-library"')
    expect(html).toContain('id="file-library-tree" class="no-selection" data-state="" data-after-content="No Folder is Opened."')
    expect(html).toContain('id="file-info-content"')
    expect(html).toContain('id="ty-sidebar-footer"')
    expect(html).toContain('id="sidebar-footer-main-item-label">Open Folder...</span>')
    expect(html).toContain('id="reveal-folder-from-sidebar-menu"')
    expect(html).toContain('id="refresh-from-sidebar-menu"')
    expect(html).toContain('id="ty-group-by-folder-btn"')
    expect(html).toContain('id="ty-sort-by-natural-btn"')
    expect(html).toContain('data-localize="Recent Locations"')
    expect(html).toContain('id="folder-menu-item-after"')
    expect(html).toContain('<div id="outline-content" class="outline-content sidebar-content-content"')
    expect(html).not.toContain('outline-list')
    expect(html).not.toContain('outline-arrow-container')
    expect(html).not.toContain('outline-text')
    expect(html).not.toContain('level-')
    expect(html).toContain('class="outline-label"')
    expect(html).toContain('class="outline-children"')
    expect(html).toContain('id="sidebar-content"')
    expect(html).toContain('class="outline-item-wrapper outline-h1 outline-item-open"')
    expect(html).toContain('class="outline-item-wrapper outline-h2')
    expect(html).toContain('class="outline-item-wrapper outline-h3')
    expect(html).toContain('<span class="outline-expander"></span><span class="outline-label"')
    expect(html).toContain('<ul class="outline-children"></ul>')
    expect(html).not.toContain('outline-item-active')
    expect(html).not.toContain('outline-active')
  })

  it('keeps outline branches expanded by default and still allows explicit collapse', () => {
    const rendered = renderSidebar()

    expect(rendered.textContent).toContain('三层架构 + 热点下钻：设计文档')
    expect(rendered.textContent).toContain('架构总览')
    expect(rendered.textContent).toContain('L0：领域级 — 领域模型 & 规则')
    expect(rendered.textContent).toContain('职责')

    const l0Expander = rendered.querySelector('.outline-h2.outline-item-open > .outline-item > .outline-expander') as HTMLElement

    act(() => {
      l0Expander.click()
    })

    expect(rendered.textContent).not.toContain('职责')
    expect(rendered.textContent).not.toContain('举例：电商平台')

    const rootExpander = rendered.querySelector('.outline-h1 > .outline-item > .outline-expander') as HTMLElement

    act(() => {
      rootExpander.click()
    })

    expect(rendered.textContent).not.toContain('架构总览')
    expect(rendered.textContent).not.toContain('职责')
  })

  it('marks the first outline item active before viewport sync can run', () => {
    const rendered = renderSidebar()
    const firstOutlineItem = rendered.querySelector('#outline-content .outline-item')
    const firstOutlineLabel = rendered.querySelector('#outline-content .outline-label')

    expect(firstOutlineItem?.className).toContain('outline-item-active')
    expect(firstOutlineLabel?.className).toContain('outline-active')
  })

  it('responds to Typora header switch and search button clicks', () => {
    const rendered = renderSidebar()
    const sidebar = rendered.querySelector('#typora-sidebar') as HTMLElement
    const switchButton = rendered.querySelector('#switch-sidebar-icon') as HTMLElement
    const searchButton = rendered.querySelector('#sidebar-search-btn') as HTMLElement

    expect(sidebar.dataset.sidebarTab).toBe('outline')
    expect(rendered.querySelector('.sidebar-tab-current')?.textContent).toBe('Outline')
    expect(sidebar.className).not.toContain('ty-show-search')
    expect(document.body.classList.contains('active-tab-outline')).toBe(true)
    expect(document.body.classList.contains('active-tab-files')).toBe(false)

    act(() => {
      switchButton.click()
    })

    expect(sidebar.dataset.sidebarTab).toBe('files')
    expect(sidebar.className).toContain('active-tab-files')
    expect(rendered.querySelector('.sidebar-tab-current')?.textContent).toBe('Files')
    expect(switchButton.getAttribute('ty-hint')).toBe('Switch to Outline view')
    expect(rendered.querySelector('#switch-sidebar-icon .ty-icon.ty-file-tree')).not.toBeNull()
    expect(document.body.classList.contains('active-tab-files')).toBe(true)
    expect(document.body.classList.contains('active-tab-outline')).toBe(false)

    act(() => {
      searchButton.click()
    })

    expect(sidebar.className).toContain('ty-show-search')
    expect(sidebar.className).toContain('ty-on-search')
    expect(rendered.querySelector('.sidebar-osx-tab')?.className).toBe('sidebar-osx-tab ty-tab-wrapper')
    const searchInput = rendered.querySelector('#file-library-search-input')
    expect(searchInput).not.toBeNull()
    expect(searchInput?.parentElement?.id).toBe('ty-sidebar-search-tabs')
    expect(rendered.querySelector('#file-library-search-panel')).toBeNull()
    expect(document.activeElement).toBe(searchInput)
    expect(document.body.classList.contains('ty-show-search')).toBe(true)
    expect(document.body.classList.contains('ty-on-search')).toBe(true)
  })

  it('searches all outline headings without expanding collapsed branches', () => {
    const rendered = renderSidebar()
    const searchButton = rendered.querySelector('#sidebar-search-btn') as HTMLElement

    expect(rendered.textContent).toContain('三层架构 + 热点下钻：设计文档')
    expect(rendered.textContent).toContain('架构总览')
    expect(rendered.textContent).toContain('职责')

    act(() => {
      searchButton.click()
    })
    changeSearchInput(rendered, '职责')

    expect(rendered.querySelector('#typora-sidebar')?.className).toContain('ty-show-outline-filter')
    expect(rendered.querySelector('#typora-sidebar')?.className).toContain('ty-on-outline-filter')
    expect(document.body.classList.contains('ty-show-outline-filter')).toBe(true)
    expect(document.body.classList.contains('ty-on-outline-filter')).toBe(true)
    expect(rendered.querySelector('#outline-content')?.textContent).toContain('职责')
    expect(rendered.querySelector('#outline-content')?.textContent).not.toContain('三层架构 + 热点下钻：设计文档')
    expect(rendered.querySelector('#file-library')?.textContent).not.toContain('职责')
  })

  it('loads the current file parent folder tree when switching to files', async () => {
    sidebarTestState.invoke.mockResolvedValueOnce({
      name: 'notes',
      path: '/Users/demo/Documents/notes',
      is_dir: true,
      children: [
        {
          name: 'drafts',
          path: '/Users/demo/Documents/notes/drafts',
          is_dir: true,
          children: [
            {
              name: 'chapter.md',
              path: '/Users/demo/Documents/notes/drafts/chapter.md',
              is_dir: false,
              children: [],
            },
          ],
        },
        {
          name: 'current.md',
          path: '/Users/demo/Documents/notes/current.md',
          is_dir: false,
          children: [],
        },
      ],
    })

    const rendered = renderSidebar()
    const switchButton = rendered.querySelector('#switch-sidebar-icon') as HTMLElement

    await act(async () => {
      switchButton.click()
      await Promise.resolve()
    })

    expect(sidebarTestState.invoke).toHaveBeenCalledWith('list_file_tree', {
      filePath: sidebarTestState.filePath,
    })
    expect(rendered.querySelector('#file-library-tree .file-node-root')?.textContent).toContain('notes')
    expect(rendered.querySelector('[data-path="/Users/demo/Documents/notes/drafts"]')?.textContent).toContain('drafts')
    expect(rendered.querySelector('[data-path="/Users/demo/Documents/notes/drafts/chapter.md"]')).toBeNull()
    expect(rendered.querySelector('[data-path="/Users/demo/Documents/notes/current.md"]')?.className).toContain('active')
    expect(rendered.querySelector('[data-path="/Users/demo/Documents/notes/drafts"]')?.className).toContain('file-library-node')
    expect(rendered.querySelector('[data-path="/Users/demo/Documents/notes/drafts"]')?.className).toContain('file-node-collapsed')
    expect(rendered.querySelector('[data-path="/Users/demo/Documents/notes/drafts"]')?.getAttribute('data-has-sub')).toBe('true')
    expect(rendered.querySelector('[data-path="/Users/demo/Documents/notes/drafts"]')?.getAttribute('data-is-directory')).toBe('true')
    expect(rendered.querySelector('[data-path="/Users/demo/Documents/notes/drafts"] .file-node-content')).not.toBeNull()
    expect(rendered.querySelector('[data-path="/Users/demo/Documents/notes/drafts"] .file-node-open-state .fa-caret-right')).not.toBeNull()
    expect(rendered.querySelector('[data-path="/Users/demo/Documents/notes/drafts"] .file-node-icon.fa-folder')).not.toBeNull()
    expect(rendered.querySelector('[data-path="/Users/demo/Documents/notes/drafts"] .file-tree-rename-div')).not.toBeNull()
    expect(rendered.querySelector('[data-path="/Users/demo/Documents/notes/drafts"] .file-tree-rename-input')).not.toBeNull()
    expect(rendered.querySelector('[data-path="/Users/demo/Documents/notes/current.md"]')?.className).toContain('file-library-file-node')
    expect(rendered.querySelector('[data-path="/Users/demo/Documents/notes/current.md"]')?.getAttribute('data-has-sub')).toBe('false')
    expect(rendered.querySelector('[data-path="/Users/demo/Documents/notes/current.md"]')?.getAttribute('data-is-directory')).toBe('false')
    expect(rendered.querySelector('[data-path="/Users/demo/Documents/notes/current.md"] .file-node-icon.fa-file-text-o')).not.toBeNull()
    expect(rendered.querySelector('[data-path="/Users/demo/Documents/notes/current.md"] .file-node-title-name-part')?.textContent).toBe('current')
    expect(rendered.querySelector('[data-path="/Users/demo/Documents/notes/current.md"] .file-node-title-ext-part')?.textContent).toBe('.md')
  })

  it('collapses file tree subdirectories by default and expands them with the Typora chevron', async () => {
    sidebarTestState.invoke.mockResolvedValueOnce({
      name: 'notes',
      path: '/Users/demo/Documents/notes',
      is_dir: true,
      children: [
        {
          name: 'drafts',
          path: '/Users/demo/Documents/notes/drafts',
          is_dir: true,
          children: [
            {
              name: 'chapter.md',
              path: '/Users/demo/Documents/notes/drafts/chapter.md',
              is_dir: false,
              children: [],
            },
          ],
        },
      ],
    })

    const rendered = renderSidebar()
    const switchButton = rendered.querySelector('#switch-sidebar-icon') as HTMLElement

    await act(async () => {
      switchButton.click()
      await Promise.resolve()
    })

    expect(rendered.querySelector('[data-path="/Users/demo/Documents/notes"]')?.className).toContain('file-node-expanded')
    expect(rendered.querySelector('[data-path="/Users/demo/Documents/notes/drafts"]')?.className).toContain('file-node-collapsed')
    expect(rendered.querySelector('[data-path="/Users/demo/Documents/notes/drafts/chapter.md"]')).toBeNull()

    const draftsExpander = rendered.querySelector('[data-path="/Users/demo/Documents/notes/drafts"] .file-node-open-state') as HTMLElement

    await act(async () => {
      draftsExpander.click()
      await Promise.resolve()
    })

    expect(rendered.querySelector('[data-path="/Users/demo/Documents/notes/drafts/chapter.md"]')?.textContent).toContain('chapter.md')
  })

  it('searches files by filename and keeps only matching ancestor folders', async () => {
    sidebarTestState.invoke.mockResolvedValueOnce({
      name: 'notes',
      path: '/Users/demo/Documents/notes',
      is_dir: true,
      children: [
        {
          name: 'drafts',
          path: '/Users/demo/Documents/notes/drafts',
          is_dir: true,
          children: [
            {
              name: 'chapter.md',
              path: '/Users/demo/Documents/notes/drafts/chapter.md',
              is_dir: false,
              children: [],
            },
          ],
        },
        {
          name: 'archive',
          path: '/Users/demo/Documents/notes/archive',
          is_dir: true,
          children: [
            {
              name: 'old.md',
              path: '/Users/demo/Documents/notes/archive/old.md',
              is_dir: false,
              children: [],
            },
          ],
        },
        {
          name: 'current.md',
          path: '/Users/demo/Documents/notes/current.md',
          is_dir: false,
          children: [],
        },
      ],
    })

    const rendered = renderSidebar()
    const switchButton = rendered.querySelector('#switch-sidebar-icon') as HTMLElement
    const searchButton = rendered.querySelector('#sidebar-search-btn') as HTMLElement

    await act(async () => {
      switchButton.click()
      await Promise.resolve()
    })

    expect(rendered.querySelector('[data-path="/Users/demo/Documents/notes/drafts/chapter.md"]')).toBeNull()

    await act(async () => {
      searchButton.click()
      await Promise.resolve()
    })
    changeSearchInput(rendered, 'chapter')

    expect(rendered.querySelector('#file-library-tree')?.textContent).toContain('notes')
    expect(rendered.querySelector('[data-path="/Users/demo/Documents/notes/drafts"]')?.textContent).toContain('drafts')
    expect(rendered.querySelector('[data-path="/Users/demo/Documents/notes/drafts/chapter.md"]')?.textContent).toContain('chapter.md')
    expect(rendered.querySelector('[data-path="/Users/demo/Documents/notes/current.md"]')).toBeNull()
    expect(rendered.querySelector('[data-path="/Users/demo/Documents/notes/archive"]')).toBeNull()

    changeSearchInput(rendered, 'drafts')

    expect(rendered.querySelector('[data-path="/Users/demo/Documents/notes/drafts"]')).toBeNull()
    expect(rendered.querySelector('#file-library-tree')?.textContent).toContain('No result found.')
  })

  it('opens a file tree item in the current editor window', async () => {
    sidebarTestState.invoke.mockImplementation((command: string, args: Record<string, string>) => {
      if (command === 'list_file_tree') {
        return Promise.resolve({
          name: 'notes',
          path: '/Users/demo/Documents/notes',
          is_dir: true,
          children: [
            {
              name: 'other.md',
              path: '/Users/demo/Documents/notes/other.md',
              is_dir: false,
              children: [],
            },
          ],
        })
      }

      if (command === 'read_file') {
        expect(args).toEqual({ path: '/Users/demo/Documents/notes/other.md' })
        return Promise.resolve('# Other')
      }

      if (command === 'get_file_name') {
        expect(args).toEqual({ path: '/Users/demo/Documents/notes/other.md' })
        return Promise.resolve('other.md')
      }

      return Promise.reject(new Error(`unexpected command: ${command}`))
    })

    const rendered = renderSidebar()
    const switchButton = rendered.querySelector('#switch-sidebar-icon') as HTMLElement

    await act(async () => {
      switchButton.click()
      await Promise.resolve()
    })

    const otherFile = rendered.querySelector('[data-path="/Users/demo/Documents/notes/other.md"]') as HTMLElement

    await act(async () => {
      otherFile.click()
      await Promise.resolve()
    })

    expect(sidebarTestState.openFile).toHaveBeenCalledWith(
      '/Users/demo/Documents/notes/other.md',
      '# Other',
      'other.md',
    )
  })
})

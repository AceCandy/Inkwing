// @vitest/environments happy-dom
// @vitest-environment happy-dom

import { beforeEach, describe, expect, it } from 'vitest'
import { mountTyporaSkeleton, unmountTyporaSkeleton } from './mountSkeleton'
import { TYPORA_SHELL_HTML } from './skeletonHtml'

beforeEach(() => {
  // 清干净 body（含跨用例残留的 flag）和 #root。
  document.body.innerHTML = '<div id="root"></div>'
  document.body.removeAttribute('data-typora-skeleton-mounted')
})

describe('TYPORA_SHELL_HTML skeleton structure', () => {
  it('contains all Typora-native top-level sidebar containers with original ids', () => {
    expect(TYPORA_SHELL_HTML).toContain('id="toc-dropmenu"')
    expect(TYPORA_SHELL_HTML).toContain('id="typora-sidebar"')
    expect(TYPORA_SHELL_HTML).toContain('id="sidebar-content"')
    expect(TYPORA_SHELL_HTML).toContain('id="outline-content"')
    expect(TYPORA_SHELL_HTML).toContain('id="file-library"')
    expect(TYPORA_SHELL_HTML).toContain('id="file-library-tree"')
    expect(TYPORA_SHELL_HTML).toContain('id="file-library-list"')
    expect(TYPORA_SHELL_HTML).toContain('id="file-library-search"')
    expect(TYPORA_SHELL_HTML).toContain('id="file-library-search-panel"')
    expect(TYPORA_SHELL_HTML).toContain('id="file-library-search-result"')
    expect(TYPORA_SHELL_HTML).toContain('id="file-info-content"')
    expect(TYPORA_SHELL_HTML).toContain('id="ty-sidebar-footer"')
    expect(TYPORA_SHELL_HTML).toContain('id="ty-sidebar-search-tabs"')
    expect(TYPORA_SHELL_HTML).toContain('id="typora-sidebar-resizer"')
  })

  it('contains Typora-native sidebar-tab controls (macOS segmented)', () => {
    expect(TYPORA_SHELL_HTML).toContain('id="switch-sidebar-icon"')
    expect(TYPORA_SHELL_HTML).toContain('id="sidepanel-segmented-input-files"')
    expect(TYPORA_SHELL_HTML).toContain('id="sidepanel-segmented-input-outline"')
    expect(TYPORA_SHELL_HTML).toContain('id="sidebar-search-btn"')
    expect(TYPORA_SHELL_HTML).toContain('id="ty-sidebar-search-back-btn"')
  })

  it('contains the x-template scripts Typora uses for cloning', () => {
    expect(TYPORA_SHELL_HTML).toContain('id="file-search-item-template"')
    expect(TYPORA_SHELL_HTML).toContain('id="file-list-item-template"')
    expect(TYPORA_SHELL_HTML).toContain('id="folder-menu-item-template"')
    expect(TYPORA_SHELL_HTML).toContain('id="sidebar-loading-template"')
    expect(TYPORA_SHELL_HTML).toContain('id="file-library-node-template"')
  })

  it('contains the inline SVG sprite for find-and-replace icons', () => {
    expect(TYPORA_SHELL_HTML).toContain('id="find-and-replace-icon-case"')
    expect(TYPORA_SHELL_HTML).toContain('id="find-and-replace-icon-word"')
    expect(TYPORA_SHELL_HTML).toContain('id="find-and-replace-icon-regexp"')
  })

  it('contains the sidebar footer menu with Typora-native ids', () => {
    expect(TYPORA_SHELL_HTML).toContain('id="sidebar-new-file-btn"')
    expect(TYPORA_SHELL_HTML).toContain('id="unpin-outline-btn"')
    expect(TYPORA_SHELL_HTML).toContain('id="sidebar-menu-btn"')
    expect(TYPORA_SHELL_HTML).toContain('id="sidebar-files-menu"')
    expect(TYPORA_SHELL_HTML).toContain('id="switch-file-list-btn"')
  })
})

describe('mountTyporaSkeleton', () => {
  it('injects the skeleton into document.body before #root', () => {
    mountTyporaSkeleton()

    const host = document.getElementById('typora-skeleton-host')
    expect(host).not.toBeNull()
    // 骨架挂在 #root 之前（与 Typora DOM 顺序一致：sidebar 先于 content）。
    expect(document.body.firstChild).toBe(host)
    expect(document.getElementById('root')).not.toBeNull()
    expect(document.getElementById('typora-sidebar')).not.toBeNull()
    expect(document.getElementById('outline-content')).not.toBeNull()
  })

  it('is idempotent (mounting twice does not duplicate)', () => {
    mountTyporaSkeleton()
    mountTyporaSkeleton()

    expect(document.querySelectorAll('#typora-skeleton-host')).toHaveLength(1)
    expect(document.querySelectorAll('#typora-sidebar')).toHaveLength(1)
  })

  it('relocates the search panel content into #ty-sidebar-search-tabs (macOS form)', () => {
    mountTyporaSkeleton()

    // 搬运后：#file-library-search-input 应在 #ty-sidebar-search-tabs 内，
    // 而非 #file-library-search-panel 内（对齐 Typora index.html 末尾脚本 1421-1426）。
    const searchTabs = document.getElementById('ty-sidebar-search-tabs')
    const searchPanel = document.getElementById('file-library-search-panel')
    expect(searchTabs?.querySelector('#file-library-search-input')).not.toBeNull()
    expect(searchPanel?.querySelector('#file-library-search-input') ?? null).toBeNull()
  })

  it('unmountTyporaSkeleton removes the host and its flag', () => {
    mountTyporaSkeleton()
    unmountTyporaSkeleton()

    expect(document.getElementById('typora-skeleton-host')).toBeNull()
    expect(document.getElementById('typora-sidebar')).toBeNull()
    expect(document.body.hasAttribute('data-typora-skeleton-mounted')).toBe(false)
  })
})

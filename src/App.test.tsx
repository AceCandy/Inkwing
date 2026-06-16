import React from 'react'
import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import * as AppModule from './App'

const appCss = readFileSync(new URL('./App.css', import.meta.url), 'utf8')
const mainTsx = readFileSync(new URL('./main.tsx', import.meta.url), 'utf8')

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
  convertFileSrc: vi.fn((path: string) => `asset://${path}`),
  isTauri: vi.fn(() => false),
}))

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(),
}))

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(),
}))

vi.mock('./components/Editor', () => ({
  MilkdownEditor: () => <div className="milkdown-editor" />,
}))

vi.mock('./components/SettingsModal', () => ({
  SettingsModal: () => <div className="settings-modal" />,
}))

vi.mock('./hooks/useKeyboardShortcuts', () => ({
  useKeyboardShortcuts: vi.fn(),
}))

vi.mock('./hooks/useAutoSave', () => ({
  useAutoSave: vi.fn(),
}))

vi.mock('./hooks/useAppLogo', () => ({
  useAppLogo: () => 'logo.png',
}))

vi.mock('./themes', () => ({
  applyThemeOption: vi.fn(),
  getThemeOption: vi.fn((theme: string) => ({
    type: 'typora',
    id: theme,
    packageId: 'claude-typora-theme-v1-0-0',
    packageName: 'Claude Typora Theme',
    name: 'Claude Typora Theme / Claude',
    cssFile: 'claude.css',
    basePath: '/third-theme/claude-typora-theme-v1.0.0',
  })),
  refreshExternalThemes: vi.fn(),
}))

vi.mock('./i18n', () => ({
  useLanguage: () => ({
    t: (key: string) => key,
  }),
}))

vi.mock('./stores/editorStore', () => ({
  useEditorStore: () => ({
    filePath: '/tmp/demo.md',
    fileName: 'demo.md',
    content: [
      '# 欢迎使用 WeMD',
      '## 1. 基础语法',
      '## 2. 特殊格式',
      '### 上标和下标',
      '### Emoji 表情',
    ].join('\n'),
    isModified: false,
    mode: 'wysiwyg',
    showSettings: false,
    showSidebar: true,
    currentTheme: 'typora:claude-typora-theme-v1-0-0:claude',
    newFile: vi.fn(),
    openFile: vi.fn(),
    setShowSettings: vi.fn(),
    setThemeError: vi.fn(),
  }),
}))

describe('App sidebar resizing', () => {
  it('keeps sidebar width inside the draggable range', () => {
    const clampSidebarWidth = (AppModule as { clampSidebarWidth?: (width: number) => number }).clampSidebarWidth

    expect(clampSidebarWidth?.(100)).toBe(180)
    expect(clampSidebarWidth?.(245)).toBe(245)
    expect(clampSidebarWidth?.(800)).toBe(520)
  })

  it('uses the stored sidebar width without Claude-specific migration', () => {
    const getInitialSidebarWidth = (
      AppModule as { getInitialSidebarWidth?: (storage: Storage) => number }
    ).getInitialSidebarWidth
    const storage = {
      getItem: vi.fn(() => '270'),
    } as unknown as Storage

    expect(getInitialSidebarWidth?.(storage)).toBe(270)
  })

  it('only clamps stored sidebar widths to the draggable range', () => {
    const getInitialSidebarWidth = (
      AppModule as { getInitialSidebarWidth?: (storage: Storage) => number }
    ).getInitialSidebarWidth
    const storage = {
      getItem: vi.fn(() => '120'),
    } as unknown as Storage

    expect(getInitialSidebarWidth?.(storage)).toBe(180)
  })

  it('loads Typora-compatible icon fonts for the sidebar shell', () => {
    expect(mainTsx).toContain("import 'font-awesome/css/font-awesome.min.css'")
    expect(mainTsx).toContain("import './styles/typora-control-icons.css'")
  })

  it('renders a Typora-compatible sidebar resizer with width variables', () => {
    const html = renderToStaticMarkup(<AppModule.default />)

    expect(html).not.toContain('class="sidebar-layout"')
    expect(html).toContain('--sidebar-width:245px')
    expect(html).toContain('id="typora-sidebar-resizer"')
    expect(html).toContain('class="typora-sidebar-resizer-bar"')
    expect(html).toContain('role="separator"')
    expect(html).toContain('aria-valuemin="180"')
    expect(html).toContain('aria-valuemax="520"')
    expect(html).toContain('aria-valuenow="245"')
  })

  it('renders Typora shell classes and outline hierarchy classes', () => {
    const html = renderToStaticMarkup(<AppModule.default />)

    expect(html).toContain('id="typora-sidebar"')
    expect(html).toContain('class="stopselect dropmenu sidebar-menu open use-file-tree-style active-tab-outline"')
    expect(html).toContain('data-sidebar-tab="outline"')
    expect(html).toContain('id="toc-dropmenu"')
    expect(html).toContain('class="info-panel-tab-wrapper ty-tab-wrapper"')
    expect(html).toContain('id="sidepanel-segmented-input-outline"')
    expect(html).toContain('id="sidepanel-segmented-input-outline">Outline</div>')
    expect(html).not.toContain('sidebar-tab-title')
    expect(html).toContain('id="switch-sidebar-icon"')
    expect(html).toContain('Switch to File List view')
    expect(html).toContain('id="sidebar-search-btn"')
    expect(html).toContain('id="ty-sidebar-footer"')
    expect(html).toContain('id="reveal-folder-from-sidebar-menu"')
    expect(html).toContain('class="outline-content sidebar-content-content"')
    expect(html).toContain('data-after-content="Outline is Empty."')
    expect(html).toContain('outline-item-wrapper outline-h1 outline-item-open')
    expect(html).toContain('outline-item-wrapper outline-h2')
    expect(html).not.toContain('outline-item-active')
    expect(html).not.toContain('outline-label outline-active')
    expect(html).not.toContain('outline-arrow-container')
    expect(html).not.toContain('outline-text')
  })

  it('renders empty Typora titlebar and unclassed content landmarks', () => {
    const html = renderToStaticMarkup(<AppModule.default />)

    expect(html).toContain('<titlebar data-tauri-drag-region="true"></titlebar>')
    expect(html).toContain('<content><div class="milkdown-editor"></div></content>')
    expect(html).not.toContain('id="top-titlebar"')
    expect(html).not.toContain('class="editor-header-bar')
    expect(html).not.toContain('data-typora-node="titlebar"')
    expect(html).not.toContain('id="title-text"')
    expect(html).not.toContain('class="header-filename-text title-text"')
    expect(html).not.toContain('class="header-file-icon ty-file-icon ty-fi-markdown"')
    expect(html).not.toContain('class="header-title-caret fa fa-caret-down"')
    expect(html).not.toContain('class="typora-content-shell"')
    expect(html).not.toContain('data-typora-node="content"')
  })

  it('does not render project-owned titlebar statistics over Typora shell', () => {
    const html = renderToStaticMarkup(<AppModule.default />)

    expect(html).not.toContain('class="header-stat-container"')
    expect(html).not.toContain('选择统计指标')
    expect(html).not.toContain('<span>1 分钟</span>')
  })

  it('styles the main shell with Typora-compatible geometry', () => {
    expect(appCss).toMatch(/\.app\s*\{[\s\S]*--title-bar-height: 28px;/)
    expect(appCss).toMatch(/\.app-body > titlebar\s*\{[\s\S]*position: absolute;[\s\S]*left: var\(--sidebar-width\);[\s\S]*height: var\(--title-bar-height\);[\s\S]*display: block;/)
    expect(appCss).toMatch(/\.app-body > content\s*\{[\s\S]*position: absolute;[\s\S]*top: 0;[\s\S]*left: var\(--sidebar-width\);[\s\S]*width: inherit;[\s\S]*margin-top: var\(--title-bar-height\);[\s\S]*overflow-y: auto;/)
    expect(appCss).not.toMatch(/\.app-body > content\s*\{[\s\S]*width: auto;/)
    expect(appCss).not.toContain('.editor-header-bar')
    expect(appCss).not.toContain('.typora-content-shell')
    expect(appCss).toMatch(/\.sidebar-resizer\s*\{[\s\S]*width: 6px;[\s\S]*margin-left: -2px;/)
  })

  it('uses Typora theme variables instead of project theme tokens for app chrome', () => {
    expect(appCss).not.toContain('var(--accent')
    expect(appCss).not.toContain('var(--accent-hover')
    expect(appCss).not.toContain('var(--bg-primary')
    expect(appCss).not.toContain('var(--bg-surface')
    expect(appCss).not.toContain('var(--text-primary')
    expect(appCss).not.toContain('var(--text-secondary')
    expect(appCss).not.toContain('var(--border)')
    expect(appCss).toContain('background-color: var(--primary-color);')
    expect(appCss).toContain('color: var(--text-color);')
  })

  it('does not wrap the Typora sidebar in a project-owned visual slot', () => {
    const html = renderToStaticMarkup(<AppModule.default />)

    expect(html).not.toContain('class="sidebar-layout"')
    expect(appCss).not.toContain('.sidebar-layout')
    expect(appCss).not.toMatch(/#typora-sidebar\s*\{[^}]*width:\s*245px/)
  })
})

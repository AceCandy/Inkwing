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

vi.mock('./components/Preview', () => ({
  Preview: () => <div className="preview-container" />,
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
    packageId: 'catppuccin-mocha',
    packageName: 'Catppuccin Mocha',
    name: 'Catppuccin Mocha / Theme',
    cssFile: 'theme.css',
    basePath: '/themes/catppuccin-mocha',
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
    currentTheme: 'typora:catppuccin-mocha:theme',
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

  it('migrates the old default sidebar width to the Typora skeleton default', () => {
    const getInitialSidebarWidth = (
      AppModule as { getInitialSidebarWidth?: (storage: Storage) => number }
    ).getInitialSidebarWidth
    const storage = {
      getItem: vi.fn(() => '270'),
    } as unknown as Storage

    expect(getInitialSidebarWidth?.(storage)).toBe(245)
  })

  it('migrates the old Claude visible card width to the Typora skeleton width', () => {
    const getInitialSidebarWidth = (
      AppModule as { getInitialSidebarWidth?: (storage: Storage) => number }
    ).getInitialSidebarWidth
    const storage = {
      getItem: vi.fn(() => '230'),
    } as unknown as Storage

    expect(getInitialSidebarWidth?.(storage)).toBe(245)
  })

  it('loads Typora-compatible FontAwesome icons for the sidebar file tree', () => {
    expect(mainTsx).toContain("import 'font-awesome/css/font-awesome.min.css'")
  })

  it('renders a Typora-compatible sidebar resizer with width variables', () => {
    const html = renderToStaticMarkup(<AppModule.default />)

    expect(html).toContain('class="sidebar-layout"')
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
    expect(html).toContain('id="sidepanel-segmented-input-outline">大纲</div>')
    expect(html).not.toContain('sidebar-tab-title')
    expect(html).toContain('id="switch-sidebar-icon"')
    expect(html).toContain('切换到文件树视图')
    expect(html).toContain('id="sidebar-search-btn"')
    expect(html).toContain('id="ty-sidebar-footer"')
    expect(html).toContain('class="outline-content sidebar-content-content"')
    expect(html).toContain('data-after-content="大纲内容为空"')
    expect(html).toContain('outline-item-wrapper outline-h1 outline-item-open')
    expect(html).toContain('outline-item-wrapper outline-h2')
    expect(html).not.toContain('outline-item-active')
    expect(html).not.toContain('outline-label outline-active')
    expect(html).not.toContain('outline-arrow-container')
    expect(html).not.toContain('outline-text')
  })

  it('renders Typora titlebar and content shell landmarks', () => {
    const html = renderToStaticMarkup(<AppModule.default />)

    expect(html).toContain('id="top-titlebar"')
    expect(html).toContain('<titlebar id="top-titlebar" class="editor-header-bar')
    expect(html).toContain('data-typora-node="titlebar"')
    expect(html).toContain('id="title-text"')
    expect(html).toContain('class="header-filename-text title-text"')
    expect(html).toContain('class="header-file-icon ty-file-icon ty-fi-markdown"')
    expect(html).toContain('class="header-title-caret fa fa-caret-down"')
    expect(html).not.toContain('<svg class="header-file-icon"')
    expect(html).toContain('<content class="typora-content-shell"')
    expect(html).toContain('data-typora-node="content"')
  })

  it('defaults the titlebar statistic to Typora reading time', () => {
    const html = renderToStaticMarkup(<AppModule.default />)

    expect(html).toContain('<span>1 分钟</span>')
    expect(html).not.toContain('<span>20 词</span>')
  })

  it('styles the main shell with Typora-compatible geometry', () => {
    expect(appCss).toMatch(/\.app\s*\{[\s\S]*--title-bar-height: 28px;/)
    expect(appCss).toMatch(/\.app-body > \.editor-area\s*\{[\s\S]*position: absolute;[\s\S]*left: var\(--sidebar-width\);/)
    expect(appCss).toMatch(/\.editor-header-bar\s*\{[\s\S]*height: var\(--title-bar-height\);[\s\S]*position: absolute;/)
    expect(appCss).toMatch(/\.typora-content-shell\s*\{[\s\S]*top: var\(--title-bar-height\);[\s\S]*height: calc\(100% - var\(--title-bar-height\)\);/)
    expect(appCss).toMatch(/\.sidebar-resizer\s*\{[\s\S]*width: 6px;[\s\S]*margin-left: -2px;/)
  })

  it('does not force the real Typora sidebar width inside imported theme scope', () => {
    expect(appCss).toContain('body:not(.typora-theme-scope) .sidebar-layout #typora-sidebar')
    expect(appCss).not.toMatch(/(^|\n)\.sidebar-layout #typora-sidebar\s*\{\s*width: 100%;\s*\}/)
  })
})

import React from 'react'
import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import * as AppModule from './App'
import { TYPORA_SHELL_HTML } from './components/TyporaShell/skeletonHtml'

const appCss = readFileSync(new URL('./App.css', import.meta.url), 'utf8')
const mainTsx = readFileSync(new URL('./main.tsx', import.meta.url), 'utf8')
const indexHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8')

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
      getItem: vi.fn(() => '300'),
    } as unknown as Storage

    expect(getInitialSidebarWidth?.(storage)).toBe(300)
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
    // font-awesome 经 main.tsx import；Typora 实物图标 CSS（ionicons/typora-icon/
    // typora-file-icon）逐字复制自 TypeMark/style，放 public 下经 index.html 全局 link。
    expect(mainTsx).toContain("import 'font-awesome/css/font-awesome.min.css'")
    expect(indexHtml).toContain('/typora-control/ionicons-2.0.1/css/ionicons.min.css')
    expect(indexHtml).toContain('/typora-control/typora-icon/style.css')
    expect(indexHtml).toContain('/typora-control/typora-file-icon/style.css')
  })

  it('mounts the Typora skeleton in main.tsx before React render', () => {
    // 方案 A：骨架由 main.tsx 在 React render 前注入 document.body。
    expect(mainTsx).toContain('mountTyporaSkeleton')
  })

  it('skeleton HTML contains the Typora-native sidebar resizer (not rendered by App)', () => {
    // resizer 的 DOM 在骨架里（Typora 原生 id），App 只通过 SidebarResizerBridge 绑定事件。
    expect(TYPORA_SHELL_HTML).toContain('id="typora-sidebar-resizer"')
    expect(TYPORA_SHELL_HTML).toContain('class="typora-sidebar-resizer-bar"')
    // App 渲染的 HTML 不应重复出现 resizer 的 DOM（只通过事件桥接）。
    const html = renderToStaticMarkup(<AppModule.default />)
    expect(html).not.toContain('id="typora-sidebar-resizer"')
  })

  it('skeleton HTML contains Typora-native sidebar shell (macOS segmented tab form)', () => {
    // sidebar 骨架不在 App 的 React 树里（在 body 注入的骨架里），故测骨架 HTML 字符串。
    expect(TYPORA_SHELL_HTML).toContain('id="typora-sidebar"')
    expect(TYPORA_SHELL_HTML).toContain('class="stopselect dropmenu sidebar-menu"')
    expect(TYPORA_SHELL_HTML).toContain('id="toc-dropmenu"')
    expect(TYPORA_SHELL_HTML).toContain('class="info-panel-tab-wrapper ty-tab-wrapper"')
    expect(TYPORA_SHELL_HTML).toContain('id="sidepanel-segmented-input-outline"')
    expect(TYPORA_SHELL_HTML).toContain('id="sidepanel-segmented-input-outline" data-localize="Outline"')
    expect(TYPORA_SHELL_HTML).toContain('id="switch-sidebar-icon"')
    expect(TYPORA_SHELL_HTML).toContain('id="sidebar-search-btn"')
    expect(TYPORA_SHELL_HTML).toContain('id="ty-sidebar-footer"')
    expect(TYPORA_SHELL_HTML).toContain('id="reveal-folder-from-sidebar-menu"')
    expect(TYPORA_SHELL_HTML).toContain('class="outline-content sidebar-content-content"')
    expect(TYPORA_SHELL_HTML).toContain('data-after-content="Outline is Empty."')
  })

  it('renders macOS seamless titlebar overlay with centered filename and right word count', () => {
    const html = renderToStaticMarkup(<AppModule.default />)

    // macOS 形态：Typora 用原生 Cocoa 标题栏渲染文件名/字数，本项目用 Tauri 无 Cocoa bridge，
    // 自渲染轻量覆盖层（带 .inkwing-chrome 隔离 Typora reset）。
    expect(html).toContain('mac-titlebar-overlay')
    expect(html).toContain('inkwing-chrome')
    expect(html).toContain('data-tauri-drag-region="true"')
    expect(html).toContain('class="mac-titlebar-filename')
    expect(html).toContain('>demo.md<')
    expect(html).toContain('class="mac-titlebar-wordcount"')
    expect(html).toContain('Words')
    // 不渲染 Electron/unibody 形态的 #top-titlebar / traffic lights / footer.ty-footer。
    expect(html).not.toContain('id="top-titlebar"')
    expect(html).not.toContain('id="w-traffic-lights"')
    expect(html).not.toContain('id="w-menu-btn"')
    expect(html).not.toContain('class="stopselect ty-footer"')
    expect(html).not.toContain('id="footer-word-count"')
    expect(html).not.toContain('id="outline-btn"')
  })

  it('renders content with Milkdown editor (Typora <content> custom element)', () => {
    const html = renderToStaticMarkup(<AppModule.default />)

    // 方案 A：正文用 Typora 的 <content> 自定义元素，window.css 给它定位。
    expect(html).toContain('<content>')
    expect(html).toContain('class="milkdown-editor"')
  })

  it('App.css defers sidebar/layout to Typora window.css (no project-owned shell)', () => {
    // 方案 A：#typora-sidebar / #typora-sidebar-resizer / <content> 的布局完全由
    // Typora base-control.css / window.css 提供。App.css 只保留 resizer 拖拽热区、
    // mac-titlebar-overlay、content 内 milkdown-editor 撑满。
    expect(appCss).not.toContain('.app {')
    expect(appCss).not.toContain('.app-body')
    // resizer 规则用 Typora 原生 id（#typora-sidebar-resizer），不再用项目别名 .sidebar-resizer。
    expect(appCss).toMatch(/#typora-sidebar-resizer\s*\{/)
    expect(appCss).not.toMatch(/\.sidebar-resizer\s*\{/)
    // macOS seamless 形态：自渲染 .mac-titlebar-overlay（文件名居中 + 字数右上）。
    expect(appCss).toMatch(/\.mac-titlebar-overlay\s*\{[^}]*position:\s*fixed/)
    expect(appCss).toMatch(/\.mac-titlebar-filename\s*\{[^}]*opacity:\s*0\.7/)
    expect(appCss).toMatch(/\.mac-titlebar-wordcount\s*\{[^}]*right:\s*12px/)
    // content 内 milkdown-editor 撑满。
    expect(appCss).toMatch(/content > \.milkdown-editor\s*\{/)
  })

  it('uses Typora theme variables instead of project theme tokens for app chrome', () => {
    expect(appCss).not.toContain('var(--accent')
    expect(appCss).not.toContain('var(--bg-primary')
    expect(appCss).not.toContain('var(--bg-surface')
    expect(appCss).not.toContain('var(--text-primary')
    expect(appCss).toContain('background-color: var(--primary-color);')
    expect(appCss).toContain('color: var(--text-color, #333);')
  })

  it('does not wrap the Typora sidebar in a project-owned visual slot', () => {
    expect(appCss).not.toContain('.sidebar-layout')
    expect(appCss).not.toMatch(/#typora-sidebar\s*\{[^}]*width:\s*245px/)
  })
})

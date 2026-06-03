import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import * as AppModule from './App'

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
  getThemeOption: vi.fn((theme: string) => ({ type: 'builtin', id: theme })),
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
    currentTheme: 'default',
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
    expect(clampSidebarWidth?.(270)).toBe(270)
    expect(clampSidebarWidth?.(800)).toBe(520)
  })

  it('renders a Typora-compatible sidebar resizer with width variables', () => {
    const html = renderToStaticMarkup(<AppModule.default />)

    expect(html).toContain('class="sidebar-layout"')
    expect(html).toContain('--sidebar-width:270px')
    expect(html).toContain('id="typora-sidebar-resizer"')
    expect(html).toContain('class="typora-sidebar-resizer-bar"')
    expect(html).toContain('role="separator"')
    expect(html).toContain('aria-valuemin="180"')
    expect(html).toContain('aria-valuemax="520"')
    expect(html).toContain('aria-valuenow="270"')
  })

  it('renders Typora shell classes and outline hierarchy classes', () => {
    const html = renderToStaticMarkup(<AppModule.default />)

    expect(html).toContain('id="typora-sidebar"')
    expect(html).toContain('class="sidebar stopselect dropmenu sidebar-menu active-tab-outline open"')
    expect(html).toContain('class="outline-list outline-content sidebar-content-content"')
    expect(html).toContain('data-after-content="大纲内容为空"')
    expect(html).toContain('outline-item-wrapper outline-h1 level-1 outline-item-open')
    expect(html).toContain('outline-item-wrapper outline-h2 level-2 outline-item-signle outline-item-single')
    expect(html).toContain('outline-item-active')
    expect(html).toContain('outline-label outline-text outline-active')
  })
})

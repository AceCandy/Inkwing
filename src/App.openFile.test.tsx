// @vitest-environment happy-dom

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import App from './App'
import { openMarkdownFileInCurrentWindow } from './utils/openMarkdownFile'
import { mountTyporaSkeleton, unmountTyporaSkeleton } from './components/TyporaShell/mountSkeleton'

const editorState = vi.hoisted(() => ({
  filePath: null as string | null,
  fileName: 'Untitled',
  content: '',
  isModified: false,
  mode: 'wysiwyg' as const,
  showSettings: false,
  showSidebar: true,
  currentTheme: 'typora:claude-typora-theme-v1-0-0:claude',
  newFile: vi.fn(),
  openFile: vi.fn(),
  setShowSettings: vi.fn(),
  setThemeError: vi.fn(),
}))

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
  convertFileSrc: vi.fn((path: string) => `asset://${path}`),
  isTauri: vi.fn(() => false),
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
    basePath: '/themes/claude',
  })),
  refreshExternalThemes: vi.fn(),
}))

vi.mock('./i18n', () => ({
  useLanguage: () => ({
    t: (key: string) => key,
  }),
  t: (key: string) => key,
}))

vi.mock('./stores/editorStore', () => ({
  useEditorStore: () => editorState,
}))

vi.mock('./utils/openMarkdownFile', () => ({
  openMarkdownFileForEditorState: vi.fn(),
  openMarkdownFileInCurrentWindow: vi.fn(),
}))

describe('App open file entry points', () => {
  let host: HTMLDivElement
  let root: ReturnType<typeof createRoot>

  beforeEach(() => {
    editorState.filePath = null
    vi.mocked(openMarkdownFileInCurrentWindow).mockReset()
    vi.mocked(openMarkdownFileInCurrentWindow).mockResolvedValue(undefined)
    // 方案 A：Typora 骨架注入 document.body（#root/host 之外），App 内 TyporaShell
    // 通过 portal 把内容塞进骨架节点。测试需先注入骨架。
    mountTyporaSkeleton()
    host = document.createElement('div')
    document.body.appendChild(host)
    root = createRoot(host)
  })

  afterEach(() => {
    act(() => root.unmount())
    host.remove()
    unmountTyporaSkeleton()
  })

  it('starts in the Typora shell without a welcome fallback', async () => {
    await act(async () => {
      root.render(<App />)
    })

    expect(host.querySelector('.welcome-screen')).toBeNull()
    // sidebar 骨架在 document.body（不在 host/#root 内），对齐 Typora DOM 结构。
    expect(document.querySelector('#typora-sidebar')).not.toBeNull()
    expect(document.querySelector('#file-library-search-input')).not.toBeNull()
    expect(host.querySelector('.milkdown-editor')).not.toBeNull()
    expect(openMarkdownFileInCurrentWindow).not.toHaveBeenCalled()
  })
})

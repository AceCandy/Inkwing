// @vitest-environment happy-dom

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import App from './App'
import { openMarkdownFileInCurrentWindow } from './utils/openMarkdownFile'

const editorState = vi.hoisted(() => ({
  filePath: null as string | null,
  fileName: 'Untitled',
  content: '',
  isModified: false,
  mode: 'wysiwyg' as const,
  showSettings: false,
  showSidebar: true,
  currentTheme: 'typora:catppuccin-mocha:theme',
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
    host = document.createElement('div')
    document.body.appendChild(host)
    root = createRoot(host)
  })

  afterEach(() => {
    act(() => root.unmount())
    host.remove()
  })

  it('opens from the welcome screen in the current window', async () => {
    await act(async () => {
      root.render(<App />)
    })

    const openButton = Array.from(host.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('welcome.openFile')
    )

    expect(openButton).toBeDefined()

    await act(async () => {
      openButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
    })

    expect(openMarkdownFileInCurrentWindow).toHaveBeenCalledTimes(1)
  })
})

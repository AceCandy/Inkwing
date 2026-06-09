import { invoke } from '@tauri-apps/api/core'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { SettingsModal } from './index'

vi.mock('../../stores/editorStore', () => ({
	  useEditorStore: () => ({
	    currentTheme: 'typora:catppuccin-mocha:theme',
    setTheme: vi.fn(),
    setShowSettings: vi.fn(),
    themeError: '主题加载失败',
  }),
}))

vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: vi.fn((path: string) => `asset://${path}`),
  invoke: vi.fn(),
}))

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(),
  save: vi.fn(),
}))

const localStorageStub = {
  getItem: vi.fn(() => 'zh'),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}

describe('SettingsModal', () => {
  beforeEach(() => {
    vi.mocked(invoke).mockResolvedValue([])
    localStorageStub.getItem.mockReturnValue('zh')
    localStorageStub.setItem.mockClear()

    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: localStorageStub,
    })
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { platform: 'MacIntel' },
    })

  })

  it('renders Typora folder import controls and current theme errors', () => {
    const html = renderToStaticMarkup(<SettingsModal />)

    expect(html).toContain('导入 Typora 主题文件夹')
    expect(html).toContain('主题加载失败')
  })

  it('renders Typora folder import control in English', () => {
    localStorageStub.getItem.mockReturnValue('en')

    const html = renderToStaticMarkup(<SettingsModal />)

    expect(html).toContain('Import Typora Theme Folder')
    expect(html).not.toContain('导入 Typora 主题文件夹')
  })
})

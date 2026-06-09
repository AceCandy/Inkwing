import { beforeEach, describe, expect, it, vi } from 'vitest'

const localStorageStub = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}

async function loadFreshStore() {
  vi.resetModules()
  return import('./editorStore')
}

describe('editorStore settings persistence', () => {
  beforeEach(() => {
    localStorageStub.getItem.mockReset()
    localStorageStub.setItem.mockReset()

    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: localStorageStub,
    })
  })

  it('keeps the previously selected theme when the app is opened again', async () => {
    localStorageStub.getItem.mockReturnValue('typora:claude-typora-theme-v1-0-0:claude')

    const { useEditorStore } = await loadFreshStore()

    expect(useEditorStore.getState().currentTheme).toBe('typora:claude-typora-theme-v1-0-0:claude')
  })

  it('persists theme changes for the next app launch', async () => {
    localStorageStub.getItem.mockReturnValue(null)
    const { useEditorStore } = await loadFreshStore()

    useEditorStore.getState().setTheme('typora:catppuccin-latte:theme')

    expect(localStorageStub.setItem).toHaveBeenCalledWith('app-theme', 'typora:catppuccin-latte:theme')
    expect(useEditorStore.getState().currentTheme).toBe('typora:catppuccin-latte:theme')
  })

  it('migrates legacy built-in theme ids to bundled Typora CSS theme ids', async () => {
    localStorageStub.getItem.mockReturnValue('light')

    const { useEditorStore } = await loadFreshStore()

    expect(useEditorStore.getState().currentTheme).toBe('typora:catppuccin-latte:theme')
  })

  it('uses bundled Typora dark CSS as the default theme id', async () => {
    localStorageStub.getItem.mockReturnValue(null)

    const { useEditorStore } = await loadFreshStore()

    expect(useEditorStore.getState().currentTheme).toBe('typora:catppuccin-mocha:theme')
  })
})

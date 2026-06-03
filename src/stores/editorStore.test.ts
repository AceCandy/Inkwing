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
    localStorageStub.getItem.mockReturnValue('light')

    const { useEditorStore } = await loadFreshStore()

    expect(useEditorStore.getState().currentTheme).toBe('light')
  })

  it('persists theme changes for the next app launch', async () => {
    localStorageStub.getItem.mockReturnValue(null)
    const { useEditorStore } = await loadFreshStore()

    useEditorStore.getState().setTheme('light')

    expect(localStorageStub.setItem).toHaveBeenCalledWith('app-theme', 'light')
    expect(useEditorStore.getState().currentTheme).toBe('light')
  })
})

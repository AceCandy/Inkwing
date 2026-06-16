import { readFileSync } from 'node:fs'

import { invoke, isTauri } from '@tauri-apps/api/core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getAllThemes, getThemeOption, refreshExternalThemes } from './index'
import { readTyporaThemeCss } from './typora/api'

vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: vi.fn((path: string) => `asset://${path}`),
  invoke: vi.fn(),
  isTauri: vi.fn(() => true),
}))

function readBundledThemeCss(themeDir: string): string {
  return readFileSync(new URL(`../../themes/${themeDir}/theme.css`, import.meta.url), 'utf8')
}

describe('theme registry', () => {
  beforeEach(() => {
    vi.mocked(invoke).mockReset()
    vi.mocked(isTauri).mockReset()
    vi.mocked(isTauri).mockReturnValue(true)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('ships built-in themes as Typora-compatible CSS files', () => {
    const mochaCss = readBundledThemeCss('catppuccin-mocha')
    const latteCss = readBundledThemeCss('catppuccin-latte')

    for (const css of [mochaCss, latteCss]) {
      expect(css).toContain('#write')
      expect(css).toContain('#typora-sidebar')
      expect(css).toContain('.outline-content')
      expect(css).toContain('.outline-item')
      expect(css).not.toContain('#file-library-search-input')
      expect(css).not.toContain('--theme-editor-bg')
      expect(css).not.toContain('--theme-preview-bg')
    }
  })

  it('uses bundled Typora CSS packages when opened in Safari without Tauri IPC', async () => {
    vi.mocked(isTauri).mockReturnValue(false)
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('/* bundled Typora css */\n#write { color: var(--font-color); }'),
    })
    vi.stubGlobal('fetch', fetchMock)

    const themes = await refreshExternalThemes()
    const css = await readTyporaThemeCss('claude-typora-theme-v1-0-0', 'claude.css')

    expect(invoke).not.toHaveBeenCalled()
    expect(themes.map((theme) => theme.id)).toEqual([
      'typora:claude-typora-theme-v1-0-0:claude',
      'typora:claude-typora-theme-v1-0-0:claude-dark',
      'typora:catppuccin-mocha:theme',
      'typora:catppuccin-latte:theme',
    ])
    expect(fetchMock).toHaveBeenCalledWith('/third-theme/claude-typora-theme-v1.0.0/claude.css?raw')
    expect(css).toEqual({
      css: '/* bundled Typora css */\n#write { color: var(--font-color); }',
      basePath: '/third-theme/claude-typora-theme-v1.0.0',
    })
  })

  it('uses Typora CSS packages as the only selectable theme source', async () => {
    vi.mocked(invoke).mockResolvedValueOnce([
      {
        id: 'catppuccin-mocha',
        name: 'Catppuccin Mocha',
        type: 'typora',
        basePath: '/themes/catppuccin-mocha',
        importedAt: 'bundled',
        variants: [
          {
            id: 'theme',
            name: 'Theme',
            cssFile: 'theme.css',
          },
        ],
      },
      {
        id: 'catppuccin-latte',
        name: 'Catppuccin Latte',
        type: 'typora',
        basePath: '/themes/catppuccin-latte',
        importedAt: 'bundled',
        variants: [
          {
            id: 'theme',
            name: 'Theme',
            cssFile: 'theme.css',
          },
        ],
      },
    ])

    await refreshExternalThemes()

    const themes = getAllThemes()
    expect(themes).toHaveLength(2)
    expect(themes.every((theme) => theme.type === 'typora')).toBe(true)
    expect(themes.map((theme) => theme.id)).toEqual([
      'typora:catppuccin-mocha:theme',
      'typora:catppuccin-latte:theme',
    ])
    expect(themes.map((theme) => theme.id)).not.toContain('default')
    expect(themes.map((theme) => theme.id)).not.toContain('light')
  })

  it('exposes imported Typora variants through the theme list', async () => {
    vi.mocked(invoke).mockResolvedValueOnce([
      {
        id: 'claude-typora-theme-v1-0-0',
        name: 'Claude Typora Theme',
        type: 'typora',
        basePath: '/themes/claude',
        importedAt: '2026-06-02T00:00:00Z',
        variants: [
          {
            id: 'claude',
            name: 'Claude',
            cssFile: 'claude.css',
          },
        ],
      },
    ])

    await refreshExternalThemes()

    expect(getAllThemes()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'typora',
          id: 'typora:claude-typora-theme-v1-0-0:claude',
          name: 'Claude Typora Theme / Claude',
          packageId: 'claude-typora-theme-v1-0-0',
          packageName: 'Claude Typora Theme',
          cssFile: 'claude.css',
          basePath: '/themes/claude',
        }),
      ]),
    )
    expect(getThemeOption('typora:claude-typora-theme-v1-0-0:claude')).toEqual(
      expect.objectContaining({
        type: 'typora',
        packageId: 'claude-typora-theme-v1-0-0',
      }),
    )
  })

  it('does not expose Typora user override css files as selectable theme variants', async () => {
    vi.mocked(invoke).mockResolvedValueOnce([
      {
        id: 'claude-typora-theme-v1-0-0',
        name: 'Claude Typora Theme',
        type: 'typora',
        basePath: '/themes/claude',
        importedAt: '2026-06-02T00:00:00Z',
        variants: [
          {
            id: 'claude',
            name: 'Claude',
            cssFile: 'claude.css',
          },
          {
            id: 'base-user',
            name: 'Base User',
            cssFile: 'base.user.css',
          },
          {
            id: 'claude-user',
            name: 'Claude User',
            cssFile: 'claude.user.css',
          },
        ],
      },
    ])

    const themes = await refreshExternalThemes()

    expect(themes.map((theme) => theme.cssFile)).toEqual(['claude.css'])
  })

  it('migrates legacy theme ids to the Claude Typora CSS target', async () => {
    vi.mocked(invoke).mockResolvedValueOnce([
      {
        id: 'claude-typora-theme-v1-0-0',
        name: 'Claude Typora Theme',
        type: 'typora',
        basePath: '/themes/claude',
        importedAt: 'bundled',
        variants: [
          {
            id: 'claude',
            name: 'Claude',
            cssFile: 'claude.css',
          },
        ],
      },
    ])

    await refreshExternalThemes()

    expect(getThemeOption('default')).toEqual(
      expect.objectContaining({
        type: 'typora',
        id: 'typora:claude-typora-theme-v1-0-0:claude',
      }),
    )
    expect(getThemeOption('light')).toEqual(
      expect.objectContaining({
        type: 'typora',
        id: 'typora:claude-typora-theme-v1-0-0:claude',
      }),
    )
  })

  it('raises an explicit error when a requested Typora theme is unavailable', async () => {
    vi.mocked(invoke).mockResolvedValueOnce([])

    await refreshExternalThemes()

    expect(() => getThemeOption('typora:missing:theme')).toThrow('Typora 主题不存在: typora:missing:theme')
  })
})

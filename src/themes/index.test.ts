import { readFileSync } from 'node:fs'

import { invoke } from '@tauri-apps/api/core'
import { describe, expect, it, vi } from 'vitest'

import { getAllThemes, getThemeOption, refreshExternalThemes } from './index'

vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: vi.fn((path: string) => `asset://${path}`),
  invoke: vi.fn(),
}))

function readBundledThemeCss(themeDir: string): string {
  return readFileSync(new URL(`../../themes/${themeDir}/theme.css`, import.meta.url), 'utf8')
}

describe('theme registry', () => {
  it('ships built-in themes as Typora-compatible CSS files', () => {
    const mochaCss = readBundledThemeCss('catppuccin-mocha')
    const latteCss = readBundledThemeCss('catppuccin-latte')

    for (const css of [mochaCss, latteCss]) {
      expect(css).toContain('#write')
      expect(css).toContain('#typora-sidebar')
      expect(css).toContain('.outline-content')
      expect(css).toContain('.outline-item')
      expect(css).not.toContain('--theme-editor-bg')
      expect(css).not.toContain('--theme-preview-bg')
    }
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

  it('falls back to the first Typora CSS theme when a legacy theme id is requested', async () => {
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
    ])

    await refreshExternalThemes()

    expect(getThemeOption('default')).toEqual(
      expect.objectContaining({
        type: 'typora',
        id: 'typora:catppuccin-mocha:theme',
      }),
    )
  })
})

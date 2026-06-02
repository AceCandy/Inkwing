import { invoke } from '@tauri-apps/api/core'
import { describe, expect, it, vi } from 'vitest'

import { getAllThemes, getThemeOption, refreshExternalThemes } from './index'

vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: vi.fn((path: string) => `asset://${path}`),
  invoke: vi.fn(),
}))

describe('theme registry', () => {
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
})

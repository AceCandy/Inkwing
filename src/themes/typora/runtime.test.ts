// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { readTyporaThemeCss } from './api'
import { applyTyporaTheme, getTyporaRuntimeBodyClasses, getTyporaRuntimeShellVariables } from './runtime'

vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: vi.fn((path: string) => `asset://${path}`),
}))

vi.mock('./api', () => ({
  readTyporaThemeCss: vi.fn(),
}))

const readTyporaThemeCssMock = vi.mocked(readTyporaThemeCss)

beforeEach(() => {
  document.head.innerHTML = ''
  document.body.className = ''
  document.body.removeAttribute('style')
  readTyporaThemeCssMock.mockReset()
})

describe('getTyporaRuntimeBodyClasses', () => {
  it('adds Typora-compatible macOS outline body classes', () => {
    expect(getTyporaRuntimeBodyClasses('MacIntel', 'Mozilla/5.0 (Macintosh)')).toEqual([
      'typora-theme-scope',
      'typora-node',
      'allow-file-tree-scroll',
      'html-for-mac',
      'no-animation',
      'mac-os-11',
      'mac-os',
      'mac-seamless-mode',
      'pin-outline',
      'active-tab-outline',
    ])
  })

  it('adds Typora-compatible Windows outline body classes', () => {
    expect(getTyporaRuntimeBodyClasses('Win32', 'Mozilla/5.0 (Windows NT 10.0)')).toEqual([
      'typora-theme-scope',
      'typora-node',
      'no-animation',
      'os-windows',
      'pin-outline',
      'active-tab-outline',
    ])
  })

  it('does not force Typora flat outline mode when the app outline is collapsible', () => {
    expect(getTyporaRuntimeBodyClasses('MacIntel', 'Mozilla/5.0 (Macintosh)')).not.toContain(
      'no-collapse-outline',
    )
  })
})

describe('getTyporaRuntimeShellVariables', () => {
  it('provides macOS Typora shell variables that imported themes expect from the host app', () => {
    expect(getTyporaRuntimeShellVariables('MacIntel', 'Mozilla/5.0 (Macintosh)')).toEqual(
      expect.objectContaining({
        '--sidebar-width': '245px',
        '--title-bar-height': '28px',
        '--typora-font-size': '17px',
      }),
    )
  })

  it('injects Typora font size into the shell style for rem-based themes', async () => {
    readTyporaThemeCssMock.mockResolvedValue({
      css: 'body { font-size: 1rem; }',
      basePath: '/themes/claude',
    })

    await applyTyporaTheme({
      type: 'typora',
      id: 'typora:claude-typora-theme-v1-0-0:claude',
      name: 'Claude',
      packageId: 'claude-typora-theme-v1-0-0',
      packageName: 'Claude',
      cssFile: 'claude.css',
      basePath: '/themes/claude',
    })

    const shellStyle = document.getElementById('inkwing-active-typora-shell-theme')?.textContent

    expect(shellStyle).toContain('--typora-font-size: 17px;')
    expect(shellStyle).toContain('font-size: var(--typora-font-size, 17px);')
  })
})

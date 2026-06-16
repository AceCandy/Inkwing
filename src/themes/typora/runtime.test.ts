// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { convertFileSrc, isTauri } from '@tauri-apps/api/core'

import { readTyporaThemeCss } from './api'
import { applyTyporaTheme, getTyporaRuntimeBodyClasses, getTyporaRuntimeShellVariables } from './runtime'
import typoraBaseCss from './base.css.txt?raw'
import typoraBaseControlCss from './base-control.css.txt?raw'

vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: vi.fn((path: string) => `asset://${path}`),
  isTauri: vi.fn(() => true),
}))

vi.mock('./api', () => ({
  readTyporaThemeCss: vi.fn(),
}))

const readTyporaThemeCssMock = vi.mocked(readTyporaThemeCss)
const convertFileSrcMock = vi.mocked(convertFileSrc)
const isTauriMock = vi.mocked(isTauri)

beforeEach(() => {
  document.head.innerHTML = ''
  document.body.className = ''
  document.body.removeAttribute('style')
  readTyporaThemeCssMock.mockReset()
  convertFileSrcMock.mockClear()
  isTauriMock.mockReturnValue(true)
})

describe('getTyporaRuntimeBodyClasses', () => {
  it('adds Typora-compatible macOS outline body classes', () => {
    expect(getTyporaRuntimeBodyClasses('MacIntel', 'Mozilla/5.0 (Macintosh)')).toEqual([
      'typora-theme-scope',
      'typora-node',
      'no-collapse-outline',
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
      'no-collapse-outline',
      'no-animation',
      'os-windows',
      'pin-outline',
      'active-tab-outline',
    ])
  })

  it('keeps Typora no-collapse-outline body state for imported outline themes', () => {
    expect(getTyporaRuntimeBodyClasses('MacIntel', 'Mozilla/5.0 (Macintosh)')).toContain(
      'no-collapse-outline',
    )
  })
})

describe('getTyporaRuntimeShellVariables', () => {
  it('reads Typora base-control variables from CSS instead of a TypeScript color map', () => {
    expect(typoraBaseCss).toContain('--text-color:#333333')
    expect(typoraBaseControlCss).toContain('--active-toggle-btn-color:#ddd')
    expect(typoraBaseControlCss).toContain('--primary-color:#428bca')
    expect(getTyporaRuntimeShellVariables('MacIntel', 'Mozilla/5.0 (Macintosh)')).toEqual(
      expect.objectContaining({
        '--text-color': '#333333',
        '--active-toggle-btn-color': '#ddd',
        '--primary-color': '#428bca',
      }),
    )
  })

  it('provides macOS Typora shell variables that imported themes expect from the host app', () => {
    expect(getTyporaRuntimeShellVariables('MacIntel', 'Mozilla/5.0 (Macintosh)')).toEqual(
      expect.objectContaining({
        '--sidebar-width': '245px',
        '--title-bar-height': '28px',
        '--typora-font-size': '17px',
        '--typora-line-height': '1.42857143',
        '--active-toggle-btn-color': '#ddd',
        '--active-file-bg-color': '#eee',
        '--primary-color': '#428bca',
        '--side-bar-bg-color': 'var(--bg-color)',
        '--text-color': '#333333',
        '--window-border': '1px solid #e9e9e9',
      }),
    )
  })

  it('injects Typora font size into the shell style for rem-based themes', async () => {
    readTyporaThemeCssMock.mockResolvedValue({
      css: 'html, :host { line-height: 1.5; } body { font-size: 1rem; }',
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

    expect(document.head.firstElementChild?.id).toBe('inkwing-active-typora-shell-theme')
    expect(shellStyle).toContain(':root {')
    expect(shellStyle).toContain('--typora-font-size: 17px;')
    expect(shellStyle).toContain('--typora-line-height: 1.5;')
    expect(shellStyle).toContain('--active-toggle-btn-color: #ddd;')
    expect(shellStyle).toContain('--text-color: #333333;')
    expect(shellStyle).toContain('--window-border: 1px solid #e9e9e9;')
    expect(shellStyle).toContain('font-size: var(--typora-font-size);')
    expect(shellStyle).toContain('line-height: var(--typora-line-height);')
    expect(shellStyle).toContain('body.typora-theme-applying #typora-sidebar { transition: none !important; }')
    expect(shellStyle).toContain('.typora-theme-scope #file-library-search-input{')
    expect(shellStyle).toContain('padding-right: 64px;')
    expect(shellStyle).toContain('body.typora-theme-scope #typora-sidebar.ty-show-search #file-library-search')
    expect(shellStyle).not.toContain('body.typora-theme-scope #typora-sidebar.ty-show-outline-filter #file-library-search')
    expect(shellStyle).not.toContain('body.typora-theme-scope.no-animation #typora-sidebar.ty-show-outline-filter #file-library-search')
    expect(shellStyle).toContain('body.typora-theme-scope #typora-sidebar.ty-on-outline-filter .outline-expander')
    expect(shellStyle).not.toContain('border: 1px solid var(--active-toggle-btn-color);')
  })

  it('uses browser-readable theme asset urls outside Tauri', async () => {
    isTauriMock.mockReturnValue(false)
    readTyporaThemeCssMock.mockResolvedValue({
      css: '@font-face { font-family: Claude; src: url("./claude_fonts/AnthropicSansWebText.ttf") format("truetype"); }',
      basePath: '/third-theme/claude-typora-theme-v1.0.0',
    })

    await applyTyporaTheme({
      type: 'typora',
      id: 'typora:claude-typora-theme-v1-0-0:claude',
      name: 'Claude',
      packageId: 'claude-typora-theme-v1-0-0',
      packageName: 'Claude',
      cssFile: 'claude.css',
      basePath: '/third-theme/claude-typora-theme-v1.0.0',
    })

    const themeStyle = document.getElementById('inkwing-active-typora-theme')?.textContent

    expect(convertFileSrcMock).not.toHaveBeenCalled()
    expect(themeStyle).toContain(
      'url("/third-theme/claude-typora-theme-v1.0.0/claude_fonts/AnthropicSansWebText.ttf")',
    )
  })
})

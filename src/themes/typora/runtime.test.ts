// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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
  // happy-dom 的 navigator.platform 默认为空，stub 成 MacIntel 使平台 class 走 mac 分支。
  vi.stubGlobal('navigator', { platform: 'MacIntel', userAgent: 'Mozilla/5.0 (Macintosh)' })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('getTyporaRuntimeBodyClasses', () => {
  it('emits Typora-native body classes on macOS (with .typora-node, no .typora-theme-scope)', () => {
    // 方案 A：body 用 Typora index.html 原生 class（174 行）+ window.css 必需的 .typora-node
    // 前缀（#typora-sidebar 的 left/position 规则都依赖它）。不再用项目自造的 .typora-theme-scope。
    // active-tab-* / pin-outline 由 TyporaShell 组件运行时切换，不在 runtime 固定输出。
    expect(getTyporaRuntimeBodyClasses('MacIntel', 'Mozilla/5.0 (Macintosh)')).toEqual([
      'typora-node',
      'no-collapse-outline',
      'allow-file-tree-scroll',
      'html-for-mac',
      'no-animation',
      'mac-os-11',
      'mac-os',
      'mac-seamless-mode',
    ])
  })

  it('emits Typora-native body classes on Windows', () => {
    expect(getTyporaRuntimeBodyClasses('Win32', 'Mozilla/5.0 (Windows NT 10.0)')).toEqual([
      'typora-node',
      'no-collapse-outline',
      'allow-file-tree-scroll',
      'html-for-mac',
      'no-animation',
      'os-windows',
    ])
  })

  it('emits .typora-node (window.css dependency) but never .typora-theme-scope', () => {
    const classes = getTyporaRuntimeBodyClasses('MacIntel', 'Mozilla/5.0 (Macintosh)')
    expect(classes).toContain('typora-node')
    expect(classes).not.toContain('typora-theme-scope')
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
        '--sidebar-width': '270px',
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

  it('injects Typora base CSS verbatim (no scope rewrite) and shell variables on :root', async () => {
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

    const shellStyle = document.getElementById('inkwing-active-typora-shell-theme')?.textContent ?? ''
    const baseStyle = document.getElementById('inkwing-active-typora-base-theme')?.textContent ?? ''

    // 注入顺序：base（实物 base+base-control+mac+window 原样）→ shell（变量+补偿）→ theme。
    expect(document.head.firstElementChild?.id).toBe('inkwing-active-typora-base-theme')

    // 方案 A 核心：base CSS 原样注入，选择器保持 Typora 原生（#typora-sidebar / #outline-content 等），
    // 不再有 .typora-theme-scope 作用域前缀。
    expect(baseStyle).not.toContain('.typora-theme-scope')
    expect(baseStyle).toContain('#typora-sidebar')
    expect(baseStyle).toContain('#outline-content')
    expect(baseStyle).toContain('.outline-item')
    // mac.css 实物规则原样保留（不再坍缩为 body.typora-theme-scope.html-for-mac）。
    expect(baseStyle).toMatch(/html-for-mac[^{]*#typora-sidebar/)
    // 变量挂在 :root（对齐 Typora base.css 的 :root 定义），不再坍缩到 .typora-theme-scope。
    expect(shellStyle).toContain(':root {')
    expect(shellStyle).toContain('--typora-font-size: 17px;')
    expect(shellStyle).toContain('--typora-line-height: 1.5;')
    expect(shellStyle).toContain('--active-toggle-btn-color: #ddd;')
    expect(shellStyle).toContain('--text-color: #333333;')
    expect(shellStyle).toContain('--window-border: 1px solid #e9e9e9;')
    expect(shellStyle).toContain('font-size: var(--typora-font-size);')
    expect(shellStyle).toContain('line-height: var(--typora-line-height);')
    expect(shellStyle).toContain('body.typora-theme-applying #typora-sidebar { transition: none !important; }')
    // 大纲过滤态的 hit/miss/expander 规则已由 Typora 实物提供（base style 原样）。
    expect(baseStyle).toContain('ty-outline-miss')
    expect(baseStyle).toContain('ty-outline-hit')
    expect(baseStyle).toContain('ty-on-outline-filter')
    // close-outline-filter-btn：显隐由本项目专属态控制（Typora 无此独立按钮）。
    expect(shellStyle).toContain('ty-show-outline-filter')
    expect(shellStyle).toContain('close-outline-filter-btn')
    // 本项目因按钮 id 重命名自带 #filesearch-*-option-btn 定位规则在 shell。
    expect(shellStyle).toContain('filesearch-case-option-btn')
    // 命中高亮色是本项目新增（Typora 实物只设 opacity），仍在 shell。
    expect(shellStyle).toContain('rgba(248, 192, 116, .3)')
    // 项目自造 UI 的 Typora reset 隔离。
    expect(shellStyle).toContain('inkwing-chrome')
    // 全文搜索结果项布局（ty-search-item 等）已由 Typora 实物 base-control 提供（base style 原样）。
    expect(baseStyle).toContain('ty-search-item')
    expect(baseStyle).toContain('file-list-item-count')
  })

  it('uses browser-readable theme asset urls outside Tauri', async () => {
    isTauriMock.mockReturnValue(false)
    readTyporaThemeCssMock.mockResolvedValue({
      css: '@font-face { font-family: Claude; src: url("./claude_fonts/AnthropicSansWebText.ttf") format("truetype"); }',
      basePath: '/themes/claude-typora-theme-v1-0-0',
    })

    await applyTyporaTheme({
      type: 'typora',
      id: 'typora:claude-typora-theme-v1-0-0:claude',
      name: 'Claude',
      packageId: 'claude-typora-theme-v1-0-0',
      packageName: 'Claude',
      cssFile: 'claude.css',
      basePath: '/themes/claude-typora-theme-v1-0-0',
    })

    const themeStyle = document.getElementById('inkwing-active-typora-theme')?.textContent ?? ''

    expect(convertFileSrcMock).not.toHaveBeenCalled()
    expect(themeStyle).toContain(
      'url("/themes/claude-typora-theme-v1-0-0/claude_fonts/AnthropicSansWebText.ttf")',
    )
  })

  it('applies Typora-native body classes after theme application (no .typora-theme-scope)', async () => {
    readTyporaThemeCssMock.mockResolvedValue({ css: 'body { color: red; }', basePath: '' })

    await applyTyporaTheme({
      type: 'typora',
      id: 'typora:claude:claude',
      name: 'Claude',
      packageId: 'claude',
      packageName: 'Claude',
      cssFile: 'claude.css',
      basePath: '',
    })

    expect(document.body.classList.contains('typora-node')).toBe(true)
    expect(document.body.classList.contains('no-collapse-outline')).toBe(true)
    expect(document.body.classList.contains('html-for-mac')).toBe(true)
    expect(document.body.classList.contains('mac-os')).toBe(true)
    expect(document.body.classList.contains('typora-theme-scope')).toBe(false)
  })
})

import { describe, expect, it } from 'vitest'
import {
  adaptTyporaCss,
  extractTyporaShellVariables,
  rewriteCssAssetUrls,
} from './cssAdapter'
import { isTyporaThemeOption } from './types'

const toAssetUrl = (path: string) => `asset://${path}`

describe('rewriteCssAssetUrls', () => {
  it('rewrites relative font urls against the imported theme base path', () => {
    const css = [
      '@font-face { src: url("./claude_fonts/AnthropicSansWebText.ttf") format("truetype"); }',
      '@font-face { src: url(".\\fonts\\a.woff2") format("woff2"); }',
    ].join('\n')

    const result = rewriteCssAssetUrls(css, '/app/themes/claude', toAssetUrl)

    expect(result).toContain(
      'url("asset:///app/themes/claude/claude_fonts/AnthropicSansWebText.ttf")',
    )
    expect(result).toContain('url("asset:///app/themes/claude/fonts/a.woff2")')
  })

  it('does not rewrite remote, data, or absolute urls', () => {
    const css = [
      '.a { background: url("https://example.com/a.png"); }',
      '.b { background: url("data:image/png;base64,abc"); }',
      '.c { background: url("/already/absolute.png"); }',
    ].join('\n')

    const result = rewriteCssAssetUrls(css, '/app/themes/claude', toAssetUrl)

    expect(result).toContain('url("https://example.com/a.png")')
    expect(result).toContain('url("data:image/png;base64,abc")')
    expect(result).toContain('url("/already/absolute.png")')
  })
})

describe('extractTyporaShellVariables', () => {
  it('maps known Typora shell variables into Inkwing shell variables', () => {
    const css = `
      :root {
        --bg-color: #faf9f5;
        --font-color: #141413;
        --border-color: #1f1e1d;
        --LOGO-color: #D97757;
      }
    `

    expect(extractTyporaShellVariables(css)).toEqual(
      expect.objectContaining({
        '--bg-primary': '#faf9f5',
        '--bg-secondary': '#faf9f5',
        '--theme-editor-bg': '#faf9f5',
        '--theme-preview-bg': '#faf9f5',
        '--text-primary': '#141413',
        '--theme-text-primary': '#141413',
        '--border': '#1f1e1d',
        '--theme-border': '#1f1e1d',
        '--accent': '#D97757',
        '--theme-accent': '#D97757',
      }),
    )
  })

  it('maps Typora editor variables used by editor and preview containers', () => {
    const css = `
      :root {
        --bg-color: #262624;
        --hover-color: #141413;
        --font-color: #faf9f5;
        --sidebar-font-color: #c2c0b6;
        --border-color: #dedcd1;
        --pre-bg-color: #ffffff80;
        --pre-border-color: #1f1e1d26;
        --pre-inputfont-color: #73726c;
        --code-bg-color: #c2c0b60d;
        --code-font-color: #fe8181;
        --code-border: #dedcd126;
        --LOGO-color: #D97757;
        --font-serif: "Anthropic Serif Web Text", Georgia;
        --font-mono: "Anthropic Mono Variable", ui-monospace;
      }
    `

    expect(extractTyporaShellVariables(css)).toEqual(
      expect.objectContaining({
        '--theme-editor-bg': '#262624',
        '--theme-preview-bg': '#262624',
        '--theme-code-bg': '#ffffff80',
        '--theme-code-border': '#1f1e1d26',
        '--theme-code-text': '#73726c',
        '--theme-inline-code-bg': '#c2c0b60d',
        '--theme-inline-code-text': '#fe8181',
        '--theme-inline-code-border': '#dedcd126',
        '--theme-font-family': '"Anthropic Serif Web Text", Georgia',
        '--theme-font-family-mono': '"Anthropic Mono Variable", ui-monospace',
      }),
    )
  })
})

describe('adaptTyporaCss', () => {
  it('scopes #write rules to editor and preview content', () => {
    const css = '#write h1, #write h2 { color: var(--font-color); }'

    const result = adaptTyporaCss(css, {
      assetBasePath: '/app/themes/claude',
      toAssetUrl,
    })

    expect(result).toContain('.typora-theme-scope .milkdown .editor h1')
    expect(result).toContain('.typora-theme-scope .preview-content h1')
    expect(result).toContain('.typora-theme-scope .milkdown .editor h2')
    expect(result).toContain('.typora-theme-scope .preview-content h2')
    expect(result).not.toContain('#write h1')
    expect(result).not.toContain('#write h2')
  })

  it('drops Typora-only shell selectors instead of leaking them globally', () => {
    const css = [
      '#typora-sidebar { background: red; }',
      '.ty-tooltip.shown { display: none; }',
      '.CodeMirror { font-size: 14px; }',
      '.CodeMirror-scroll { overflow: auto; }',
      '#write p { color: black; }',
    ].join('\n')

    const result = adaptTyporaCss(css, {
      assetBasePath: '/app/themes/claude',
      toAssetUrl,
    })

    expect(result).not.toContain('#typora-sidebar')
    expect(result).not.toContain('.ty-tooltip')
    expect(result).not.toContain('.CodeMirror')
    expect(result).toContain('.typora-theme-scope .milkdown .editor p')
  })

  it('scopes body html and :root rules to the typora theme scope', () => {
    const css = [
      'body { background: #faf9f5; }',
      'html { color-scheme: light; }',
      ':root { --font-color: #141413; }',
    ].join('\n')

    const result = adaptTyporaCss(css, {
      assetBasePath: '/app/themes/claude',
      toAssetUrl,
    })

    expect(result).toContain('.typora-theme-scope{')
    expect(result).not.toContain('.typora-theme-scope body')
    expect(result).not.toContain('.typora-theme-scope html')
    expect(result).not.toContain('.typora-theme-scope :root')
    expect(result).not.toContain('body {')
    expect(result).not.toContain('html {')
    expect(result).not.toContain(':root {')
  })

  it('maps Typora code fence selectors to Inkwing pre elements', () => {
    const css = [
      '.md-fences { background-color: var(--pre-bg-color); border-color: var(--pre-border-color); }',
      '.CodeMirror-lines { color: var(--pre-inputfont-color); }',
      'code, tt { color: var(--code-font-color); background-color: var(--code-bg-color); }',
    ].join('\n')

    const result = adaptTyporaCss(css, {
      assetBasePath: '/app/themes/claude',
      toAssetUrl,
    })

    expect(result).toContain('.typora-theme-scope .milkdown .editor pre')
    expect(result).toContain('.typora-theme-scope .preview-content pre')
    expect(result).toContain('.typora-theme-scope .milkdown .editor pre code')
    expect(result).toContain('.typora-theme-scope .preview-content pre code')
    expect(result).toContain('var(--theme-code-bg)')
    expect(result).toContain('var(--theme-code-border)')
    expect(result).toContain('var(--theme-code-text)')
    expect(result).toContain('var(--theme-inline-code-text)')
    expect(result).not.toContain('var(--code-font-color)')
    expect(result).not.toContain('.typora-theme-scope .CodeMirror-lines')
  })

  it('maps Typora content selectors to editor and preview surfaces', () => {
    const css = [
      '.write ul { margin: 0; }',
      '.write > ol { padding: 0 2rem; }',
      'blockquote > p { margin: 0; }',
      'hr { border-color: var(--hr-color); }',
    ].join('\n')

    const result = adaptTyporaCss(css, {
      assetBasePath: '/app/themes/claude',
      toAssetUrl,
    })

    expect(result).toContain('.typora-theme-scope .milkdown .editor ul')
    expect(result).toContain('.typora-theme-scope .preview-content ul')
    expect(result).toContain('.typora-theme-scope .milkdown .editor > ol')
    expect(result).toContain('.typora-theme-scope .preview-content > ol')
    expect(result).toContain('.typora-theme-scope .milkdown .editor blockquote > p')
    expect(result).toContain('.typora-theme-scope .preview-content blockquote > p')
    expect(result).toContain('.typora-theme-scope .milkdown .editor hr')
    expect(result).toContain('.typora-theme-scope .preview-content hr')
    expect(result).toContain('var(--theme-hr-color)')
    expect(result).not.toContain('.typora-theme-scope .write ul')
    expect(result).not.toContain('.typora-theme-scope blockquote > p')
  })

  it('appends app compatibility rules after imported Typora CSS', () => {
    const result = adaptTyporaCss('#write h1 { font-size: 2rem; }', {
      assetBasePath: '/app/themes/claude',
      toAssetUrl,
    })

    expect(result).toContain('body.typora-theme-scope .sidebar{')
    expect(result).toContain('border:0.5px solid var(--border-color-15, rgba(31, 30, 29, 0.14));')
    expect(result).toContain('width:calc(var(--sidebar-width, 325px) - 15px);')
    expect(result).toContain('body.typora-theme-scope .sidebar-title-logo{display:none;}')
    expect(result).toContain('body.typora-theme-scope .sidebar-header h3{font-size:24px;')
    expect(result.trim().endsWith('}')).toBe(true)
  })

  it('adds Typora-like document surface rules with stronger body scope', () => {
    const result = adaptTyporaCss('#write { max-width: 752px; }', {
      assetBasePath: '/app/themes/claude',
      toAssetUrl,
    })

    expect(result).toContain('body.typora-theme-scope .milkdown-editor')
    expect(result).toContain('body.typora-theme-scope .preview-container')
    expect(result).toContain('padding:var(--typora-surface-padding, 24px);')
    expect(result).toContain('body.typora-theme-scope .milkdown .editor')
    expect(result).toContain('body.typora-theme-scope .preview-content')
  })

  it('adds Typora-like outline tree compatibility rules', () => {
    const result = adaptTyporaCss('', {
      assetBasePath: '/app/themes/claude',
      toAssetUrl,
    })

    expect(result).toContain('body.typora-theme-scope .outline-content{')
    expect(result).toContain('padding:14px 14px 22px 17px;')
    expect(result).toContain('body.typora-theme-scope .outline-content li .outline-item::before')
    expect(result).toContain('border-left:1px solid var(--LOGO-color);')
    expect(result).toContain('body.typora-theme-scope .outline-item-open > .outline-children::before')
    expect(result).toContain('body.typora-theme-scope .outline-content li .outline-label')
  })

  it('maps Typora sidebar shell selectors onto Inkwing sidebar', () => {
    const css = [
      '#typora-sidebar { border-radius: 15px; }',
      '#typora-sidebar:hover { box-shadow: var(--box-shadow-userinput-hover); }',
      '#typora-sidebar input { color: var(--sidebar-font-color); }',
    ].join('\n')

    const result = adaptTyporaCss(css, {
      assetBasePath: '/app/themes/claude',
      toAssetUrl,
    })

    expect(result).toMatch(/body\.typora-theme-scope \.sidebar\{\s*border-radius: 15px;/)
    expect(result).toMatch(/body\.typora-theme-scope \.sidebar:hover\{\s*box-shadow: var\(--box-shadow-userinput-hover\);/)
    expect(result).toMatch(/body\.typora-theme-scope \.sidebar input\{\s*color: var\(--text-secondary\);/)
    expect(result).not.toContain('#typora-sidebar')
  })

  it('maps Typora outline content id selectors onto Inkwing outline content', () => {
    const css = [
      '#outline-content { color: var(--sidebar-font-color); }',
      '#outline-content .outline-label { font-size: 14px; }',
    ].join('\n')

    const result = adaptTyporaCss(css, {
      assetBasePath: '/app/themes/claude',
      toAssetUrl,
    })

    expect(result).toMatch(/\.typora-theme-scope \.outline-content\{\s*color: var\(--text-secondary\);/)
    expect(result).toMatch(/\.typora-theme-scope \.outline-content \.outline-label\{\s*font-size: 14px;/)
    expect(result).not.toContain('#outline-content')
  })

  it('keeps Typora body state selectors matchable when adapting sidebar shell rules', () => {
    const css = [
      '.mac-os #typora-sidebar { margin-top: calc(var(--title-bar-height, 28px) + 15px) !important; }',
      '.mac-seamless-mode #typora-sidebar:hover { box-shadow: var(--box-shadow-userinput-hover) !important; }',
    ].join('\n')

    const result = adaptTyporaCss(css, {
      assetBasePath: '/app/themes/claude',
      toAssetUrl,
    })

    expect(result).toContain('body.typora-theme-scope.mac-os .sidebar{')
    expect(result).toContain('body.typora-theme-scope.mac-seamless-mode .sidebar:hover{')
    expect(result).not.toContain('.mac-os body.typora-theme-scope')
    expect(result).not.toContain('.mac-seamless-mode body.typora-theme-scope')
  })

  it('keeps Typora outline tab state selectors matchable on the app body', () => {
    const css = [
      '.mac-os.active-tab-outline #outline-content { padding-bottom: 22px !important; }',
      '.mac-seamless-mode.active-tab-outline #outline-content { height: 100% !important; }',
    ].join('\n')

    const result = adaptTyporaCss(css, {
      assetBasePath: '/app/themes/claude',
      toAssetUrl,
    })

    expect(result).toContain('body.typora-theme-scope.mac-os.active-tab-outline .outline-content{')
    expect(result).toContain('body.typora-theme-scope.mac-seamless-mode.active-tab-outline .outline-content{')
    expect(result).not.toContain('.typora-theme-scope .mac-os.active-tab-outline')
    expect(result).not.toContain('.typora-theme-scope .mac-seamless-mode.active-tab-outline')
  })

  it('keeps Typora sidebar content state selectors matchable on the app body', () => {
    const css = [
      '.mac-os.active-tab-outline #sidebar-content { bottom: 15px !important; }',
      '.os-windows .ty-show-search #sidebar-content .sidebar-content-content { margin-top: -7px; }',
    ].join('\n')

    const result = adaptTyporaCss(css, {
      assetBasePath: '/app/themes/claude',
      toAssetUrl,
    })

    expect(result).toContain('body.typora-theme-scope.mac-os.active-tab-outline #sidebar-content{')
    expect(result).toContain('body.typora-theme-scope.os-windows.ty-show-search #sidebar-content .sidebar-content-content{')
    expect(result).not.toContain('.typora-theme-scope .mac-os.active-tab-outline')
    expect(result).not.toContain('.typora-theme-scope .os-windows .ty-show-search')
  })

  it('maps Typora inline marker selectors onto rendered inline elements', () => {
    const css = [
      'span[md-inline="highlight"] mark, .md-pair-s mark { text-decoration: underline wavy #D97757; }',
      'span[md-inline="underline"] u { text-underline-offset: 3px; }',
    ].join('\n')

    const result = adaptTyporaCss(css, {
      assetBasePath: '/app/themes/claude',
      toAssetUrl,
    })

    expect(result).toContain('.typora-theme-scope .milkdown .editor mark')
    expect(result).toContain('.typora-theme-scope .preview-content mark')
    expect(result).toContain('.typora-theme-scope .milkdown .editor u')
    expect(result).toContain('.typora-theme-scope .preview-content u')
    expect(result).not.toContain('span[md-inline="highlight"]')
    expect(result).not.toContain('.md-pair-s mark')
  })
})

describe('isTyporaThemeOption', () => {
  it('requires packageId and basePath to be strings', () => {
    expect(
      isTyporaThemeOption({
        type: 'typora',
        id: 'theme-a',
        name: 'Theme A',
        packageId: 'pkg-a',
        packageName: 'Package A',
        cssFile: 'style.css',
        basePath: '/app/themes/a',
      }),
    ).toBe(true)

    expect(
      isTyporaThemeOption({
        type: 'typora',
        id: 'theme-a',
        name: 'Theme A',
        packageName: 'Package A',
        cssFile: 'style.css',
        basePath: '/app/themes/a',
      }),
    ).toBe(false)

    expect(
      isTyporaThemeOption({
        type: 'typora',
        id: 'theme-a',
        name: 'Theme A',
        packageId: 'pkg-a',
        packageName: 'Package A',
        cssFile: 'style.css',
        basePath: 123,
      }),
    ).toBe(false)
  })
})

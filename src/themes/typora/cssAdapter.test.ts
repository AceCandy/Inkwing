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
      '#typora-quick-open { background: red; }',
      '.ty-tooltip.shown { display: none; }',
      '.CodeMirror { font-size: 14px; }',
      '.CodeMirror-scroll { overflow: auto; }',
      '#write p { color: black; }',
    ].join('\n')

    const result = adaptTyporaCss(css, {
      assetBasePath: '/app/themes/claude',
      toAssetUrl,
    })

    expect(result).not.toContain('#typora-quick-open')
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

    expect(result).toContain('body.typora-theme-scope #typora-sidebar{')
    expect(result).toContain('--typora-sidebar-toolbar-height:120px;')
    expect(result).toContain('border:0.5px solid var(--border-color-15, rgba(31, 30, 29, 0.14));')
    expect(result).toContain('width:calc(var(--sidebar-width, 245px) - 15px);')
    expect(result).toContain('body.typora-theme-scope #typora-sidebar-resizer{left:var(--sidebar-width, 245px);}')
    expect(result).toContain('body.typora-theme-scope #typora-sidebar .sidebar-osx-tab{')
    expect(result).toContain('height:var(--typora-sidebar-toolbar-height, 120px);')
    expect(result).toContain('border-bottom:1px solid var(--border-color-15, rgba(31, 30, 29, 0.14));')
    expect(result).toContain('body.typora-theme-scope #typora-sidebar .sidebar-content{position:absolute;top:var(--typora-sidebar-toolbar-height, 120px)!important;right:0;bottom:15px;left:0;')
    expect(result).toContain('body.typora-theme-scope.mac-os #typora-sidebar .sidebar-content,')
    expect(result).toContain('body.typora-theme-scope.mac-seamless-mode #typora-sidebar .sidebar-content{top:var(--typora-sidebar-toolbar-height, 120px)!important;}')
    expect(result.trim().endsWith('}')).toBe(true)
  })

  it('lets imported Typora #write spacing define the document inset', () => {
    const result = adaptTyporaCss('#write { max-width: 752px; }', {
      assetBasePath: '/app/themes/claude',
      toAssetUrl,
    })

    expect(result).toContain('body.typora-theme-scope .milkdown-editor')
    expect(result).toContain('body.typora-theme-scope .preview-container')
    expect(result).toContain(
      'body.typora-theme-scope .milkdown-editor,\nbody.typora-theme-scope .preview-container{padding:0;',
    )
    expect(result).not.toContain('padding:var(--typora-surface-padding, 24px);')
    expect(result).toContain('body.typora-theme-scope .milkdown .editor')
    expect(result).toContain('body.typora-theme-scope .preview-content')
  })

  it('does not synthesize theme-specific outline connector rules without theme CSS', () => {
    const result = adaptTyporaCss('', {
      assetBasePath: '/app/themes/claude',
      toAssetUrl,
    })

    expect(result).toContain('body.typora-theme-scope #outline-content{')
    expect(result).toContain('padding:14px 14px 22px 17px;')
    expect(result).toContain('body.typora-theme-scope #outline-content{list-style:none;margin:0;}')
    expect(result).toContain('body.typora-theme-scope #outline-content ul{list-style:none;margin:0;padding-left:0;}')
    expect(result).not.toContain('body.typora-theme-scope #outline-content,\nbody.typora-theme-scope #outline-content ul')
    expect(result).not.toContain('outline-item::before')
    expect(result).not.toContain('outline-children::before')
    expect(result).not.toContain('var(--LOGO-color')
  })

  it('keeps Claude outline connector rules from the imported theme CSS', () => {
    const result = adaptTyporaCss([
      '#outline-content { color: var(--sidebar-font-color); }',
      '.outline-content li .outline-label { font-family: var(--font-sans); }',
      '.outline-content li .outline-item::before { border-left: 1px solid var(--LOGO-color); }',
      '.outline-content > li:first-of-type > .outline-item::before { border-top: 1px solid var(--LOGO-color); }',
      '.outline-item-open > .outline-children::before { border-left: 1px solid var(--LOGO-color); }',
    ].join('\n'), {
      assetBasePath: '/app/themes/claude',
      toAssetUrl,
    })

    expect(result).toContain('body.typora-theme-scope #outline-content{')
    expect(result).toContain('body.typora-theme-scope #outline-content li .outline-label{')
    expect(result).toContain('font-family: var(--font-sans);')
    expect(result).toContain('body.typora-theme-scope #outline-content li .outline-item::before{')
    expect(result).toContain('border-left: 1px solid var(--accent);')
    expect(result).toContain('body.typora-theme-scope #outline-content > li:first-of-type > .outline-item::before{')
    expect(result).toContain('.typora-theme-scope .outline-item-open > .outline-children::before{')
  })

  it('keeps Typora sidebar shell selectors scoped to the real sidebar id', () => {
    const css = [
      '#typora-sidebar { border-radius: 15px; }',
      '#typora-sidebar:hover { box-shadow: var(--box-shadow-userinput-hover); }',
      '#typora-sidebar input { color: var(--sidebar-font-color); }',
    ].join('\n')

    const result = adaptTyporaCss(css, {
      assetBasePath: '/app/themes/claude',
      toAssetUrl,
    })

    expect(result).toMatch(/body\.typora-theme-scope #typora-sidebar\{\s*border-radius: 15px;/)
    expect(result).toMatch(/body\.typora-theme-scope #typora-sidebar:hover\{\s*box-shadow: var\(--box-shadow-userinput-hover\);/)
    expect(result).toMatch(/body\.typora-theme-scope #typora-sidebar input\{\s*color: var\(--text-secondary\);/)
    expect(result).not.toMatch(/body\.typora-theme-scope \.sidebar\{/)
  })

  it('keeps Typora sidebar resizer selectors mapped to the app resizer element', () => {
    const css = [
      '#typora-sidebar-resizer:not(.dragging) .typora-sidebar-resizer-bar:hover { background: none !important; }',
      '.pin-outline #typora-sidebar-resizer { display: block; }',
    ].join('\n')

    const result = adaptTyporaCss(css, {
      assetBasePath: '/app/themes/claude',
      toAssetUrl,
    })

    expect(result).toContain(
      'body.typora-theme-scope #typora-sidebar-resizer:not(.dragging) .typora-sidebar-resizer-bar:hover{',
    )
    expect(result).toContain('body.typora-theme-scope.pin-outline #typora-sidebar-resizer{')
    expect(result).not.toContain('.sidebar-resizer:not')
    expect(result).not.toContain('.typora-theme-scope .pin-outline')
  })

  it('keeps Typora outline content id selectors scoped to the real outline id', () => {
    const css = [
      '#outline-content { color: var(--sidebar-font-color); }',
      '#outline-content .outline-label { font-size: 14px; }',
    ].join('\n')

    const result = adaptTyporaCss(css, {
      assetBasePath: '/app/themes/claude',
      toAssetUrl,
    })

    expect(result).toMatch(/body\.typora-theme-scope #outline-content\{\s*color: var\(--text-secondary\);/)
    expect(result).toMatch(/body\.typora-theme-scope #outline-content \.outline-label\{\s*font-size: 14px;/)
    expect(result).not.toContain('.typora-theme-scope .outline-content')
  })

  it('mirrors Typora wrapper-active outline selectors to the active outline item', () => {
    const css = [
      '#outline-content .outline-item-active > .outline-item { margin-left: 4px !important; }',
      '.outline-item-active > .outline-item::before { left: -7px !important; }',
    ].join('\n')

    const result = adaptTyporaCss(css, {
      assetBasePath: '/app/themes/claude',
      toAssetUrl,
    })

    expect(result).toContain('body.typora-theme-scope #outline-content .outline-item-active > .outline-item')
    expect(result).toContain('body.typora-theme-scope #outline-content .outline-item-active{')
    expect(result).toContain('.typora-theme-scope .outline-item-active > .outline-item::before')
    expect(result).toContain('.typora-theme-scope .outline-item-active::before{')
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

    expect(result).toContain('body.typora-theme-scope.mac-os #typora-sidebar{')
    expect(result).toContain('body.typora-theme-scope.mac-seamless-mode #typora-sidebar:hover{')
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

    expect(result).toContain('body.typora-theme-scope.mac-os.active-tab-outline #outline-content{')
    expect(result).toContain('body.typora-theme-scope.mac-seamless-mode.active-tab-outline #outline-content{')
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

  it('ignores Typora selector comments before scoping Claude shell rules', () => {
    const css = [
      '/* Implementation detail */',
      '.no-collapse-outline .outline-content li ul { margin-left: 21px; }',
      '/* Implementation detail */',
      '.mac-os #typora-sidebar, .mac-seamless-mode #typora-sidebar { margin-top: 43px; }',
      '/* Implementation detail */',
      '.ty-on-outline-filter #outline-content .outline-item::before { display: none; }',
    ].join('\n')

    const result = adaptTyporaCss(css, {
      assetBasePath: '/app/themes/claude',
      toAssetUrl,
    })

    expect(result).toContain('body.typora-theme-scope.no-collapse-outline #outline-content li ul{')
    expect(result).toContain('body.typora-theme-scope.mac-os #typora-sidebar')
    expect(result).toContain('body.typora-theme-scope.mac-seamless-mode #typora-sidebar')
    expect(result).toContain('body.typora-theme-scope.ty-on-outline-filter #outline-content .outline-item::before{')
    expect(result).not.toContain('.no-collapse-outline body.typora-theme-scope')
    expect(result).not.toContain('.mac-os body.typora-theme-scope')
    expect(result).not.toContain('.ty-on-outline-filter body.typora-theme-scope')
    expect(result).not.toContain('.typora-theme-scope /* Implementation detail */')
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

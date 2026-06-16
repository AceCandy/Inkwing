import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  adaptTyporaCss,
  extractTyporaShellVariables,
  rewriteCssAssetUrls,
} from './cssAdapter'
import { isTyporaThemeOption } from './types'

const toAssetUrl = (path: string) => `asset://${path}`
const claudeCss = readFileSync(
  new URL('../../../third-theme/claude-typora-theme-v1.0.0/claude.css', import.meta.url),
  'utf8',
)

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
  it('keeps known Typora shell variables under their original names', () => {
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
        '--bg-color': '#faf9f5',
        '--font-color': '#141413',
        '--border-color': '#1f1e1d',
        '--LOGO-color': '#D97757',
      }),
    )
    expect(extractTyporaShellVariables(css)).not.toHaveProperty('--bg-primary')
  })

  it('keeps Typora editor variables used by editor and preview containers', () => {
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
        '--bg-color': '#262624',
        '--hover-color': '#141413',
        '--font-color': '#faf9f5',
        '--sidebar-font-color': '#c2c0b6',
        '--border-color': '#dedcd1',
        '--pre-bg-color': '#ffffff80',
        '--pre-border-color': '#1f1e1d26',
        '--pre-inputfont-color': '#73726c',
        '--code-bg-color': '#c2c0b60d',
        '--code-font-color': '#fe8181',
        '--code-border': '#dedcd126',
        '--LOGO-color': '#D97757',
        '--font-serif': '"Anthropic Serif Web Text", Georgia',
        '--font-mono': '"Anthropic Mono Variable", ui-monospace',
      }),
    )
    expect(extractTyporaShellVariables(css)).not.toHaveProperty('--theme-editor-bg')
  })

  it('extracts the Typora theme root line-height for runtime shell parity', () => {
    const css = `
      html,
      :host {
        line-height: 1.5;
        tab-size: 4;
      }

      body {
        line-height: inherit;
      }

      #write {
        line-height: 1.75;
      }
    `

    expect(extractTyporaShellVariables(css)).toEqual(
      expect.objectContaining({
        '--typora-line-height': '1.5',
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

    expect(result).toContain('body.typora-theme-scope #write h1')
    expect(result).toContain('.typora-theme-scope .preview-content h1')
    expect(result).toContain('body.typora-theme-scope #write h2')
    expect(result).toContain('.typora-theme-scope .preview-content h2')
    expect(result).not.toContain('.typora-theme-scope .milkdown .editor h1')
    expect(result).not.toContain('.typora-theme-scope .milkdown .editor h2')
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
    expect(result).toContain('body.typora-theme-scope #write p')
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

    expect(result).toContain('body.typora-theme-scope #write pre')
    expect(result).toContain('.typora-theme-scope .preview-content pre')
    expect(result).toContain('body.typora-theme-scope #write pre code')
    expect(result).toContain('.typora-theme-scope .preview-content pre code')
    expect(result).toContain('var(--pre-bg-color)')
    expect(result).toContain('var(--pre-border-color)')
    expect(result).toContain('var(--pre-inputfont-color)')
    expect(result).toContain('var(--code-font-color)')
    expect(result).toContain('var(--code-bg-color)')
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

    expect(result).toContain('body.typora-theme-scope #write ul')
    expect(result).toContain('.typora-theme-scope .preview-content ul')
    expect(result).toContain('body.typora-theme-scope #write > ol')
    expect(result).toContain('.typora-theme-scope .preview-content > ol')
    expect(result).toContain('body.typora-theme-scope #write blockquote > p')
    expect(result).toContain('.typora-theme-scope .preview-content blockquote > p')
    expect(result).toContain('body.typora-theme-scope #write hr')
    expect(result).toContain('.typora-theme-scope .preview-content hr')
    expect(result).toContain('var(--hr-color)')
    expect(result).not.toContain('.typora-theme-scope .write ul')
    expect(result).not.toContain('.typora-theme-scope blockquote > p')
  })

  it('does not append project-owned compatibility rules after imported Typora CSS', () => {
    const result = adaptTyporaCss('#write h1 { font-size: 2rem; }', {
      assetBasePath: '/app/themes/claude',
      toAssetUrl,
    })

    expect(result).toContain('body.typora-theme-scope #write h1')
    expect(result).not.toContain('body.typora-theme-scope #typora-sidebar-resizer{left:var(--sidebar-width, 245px);}')
    expect(result).not.toContain('body.typora-theme-scope #typora-sidebar.active-tab-outline #file-library{display:none;}')
    expect(result).not.toContain('body.typora-theme-scope #typora-sidebar.active-tab-files #outline-content{display:none;}')
    expect(result).not.toContain('body.typora-theme-scope #typora-sidebar.active-tab-files #file-library{display:block;}')
    expect(result).not.toContain('body.typora-theme-scope #typora-sidebar #file-library-search{display:none;}')
    expect(result).not.toContain('body.typora-theme-scope #typora-sidebar.active-tab-outline.ty-on-search #file-library-search-result{display:none;}')
    expect(result).not.toContain('body.typora-theme-scope #typora-sidebar.active-tab-outline.ty-on-search #outline-content{height:100%!important;max-height:100%!important;}')
    expect(result).not.toContain('border:0.5px solid')
    expect(result).not.toContain('box-shadow:var(--box-shadow-userinput')
    expect(result).not.toContain('background-image:linear-gradient')
    expect(result).not.toContain('border-radius:15px')
    expect(result).not.toContain('font-family:var(--font-sans)')
    expect(result.trim().endsWith('}')).toBe(true)
  })

  it('does not force a large outline toolbar over Typora theme geometry', () => {
    const result = adaptTyporaCss(
      '.mac-os #typora-sidebar .sidebar-content { top: 24px !important; }',
      {
        assetBasePath: '/app/themes/claude',
        toAssetUrl,
      },
    )

    expect(result).toContain('body.typora-theme-scope.mac-os #typora-sidebar .sidebar-content{ top: 24px !important; }')
    expect(result).not.toContain('--typora-sidebar-toolbar-height:120px;')
    expect(result).not.toContain('width:84px')
    expect(result).not.toContain('font-size:24px')
  })

  it('lets imported Typora #write spacing define the document inset', () => {
    const result = adaptTyporaCss('#write { max-width: 752px; }', {
      assetBasePath: '/app/themes/claude',
      toAssetUrl,
    })

    expect(result).not.toContain('body.typora-theme-scope .milkdown-editor')
    expect(result).not.toContain('body.typora-theme-scope .preview-container')
    expect(result).not.toContain('font-size:var(--typora-font-size, 17px);')
    expect(result).not.toContain('padding:var(--typora-surface-padding, 24px);')
    expect(result).toContain('body.typora-theme-scope #write')
    expect(result).toContain('.typora-theme-scope .preview-content')
  })

  it('does not synthesize local editor list marker resets over Typora content', () => {
    const result = adaptTyporaCss('#write ul:not(.task-list) { list-style-type: disc; }', {
      assetBasePath: '/app/themes/claude',
      toAssetUrl,
    })

    const markerReset = [
      'body.typora-theme-scope #write li::marker',
      '.typora-theme-scope .preview-content li::marker{color:currentColor;font-weight:inherit;}',
    ].join(', ')

    expect(result).not.toContain(markerReset)
    expect(result).not.toContain('li::marker{color:var(--theme-accent')
    expect(result).toContain('body.typora-theme-scope #write ul:not(.task-list)')
    expect(result).toContain('.typora-theme-scope .preview-content ul:not(.task-list)')
  })

  it('does not synthesize theme-specific outline connector rules without theme CSS', () => {
    const result = adaptTyporaCss('', {
      assetBasePath: '/app/themes/claude',
      toAssetUrl,
    })

    expect(result).not.toContain('body.typora-theme-scope #outline-content')
    expect(result).not.toContain('body.typora-theme-scope #outline-content,\nbody.typora-theme-scope #outline-content ul')
    expect(result).not.toContain('outline-item::before')
    expect(result).not.toContain('outline-children::before')
    expect(result).not.toContain('var(--LOGO-color')
  })

  it('does not append outline compatibility overrides after imported outline theme rules', () => {
    const result = adaptTyporaCss([
      '.outline-content li .outline-label { font-family: var(--font-sans); padding: 1px; }',
      '.outline-item > .outline-expander { color: var(--sidebar-font-color); }',
      '.outline-content li .outline-item::before { border-left: 1px solid var(--LOGO-color); }',
    ].join('\n'), {
      assetBasePath: '/app/themes/claude',
      toAssetUrl,
    })

    expect(result.match(/\.outline-content li \.outline-label\{/g)).toHaveLength(1)
    expect(result.match(/\.outline-item > \.outline-expander\{/g)).toHaveLength(1)
    expect(result.match(/\.outline-content li \.outline-item::before\{/g)).toHaveLength(1)
    expect(result).not.toContain('max-width:calc(100% - 12px)')
    expect(result).not.toContain('font-weight:var(--sidebar-font-weight, 430)!important')
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
    expect(result).toContain('body.typora-theme-scope .outline-content li .outline-label{')
    expect(result).toContain('font-family: var(--font-sans);')
    expect(result).toContain('body.typora-theme-scope .outline-content li .outline-item::before{')
    expect(result).toContain('border-left: 1px solid var(--LOGO-color);')
    expect(result).toContain('body.typora-theme-scope .outline-content > li:first-of-type > .outline-item::before{')
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
    expect(result).toMatch(/body\.typora-theme-scope #typora-sidebar input\{\s*color: var\(--sidebar-font-color\);/)
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

    expect(result).toMatch(/body\.typora-theme-scope #outline-content\{\s*color: var\(--sidebar-font-color\);/)
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

  it('keeps Typora sidebar content state selectors matchable in the app shell', () => {
    const css = [
      '.mac-os.active-tab-outline #sidebar-content { bottom: 15px !important; }',
      '.os-windows .ty-show-search #sidebar-content .sidebar-content-content { margin-top: -7px; }',
      '.no-animation .ty-show-outline-filter #file-library-search { transition: none; }',
    ].join('\n')

    const result = adaptTyporaCss(css, {
      assetBasePath: '/app/themes/claude',
      toAssetUrl,
    })

    expect(result).toContain('body.typora-theme-scope.mac-os.active-tab-outline #sidebar-content{')
    expect(result).toContain('body.typora-theme-scope.os-windows #typora-sidebar.ty-show-search #sidebar-content .sidebar-content-content{')
    expect(result).toContain('body.typora-theme-scope.no-animation #typora-sidebar.ty-show-outline-filter #file-library-search{')
    expect(result).not.toContain('.typora-theme-scope .mac-os.active-tab-outline')
    expect(result).not.toContain('.typora-theme-scope .os-windows .ty-show-search')
    expect(result).not.toContain('.typora-theme-scope .no-animation .ty-show-outline-filter')
  })

  it('does not synthesize outline search field geometry over imported themes', () => {
    const css = [
      '#typora-sidebar.ty-on-search #file-library-search { height: 100%; padding-top: 20px; overflow: hidden; }',
      '#typora-sidebar.ty-on-search #file-library-search-panel { position: relative; }',
    ].join('\n')

    const result = adaptTyporaCss(css, {
      assetBasePath: '/app/themes/claude',
      toAssetUrl,
    })

    expect(result).toContain('body.typora-theme-scope #typora-sidebar.ty-on-search #file-library-search{ height: 100%;')
    expect(result).toContain('body.typora-theme-scope #typora-sidebar.ty-on-search #file-library-search-panel{ position: relative; }')
    expect(result).not.toContain('body.typora-theme-scope #typora-sidebar.active-tab-outline.ty-on-search #file-library-search{height:auto;')
    expect(result).not.toContain('height:calc(100% - 28px)!important')
  })

  it('keeps implemented Typora sidebar search selectors so themes style the native search controls', () => {
    const css = [
      '.ty-sidebar-search-panel .searchpanel-search-option-btn { top: 4px; opacity: .5; }',
      '#ty-sidebar-search-tabs .searchpanel-search-option-btn { top: 10px; }',
      '#typora-sidebar.ty-on-search .searchpanel-search-option-btn { display: inline-block; }',
      '.ty-search-item-line span { opacity: .8; }',
      '.ty-file-search-match-text { background-color: rgba(248, 192, 116, .3); }',
      '.ty-tooltip.shown { display: none; }',
    ].join('\n')

    const result = adaptTyporaCss(css, {
      assetBasePath: '/app/themes/claude',
      toAssetUrl,
    })

    expect(result).toContain('.typora-theme-scope .ty-sidebar-search-panel .searchpanel-search-option-btn{')
    expect(result).toContain('.typora-theme-scope #ty-sidebar-search-tabs .searchpanel-search-option-btn{')
    expect(result).toContain('body.typora-theme-scope #typora-sidebar.ty-on-search .searchpanel-search-option-btn{')
    expect(result).not.toContain('.ty-search-item-line')
    expect(result).not.toContain('.ty-file-search-match-text')
    expect(result).not.toContain('.ty-tooltip')
  })

  it('ignores Typora selector comments before scoping Claude shell rules', () => {
    const css = [
      '/* Implementation detail */',
      '.no-collapse-outline .outline-content li ul { margin-left: 21px; }',
      '.no-collapse-outline .outline-children > li:first-child > .outline-item::before { top: -8px; }',
      '/* Implementation detail */',
      '.mac-os #typora-sidebar, .mac-seamless-mode #typora-sidebar { margin-top: 43px; }',
      '/* Implementation detail */',
      '.ty-on-outline-filter #outline-content .outline-item::before { display: none; }',
    ].join('\n')

    const result = adaptTyporaCss(css, {
      assetBasePath: '/app/themes/claude',
      toAssetUrl,
    })

    expect(result).toContain('body.typora-theme-scope.no-collapse-outline .outline-content li ul{')
    expect(result).toContain('body.typora-theme-scope.no-collapse-outline .outline-children > li:first-child > .outline-item::before{')
    expect(result).toContain('body.typora-theme-scope.mac-os #typora-sidebar')
    expect(result).toContain('body.typora-theme-scope.mac-seamless-mode #typora-sidebar')
    expect(result).toContain('body.typora-theme-scope.ty-on-outline-filter #outline-content .outline-item::before{')
    expect(result).not.toContain('body.typora-theme-scope #outline-content li ul')
    expect(result).not.toContain('body.typora-theme-scope #outline-content li .outline-item::before')
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

    expect(result).toContain('body.typora-theme-scope #write mark')
    expect(result).toContain('.typora-theme-scope .preview-content mark')
    expect(result).toContain('body.typora-theme-scope #write u')
    expect(result).toContain('.typora-theme-scope .preview-content u')
    expect(result).not.toContain('span[md-inline="highlight"]')
    expect(result).not.toContain('.md-pair-s mark')
  })

  it('scopes real Claude sidebar shell selectors instead of leaving raw Typora selectors', () => {
    const result = adaptTyporaCss(claudeCss, {
      assetBasePath: '/app/themes/claude',
      toAssetUrl,
    })

    expect(result).toContain('body.typora-theme-scope #typora-sidebar{')
    expect(result).toContain('width: calc(var(--sidebar-width) - 15px) !important;')
    expect(result).toContain('body.typora-theme-scope.mac-os #typora-sidebar')
    expect(result).toContain('margin-top: calc(var(--title-bar-height, 28px) + 15px) !important;')
    expect(result).toContain('body.typora-theme-scope.mac-os #typora-sidebar .sidebar-content')
    expect(result).toContain('top: 24px !important;')
    expect(result).toContain('body.typora-theme-scope.mac-os #typora-sidebar')
    expect(result).toContain('body.typora-theme-scope.mac-seamless-mode #typora-sidebar')
    expect(result).not.toMatch(/(?:^|})\s*(?:\/\*[\s\S]*?\*\/\s*)*#typora-sidebar\s*\{/)
    expect(result).not.toMatch(/(?:^|})\s*(?:\/\*[\s\S]*?\*\/\s*)*\.mac-os\s+#typora-sidebar\b/)
    expect(result).not.toMatch(/(?:^|})\s*(?:\/\*[\s\S]*?\*\/\s*)*\.mac-seamless-mode\s+#typora-sidebar\b/)
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

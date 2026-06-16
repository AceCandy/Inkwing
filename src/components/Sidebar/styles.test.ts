import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync(new URL('./styles.css', import.meta.url), 'utf8')

describe('Sidebar styles', () => {
  it('does not keep project fallback styles outside Typora scope', () => {
    expect(css).not.toContain('body:not(.typora-theme-scope)')
    expect(css).not.toContain('--bg-secondary')
    expect(css).not.toContain('--text-primary')
    expect(css).not.toContain('--text-secondary')
    expect(css).not.toContain('--bg-surface')
    expect(css).not.toContain('--accent')
    expect(css).not.toContain('--border)')
  })

  it('uses Typora cascaded sidebar shell geometry as the base', () => {
    const baseSidebarRule = css.match(/(^|\n)#typora-sidebar \{[^}]+\}/)?.[0] ?? ''
    const sidebarTabsRule = css.match(/\.sidebar-tabs \{[^}]+\}/)?.[0] ?? ''
    const contentRule = css.match(/\.sidebar-content \{[^}]+\}/)?.[0] ?? ''
    const contentItemRule = css.match(/\.sidebar-content-content \{[^}]+\}/)?.[0] ?? ''
    const outlineContentRule = css.match(/#outline-content \{[^}]+\}/)?.[0] ?? ''
    const fileLibraryRule = css.match(/(^|\n)#file-library \{[^}]+\}/)?.[0] ?? ''
    const outlineRule = css.match(/\.outline-content \{[^}]+\}/)?.[0] ?? ''
    const outlineLabelRule =
      css.match(/body\.typora-theme-scope \.outline-label \{[^}]+\}/)?.[0] ?? ''
    const footerRule = css.match(/\.sidebar-footer \{[^}]+\}/)?.[0] ?? ''
    const filesTabContentRule =
      css.match(/\.active-tab-files\.use-file-tree-style \.sidebar-content \{[^}]+\}/)?.[0] ?? ''
    const searchFilesTabContentRule =
      css.match(/\.active-tab-files\.use-file-tree-style\.ty-on-search \.sidebar-content \{[^}]+\}/)?.[0] ?? ''
    const macSeamlessRule =
      css.match(/body\.typora-theme-scope\.mac-seamless-mode #typora-sidebar \{[^}]+\}/)?.[0] ?? ''

    expect(baseSidebarRule).toContain('display: -webkit-flex;')
    expect(baseSidebarRule).toContain('display: flex;')
    expect(baseSidebarRule).toContain('flex-direction: column;')
    expect(baseSidebarRule).toContain('position: absolute;')
    expect(baseSidebarRule).toContain('width: var(--sidebar-width);')
    expect(baseSidebarRule).toContain('height: 100%;')
    expect(baseSidebarRule).toContain('background-color: var(--side-bar-bg-color);')
    expect(baseSidebarRule).toContain('border-right: 1px solid rgba(0, 0, 0, 0.07);')
    expect(baseSidebarRule).not.toContain('width: var(--sidebar-width,')
    expect(sidebarTabsRule).toContain('width: calc(100% - 32px);')
    expect(sidebarTabsRule).toContain('height: 100%;')
    expect(sidebarTabsRule).toContain('align-items: center;')
    expect(sidebarTabsRule).toContain('border-bottom: 1px solid #eee;')
    expect(sidebarTabsRule).toContain('border-bottom: var(--window-border);')
    expect(sidebarTabsRule).toContain('line-height: 40px;')
    expect(contentRule).toContain('display: -webkit-flex;')
    expect(contentRule).toContain('display: flex;')
    expect(contentRule).toContain('flex: 1;')
    expect(contentRule).toContain('position: relative;')
    expect(contentRule).toContain('flex-direction: column;')
    expect(contentRule).toContain('width: 100%;')
    expect(contentRule).not.toContain('position: absolute;')
    expect(contentRule).not.toContain('top: 64px;')
    expect(contentRule).not.toContain('bottom: 0;')
    expect(contentRule).not.toContain('min-height: 0;')
    expect(contentItemRule).toContain('min-width: 100%;')
    expect(contentItemRule).toContain('font-size: 14px;')
    expect(outlineContentRule).toContain('display: block;')
    expect(outlineContentRule).toContain('overflow-x: hidden;')
    expect(outlineContentRule).not.toContain('height: 100%;')
    expect(outlineContentRule).not.toContain('line-height: 1.1rem;')
    expect(fileLibraryRule).toContain('flex: 1;')
    expect(fileLibraryRule).toContain('overflow-y: auto;')
    expect(fileLibraryRule).toContain('overflow-x: hidden;')
    expect(outlineRule).toContain('-webkit-flex: auto;')
    expect(outlineRule).toContain('flex: auto;')
    expect(outlineRule).toContain('overflow-x: hidden;')
    expect(outlineRule).not.toContain('padding:')
    expect(outlineLabelRule).toContain('display: table-cell;')
    expect(outlineLabelRule).toContain('vertical-align: middle;')
    expect(footerRule).toContain('display: none;')
    expect(footerRule).toContain('opacity: 0;')
    expect(footerRule).toContain('height: 30px;')
    expect(footerRule).toContain('font-size: 12px;')
    expect(filesTabContentRule).toContain('bottom: 30px;')
    expect(searchFilesTabContentRule).toContain('bottom: 0;')
    expect(macSeamlessRule).toContain('padding-top: 20px;')
  })

  it('uses Typora base-control empty outline behavior in Typora scope', () => {
    const emptyOutlineRule =
      css.match(/body\.typora-theme-scope #outline-content:empty \{[^}]+\}/)?.[0] ?? ''
    const emptyOutlineAfterRule =
      css.match(/body\.typora-theme-scope #outline-content:empty::after \{[^}]+\}/)?.[0] ?? ''
    const emptyOutlineHoverRule =
      css.match(/body\.typora-theme-scope #typora-sidebar:hover #outline-content:empty::after \{[^}]+\}/)?.[0] ?? ''

    expect(emptyOutlineRule).toContain('padding: 0;')
    expect(emptyOutlineRule).toContain('position: relative;')
    expect(emptyOutlineAfterRule).toContain('content: attr(data-after-content);')
    expect(emptyOutlineAfterRule).toContain('position: absolute;')
    expect(emptyOutlineAfterRule).toContain('top: calc(50vh - 60px);')
    expect(emptyOutlineAfterRule).toContain('opacity: 0;')
    expect(emptyOutlineHoverRule).toContain('animation: fadein 0.5s;')
    expect(emptyOutlineHoverRule).toContain('opacity: 1;')
  })

  it('does not keep Typora search geometry in the component stylesheet', () => {
    expect(css).not.toContain('.sidebar-osx-tab.searching')
    expect(css).not.toContain('.sidebar-osx-tab {\n  position: static;\n  background: inherit;\n}')
    expect(css).not.toContain('#file-library-search-input')
    expect(css).not.toContain('#file-library-search-panel')
    expect(css).not.toContain('#file-library-search-result')
    expect(css).not.toContain('#ty-sidebar-search-tabs')
    expect(css).not.toContain('.ty-sidebar-search-panel .searchpanel-search-option-btn')
    expect(css).not.toContain('padding-right: 64px;')
    expect(css).not.toContain('padding-right: 72px;')
    expect(css).not.toContain('border: 1px solid var(--active-toggle-btn-color);')
    expect(css).not.toContain('flex: none;')
    expect(css).not.toContain('flex: 0 0 auto;')
  })

  it('uses Typora base outline disclosure icons and no-collapse state in Typora scope', () => {
    expect(css).toContain('body.typora-theme-scope .outline-expander::before')
    expect(css).toContain('content: "\\f125";')
    expect(css).toContain('body.typora-theme-scope .outline-item-open > .outline-item > .outline-expander::before')
    expect(css).toContain('content: "\\f123";')
    expect(css).toContain('font-family: Ionicons;')
    expect(css).toContain('body.typora-theme-scope.pin-outline.no-collapse-outline .outline-children')
    expect(css).toContain('body.typora-theme-scope.pin-outline.no-collapse-outline .outline-expander')
    expect(css).not.toContain('font-family: FontAwesome;')
  })

  it('does not synthesize Claude outline connector rules locally', () => {
    expect(css).not.toContain('--outline-connector-color')
    expect(css).not.toContain('.outline-content li .outline-item::before')
    expect(css).not.toContain('.outline-item-open > .outline-children::before')
    expect(css).not.toContain('var(--LOGO-color')
  })
})

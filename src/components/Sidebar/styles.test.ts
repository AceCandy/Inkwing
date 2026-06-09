import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync(new URL('./styles.css', import.meta.url), 'utf8')

describe('Sidebar styles', () => {
  it('does not ship theme-specific outline connector rules by default', () => {
    expect(css).not.toContain('--outline-connector-color')
    expect(css).not.toContain('.outline-content li .outline-item::before')
    expect(css).not.toContain('.outline-item-open > .outline-children::before')
    expect(css).not.toContain('var(--LOGO-color')
  })

  it('uses Typora-like disclosure triangles for collapsible outline items', () => {
    expect(css).toContain('transform: rotate(-45deg);')
    expect(css).toContain('transform: rotate(45deg);')
    expect(css).not.toContain('content: "▾";')
    expect(css).not.toContain('content: "▸";')
  })

  it('keeps local outline disclosure visuals out of Typora theme scope', () => {
    expect(css).toContain('body:not(.typora-theme-scope) .outline-expander::before')
    expect(css).toContain(
      'body:not(.typora-theme-scope) .outline-item-open > .outline-item > .outline-label',
    )
    expect(css).not.toContain('.outline-item-open > .outline-item > .outline-label,\n.outline-item-close')
    expect(css).not.toContain('padding-left: 26px !important;')
    expect(css).not.toMatch(/(^|\n)\.outline-expander::before\s*\{\s*content:\s*none\s*!important;/)
  })

  it('provides Typora base disclosure icons when imported themes only style the expander', () => {
    expect(css).toContain('body.typora-theme-scope .outline-item-close > .outline-item > .outline-expander::before')
    expect(css).toContain('content: "\\f0da";')
    expect(css).toContain('body.typora-theme-scope .outline-item-open > .outline-item > .outline-expander::before')
    expect(css).toContain('content: "\\f0d7";')
    expect(css).toContain('font-family: FontAwesome;')
  })

  it('reveals Typora sidebar header actions on hover or focus', () => {
    const hoverActionRule = css.match(/\.sidebar-hover-action \{[^}]+\}/)?.[0] ?? ''

    expect(css).toContain('.sidebar-hover-action {')
    expect(css).toContain('opacity: 0;')
    expect(hoverActionRule).not.toContain('pointer-events')
    expect(css).toContain('#typora-sidebar:hover .sidebar-hover-action')
    expect(css).toContain('#typora-sidebar:focus-within .sidebar-hover-action')
    expect(css).toContain('.sidebar-osx-tab.searching .sidebar-hover-action')
    expect(css).toContain('opacity: 1;')
  })

  it('keeps default sidebar box geometry out of Typora theme scope', () => {
    const baseSidebarRule = css.match(/(^|\n)#typora-sidebar \{[^}]+\}/)?.[0] ?? ''
    const fallbackSidebarRule =
      css.match(/body:not\(\.typora-theme-scope\) #typora-sidebar \{[^}]+\}/)?.[0] ?? ''

    expect(baseSidebarRule).toContain('display: block;')
    expect(baseSidebarRule).toContain('overflow: hidden;')
    expect(baseSidebarRule).toContain('box-sizing: border-box;')
    expect(baseSidebarRule).not.toContain('width: 100%;')
    expect(baseSidebarRule).not.toContain('height: 100%;')
    expect(baseSidebarRule).not.toContain('background-color:')
    expect(baseSidebarRule).not.toContain('border-right:')
    expect(fallbackSidebarRule).toContain('width: 100%;')
    expect(fallbackSidebarRule).toContain('height: 100%;')
    expect(fallbackSidebarRule).toContain('background-color: var(--bg-secondary);')
    expect(fallbackSidebarRule).toContain('border-right: 1px solid var(--border);')
  })

  it('inherits Typora sidebar tab typography instead of hardcoding a title size', () => {
    const tabsRule = css.match(/\.sidebar-tabs \{[^}]+\}/)?.[0] ?? ''
    const fallbackTabsRule = css.match(/body:not\(\.typora-theme-scope\) \.sidebar-tabs \{[^}]+\}/)?.[0] ?? ''
    const tabRule = css.match(/\.sidebar-tab \{[^}]+\}/)?.[0] ?? ''
    const fallbackTabRule = css.match(/body:not\(\.typora-theme-scope\) \.sidebar-tab \{[^}]+\}/)?.[0] ?? ''
    const buttonRule = css.match(/\.sidebar-tab-btn \{[^}]+\}/)?.[0] ?? ''
    const fallbackButtonRule = css.match(/body:not\(\.typora-theme-scope\) \.sidebar-tab-btn \{[^}]+\}/)?.[0] ?? ''
    const fallbackSearchButtonRule = css.match(/body:not\(\.typora-theme-scope\) #sidebar-search-btn \{[^}]+\}/)?.[0] ?? ''

    expect(css).not.toContain('.sidebar-tab-title')
    expect(tabsRule).toContain('display: flex;')
    expect(tabsRule).not.toContain('font-size: 16px;')
    expect(tabsRule).not.toContain('border-bottom:')
    expect(tabsRule).not.toContain('color: var(--text-secondary);')
    expect(fallbackTabsRule).toContain('border-bottom: 1px solid var(--window-border, var(--border));')
    expect(tabRule).toContain('line-height: 40px;')
    expect(tabRule).not.toContain('text-transform:')
    expect(tabRule).not.toContain('opacity:')
    expect(fallbackTabRule).toContain('text-transform: uppercase;')
    expect(tabRule).not.toContain('font-size:')
    expect(buttonRule).toContain('width: 40px;')
    expect(buttonRule).toContain('line-height: 40px;')
    expect(buttonRule).not.toContain('opacity: 0;')
    expect(buttonRule).not.toContain('color: var(--text-secondary);')
    expect(fallbackButtonRule).toContain('color: var(--text-secondary);')
    expect(fallbackSearchButtonRule).toContain('font-size: 18px;')
    expect(css).not.toContain('font-size: 19px;')
  })

  it('switches visible sidebar content with Typora active tab classes', () => {
    expect(css).toContain('#typora-sidebar.active-tab-outline #outline-content')
    expect(css).toContain('#typora-sidebar.active-tab-files #file-library')
    expect(css).toContain('#typora-sidebar.active-tab-files #outline-content')
    expect(css).toContain('display: none;')
  })

  it('shows the Typora search panel when the sidebar enters search state', () => {
    const outlineContentRule = css.match(/#typora-sidebar\.active-tab-outline\.ty-on-search #outline-content \{[^}]+\}/)?.[0] ?? ''

    expect(css).toContain('#typora-sidebar #file-library-search,')
    expect(css).not.toContain('#typora-sidebar.ty-on-search #file-library-search {')
    expect(css).not.toContain('#typora-sidebar.ty-on-search #file-library-search-panel')
    expect(css).not.toMatch(/#typora-sidebar\.active-tab-outline\.ty-on-search #file-library-search\s*\{/)
    expect(outlineContentRule).toContain('height: 100% !important;')
    expect(outlineContentRule).toContain('max-height: 100% !important;')
  })

  it('keeps the search field visible while leaving it overrideable by Typora themes', () => {
    const searchInputRule = css.match(/#file-library-search-input \{[^}]+\}/)?.[0] ?? ''
    const searchInputFocusRule = css.match(/#file-library-search-input:focus \{[^}]+\}/)?.[0] ?? ''
    const searchPanelRule = css.match(/\.ty-sidebar-search-panel \{[^}]+\}/)?.[0] ?? ''
    const backButtonRule = css.match(/#ty-sidebar-search-back-btn \.ty-left-arrow::before \{[^}]+\}/)?.[0] ?? ''
    const optionButtonRule = css.match(/\.searchpanel-search-option-btn \{[^}]+\}/)?.[0] ?? ''
    const optionIconRule = css.match(/\.searchpanel-search-option-btn \.icon \{[^}]+\}/)?.[0] ?? ''

    expect(searchInputRule).toContain('flex: 1;')
    expect(searchInputRule).toContain('min-width: 0;')
    expect(searchInputRule).toContain('height: 28px;')
    expect(searchInputRule).toContain('border: 1px solid var(--border-color, var(--border));')
    expect(searchInputRule).toContain('background: var(--input-bg-color, var(--bg-color, var(--bg-surface)));')
    expect(searchInputRule).toContain('border-radius: 7px;')
    expect(searchInputRule).toContain('color: var(--sidebar-font-color, var(--text-secondary));')
    expect(searchInputRule).not.toContain('!important')
    expect(searchInputFocusRule).toContain('border-color: var(--primary-color, var(--accent));')
    expect(searchPanelRule).toContain('gap: 6px;')
    expect(searchPanelRule).toContain('padding: 0 8px;')
    expect(backButtonRule).toContain('border-left: 2px solid currentColor;')
    expect(backButtonRule).toContain('transform: rotate(45deg);')
    expect(optionButtonRule).toContain('flex: 0 0 24px;')
    expect(optionButtonRule).toContain('width: 24px;')
    expect(optionButtonRule).not.toContain('!important')
    expect(optionIconRule).toContain('width: 13px;')
    expect(optionIconRule).toContain('height: 13px;')
  })

  it('styles the file tree as a compact Typora sidebar tree', () => {
    const nodeRule = css.match(/\.file-tree-node \{[^}]+\}/)?.[0] ?? ''
    const itemRule = css.match(/\.file-tree-item \{[^}]+\}/)?.[0] ?? ''
    const fallbackItemRule =
      css.match(/body:not\(\.typora-theme-scope\) \.file-node-content,[\s\S]*?body:not\(\.typora-theme-scope\) \.file-tree-item \{[^}]+\}/)?.[0] ?? ''
    const fallbackActiveRule =
      css.match(/body:not\(\.typora-theme-scope\) \.file-tree-node\.active > \.file-tree-item \{[^}]+\}/)?.[0] ?? ''
    const fallbackChildrenRule = css.match(/body:not\(\.typora-theme-scope\) \.file-tree-children \{[^}]+\}/)?.[0] ?? ''
    const closedExpanderRules = Array.from(
      css.matchAll(/\.file-tree-close > \.file-tree-item > \.file-tree-expander::before \{[^}]+\}/g),
      match => match[0],
    )
    const openExpanderRules = Array.from(
      css.matchAll(/\.file-tree-open > \.file-tree-item > \.file-tree-expander::before \{[^}]+\}/g),
      match => match[0],
    )

    expect(nodeRule).toContain('font-size: inherit;')
    expect(nodeRule).not.toContain('color:')
    expect(itemRule).toContain('display: flex;')
    expect(itemRule).not.toContain('border-radius: 4px;')
    expect(itemRule).not.toContain('padding:')
    expect(fallbackItemRule).toContain('border-radius: 4px;')
    expect(fallbackItemRule).toContain('padding: 5px 7px 5px 0;')
    expect(fallbackActiveRule).toContain('background: var(--hover-color, var(--bg-surface));')
    expect(fallbackChildrenRule).toContain('padding-left: 15px;')
    expect(closedExpanderRules.some(rule => rule.includes('transform: rotate(-45deg);'))).toBe(true)
    expect(openExpanderRules.some(rule => rule.includes('transform: rotate(45deg);'))).toBe(true)
    expect(css).toContain('.file-library-node')
    expect(css).toContain('.file-node-content')
    expect(css).toContain('.file-node-icon')
    expect(css).toContain('.file-node-title')
    expect(css).toContain('body:not(.typora-theme-scope) #file-library-tree .file-node-icon .fa-folder::before')
    expect(css).not.toContain('body.typora-theme-scope #file-library-tree .file-node-icon .fa-folder::before')
  })
})

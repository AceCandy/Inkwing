import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { resolveActiveHeadingIndex } from './index'
import { Sidebar } from './index'

vi.mock('../../stores/editorStore', () => ({
  useEditorStore: () => ({
    showSidebar: true,
    content: [
      '# 三层架构 + 热点下钻：设计文档',
      '## 架构总览',
      '## L0：领域级 — 领域模型 & 规则',
      '### 职责',
      '### 举例：电商平台',
      '## L1：功能级 — Index + Graph',
    ].join('\n'),
  }),
}))

vi.mock('../../i18n', () => ({
  useLanguage: () => ({
    t: (key: string) => key,
  }),
}))

describe('Sidebar', () => {
  it('resolves the active outline item from the latest heading above the viewport reference line', () => {
    expect(resolveActiveHeadingIndex([], 120)).toBeNull()
    expect(resolveActiveHeadingIndex([140, 260, 420], 120)).toBe(0)
    expect(resolveActiveHeadingIndex([80, 160, 320], 180)).toBe(1)
    expect(resolveActiveHeadingIndex([80, 160, 320], 360)).toBe(2)
  })

  it('renders Typora-compatible nested outline markup', () => {
    const html = renderToStaticMarkup(<Sidebar />)

    expect(html).toContain('id="toc-dropmenu"')
    expect(html).toContain('id="toc-content"')
    expect(html).toContain(
      'aria-hidden="true" class="stopselect dropmenu sidebar-menu open use-file-tree-style active-tab-outline" id="typora-sidebar" role="menu"',
    )
    expect(html).toContain('class="info-panel-tab-wrapper ty-tab-wrapper"')
    expect(html).toContain('id="info-panel-tab-outline"')
    expect(html).toContain('class="sidebar-osx-tab ty-tab-wrapper"')
    expect(html).not.toContain('class="sidebar-osx-tab ty-tab-wrapper searching"')
    expect(html).toContain('id="sidepanel-segmented-input-files">文件</div>')
    expect(html).toContain('id="sidepanel-segmented-input-outline"')
    expect(html).toContain('id="ty-sidebar-search-tabs"')
    expect(html).toContain('id="filesearch-case-option-btn"')
    expect(html).toContain('id="filesearch-word-option-btn"')
    expect(html).toContain('id="filesearch-regexp-option-btn"')
    expect(html).toContain('id="file-library-search"')
    expect(html).toContain('id="file-library"')
    expect(html).toContain('id="file-library-tree" class="no-selection" data-state=""')
    expect(html).toContain('id="file-info-content"')
    expect(html).toContain('id="ty-sidebar-footer"')
    expect(html).toContain('class="outline-content sidebar-content-content"')
    expect(html).not.toContain('outline-list')
    expect(html).not.toContain('outline-arrow-container')
    expect(html).not.toContain('outline-text')
    expect(html).not.toContain('level-')
    expect(html).toContain('class="outline-label"')
    expect(html).toContain('class="outline-children"')
    expect(html).toContain('id="sidebar-content"')
    expect(html).toContain('class="outline-item-wrapper outline-h2 outline-item-open"')
    expect(html).toContain('class="outline-item-wrapper outline-h3 outline-item-signle outline-item-single"')
    expect(html).toContain('<span class="outline-expander"></span><span class="outline-label"')
    expect(html).toContain('<ul class="outline-children"></ul>')
    expect(html).not.toContain('outline-item-active')
    expect(html).not.toContain('outline-active')
  })
})

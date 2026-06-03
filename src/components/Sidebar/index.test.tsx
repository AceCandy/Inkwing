import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

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
  it('renders Typora-compatible nested outline markup', () => {
    const html = renderToStaticMarkup(<Sidebar />)

    expect(html).toContain('class="outline-list outline-content"')
    expect(html).toContain('class="outline-label outline-text"')
    expect(html).toContain('class="outline-children"')
    expect(html).toContain('id="sidebar-content"')
    expect(html).toContain('class="outline-item-wrapper level-2 outline-item-open"')
    expect(html).toContain('class="outline-item-wrapper level-3 outline-item-single"')
  })
})

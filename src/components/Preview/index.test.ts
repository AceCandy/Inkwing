import { describe, expect, it } from 'vitest'

import { simpleMarkdownToHTML } from './index'

describe('simpleMarkdownToHTML', () => {
  it('keeps fenced code blocks identifiable for Typora theme styles', () => {
    const html = simpleMarkdownToHTML('```yaml\n# L0\nfoo: bar\n```')

    expect(html).toContain('<pre class="md-fences" lang="yaml"><code>')
    expect(html).toContain('# L0')
    expect(html).toContain('foo: bar')
    expect(html).toContain('</code></pre>')
  })

  it('renders common Typora inline syntax used by imported themes', () => {
    const html = simpleMarkdownToHTML([
      '这是~~删除线~~文本',
      '==这是高亮文本==',
      '水的化学式：H~2~O',
      '质能方程：E=mc^2^',
      '今天天气真好 :sunny:',
    ].join('\n\n'))

    expect(html).toContain('<del>删除线</del>')
    expect(html).toContain('<mark>这是高亮文本</mark>')
    expect(html).toContain('H<sub>2</sub>O')
    expect(html).toContain('mc<sup>2</sup>')
    expect(html).toContain('今天天气真好 ☀️')
  })

  it('marks GFM task list items with the Typora task item class', () => {
    const html = simpleMarkdownToHTML('- [x] 已完成\n- [ ] 待处理')

    expect(html).toContain('<li class="md-task-list-item">')
    expect(html).toContain('<input checked="" disabled="" type="checkbox">')
    expect(html).toContain('<input disabled="" type="checkbox">')
  })

  it('wraps markdown tables with the Typora table figure classes', () => {
    const html = simpleMarkdownToHTML([
      '| 字段 | 说明 |',
      '| --- | --- |',
      '| id | 标识 |',
    ].join('\n'))

    expect(html).toContain('<figure class="md-table-fig table-figure">')
    expect(html).toContain('<table>')
    expect(html).toContain('<th>字段</th>')
    expect(html).toContain('</table>')
    expect(html).toContain('</figure>')
  })
})

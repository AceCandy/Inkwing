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
})

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
})

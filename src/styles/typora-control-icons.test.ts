import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync(new URL('./typora-control-icons.css', import.meta.url), 'utf8')

describe('Typora control icon styles', () => {
  it('loads Typora control icon fonts and native sidebar glyph classes', () => {
    expect(css).toContain("font-family: 'typora-icon';")
    expect(css).toContain("url('/typora-control/typora-icon/fonts/typora-icon.woff')")
    expect(css).toContain("font-family: 'Ionicons';")
    expect(css).toContain("url('/typora-control/ionicons-2.0.1/fonts/ionicons.woff')")
    expect(css).toContain('.ty-three-cells::before')
    expect(css).toContain('content: "\\e900";')
    expect(css).toContain('.ty-file-tree::before')
    expect(css).toContain('content: "\\e904";')
    expect(css).toContain('.ty-left-arrow::before')
    expect(css).toContain('content: "\\e920";')
    expect(css).toContain('.ion-ios7-search-strong::before')
    expect(css).toContain('content: "\\f1d9";')
  })
})

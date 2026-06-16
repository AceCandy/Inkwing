import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync(new URL('./katex-theme.css', import.meta.url), 'utf8')

describe('KaTeX theme CSS', () => {
  it('uses Typora variables instead of project theme tokens', () => {
    expect(css).not.toContain('--theme-')
    expect(css).not.toContain('Catppuccin')
    expect(css).not.toContain('#181825')
    expect(css).not.toContain('#89b4fa')
    expect(css).toContain('background-color: var(--code-bg-color);')
    expect(css).toContain('background-color: var(--pre-bg-color);')
    expect(css).toContain('color: var(--font-color);')
    expect(css).toContain('color: var(--LOGO-color);')
  })
})

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
})

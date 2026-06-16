import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync(new URL('./global.css', import.meta.url), 'utf8')

describe('global CSS reset', () => {
  it('matches Typora base box sizing for elements and pseudo-elements', () => {
    expect(css).toMatch(/\*,\s*\n\*::before,\s*\n\*::after \{[\s\S]*box-sizing: border-box;/)
  })

  it('does not define project theme fallback tokens', () => {
    expect(css).not.toContain('--bg-primary')
    expect(css).not.toContain('--bg-secondary')
    expect(css).not.toContain('--bg-surface')
    expect(css).not.toContain('--text-primary')
    expect(css).not.toContain('--text-secondary')
    expect(css).not.toContain('--accent')
  })

  it('uses Typora theme variables for global chrome colors', () => {
    expect(css).toMatch(/body\s*\{[\s\S]*background-color: var\(--bg-color\);/)
    expect(css).toMatch(/body\s*\{[\s\S]*color: var\(--text-color\);/)
    expect(css).toContain('background-color: var(--select-text-bg-color);')
    expect(css).toContain('outline: 2px solid var(--focus-ring-color);')
  })
})

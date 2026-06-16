import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync(new URL('./styles.css', import.meta.url), 'utf8')

describe('Editor styles', () => {
  it('does not keep non-Typora project theme fallbacks in the editor runtime CSS', () => {
    expect(css).not.toContain('body:not(.typora-theme-scope)')
    expect(css).not.toContain('--theme-')
  })

  it('keeps the Typora write root on the base/control skeleton', () => {
    const hostRule =
      css.match(/body\.typora-theme-scope \.typora-write-host,[\s\S]*?body\.typora-theme-scope \.typora-write-host \.milkdown \{[^}]+\}/)?.[0] ?? ''
    const writeRule = css.match(/body\.typora-theme-scope #write \{[^}]+\}/)?.[0] ?? ''
    const typoraNodeWriteRule =
      css.match(/body\.typora-theme-scope\.typora-node #write \{[^}]+\}/)?.[0] ?? ''
    const writeAfterRule = css.match(/body\.typora-theme-scope #write::after \{[^}]+\}/)?.[0] ?? ''

    expect(hostRule).toContain('width: 100%;')
    expect(hostRule).toContain('min-height: 100%;')
    expect(hostRule).toContain('height: 100%;')
    expect(hostRule).toContain('background-color: inherit;')
    expect(writeRule).toContain('position: relative;')
    expect(writeRule).toContain('min-height: 100%;')
    expect(writeRule).toContain('top: 0;')
    expect(writeRule).toContain('margin: 0 auto;')
    expect(writeRule).toContain('height: auto;')
    expect(writeRule).toContain('width: inherit;')
    expect(writeRule).toContain('word-break: normal;')
    expect(writeRule).toContain('word-wrap: break-word;')
    expect(writeRule).toContain('white-space: normal;')
    expect(writeRule).toContain('overflow-x: visible;')
    expect(writeRule).toContain('-webkit-user-drag: none;')
    expect(writeRule).toContain('padding-bottom: 70px;')
    expect(writeRule).toContain('transition: .4s padding-top ease-out;')
    expect(typoraNodeWriteRule).toContain('min-height: 100%;')
    expect(typoraNodeWriteRule).toContain('top: 0;')
    expect(writeAfterRule).toContain('content: "";')
    expect(writeAfterRule).toContain('font-size: 0;')
    expect(writeAfterRule).toContain('display: block;')
    expect(writeAfterRule).toContain('height: 0;')
  })

  it('uses Typora base positioning and wrapping for write block nodes', () => {
    expect(css).toContain('body.typora-theme-scope #write h1,')
    expect(css).toContain('body.typora-theme-scope #write h6,')
    expect(css).toContain('body.typora-theme-scope #write p,')
    expect(css).toContain('body.typora-theme-scope #write pre {')
    expect(css).toContain('width: inherit;')
    expect(css).toContain('position: relative;')
    expect(css).toContain('body.typora-theme-scope #write h5 {')
    expect(css).toContain('white-space: pre-wrap;')
  })
})

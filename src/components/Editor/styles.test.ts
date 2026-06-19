import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync(new URL('./styles.css', import.meta.url), 'utf8')

describe('Editor styles', () => {
  it('does not keep non-Typora project theme fallbacks in the editor runtime CSS', () => {
    expect(css).not.toContain('body:not(.typora-theme-scope)')
    expect(css).not.toContain('--theme-')
  })

  it('lets Typora base + theme own the #write box model (no host overrides)', () => {
    // 关键回归守护：Editor/styles.css 不再给 #write 套 width/padding/transition/margin 等
    // 盒模型属性——这些必须由 Typora base.css 的 #write{width:inherit;margin:0 auto;
    // padding-top:36px} 与主题（如 claude.css 的 #write{width:100%;max-width:752px;
    // padding:2.25rem 1rem 4.375rem 1rem}）经 adaptTyporaCss 注入决定。
    // 项目自造覆盖会与主题层叠冲突，导致正文居中盒模型与 Typora 不一致。
    const writeRule = css.match(/body\.typora-theme-scope #write \{[^}]+\}/)?.[0] ?? ''
    expect(writeRule).toBe('')
    expect(css).not.toContain('padding-bottom: 70px;')
    expect(css).not.toContain('transition: .4s padding-top ease-out;')
    expect(css).not.toMatch(/body\.typora-theme-scope\.typora-node #write \{/)
    // 不再为 block 节点手写 width:inherit——base.css 已有，重复写只是覆盖源不清晰。
    expect(css).not.toContain('body.typora-theme-scope #write h1,')
    expect(css).not.toContain('body.typora-theme-scope #write pre {')
  })

  it('keeps the write host stretched over the content area', () => {
    const hostRule =
      css.match(/body\.typora-theme-scope \.typora-write-host,[\s\S]*?body\.typora-theme-scope \.typora-write-host \.milkdown \{[^}]+\}/)?.[0] ?? ''
    expect(hostRule).toContain('width: 100%;')
    expect(hostRule).toContain('min-height: 100%;')
    expect(hostRule).toContain('background-color: inherit;')

    const writeAfterRule = css.match(/body\.typora-theme-scope #write::after \{[^}]+\}/)?.[0] ?? ''
    expect(writeAfterRule).toContain('content: "";')
    expect(writeAfterRule).toContain('display: block;')
  })
})

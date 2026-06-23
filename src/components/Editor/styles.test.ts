import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync(new URL('./styles.css', import.meta.url), 'utf8')

describe('Editor styles', () => {
  it('does not keep the abandoned typora-theme-scope adapter selectors', () => {
    // cssAdapter.ts 已删除，body 上不再有 .typora-theme-scope 类。
    // 任何残留的 body.typora-theme-scope 前缀规则都是死代码，不会生效。
    expect(css).not.toContain('typora-theme-scope')
    expect(css).not.toContain('--theme-')
  })

  it('lets Typora base + theme own the #write box model (no host overrides)', () => {
    // 关键回归守护：Editor/styles.css 不再给 #write 套 width/padding/transition/margin 等
    // 盒模型属性——这些必须由 Typora base.css 的 #write{width:inherit;margin:0 auto;
    // padding-top:36px} 与主题（如 claude.css 的 #write{width:100%;max-width:752px;
    // padding:2.25rem 1rem 4.375rem 1rem}）注入决定。
    // 项目自造覆盖会与主题层叠冲突，导致正文居中盒模型与 Typora 不一致。
    expect(css).not.toContain('padding-bottom: 70px;')
    expect(css).not.toContain('transition: .4s padding-top ease-out;')
    // 不再为 block 节点手写 width:inherit——base.css 已有，重复写只是覆盖源不清晰。
    expect(css).not.toMatch(/#write h1,/)
    expect(css).not.toMatch(/#write pre \{/)
  })

  it('keeps the write host stretched over the content area', () => {
    // Typora window.css 里 <content> 是 position:absolute（用 top/bottom 撑高），
    // 百分比高度链需逐层显式 height:100% 才能传到 #write，否则编辑器会塌成内容高度。
    // Milkdown React 包装会插入无类名的中间 div，故用后代通配覆盖整条链。
    const hostRule =
      css.match(/\.typora-write-host,[\s\S]*?\.typora-write-host \.editor \{[^}]+\}/)?.[0] ?? ''
    expect(hostRule).toContain('width: 100%;')
    expect(hostRule).toContain('height: 100%;')
    expect(hostRule).toContain('background-color: inherit;')

    const writeAfterRule = css.match(/#write::after \{[^}]+\}/)?.[0] ?? ''
    expect(writeAfterRule).toContain('content: "";')
    expect(writeAfterRule).toContain('display: block;')
  })
})

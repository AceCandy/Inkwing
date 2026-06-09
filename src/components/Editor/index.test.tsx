// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest'

import { syncTyporaWriteRoot } from './index'

describe('syncTyporaWriteRoot', () => {
  it('marks the Milkdown editor root with Typora write identifiers', () => {
    const host = document.createElement('div')
    host.innerHTML = '<div class="milkdown"><div class="editor"></div></div>'

    syncTyporaWriteRoot(host)

    const editor = host.querySelector('.editor')
    expect(editor?.id).toBe('write')
    expect(editor?.classList.contains('write')).toBe(true)
  })
})

import { describe, expect, it } from 'vitest'

import { findEmojiShortcodes, replaceEmojiShortcodes } from './typoraDecorations'

describe('typoraDecorations', () => {
  it('finds emoji shortcodes without changing markdown content', () => {
    const matches = findEmojiShortcodes('今天天气真好 :sunny:，一起学习 :books:，加油 :rocket:')

    expect(matches).toEqual([
      { from: 7, to: 14, emoji: '☀️' },
      { from: 20, to: 27, emoji: '📚' },
      { from: 31, to: 39, emoji: '🚀' },
    ])
  })

  it('can replace shortcodes for preview rendering', () => {
    expect(replaceEmojiShortcodes('今天 :sunny: 学习 :books:')).toBe('今天 ☀️ 学习 📚')
  })
})

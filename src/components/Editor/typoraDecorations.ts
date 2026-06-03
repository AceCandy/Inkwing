import type { Node as ProseNode } from '@milkdown/prose/model'

import { Plugin, PluginKey } from '@milkdown/prose/state'
import { Decoration, DecorationSet } from '@milkdown/prose/view'
import { $prose } from '@milkdown/utils'

export const EMOJI_SHORTCODES: Record<string, string> = {
  sunny: '☀️',
  books: '📚',
  rocket: '🚀',
}

export interface EmojiShortcodeMatch {
  from: number
  to: number
  emoji: string
}

export function findEmojiShortcodes(text: string): EmojiShortcodeMatch[] {
  const matches: EmojiShortcodeMatch[] = []
  const pattern = /:([a-zA-Z0-9_+-]+):/g
  let match: RegExpExecArray | null

  while ((match = pattern.exec(text))) {
    const emoji = EMOJI_SHORTCODES[match[1]]
    if (!emoji) {
      continue
    }

    matches.push({
      from: match.index,
      to: match.index + match[0].length,
      emoji,
    })
  }

  return matches
}

export function replaceEmojiShortcodes(text: string): string {
  return text.replace(/:([a-zA-Z0-9_+-]+):/g, (source, name) => EMOJI_SHORTCODES[name] ?? source)
}

function createEmojiNode(emoji: string): HTMLElement {
  const node = document.createElement('span')
  node.className = 'typora-emoji-shortcode'
  node.textContent = emoji
  return node
}

function buildEmojiDecorations(doc: ProseNode): DecorationSet {
  const decorations: Decoration[] = []

  doc.descendants((node, pos, parent) => {
    if (!node.isText || !node.text || parent?.type.name === 'code_block') {
      return
    }

    findEmojiShortcodes(node.text).forEach((match) => {
      const from = pos + match.from
      const to = pos + match.to

      decorations.push(Decoration.widget(from, () => createEmojiNode(match.emoji), { side: -1 }))
      decorations.push(Decoration.inline(from, to, { class: 'typora-emoji-shortcode-source' }))
    })
  })

  return DecorationSet.create(doc, decorations)
}

export const typoraEmojiDecorationPlugin = $prose(() =>
  new Plugin({
    key: new PluginKey('INKWING_TYPORA_EMOJI_DECORATION'),
    state: {
      init: (_, state) => buildEmojiDecorations(state.doc),
      apply: (transaction, decorationSet) => {
        if (!transaction.docChanged) {
          return decorationSet.map(transaction.mapping, transaction.doc)
        }

        return buildEmojiDecorations(transaction.doc)
      },
    },
    props: {
      decorations(this: Plugin, state) {
        return this.getState(state)
      },
    },
  }),
)

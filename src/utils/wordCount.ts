// 字数统计：逐字复刻 Typora main.js 的口径，不自己编算法。
//   - 字数：CJK 逐字（\u3040-\uABFF、\uD7A4-\uFAFF 范围每个字符算一词）+ 剩余文本按
//     标点/空白拆词，撇号连字（'s 'll 're）按一词。对应 main.js 的 s=function(e){...}。
//   - 字符数：getMarkdown().length（原始 markdown 长度，不 trim）。
//   - 行数：getMarkdown().split(/\n/g).length。
//   - 阅读时间：Math.round(wordCount / File.option.wordsPerMinute)，默认 wordsPerMinute=382。
//
// 统一出口：macOS titlebar 字数和 Windows footer 字数都引用此处，避免多处各算一份
// （之前 TyporaShell 的 #file-info-content 用了 300wpm + trim 的不同口径，现统一为 Typora 原生的 382）。

export const TYPORA_WORDS_PER_MINUTE = 382

export interface TyporaWordCount {
  words: number
  characters: number
  lines: number
  minutes: number
}

export function countTyporaWords(markdown: string): TyporaWordCount {
  const text = typeof markdown === 'string' ? markdown : ''
  // === 字数（CJK 逐字 + 标点拆词），逐字取自 main.js 的 s= 函数 ===
  let cjkCount = 0
  const withoutCjk = text.replace(/[\u3040-\uABFF\uD7A4-\uFAFF]/gi, () => {
    cjkCount += 1
    return ' '
  })
  // 撇号连字（'s 'll 're 've 'd 'm）视为一词
  const withoutApostrophes = withoutCjk.replace(/['’]\w+/g, 'b')
  // 行首/空白后的标点（含全角符号 \u3000-\u303F、半角 !-/ :-@ [-` {-~）当分隔
  const dePunctuated = withoutApostrophes.replace(/(^|\s+)[(\u3000-\u303F)!-/:-@[-`{-~]+(\s+|$)/gm, ' ')
  const tokens = ['d', dePunctuated, 'd'].join(' ').split(/[(\u3000-\u303F)\s!-,\\:-@[-`{-~]+/g)
  const words = cjkCount + tokens.length - 2

  // === 字符数：原始 markdown 长度（main.js updateCharCount: e.length）===
  const characters = text.length
  // === 行数：按 \n 拆（main.js updateLineCount: split(/\n/g).length）===
  const lines = text.split(/\n/g).length
  // === 阅读时间（main.js updateReadTime: Math.round(words / wordsPerMinute)）===
  const minutes = Math.round(words / TYPORA_WORDS_PER_MINUTE)

  return { words, characters, lines, minutes }
}

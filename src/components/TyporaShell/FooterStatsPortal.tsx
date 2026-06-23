import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useEditorStore } from '../../stores/editorStore'
import { countTyporaWords } from '../../utils/wordCount'
import { t } from '../../i18n'

// Windows 底部 footer 字数统计 portal。
// 骨架（footer.ty-footer / #footer-word-count / #footer-word-count-info）由
// skeletonHtml.ts 注入，window.css 提供全部样式；本组件只负责：
//  1. 把 countTyporaWords 的结果写进骨架的 label / 表格单元格（含 i18n 本地化文案）；
//  2. 展开状态用 React state 管理（不直接 toggle body class），展开/关闭的 body class
//     同步放在独立 effect，与点击交互 effect 解耦；
//  3. 点击 #footer-word-count 切换展开；点击面板外部 / 按 ESC 关闭（贴近 Typora 行为）。
//     点击交互 effect 只绑定一次（不依赖 expanded），用 ref 读最新展开值，避免
//     expanded 变化导致 effect 反复 cleanup/rebind 引发的 toggle 失效时序问题；
//  4. 点击 #outline-btn 切换 sidebar。
// footer 本身只在 Windows 显示（mountSkeleton 给 body 加 .show-footer），macOS 隐藏。
export const FooterStatsPortal: React.FC = () => {
  const content = useEditorStore((s) => s.content)
  const toggleSidebar = useEditorStore((s) => s.toggleSidebar)
  const lang = typeof localStorage !== 'undefined' ? localStorage.getItem('app-language') || 'zh' : 'zh'

  const wordCount = countTyporaWords(content)
  const [expanded, setExpanded] = useState(false)
  // ref 镜像 expanded，供点击交互回调读取最新值（不触发重绑）。
  const expandedRef = useRef(false)
  expandedRef.current = expanded

  const [targets, setTargets] = useState<{
    label: HTMLElement | null
    wordTd: HTMLElement | null
    charTd: HTMLElement | null
    lineTd: HTMLElement | null
    readTd: HTMLElement | null
    wordLabelTd: HTMLElement | null
    charLabelTd: HTMLElement | null
    lineLabelTd: HTMLElement | null
    readLabelTd: HTMLElement | null
    spellCheckLabel: HTMLElement | null
    wordCountBtn: HTMLElement | null
    outlineBtn: HTMLElement | null
    infoPanel: HTMLElement | null
  } | null>(null)

  // 解析骨架节点作为 portal 目标。
  // 骨架 HTML 里这些节点带 Typora 原生的初始文本（"0 Words"、"0" 等），createPortal
  // 会把内容作为子节点追加进去，与初始文本共存导致重复。这里首次解析时清空它们的文本，
  // 让 portal 内容成为唯一来源。
  useEffect(() => {
    let raf = requestAnimationFrame(() => {
      const clearText = (el: HTMLElement | null) => {
        if (el) el.textContent = ''
      }
      const label = document.getElementById('footer-word-count-label')
      const wordTd = document.getElementById('footer-word-count-td')
      const charTd = document.getElementById('footer-char-count-td')
      const lineTd = document.getElementById('footer-line-count-td')
      const readTd = document.getElementById('footer-read-time-td')
      const wordLabelTd = document.getElementById('footer-word-count-label-cn')
      const charLabelTd = document.getElementById('footer-char-count-label-cn')
      const lineLabelTd = document.getElementById('footer-line-count-label-cn')
      const readLabelTd = document.getElementById('footer-read-time-label-cn')
      const spellCheckLabel = document.querySelector('#footer-spell-check .footer-spell-check-label')
      for (const el of [label, wordTd, charTd, lineTd, readTd, wordLabelTd, charLabelTd, lineLabelTd, readLabelTd, spellCheckLabel as HTMLElement | null]) {
        clearText(el)
      }

      // Typora 原生 .dropdown-menu 的 position 由 main.js / 其它 CSS 提供（Typora app 里是
      // absolute），但本项目注入的 base-control.css / window.css 里 .dropdown-menu 和
      // #footer-word-count-info 都没显式 position——导致面板 position:static，其 bottom:32px
      // 定位失效，面板留在文档流里覆盖 footer（实测点击后底栏被盖住「消失」）。
      // 这里给面板补 position:absolute，让它相对 position:fixed 的 footer 向上弹出。
      const infoPanel = document.getElementById('footer-word-count-info')
      if (infoPanel) {
        infoPanel.style.position = 'absolute'
      }

      setTargets({
        label,
        wordTd,
        charTd,
        lineTd,
        readTd,
        wordLabelTd,
        charLabelTd,
        lineLabelTd,
        readLabelTd,
        spellCheckLabel: spellCheckLabel as HTMLElement | null,
        wordCountBtn: document.getElementById('footer-word-count'),
        outlineBtn: document.getElementById('outline-btn'),
        infoPanel,
      })
    })
    return () => cancelAnimationFrame(raf)
  }, [])

  // 展开状态 → body class（Typora window.css 用 .ty-show-word-count 控制面板显示）。
  // 独立 effect，只依赖 expanded，与点击交互 effect 解耦。
  useEffect(() => {
    document.body.classList.toggle('ty-show-word-count', expanded)
  }, [expanded])

  // 点击交互（绑定到骨架节点）。只依赖 targets（骨架就绪后绑定一次），不依赖 expanded，
  // 用 expandedRef 读最新展开值——避免 expanded 变化触发 cleanup/rebind 造成的时序问题。
  useEffect(() => {
    const btn = targets?.wordCountBtn
    const outline = targets?.outlineBtn
    const info = targets?.infoPanel
    if (!btn || !outline) return

    // 字数按钮：toggle 展开/关闭。stopPropagation 防止冒泡触发 document 的关闭逻辑。
    const onWordCountClick = (e: Event) => {
      e.stopPropagation()
      setExpanded((v) => !v)
    }
    const onOutlineClick = () => {
      toggleSidebar()
    }
    // 点击面板自身：展开时关闭（对齐 Typora——点面板内任意位置收起）。
    const onInfoClick = (e: Event) => {
      e.stopPropagation()
      if (expandedRef.current) setExpanded(false)
    }
    // 点击面板/按钮以外的区域：关闭。
    const onDocumentClick = (e: MouseEvent) => {
      if (!expandedRef.current) return
      const target = e.target as Node
      if (info && !info.contains(target) && !btn.contains(target)) {
        setExpanded(false)
      }
    }
    // ESC 关闭。
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && expandedRef.current) setExpanded(false)
    }

    btn.addEventListener('click', onWordCountClick)
    outline.addEventListener('click', onOutlineClick)
    if (info) info.addEventListener('click', onInfoClick)
    document.addEventListener('click', onDocumentClick)
    document.addEventListener('keydown', onKeyDown)

    return () => {
      btn.removeEventListener('click', onWordCountClick)
      outline.removeEventListener('click', onOutlineClick)
      if (info) info.removeEventListener('click', onInfoClick)
      document.removeEventListener('click', onDocumentClick)
      document.removeEventListener('keydown', onKeyDown)
      document.body.classList.remove('ty-show-word-count')
    }
  }, [targets, toggleSidebar])

  if (!targets?.label) return null

  // 中文用「N 字」，英文用「N Words」。
  const unit = lang === 'zh' ? '字' : 'Words'

  return (
    <>
      {createPortal(`${wordCount.words} ${unit}`, targets.label)}
      {targets.wordTd && createPortal(String(wordCount.words), targets.wordTd)}
      {targets.charTd && createPortal(String(wordCount.characters), targets.charTd)}
      {targets.lineTd && createPortal(String(wordCount.lines), targets.lineTd)}
      {targets.readTd && createPortal(String(wordCount.minutes), targets.readTd)}
      {targets.wordLabelTd && createPortal(t('footer.words'), targets.wordLabelTd)}
      {targets.charLabelTd && createPortal(t('footer.characters'), targets.charLabelTd)}
      {targets.lineLabelTd && createPortal(t('footer.lines'), targets.lineLabelTd)}
      {targets.readLabelTd && createPortal(t('footer.readTime'), targets.readLabelTd)}
      {targets.spellCheckLabel && createPortal(t('footer.spellCheck'), targets.spellCheckLabel)}
    </>
  )
}

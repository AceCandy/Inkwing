// @vitest-environment happy-dom
//
// 主题选择器命中审计：渲染真实 Sidebar DOM（含 outline + 文件树 + 搜索态），
// 逐个检查第三方主题 CSS（claude.css）的 sidebar/outline 选择器能否命中。
// 目的：用程序扫出"CSS 规则在、但 DOM 结构不匹配"的盲区，避免再出现
// 「嘴上说 100%、实际 outline 多套了一层 ul 导致主题样式失效」这类问题。
//
// 本测试不是回归测试（不阻塞 CI），而是审计报告：输出未命中选择器清单，
// 供人工判断哪些是真实缺失（需修 DOM）、哪些是 Typora 私有态（可忽略）。

import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import React from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react-dom/test-utils'

import * as AppModule from '../../App'
import { mountTyporaSkeleton, unmountTyporaSkeleton } from '../../components/TyporaShell/mountSkeleton'

vi.mock('@tauri-apps/api/core', () => ({
  // mock 文件树数据，让 #file-library-tree 渲染出真实 file-node 节点。
  // Sidebar 期望 list_file_tree 返回单个根节点对象（非数组）。
  invoke: vi.fn(async (cmd: string) => {
    if (cmd === 'list_file_tree') {
      return {
        name: 'demo',
        path: '/demo',
        is_dir: true,
        children: [
          { name: 'hello.md', path: '/demo/hello.md', is_dir: false, children: [] },
          { name: 'world.md', path: '/demo/world.md', is_dir: false, children: [] },
          { name: 'sub', path: '/demo/sub', is_dir: true, children: [
            { name: 'note.md', path: '/demo/sub/note.md', is_dir: false, children: [] },
          ]},
        ],
      }
    }
    return null
  }),
  convertFileSrc: vi.fn((path: string) => `asset://${path}`),
  isTauri: vi.fn(() => false),
}))
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }))
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn() }))
vi.mock('../../components/Editor', () => ({
  // 渲染含 #write.write 的真实编辑器壳，让主题 #write 后代选择器
  // （#write p / #write table / #write .md-alert 等）能在审计里命中。
  // Editor/index.tsx 的 syncTyporaWriteRoot 在运行时把 milkdown .editor 改写成
  // id="write" class="write"，这里直接给出最终形态，跳过 milkdown 初始化。
  MilkdownEditor: () => (
    <div className="milkdown-editor">
      <div className="typora-write-host">
        <div className="milkdown">
          <div className="editor write" id="write">
            <h1>标题一</h1>
            <h2>标题二</h2>
            <h3>标题三</h3>
            <h4>标题四</h4>
            <h5>标题五</h5>
            <h6>标题六</h6>
            <p>正文段落 <strong>加粗</strong></p>
            <ul>
              <li><p>无序列表项</p>
                <ul><li><p>嵌套无序</p></li></ul>
              </li>
            </ul>
            <ol>
              <li><p>有序列表项</p>
                <ol><li><p>嵌套有序</p></li></ol>
              </li>
            </ol>
            <table>
              <thead><tr><th>表头</th></tr></thead>
              <tbody><tr><td>单元格</td></tr></tbody>
            </table>
            <pre className="md-fences"><code>code</code></pre>
          </div>
        </div>
      </div>
    </div>
  ),
}))
vi.mock('../../components/SettingsModal', () => ({
  SettingsModal: () => <div className="settings-modal" />,
}))
vi.mock('../../hooks/useKeyboardShortcuts', () => ({ useKeyboardShortcuts: vi.fn() }))
vi.mock('../../hooks/useAutoSave', () => ({ useAutoSave: vi.fn() }))
vi.mock('../../hooks/useAppLogo', () => ({ useAppLogo: () => 'logo.png' }))
vi.mock('../', () => ({
  applyThemeOption: vi.fn(),
  getThemeOption: vi.fn(() => ({
    type: 'typora',
    id: 'typora:claude-typora-theme-v1-0-0:claude',
    packageId: 'claude-typora-theme-v1-0-0',
    packageName: 'Claude',
    name: 'Claude',
    cssFile: 'claude.css',
    basePath: '/themes/claude-typora-theme-v1-0-0',
  })),
  refreshExternalThemes: vi.fn(),
}))
vi.mock('../../i18n', () => ({ useLanguage: () => ({ t: (k: string) => k }), t: (k: string) => k }))
vi.mock('../../stores/editorStore', () => ({
  useEditorStore: () => ({
    filePath: '/demo/hello.md',
    fileName: 'hello.md',
    content: ['# 标题一', '## 标题二', '### 标题三', '正文'].join('\n'),
    isModified: false,
    mode: 'wysiwyg',
    showSettings: false,
    showSidebar: true,
    currentTheme: 'typora:claude-typora-theme-v1-0-0:claude',
    newFile: vi.fn(),
    openFile: vi.fn(),
    setShowSettings: vi.fn(),
    setThemeError: vi.fn(),
  }),
}))

// 从 CSS 文件提取选择器（去掉 @规则、注释，按逗号拆分）。
function extractSelectors(cssPath: string): string[] {
  const raw = readFileSync(cssPath, 'utf8')
  const noComments = raw.replace(/\/\*[\s\S]*?\*\//g, '')
  // 只取顶层规则块的选择器部分（不含 @media 内嵌套，简化处理：把 @media/@supports 整体跳过）
  const rules = noComments.match(/([^{}]+)\{[^{}]*\}/g) || []
  const selectors: string[] = []
  for (const rule of rules) {
    const selPart = rule.slice(0, rule.indexOf('{'))
    for (let s of selPart.split(',')) {
      s = s.trim().replace(/\s+/g, ' ')
      // 跳过 @keyframes 帧名、@media 条件、纯伪元素无宿主等
      if (!s || s.startsWith('@')) continue
      selectors.push(s)
    }
  }
  return selectors
}

// 只关注 sidebar/outline 相关选择器（过滤掉编辑器正文 #write 等）。
const SIDEBAR_KEYWORDS = [
  'outline', 'sidebar', 'file-library', 'file-tree', 'file-node', 'file-list',
  'file-info', 'filesearch', 'searchpanel', 'info-panel', 'toc-content',
  'toc-dropmenu', 'ty-sidebar', 'ty-search', 'ty-file', 'pin-outline',
  'switch-sidebar', 'switch-file-list', 'sidepanel-segmented', 'sidebar-footer',
  'sidebar-loading', 'sidebar-tabs', 'sidebar-osx', 'sidebar-hover',
  'typora-sidebar', 'close-outline', 'ty-outline',
]

function isSidebarSelector(sel: string): boolean {
  const lower = sel.toLowerCase()
  return SIDEBAR_KEYWORDS.some((kw) => lower.includes(kw))
}

// 顶部工具栏 / 底部状态栏 / 正文 #write 相关选择器。这是上一轮审计的结构性盲区：
// 当时 SIDEBAR_KEYWORDS 不含这些，导致 #top-titlebar / footer.ty-footer /
// #footer-word-count 等"骨架缺失"完全没进审计范围。现在单独建一组覆盖正文/窗口区。
const CHROME_KEYWORDS = [
  'top-titlebar', 'title-text', 'title-modified', 'w-titlebar', 'w-traffic',
  'w-menu-btn', 'w-close', 'w-max', 'w-full', 'w-pin', 'w-min', 'w-restore',
  'ty-footer', 'footer-word-count', 'footer-char-count', 'footer-line-count',
  'footer-read-time', 'footer-more-btn', 'footer-spell-check', 'footer-btn',
  'outline-btn', 'toggle-sourceview', 'toggle-focus-mode', 'toggle-typewriter',
  '#write', '.write', 'ty-word-count', 'ty-footer-word-count',
]

function isChromeSelector(sel: string): boolean {
  const lower = sel.toLowerCase()
  return CHROME_KEYWORDS.some((kw) => lower.includes(kw))
}

// Typora 私有态/伪类/伪元素，我们的 DOM 不会同时具备，属于「按需触发」类，不算缺失。
// 这些选择器命中需要特定交互态（hover/:has/:focus/:checked/动态 class），审计时单独标注。
const STATEFUL_PATTERNS = [
  /:hover/, /:focus/, /:active/, /:has\(/, /:checked/, /:not\(/,
  /\.active\b/, /\.show\b/, /\.open\b/, /\.dragging\b/, /\.select\b/,
  /\.ty-show-/, /\.ty-on-/, /\.active-tab-/, /\.pin-outline\b/,
  /\.use-file-tree-style\b/, /\.file-node-on-edit\b/, /\.file-node-expanded\b/,
  /\.file-node-collapsed\b/, /\.outline-item-open\b/, /\.outline-item-close\b/,
  /\.outline-item-active\b/, /\.ty-outline-miss\b/, /\.no-collapse-outline\b/,
  /\.sidebar-tab-current\b/, /\.empty-menu-group\b/, /\.not-empty-menu-group\b/,
  /\.selected-folder-menu-item\b/, /\.folder-menu-group\b/, /\.file-sort-item\b/,
  /::-webkit-/, /:first-of-type/, /:last-of-type/, /:only-of-type/, /:nth-child/,
  /:first-child/, /:last-child/, /\.outline-item-single\b/,
  /\.title-modified\b/, /\.typora-sourceview-on\b/, /\.typora-sourceview-off\b/,
  /\.ty-word-count-expand\b/, /\.ty-show-word-count\b/,
]
const isStateful = (sel: string) => STATEFUL_PATTERNS.some((p) => p.test(sel))

// 共享分类：把一组选择器按 命中/状态态/无关/疑似缺失 四类统计，返回报告 + 缺失清单。
function auditSelectors(label: string, selectors: string[], irrelevantPatterns: RegExp[]) {
  const isIrrelevant = (sel: string) => irrelevantPatterns.some((p) => p.test(sel))
  const matched: string[] = []
  const unmatched: string[] = []
  const unmatchedStateful: string[] = []
  const unmatchedIrrelevant: string[] = []

  for (let sel of selectors) {
    try {
      // 伪元素（::before/::after）querySelector 找不到伪元素本身，但只要宿主存在即视为结构命中。
      const pseudoMatch = sel.match(/^(.*?)::?(?:before|after|first-line|first-letter)$/)
      let testSel = sel
      let isPseudo = false
      if (pseudoMatch) {
        testSel = pseudoMatch[1]
        isPseudo = true
      }
      // 用 document 而非 container：选择器可能依赖 body class（.mac-os #typora-sidebar）。
      const hits = document.querySelectorAll(testSel)
      if (hits.length > 0) {
        matched.push(sel)
      } else if (isIrrelevant(sel)) {
        unmatchedIrrelevant.push(sel)
      } else if (isPseudo || isStateful(sel)) {
        unmatchedStateful.push(sel)
      } else {
        unmatched.push(sel)
      }
    } catch {
      // happy-dom 不支持的选择器语法（如 ::-webkit-scrollbar、:has()）归为状态类
      unmatchedStateful.push(sel)
    }
  }

  const effective = selectors.length - unmatchedIrrelevant.length
  const report = [
    `${label} 选择器总数: ${selectors.length}`,
    `✅ 命中（DOM 存在匹配元素）: ${matched.length}`,
    `⚪ 未命中但属交互态/伪类（按需触发，非结构缺失）: ${unmatchedStateful.length}`,
    `🔘 已排除（平台/编辑器内/防御性冗余）: ${unmatchedIrrelevant.length}`,
    `❌ 未命中且无法解释（疑似 DOM 结构缺失）: ${unmatched.length}`,
    `   （有效选择器 ${effective} 个，命中率 ${(matched.length / effective * 100).toFixed(1)}%）`,
    '',
    '=== ❌ 疑似结构缺失的选择器（需人工核对）===',
    ...unmatched.map((s) => `  ${s}`),
  ].join('\n')

  return { report, matched, unmatched, unmatchedStateful, unmatchedIrrelevant, effective }
}

let container: HTMLElement
let root: Root

beforeEach(async () => {
  // 方案 A：Typora 骨架注入 document.body（#root 之外），React App 内部渲染 TyporaShell
  // 通过 portal 把大纲/文件树/搜索结果塞进骨架节点。审计扫描全 document。
  // body class 对齐 Typora 原生 + claude.css 依赖的平台前缀（.mac-os/.mac-seamless-mode）。
  document.body.className =
    'no-collapse-outline allow-file-tree-scroll html-for-mac no-animation mac-os-11 mac-os mac-seamless-mode pin-outline active-tab-outline use-file-tree-style'
  document.body.innerHTML = '<div id="root"></div>'
  // 注入 Typora 原生骨架（sidebar 全树 + x-template + SVG sprite + 搜索框搬运）。
  mountTyporaSkeleton()
  container = document.getElementById('root')!
  root = createRoot(container)
  await act(async () => {
    root.render(React.createElement(AppModule.default))
  })
  // 等 portal 目标解析（TyporaShell 用 rAF 解析骨架节点）。
  await act(async () => {
    await new Promise((r) => setTimeout(r, 20))
  })
  // 切到 files tab 触发文件树加载（invoke mock 返回树数据），让 file-node DOM 渲染出来
  await act(async () => {
    const filesTab = document.querySelector('#sidepanel-segmented-input-files') as HTMLElement | null
    filesTab?.click()
  })
  // 等待文件树异步加载（list_file_tree mock）
  await act(async () => {
    await new Promise((r) => setTimeout(r, 50))
  })
})

afterEach(() => {
  unmountTyporaSkeleton()
})

describe('claude.css sidebar selector audit', () => {
  it('reports which sidebar selectors fail to match our DOM', () => {
    const cssPath = `${process.cwd()}/themes/claude-typora-theme-v1-0-0/claude.css`
    const allSelectors = extractSelectors(cssPath)
    const sidebarSelectors = allSelectors.filter(isSidebarSelector)

    // 已确认的「合法不命中」——这些选择器在 Typora 原生运行时里也匹配不到我们的场景，
    // 或属于 Typora 私有形态/编辑器内组件，与 sidebar 骨架无关。审计时排除，不算缺失。
    const IRRELEVANT_PATTERNS = [
      /\.os-windows\b/,              // 平台 class，mac 环境不命中
      /\.unibody-window\b/,          // Typora Mac 一体化窗口模式，我们不是该窗口形态
      /\.md-toc/,                    // 编辑器内 [TOC] 语法块，非 sidebar
      /file-node-icon (?:i|svg)/,    // claude.css 防御性冗余选择器（Typora 自己也不命中）
      /\.file-list-item-summary/,    // file-list（平铺列表视图）元素，我们用 file-tree 树视图
      /\.file-list-item-file-ext-part/, // 同上，file-list 视图
      /\.file-list-item-count/,      // 搜索结果计数，测试无搜索态不渲染
      /#megamenu-menu-sidebar/,      // Typora 顶部菜单栏，我们无此组件
      /\.ty-search-item\b/,          // 搜索结果项，测试无搜索态不渲染
      /\.ty-file-search-match-text/, // 搜索命中高亮，测试无搜索态不渲染
    ]

    const { report, matched, unmatched, effective } = auditSelectors(
      'claude.css sidebar 相关', sidebarSelectors, IRRELEVANT_PATTERNS,
    )
    // eslint-disable-next-line no-console
    console.log(report)

    // 审计硬指标：无法解释的结构性缺失必须为 0。
    expect(unmatched).toEqual([])
    // 软门槛：有效命中率不低于 45%（交互态选择器静态下不命中属正常）。
    const hitRate = matched.length / effective
    expect(hitRate).toBeGreaterThan(0.45)
  })
})

describe('claude.css topbar/footer/write selector audit', () => {
  // 上一轮审计的结构性盲区补强：顶部工具栏 / 底部状态栏 / 正文 #write 区选择器
  // 之前完全不在 SIDEBAR_KEYWORDS 范围内，导致骨架缺失在自动化审计里被跳过、漏报。
  //
  // 注意：本项目恒为 macOS seamless 形态——文件名/字数由自渲染的 .mac-titlebar-overlay
  // 覆盖层显示（Typora 原生用 Cocoa bridge，我们没有），系统红绿灯由 macOS 原生渲染。
  // 因此 Electron/unibody 形态的 #top-titlebar / traffic lights / footer.ty-footer /
  // #footer-word-count 等 DOM 【本就不应出现】，对应 claude.css 选择器命中 0 属正常，
  // 归入 IRRELEVANT，不算骨架缺失。
  it('reports which topbar/footer/write selectors fail to match our DOM', () => {
    const cssPath = `${process.cwd()}/themes/claude-typora-theme-v1-0-0/claude.css`
    const allSelectors = extractSelectors(cssPath)
    const chromeSelectors = allSelectors.filter(isChromeSelector)

    // 合法不命中（macOS seamless 形态）：
    //  - #top-titlebar / w-traffic-lights / w-menu-btn / title-text 等：Electron/unibody
    //    窗口形态专用，macOS seamless 下不渲染（文件名走自渲染 overlay，红绿灯走原生）。
    //  - footer.ty-footer / footer-word-count / outline-btn 等：macOS 无底部状态栏，
    //    字数在顶部 overlay。这些 DOM 不出现属正确。
    //  - .os-windows / .unibody-window / .native-window：平台/窗口模式 class。
    //  - #md-searchpanel / #md-notification：Typora 搜索/通知浮层，暂未复刻。
    //  - footer-spell-check / spell-check-panel：拼写检查，本项目无该功能。
    //  - #write 后代编辑器内容节点（.md-alert / .md-toc / CodeMirror / .md-pair-s / task-list）：
    //    由 Milkdown 按文档内容动态生成，不是静态骨架。审计 #write stub 覆盖通用节点，
    //    特殊语法块只在用户输入对应 markdown 时才出现，不算骨架缺失。
    const IRRELEVANT_PATTERNS = [
      /#top-titlebar/, /w-titlebar/, /w-traffic-lights/, /w-menu-btn/,
      /#w-min/, /#w-max/, /#w-full/, /#w-pin/, /#w-unpin/, /#w-restore/, /#w-close/,
      /\.title-text/, /title-modified/, /toolbar-icon/, /ty-menu-btn-area/,
      /footer\.ty-footer/, /footer-word-count/, /footer-char-count/,
      /footer-line-count/, /footer-read-time/, /footer-more-btn/,
      /footer-spell-check/, /footer-btn/, /#outline-btn/, /toggle-sourceview/,
      /toggle-focus-mode/, /toggle-typewriter/, /ty-word-count/,
      /\.os-windows\b/, /\.unibody-window\b/, /\.native-window\b/,
      /#md-searchpanel/, /#md-notification/,
      /#footer-spell-check/, /footer-spell-check/, /#spell-check-panel/,
      /\.typora-sourceview-on\b/, /\.typora-sourceview-off\b/,
      /\.ty-word-count-expand\b/,
      /\.ty-show-spell-check\b/, /\.ty-spell-check/,
      /\.md-alert/, /\.md-toc/, /\.CodeMirror/, /\.md-pair-s/, /\.md-meta/,
      /md-task-list-item/, /\.md-fences/, /\.md-table-fig/, /\.table-figure/,
      /md-meta-block/, /md-toc-tooltip/, /md-toc-h/, /md-toc-inner/,
    ]

    const { report, matched, unmatched, effective } = auditSelectors(
      'claude.css topbar/footer/write 相关', chromeSelectors, IRRELEVANT_PATTERNS,
    )
    // eslint-disable-next-line no-console
    console.log(report)

    // 硬指标：正文 #write 骨架无法解释的缺失必须为 0。
    // macOS 形态下 topbar/footer 走原生/overlay，不算缺失；这条断言聚焦 #write 正文区。
    expect(unmatched).toEqual([])
    const hitRate = matched.length / effective
    expect(hitRate).toBeGreaterThan(0.45)
  })
})

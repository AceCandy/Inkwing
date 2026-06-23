import { TYPORA_SHELL_HTML, applySidebarSearchPanelRelocation } from './skeletonHtml'
import { isWindows } from '../../utils/tauriRuntime'
import { t } from '../../i18n'

// 把 Typora 原生 sidebar 骨架注入 document.body，放在 #root 之前（与 Typora 一致：
// sidebar 在 DOM 顺序上先于正文 content 出现）。骨架只注入一次，幂等。
const TYPORA_SKELETON_MOUNTED_FLAG = 'data-typora-skeleton-mounted'

// Typora 骨架里的 data-localize 文本（Outline/Files/Search 等）默认是英文。
// Typora 原生用 main.js 的本地化机制根据 data-localize 值替换文本，本项目不复刻该
// 机制，改为注入后按当前语言统一替换。映射表 key = data-localize 值（英文），value = i18n key。
const SKELETON_LOCALIZE_MAP: Record<string, string> = {
  Outline: 'sidebar.outline',
  Files: 'sidebar.files',
  Search: 'sidebar.search',
}

// 替换骨架里所有 [data-localize] 元素的文本为当前语言。
function localizeSkeletonElements(root: ParentNode): void {
  const lang = typeof localStorage !== 'undefined' ? localStorage.getItem('app-language') || 'zh' : 'zh'
  if (lang === 'en') return // 英文是骨架默认值，无需替换
  root.querySelectorAll<HTMLElement>('[data-localize]').forEach((el) => {
    const key = el.getAttribute('data-localize') ?? ''
    const i18nKey = SKELETON_LOCALIZE_MAP[key]
    if (i18nKey) {
      el.textContent = t(i18nKey)
    }
  })
}

export function mountTyporaSkeleton(): void {
  if (document.body.hasAttribute(TYPORA_SKELETON_MOUNTED_FLAG)) {
    return
  }

  const root = document.getElementById('root')
  // 创建承载骨架的容器，放在 #root 之前。Typora CSS 的全局 id 选择器
  // （#typora-sidebar / #outline-content / #file-library 等）在此命中，
  // 与 Typora app 中这些节点直接挂在 <body> 下完全等价。
  const host = document.createElement('div')
  host.id = 'typora-skeleton-host'
  host.setAttribute('aria-hidden', 'false')
  host.innerHTML = TYPORA_SHELL_HTML

  if (root) {
    document.body.insertBefore(host, root)
  } else {
    document.body.appendChild(host)
  }

  // 复刻 Typora index.html 末尾的搜索框搬运脚本（macOS 形态）。
  applySidebarSearchPanelRelocation()

  // 替换骨架里 data-localize 元素的文本为当前语言（Outline/Files/Search）。
  localizeSkeletonElements(host)

  // 平台分流：Windows 显示底部 footer.ty-footer（Typora 原生机制——footer 默认
  // display:none，body 加 .show-footer 才显示）；macOS 走右上 titlebar 字数，
  // 不加 .show-footer，footer 保持隐藏。window.css 的 .show-footer 规则接管显示。
  if (isWindows()) {
    document.body.classList.add('show-footer')
  }

  document.body.setAttribute(TYPORA_SKELETON_MOUNTED_FLAG, 'true')
}

// 卸载骨架（用于测试或主题完全清除时）。
export function unmountTyporaSkeleton(): void {
  document.getElementById('typora-skeleton-host')?.remove()
  document.body.removeAttribute(TYPORA_SKELETON_MOUNTED_FLAG)
}

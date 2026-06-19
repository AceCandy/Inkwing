import { TYPORA_SHELL_HTML, applySidebarSearchPanelRelocation } from './skeletonHtml'

// 把 Typora 原生 sidebar 骨架注入 document.body，放在 #root 之前（与 Typora 一致：
// sidebar 在 DOM 顺序上先于正文 content 出现）。骨架只注入一次，幂等。
const TYPORA_SKELETON_MOUNTED_FLAG = 'data-typora-skeleton-mounted'

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

  document.body.setAttribute(TYPORA_SKELETON_MOUNTED_FLAG, 'true')
}

// 卸载骨架（用于测试或主题完全清除时）。
export function unmountTyporaSkeleton(): void {
  document.getElementById('typora-skeleton-host')?.remove()
  document.body.removeAttribute(TYPORA_SKELETON_MOUNTED_FLAG)
}

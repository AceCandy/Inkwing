import { isTauri } from '@tauri-apps/api/core'

export function isRunningInTauri(): boolean {
  try {
    // Tauri IPC 相关 API 只能在 WebView 注入运行时后调用。
    return isTauri()
  } catch {
    return false
  }
}

// 平台判定：对齐 Typora 在 body 上加的 os-windows / mac-os class 的判定口径
// （runtime.ts 的 getTyporaPlatformBodyClass 同样用 navigator.platform + userAgent）。
// 作为 React 侧的平台分流出口，供字数统计位置（mac 右上 / win 右下 footer）等使用。
export function isMac(): boolean {
  const platform = (navigator?.platform ?? '').toUpperCase()
  const userAgent = (navigator?.userAgent ?? '').toLowerCase()
  return platform.includes('MAC') || userAgent.includes('macintosh')
}

export function isWindows(): boolean {
  const platform = (navigator?.platform ?? '').toUpperCase()
  const userAgent = (navigator?.userAgent ?? '').toLowerCase()
  return platform.includes('WIN') || userAgent.includes('windows')
}

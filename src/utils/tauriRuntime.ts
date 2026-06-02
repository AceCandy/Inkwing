import { isTauri } from '@tauri-apps/api/core'

export function isRunningInTauri(): boolean {
  try {
    // Tauri IPC 相关 API 只能在 WebView 注入运行时后调用。
    return isTauri()
  } catch {
    return false
  }
}

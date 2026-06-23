import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const tauriConfig = JSON.parse(
  readFileSync(new URL('../../src-tauri/tauri.conf.json', import.meta.url), 'utf8'),
)
const cargoToml = readFileSync(new URL('../../src-tauri/Cargo.toml', import.meta.url), 'utf8')

// 透明窗口与 overlay titlebar 是平台相关设置，已从基线 tauri.conf.json 拆分到
// tauri.<platform>.conf.json（Tauri 2 自动深度合并）。透明声明必须落在这些平台文件里，
// 而不是基线配置——否则基线设 true 会让非 mac 平台也透明、设 false 又会让 mac 失去透明。
const readPlatformConfig = (platform: string) => {
  try {
    return JSON.parse(
      readFileSync(new URL(`../../src-tauri/tauri.${platform}.conf.json`, import.meta.url), 'utf8'),
    )
  } catch {
    return null
  }
}
const platformConfigHasTransparent = (config: unknown): boolean => {
  const windows = (config as { app?: { windows?: Array<{ transparent?: boolean }> } })?.app?.windows
  return Boolean(windows?.some((windowConfig) => windowConfig.transparent === true))
}

describe('Tauri config', () => {
  it('uses a deterministic IPv4 dev server URL for WebKit dev windows', () => {
    expect(tauriConfig.build.devUrl).toBe('http://127.0.0.1:1420')
    expect(tauriConfig.build.beforeDevCommand).toBe('npm run dev -- --host 127.0.0.1 --port 1420')
  })

  it('lets Tauri create the main window before Rust setup focuses it', () => {
    const mainWindow = tauriConfig.app.windows.find(
      (windowConfig: { label?: string }) => windowConfig.label === 'main',
    )

    expect(mainWindow).toEqual(
      expect.objectContaining({
        create: true,
        visible: true,
      }),
    )
  })

  it('enables asset protocol access for imported Typora theme assets', () => {
    expect(tauriConfig.app.security.assetProtocol).toEqual(
      expect.objectContaining({
        enable: true,
        scope: expect.arrayContaining(['$APPDATA/themes/typora/**']),
      }),
    )
  })

  it('enables Tauri asset protocol support in the Rust crate', () => {
    expect(cargoToml).toMatch(/tauri\s*=\s*\{[^}]*features\s*=\s*\[[^\]]*"protocol-asset"/)
  })

  it('keeps the transparent overlay window declaration out of the platform-agnostic baseline', () => {
    // 基线 tauri.conf.json 不应再声明 transparent/titleBarStyle——它们已按平台拆分。
    // 若有人把透明设置搬回基线，会破坏非 mac 平台的窗口合成（见 tauri.windows.conf.json 注释）。
    const baselineWindows = tauriConfig.app.windows as Array<{ transparent?: boolean; titleBarStyle?: string }>
    expect(baselineWindows.some((windowConfig) => 'transparent' in windowConfig)).toBe(false)
    expect(baselineWindows.some((windowConfig) => 'titleBarStyle' in windowConfig)).toBe(false)
  })

  it('only enables the transparent overlay window on macOS for Typora seamless layout', () => {
    // Typora 的透明窗口（seamless titlebar、桌面透过红绿灯）是 macOS 独有需求。
    // Windows 上 WebView2 + 透明窗口是已知坑（body 背景被忽略、整窗透明），且 Typora
    // 的 .os-windows 形态不依赖透明（content/sidebar 都是实色背景）。故只有 mac 声明 transparent，
    // Windows 走基线默认（不透明），直接用 body 的实色背景作为窗口背景。
    expect(platformConfigHasTransparent(readPlatformConfig('macos'))).toBe(true)
    // Windows 不应有平台配置文件，或即使有也不声明 transparent
    const windowsConfig = readPlatformConfig('windows')
    expect(platformConfigHasTransparent(windowsConfig)).toBe(false)
    expect(tauriConfig.app.macOSPrivateApi).toBe(true)
  })
})

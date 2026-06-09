import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const tauriConfig = JSON.parse(
  readFileSync(new URL('../../src-tauri/tauri.conf.json', import.meta.url), 'utf8'),
)
const cargoToml = readFileSync(new URL('../../src-tauri/Cargo.toml', import.meta.url), 'utf8')

describe('Tauri config', () => {
  it('uses a deterministic IPv4 dev server URL for WebKit dev windows', () => {
    expect(tauriConfig.build.devUrl).toBe('http://127.0.0.1:1420')
    expect(tauriConfig.build.beforeDevCommand).toBe('npm run dev -- --host 127.0.0.1 --port 1420')
  })

  it('lets Rust setup explicitly create and focus the main window', () => {
    const mainWindow = tauriConfig.app.windows.find(
      (windowConfig: { label?: string }) => windowConfig.label === 'main',
    )

    expect(mainWindow).toEqual(
      expect.objectContaining({
        create: false,
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

  it('enables the macOS private API required by transparent overlay windows', () => {
    const hasTransparentWindow = tauriConfig.app.windows.some(
      (windowConfig: { transparent?: boolean }) => windowConfig.transparent === true,
    )

    expect(hasTransparentWindow).toBe(true)
    expect(tauriConfig.app.macOSPrivateApi).toBe(true)
  })
})

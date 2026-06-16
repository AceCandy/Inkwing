import { invoke, isTauri } from '@tauri-apps/api/core'

import type { TyporaThemePackage } from './types'

export interface TyporaThemeCssResponse {
  css: string
  basePath: string
}

const BUNDLED_TYPORA_THEME_PACKAGES: TyporaThemePackage[] = [
  {
    id: 'claude-typora-theme-v1-0-0',
    name: 'Claude Typora Theme',
    type: 'typora',
    basePath: '/third-theme/claude-typora-theme-v1.0.0',
    importedAt: 'bundled',
    variants: [
      {
        id: 'claude',
        name: 'Claude',
        cssFile: 'claude.css',
      },
      {
        id: 'claude-dark',
        name: 'Claude Dark',
        cssFile: 'claude-dark.css',
      },
    ],
  },
  {
    id: 'catppuccin-mocha',
    name: 'Catppuccin Mocha',
    type: 'typora',
    basePath: '/themes/catppuccin-mocha',
    importedAt: 'bundled',
    variants: [
      {
        id: 'theme',
        name: 'Theme',
        cssFile: 'theme.css',
      },
    ],
  },
  {
    id: 'catppuccin-latte',
    name: 'Catppuccin Latte',
    type: 'typora',
    basePath: '/themes/catppuccin-latte',
    importedAt: 'bundled',
    variants: [
      {
        id: 'theme',
        name: 'Theme',
        cssFile: 'theme.css',
      },
    ],
  },
]

function canUseTauriIpc(): boolean {
  try {
    return isTauri()
  } catch {
    return false
  }
}

function resolveBundledTheme(themeId: string, cssFile: string): TyporaThemePackage | null {
  return BUNDLED_TYPORA_THEME_PACKAGES.find((pkg) => {
    return pkg.id === themeId && pkg.variants.some((variant) => variant.cssFile === cssFile)
  }) ?? null
}

export async function importTyporaTheme(sourceDir: string) {
  if (!canUseTauriIpc()) {
    throw new Error('导入 Typora 主题需要在 Tauri 应用中执行')
  }

  return invoke<TyporaThemePackage>('import_typora_theme', { sourceDir })
}

export async function listTyporaThemes() {
  if (!canUseTauriIpc()) {
    return BUNDLED_TYPORA_THEME_PACKAGES
  }

  return invoke<TyporaThemePackage[]>('list_typora_themes')
}

export async function readTyporaThemeCss(themeId: string, cssFile: string) {
  if (!canUseTauriIpc()) {
    const bundledTheme = resolveBundledTheme(themeId, cssFile)
    if (!bundledTheme) {
      throw new Error('外部 Typora 主题需要在 Tauri 应用中读取')
    }

    const response = await fetch(`${bundledTheme.basePath}/${cssFile}?raw`)
    if (!response.ok) {
      throw new Error(`读取内置 Typora 主题失败: ${response.status}`)
    }

    return {
      css: await response.text(),
      basePath: bundledTheme.basePath,
    }
  }

  return invoke<TyporaThemeCssResponse>('read_typora_theme_css', { themeId, cssFile })
}

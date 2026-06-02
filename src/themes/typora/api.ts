import { invoke } from '@tauri-apps/api/core'

import type { TyporaThemePackage } from './types'

export interface TyporaThemeCssResponse {
  css: string
  basePath: string
}

export async function importTyporaTheme(sourceDir: string) {
  return invoke<TyporaThemePackage>('import_typora_theme', { sourceDir })
}

export async function listTyporaThemes() {
  return invoke<TyporaThemePackage[]>('list_typora_themes')
}

export async function readTyporaThemeCss(themeId: string, cssFile: string) {
  return invoke<TyporaThemeCssResponse>('read_typora_theme_css', { themeId, cssFile })
}

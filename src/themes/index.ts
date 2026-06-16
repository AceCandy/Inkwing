export type { TyporaThemeOption } from './typora/types'

import { listTyporaThemes } from './typora/api'
import { migrateLegacyThemeId } from './typora/bundled'
import { applyTyporaTheme } from './typora/runtime'
import type { TyporaThemeOption } from './typora/types'

let typoraThemes: TyporaThemeOption[] = []

export type ThemeOption = TyporaThemeOption

export async function refreshExternalThemes(): Promise<TyporaThemeOption[]> {
  const packages = await listTyporaThemes()

  // 主题来源统一为 Typora CSS 包；内置主题也通过后端主题目录暴露。
  typoraThemes = packages.flatMap((pkg) =>
    pkg.variants
      .filter((variant) => !isTyporaUserCssFile(variant.cssFile))
      .map((variant) => ({
        type: 'typora' as const,
        id: `typora:${pkg.id}:${variant.id}`,
        name: `${pkg.name} / ${variant.name}`,
        packageId: pkg.id,
        packageName: pkg.name,
        cssFile: variant.cssFile,
        basePath: pkg.basePath,
      })),
  )

  return typoraThemes
}

function isTyporaUserCssFile(cssFile: string): boolean {
  return cssFile === 'base.user.css' || cssFile.endsWith('.user.css')
}

export function getAllThemes(): ThemeOption[] {
  return typoraThemes
}

export const getAllThemeOptions = getAllThemes

export function getThemeOption(id: string): ThemeOption {
  const normalizedId = migrateLegacyThemeId(id)
  const theme = typoraThemes.find((item) => item.id === normalizedId)

  if (!theme) {
    throw new Error(`Typora 主题不存在: ${normalizedId}`)
  }

  return theme
}

export async function applyThemeOption(theme: ThemeOption): Promise<void> {
  await applyTyporaTheme(theme)
}

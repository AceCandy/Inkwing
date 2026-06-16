import { BUNDLED_TYPORA_CLAUDE_THEME_ID } from './typora/bundled'

export const defaultTheme = {
  id: BUNDLED_TYPORA_CLAUDE_THEME_ID,
  name: 'Claude Typora Theme / Claude',
  type: 'typora',
} as const

export const defaultLightTheme = defaultTheme

export type Theme = typeof defaultTheme

// 旧导入兼容：主题样式统一由 Typora CSS runtime 注入，这里不再生成项目私有 CSS 变量。
export function themeToCSSVariables(_theme: Theme): string {
  return ''
}

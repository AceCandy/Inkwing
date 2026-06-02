export interface TyporaThemeVariant {
  id: string
  name: string
  cssFile: string
}

export interface TyporaThemePackage {
  id: string
  name: string
  type: 'typora'
  basePath: string
  variants: TyporaThemeVariant[]
  importedAt: string
}

export interface TyporaThemeOption {
  type: 'typora'
  id: string
  name: string
  packageId: string
  packageName: string
  cssFile: string
  basePath: string
}

export interface TyporaCssAdaptOptions {
  assetBasePath: string
  toAssetUrl: (path: string) => string
}

export function isTyporaThemeOption(value: unknown): value is TyporaThemeOption {
  return Boolean(
    value &&
      typeof value === 'object' &&
      (value as { type?: unknown }).type === 'typora' &&
      typeof (value as { id?: unknown }).id === 'string' &&
      typeof (value as { cssFile?: unknown }).cssFile === 'string' &&
      typeof (value as { packageId?: unknown }).packageId === 'string' &&
      typeof (value as { basePath?: unknown }).basePath === 'string',
  )
}

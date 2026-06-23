import React, { useState, useEffect } from 'react'
import { open } from '@tauri-apps/plugin-dialog'
import { invoke } from '@tauri-apps/api/core'
import { useEditorStore } from '../../stores/editorStore'
import { isRunningInTauri } from '../../utils/tauriRuntime'
import {
  getAllThemes,
  refreshExternalThemes,
  type ThemeOption,
} from '../../themes'
import { importTyporaTheme } from '../../themes/typora/api'
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts'
import { useLanguage } from '../../i18n'
import { useAppLogo } from '../../hooks/useAppLogo'
import './styles.css'

type TabId = 'interface' | 'shortcuts'

export const SettingsModal: React.FC = () => {
  const { currentTheme, setTheme, setShowSettings, themeError } = useEditorStore()
  const logoSmall = useAppLogo()
  const { modifierKey, shortcuts } = useKeyboardShortcuts()
  const [themes, setThemes] = useState<ThemeOption[]>([])
  const [importMessage, setImportMessage] = useState<string | null>(null)
  const [isImportingTheme, setIsImportingTheme] = useState(false)
  const [activeTab, setActiveTab] = useState<TabId>('interface')
  const { language, changeLanguage, t } = useLanguage()

  const TABS: { id: TabId; label: string }[] = [
    { id: 'interface', label: t('settings.interface') },
    { id: 'shortcuts', label: t('settings.shortcuts') },
  ]

  useEffect(() => {
    let cancelled = false

    async function loadThemes() {
      try {
        await refreshExternalThemes()
        if (!cancelled) {
          setThemes(getAllThemes())
        }
      } catch (err) {
        if (!cancelled) {
          setImportMessage(err instanceof Error ? err.message : String(err))
        }
      }
    }

    loadThemes()

    return () => {
      cancelled = true
    }
  }, [])

  const handleThemeChange = (themeId: string) => {
    setTheme(themeId)
  }

  const handleImportTyporaTheme = async () => {
    setImportMessage(null)
    setIsImportingTheme(true)

    try {
      const selected = await open({
        directory: true,
        multiple: false,
      })

      if (!selected || Array.isArray(selected)) {
        return
      }

      await importTyporaTheme(selected)
      await refreshExternalThemes()
      setThemes(getAllThemes())
      setImportMessage(t('settings.importThemeSuccess'))
    } catch (err) {
      setImportMessage(err instanceof Error ? err.message : String(err))
    } finally {
      setIsImportingTheme(false)
    }
  }

  const handleLanguageChange = (lang: string) => {
    changeLanguage(lang)
    // 同步 Tauri 原生菜单（Rust build_menu 按 lang 构建菜单文本）。
    if (isRunningInTauri()) {
      invoke('set_menu_language', { lang }).catch((err) =>
        console.error('Failed to sync menu language:', err),
      )
    }
  }

  const handleClose = () => {
    setShowSettings(false)
  }

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose()
    }
  }

  return (
    <div className="settings-overlay inkwing-chrome" onClick={handleOverlayClick}>
      <div className="settings-modal">
        <div className="settings-header">
          <div className="settings-title-container">
            <img src={logoSmall} alt="Logo" className="settings-title-logo" />
            <h2>{t('settings.title')}</h2>
          </div>
          <button className="settings-close-btn" onClick={handleClose}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="settings-tabs">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={`settings-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="settings-body">
          {activeTab === 'interface' && (
            <>
              {/* 语言设置 */}
              <section className="settings-section">
                <h3 className="settings-section-title">{t('settings.language')}</h3>
                <div className="option-group">
                  <button
                    className={`option-btn ${language === 'zh' ? 'active' : ''}`}
                    onClick={() => handleLanguageChange('zh')}
                  >
                    中文
                  </button>
                  <button
                    className={`option-btn ${language === 'en' ? 'active' : ''}`}
                    onClick={() => handleLanguageChange('en')}
                  >
                    English
                  </button>
                </div>
              </section>

              {/* 主题设置 */}
              <section className="settings-section">
                <h3 className="settings-section-title">{t('settings.theme')}</h3>
                <div className="theme-import-row">
                  <button
                    className="theme-import-btn"
                    onClick={handleImportTyporaTheme}
                    disabled={isImportingTheme}
                  >
                    {isImportingTheme ? t('settings.importingTheme') : t('settings.importTyporaTheme')}
                  </button>
                  {importMessage && <span className="theme-import-message">{importMessage}</span>}
                  {themeError && <span className="theme-import-message error">{themeError}</span>}
                </div>
                <div className="theme-grid">
                  {themes.map((theme) => {
                    return (
                      <button
                        key={theme.id}
                        className={`theme-card external ${currentTheme === theme.id ? 'active' : ''}`}
                        onClick={() => handleThemeChange(theme.id)}
                      >
                        <div className="theme-preview typora-preview">
                          <div className="theme-preview-header" />
                          <div className="theme-preview-content">
                            <div className="theme-preview-line" />
                            <div className="theme-preview-line short" />
                          </div>
                        </div>
                        <span className="theme-card-name">{theme.name}</span>
                        <span className="theme-card-meta">{theme.packageName}</span>
                      </button>
                    )
                  })}
                </div>
              </section>
            </>
          )}

          {activeTab === 'shortcuts' && (
            <section className="settings-section">
              <h3 className="settings-section-title">{t('settings.shortcuts')}</h3>
              <div className="shortcuts-list">
                {shortcuts.map((shortcut) => (
                  <div key={shortcut.key} className="shortcut-item">
                    <span className="shortcut-description">{shortcut.description}</span>
                    <kbd className="shortcut-key">
                      {modifierKey} + {shortcut.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}

export default SettingsModal

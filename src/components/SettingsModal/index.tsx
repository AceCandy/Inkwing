import React, { useState, useEffect } from 'react'
import { open } from '@tauri-apps/plugin-dialog'
import { useEditorStore } from '../../stores/editorStore'
import {
  getAllThemes,
  refreshExternalThemes,
  type ThemeOption,
} from '../../themes'
import { importTyporaTheme } from '../../themes/typora/api'
import { isTyporaThemeOption } from '../../themes/typora/types'
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts'
import { useLanguage } from '../../i18n'
import './styles.css'

type TabId = 'interface' | 'shortcuts'

export const SettingsModal: React.FC = () => {
  const { currentTheme, setTheme, setShowSettings, themeError } = useEditorStore()
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
      setImportMessage('Typora 主题导入成功')
    } catch (err) {
      setImportMessage(err instanceof Error ? err.message : String(err))
    } finally {
      setIsImportingTheme(false)
    }
  }

  const handleLanguageChange = (lang: string) => {
    changeLanguage(lang)
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
    <div className="settings-overlay" onClick={handleOverlayClick}>
      <div className="settings-modal">
        <div className="settings-header">
          <h2>{t('settings.title')}</h2>
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
                    {isImportingTheme ? '导入中...' : '导入 Typora 主题文件夹'}
                  </button>
                  {importMessage && <span className="theme-import-message">{importMessage}</span>}
                  {themeError && <span className="theme-import-message error">{themeError}</span>}
                </div>
                <div className="theme-grid">
                  {themes.map((theme) => {
                    const isTypora = isTyporaThemeOption(theme)

                    return (
                      <button
                        key={theme.id}
                        className={`theme-card ${currentTheme === theme.id ? 'active' : ''} ${isTypora ? 'external' : ''}`}
                        onClick={() => handleThemeChange(theme.id)}
                      >
                        {isTypora ? (
                          <div className="theme-preview typora-preview">
                            <div className="theme-preview-header" />
                            <div className="theme-preview-content">
                              <div className="theme-preview-line" />
                              <div className="theme-preview-line short" />
                            </div>
                          </div>
                        ) : (
                          <div
                            className="theme-preview"
                            style={{
                              backgroundColor: theme.colors.editorBgSecondary,
                              borderColor: theme.colors.border,
                            }}
                          >
                            <div
                              className="theme-preview-header"
                              style={{
                                backgroundColor: theme.colors.editorBg,
                                borderBottom: `1px solid ${theme.colors.border}`,
                              }}
                            />
                            <div className="theme-preview-content">
                              <div
                                className="theme-preview-line"
                                style={{ backgroundColor: theme.colors.textSecondary }}
                              />
                              <div
                                className="theme-preview-line short"
                                style={{ backgroundColor: theme.colors.textSecondary }}
                              />
                            </div>
                          </div>
                        )}
                        <span className="theme-card-name">{theme.name}</span>
                        {isTypora && <span className="theme-card-meta">{theme.packageName}</span>}
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

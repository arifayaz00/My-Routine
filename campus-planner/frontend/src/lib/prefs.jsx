import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { translate } from './i18n'

const Ctx = createContext(null)
export const usePrefs = () => useContext(Ctx)
/** Shorthand: const t = useT();  t('key', { var }) */
export const useT = () => usePrefs().t

const read = (k, ok, fallback) => { try { const v = localStorage.getItem(k); return ok.includes(v) ? v : fallback } catch { return fallback } }
const write = (k, v) => { try { localStorage.setItem(k, v) } catch {} }

export function PrefsProvider({ children }) {
  const [lang, setLangState] = useState(() => read('cp_lang', ['en', 'bn'], 'en'))
  const [theme, setThemeState] = useState(() => document.documentElement.dataset.theme === 'light' ? 'light' : 'dark')

  useEffect(() => { document.documentElement.lang = lang }, [lang])
  useEffect(() => { document.documentElement.dataset.theme = theme }, [theme])
  const setLang = useCallback((l) => { write('cp_lang', l); setLangState(l) }, [])
  const setTheme = useCallback((t) => { write('cp_theme', t); setThemeState(t) }, [])
  const t = useCallback((key, vars) => translate(lang, key, vars), [lang])
  const locale = lang === 'bn' ? 'bn-BD' : undefined  // numbers/dates in the reader's own language

  const value = useMemo(() => ({ lang, setLang, theme, setTheme, t, locale }), [lang, setLang, theme, setTheme, t, locale])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

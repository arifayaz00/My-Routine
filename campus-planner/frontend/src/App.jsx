import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CalendarDays, GraduationCap, LogOut, Moon, ShieldCheck, Sparkles, Sun, UserRound } from 'lucide-react'
import { useAuth } from './lib/auth'
import { usePrefs } from './lib/prefs'
import AccountPage from './pages/AccountPage'
import AdminPage from './pages/AdminPage'
import AuthPage from './pages/AuthPage'
import CgpaPage from './pages/CgpaPage'
import RoutinePage from './pages/RoutinePage'

const TOAST_CLS = { success: 'border-emerald-400/40 text-emerald-200', error: 'border-rose-400/40 text-rose-200', info: 'border-sky-400/40 text-sky-200' }
const ROUTES = ['routine', 'cgpa', 'admin', 'account']

/** Hash routes (#cgpa, #admin ...): the back button and bookmarks work. */
function useRoute() {
  const read = () => { const h = location.hash.replace(/^#\/?/, ''); return ROUTES.includes(h) ? h : 'routine' }
  const [route, setRoute] = useState(read)
  useEffect(() => {
    const f = () => setRoute(read())
    window.addEventListener('hashchange', f)
    return () => window.removeEventListener('hashchange', f)
  }, [])
  return [route, (r) => { location.hash = r }]
}

export default function App() {
  const { user, ready, logout } = useAuth()
  const { t, lang, setLang, theme, setTheme } = usePrefs()
  const [route, go] = useRoute()
  const [toasts, setToasts] = useState([])
  const toast = useCallback((msg, kind = 'info') => {
    const id = Math.random()
    setToasts((t) => [...t, { id, msg, kind }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000)
  }, [])

  const tabs = [
    ['routine', t('nav.routine'), CalendarDays],
    ['cgpa', t('nav.cgpa'), GraduationCap],
    ...(user?.role === 'admin' ? [['admin', t('nav.admin'), ShieldCheck]] : []),
    ...(user ? [['account', t('nav.account'), UserRound]] : []),
  ]
  const needsLogin = !user && route !== 'routine'
  let page = null
  if (!ready) page = <div className="skeleton h-40" />
  else if (needsLogin) page = <AuthPage />
  else if (route === 'routine') page = <RoutinePage toast={toast} />
  else if (route === 'cgpa') page = <CgpaPage toast={toast} />
  else if (route === 'account') page = <AccountPage toast={toast} />
  else if (route === 'admin') page = user?.role === 'admin' ? <AdminPage toast={toast} /> : <p className="glass p-8 text-center text-slate-400">{t('adminOnly')}</p>

  return (
    <div className="mx-auto max-w-7xl px-4 pb-24 pt-5 sm:px-6">
      <header className="no-print mb-6 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-lg font-extrabold">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-500 shadow-glow" style={{ color: '#fff' }}><Sparkles size={18} /></span>
          Campus Planner
        </div>
        <nav className="glass ml-auto flex gap-1 overflow-x-auto p-1" aria-label={t('nav.main')}>
          {tabs.map(([k, l, Icon]) => (
            <button key={k} onClick={() => go(k)} aria-current={route === k ? 'page' : undefined}
              className={`relative inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-semibold transition ${route === k ? 'text-white' : 'text-slate-400 hover:text-slate-200'}`}>
              {route === k && <motion.span layoutId="tab" className="absolute inset-0 rounded-xl bg-violet-500/30 shadow-glow" />}
              <span className="relative inline-flex items-center gap-1.5"><Icon size={15} />{l}</span>
            </button>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <button className="btn-ghost !px-3" onClick={() => setLang(lang === 'bn' ? 'en' : 'bn')} aria-label={lang === 'bn' ? 'Switch language to English' : t('lang.aria')} lang={lang === 'bn' ? 'en' : 'bn'}>
            {t('lang.switch')}
          </button>
          <button className="btn-ghost !px-3" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            aria-label={theme === 'light' ? t('theme.toDark') : t('theme.toLight')} title={theme === 'light' ? t('theme.toDark') : t('theme.toLight')}>
            {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
          </button>
          {user ? (
            <button className="btn-ghost" onClick={async () => { await logout(); go('routine') }}><LogOut size={15} />{t('nav.signout')}</button>
          ) : (
            <button className="btn-primary" onClick={() => go('cgpa')}>{t('nav.signin')}</button>
          )}
        </div>
      </header>

      <AnimatePresence mode="wait">
        <motion.main key={route + (user ? 'u' : 'g')} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
          {page}
        </motion.main>
      </AnimatePresence>

      <div className="no-print fixed bottom-4 right-4 z-50 max-w-[calc(100vw-2rem)] space-y-2" aria-live="polite">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div key={t.id} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 40 }}
              className={`glass break-words bg-slate-900/90 px-4 py-2.5 text-sm ${TOAST_CLS[t.kind]}`}>{t.msg}</motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}

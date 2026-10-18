import { useCallback, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { toPng } from 'html-to-image'
import { CalendarPlus, Download, Link2, Megaphone, Printer, RefreshCw, WifiOff } from 'lucide-react'
import FilterBar from '../components/FilterBar'
import RoutineGrid from '../components/RoutineGrid'
import { api, download, qs, saveBlob } from '../lib/api'
import { useAuth } from '../lib/auth'
import { usePrefs } from '../lib/prefs'

const NOTICE_CLS = {
  info: 'border-sky-400/30 bg-sky-400/10 text-sky-100',
  change: 'border-amber-400/30 bg-amber-400/10 text-amber-100',
  urgent: 'border-rose-400/30 bg-rose-400/10 text-rose-100',
}
const p = (f) => ({ department: f.department, batch: f.batch, section: f.section })

export default function RoutinePage({ toast }) {
  const { user, setUser } = useAuth()
  const { t, locale, theme } = usePrefs()
  const fmtDate = (iso) => new Date(iso).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' })
  const [tree, setTree] = useState({})
  const [teachers, setTeachers] = useState([])
  const [filter, setFilter] = useState({ department: user?.prefs?.department || '', batch: user?.prefs?.batch || '', section: user?.prefs?.section || '', teacher: '' })
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [meta, setMeta] = useState({})
  const [notices, setNotices] = useState([])
  const [online, setOnline] = useState(navigator.onLine)
  const filterRef = useRef(filter); filterRef.current = filter
  const gridRef = useRef(null)

  const load = useCallback(async () => {
    const [rows, m, ns, t, tc] = await Promise.all([
      api.get(`/routine?${qs(filterRef.current)}`), api.get('/routine/meta'), api.get('/notices'),
      api.get('/routine/filters'), api.get('/routine/teachers'),
    ])
    setEntries(rows); setMeta(m); setNotices(ns); setTree(t); setTeachers(tc); setLoading(false)
  }, [])

  useEffect(() => { setLoading(true); load().catch((e) => { if (navigator.onLine) toast(e.message, 'error'); setLoading(false) }) }, [filter, load, toast])

  useEffect(() => {  // browser online/offline: the service worker serves the last saved copy while offline
    const on = () => { setOnline(true); load().catch(() => {}) }, off = () => setOnline(false)
    window.addEventListener('online', on); window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [load])

  useEffect(() => {  // live updates pushed by the server (Server-Sent Events, auto-reconnects)
    const es = new EventSource('/api/routine/stream')
    es.addEventListener('routine-updated', () => { load().catch(() => {}); toast(t('routine.updatedToast'), 'success') })
    es.addEventListener('notice', (ev) => { load().catch(() => {}); toast(t('routine.newNotice', { t: JSON.parse(ev.data).title }), 'info') })
    return () => es.close()
  }, [load, toast, t])

  useEffect(() => {  // auto-save the preferred batch for signed-in users (debounced)
    if (!user) return
    const t = setTimeout(() => api.put('/auth/preferences', p(filter)).then(setUser).catch(() => {}), 600)
    return () => clearTimeout(t)
  }, [filter.department, filter.batch, filter.section]) // eslint-disable-line react-hooks/exhaustive-deps

  const feedUrl = () => `${location.origin}/api/routine/export.ics?${qs(filter)}`
  const copyFeed = async () => {
    try { await navigator.clipboard.writeText(feedUrl()); toast(t('routine.copied'), 'success') }
    catch { toast(t('routine.copyThis', { u: feedUrl() }), 'info') }
  }
  const savePng = async () => {
    try {
      const png = await toPng(gridRef.current, { pixelRatio: 2, backgroundColor: theme === 'light' ? '#f4f5fb' : '#020617', skipFonts: true })
      saveBlob(await (await fetch(png)).blob(), 'routine.png')
    } catch { toast(t('routine.imgFail'), 'error') }
  }

  return (
    <div className="space-y-4">
      {!online && (
        <div role="status" className="flex items-center gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-sm text-amber-100">
          <WifiOff size={16} />{t('routine.offline')}
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-200">
          <RefreshCw size={12} />{meta.updated_at ? t('routine.updatedOn', { d: fmtDate(meta.updated_at) }) : t('routine.none')}
          {meta.semester_start && meta.semester_end && <span className="text-emerald-300/70">· {t('routine.semester', { a: meta.semester_start, b: meta.semester_end })}</span>}
        </div>
        <div className="no-print flex flex-wrap gap-2">
          <button className="btn-ghost" onClick={() => download(`/routine/export.ics?${qs(filter)}`, 'routine.ics').catch((e) => toast(e.message, 'error'))}>
            <CalendarPlus size={16} />{t('routine.ics')}
          </button>
          <button className="btn-ghost" onClick={copyFeed} title={t('routine.subscribeTitle')}><Link2 size={16} />{t('routine.subscribe')}</button>
          <button className="btn-ghost" onClick={savePng}><Download size={16} />{t('routine.image')}</button>
          <button className="btn-ghost" onClick={() => window.print()}><Printer size={16} />{t('routine.print')}</button>
        </div>
      </div>

      {notices.slice(0, 3).map((n) => (
        <motion.div key={n.id} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
          className={`flex gap-3 rounded-xl border p-3 text-sm ${NOTICE_CLS[n.level]}`}>
          <Megaphone size={18} className="mt-0.5 shrink-0" />
          <div><b>{n.title}</b>{n.body && <p className="opacity-90">{n.body}</p>}
            <p className="mt-0.5 text-xs opacity-60">{fmtDate(n.created_at)}</p></div>
        </motion.div>
      ))}

      <div className="no-print"><FilterBar tree={tree} value={filter} onChange={setFilter} teachers={teachers} /></div>
      <div ref={gridRef}><RoutineGrid entries={entries} loading={loading} /></div>
    </div>
  )
}

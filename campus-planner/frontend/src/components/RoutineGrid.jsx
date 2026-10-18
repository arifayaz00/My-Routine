import { useMemo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { DoorOpen, UserRound } from 'lucide-react'
import { DAY_ORDER, KIND, to12h } from '../lib/theme'
import { useT } from '../lib/prefs'

const container = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } }
const item = { hidden: { opacity: 0, y: 12, scale: 0.97 }, show: { opacity: 1, y: 0, scale: 1 } }

function ClassCard({ e }) {
  const t = useT()
  const k = KIND[e.kind] || KIND.theory
  return (
    <motion.div
      variants={item}
      whileHover={{ scale: 1.04, zIndex: 5 }}
      className={`rounded-xl border p-2.5 text-xs leading-snug ${k.cls}`}
      title={e.title || e.code}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-bold tracking-wide">{e.code}</span>
        <span className="rounded-full bg-black/20 px-1.5 py-0.5 text-[10px] uppercase">{t(`kindShort.${KIND[e.kind] ? e.kind : 'theory'}`)}</span>
      </div>
      {e.title && <div className="mt-0.5 line-clamp-2 opacity-90">{e.title}</div>}
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 opacity-80">
        {e.room && <span className="inline-flex items-center gap-1"><DoorOpen size={12} />{e.room}</span>}
        {e.teacher && <span className="inline-flex items-center gap-1"><UserRound size={12} />{e.teacher}</span>}
      </div>
    </motion.div>
  )
}

/**
 * Weekly colour-coded timetable. Columns are the distinct time slots found in the data,
 * rows are days. `entries` is the already-filtered list from GET /api/routine.
 */
export default function RoutineGrid({ entries, loading }) {
  const t = useT()
  const { slots, days, cell } = useMemo(() => {
    const slotMap = new Map()
    const cell = {}
    entries.forEach((e) => {
      const key = `${e.start}-${e.end}`
      slotMap.set(key, { key, start: e.start, end: e.end })
      ;(cell[`${e.day}|${key}`] ||= []).push(e)
    })
    const slots = [...slotMap.values()].sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end))
    const used = new Set(entries.map((e) => e.day))
    return { slots, days: DAY_ORDER.filter((d) => used.has(d)), cell }
  }, [entries])

  if (loading) {
    return (
      <div className="glass p-4 space-y-3">
        {[...Array(5)].map((_, i) => <div key={i} className="skeleton h-16" />)}
      </div>
    )
  }
  if (!entries.length) {
    return <div className="glass p-10 text-center text-slate-400">{t('grid.none')}</div>
  }
  const agenda = DAY_ORDER.filter((d) => entries.some((e) => e.day === d)).map((d) => ({
    day: d, items: entries.filter((e) => e.day === d).sort((a, b) => a.start.localeCompare(b.start)),
  }))

  return (
    <>
    <div className="space-y-3 sm:hidden" aria-label={t('grid.agenda')}>
      {agenda.map(({ day, items }) => (
        <motion.section key={day} variants={container} initial="hidden" animate="show" className="glass p-3">
          <h3 className="mb-2 text-sm font-bold text-slate-100">{t(`day.${day}`)}</h3>
          <div className="space-y-2">
            {items.map((e) => (
              <div key={e.id} className="flex gap-3">
                <div className="w-16 shrink-0 pt-2.5 text-right text-[11px] font-semibold leading-tight text-violet-300">
                  {to12h(e.start)}<br /><span className="text-slate-500">{to12h(e.end)}</span>
                </div>
                <div className="min-w-0 flex-1"><ClassCard e={e} /></div>
              </div>
            ))}
          </div>
        </motion.section>
      ))}
      <Legend />
    </div>
    <div className="glass hidden overflow-x-auto p-3 sm:block sm:p-4">
      <AnimatePresence mode="wait">
        <motion.div
          key={entries.map((e) => e.id).join(',')}
          variants={container} initial="hidden" animate="show"
          className="grid gap-2"
          style={{ gridTemplateColumns: `88px repeat(${slots.length}, minmax(168px, 1fr))`, minWidth: 88 + slots.length * 176 }}
        >
          <div />
          {slots.map((s) => (
            <div key={s.key} className="px-1 pb-1 text-center text-xs font-semibold text-violet-300">
              {to12h(s.start)}<span className="text-slate-500"> – </span>{to12h(s.end)}
            </div>
          ))}
          {days.map((d) => (
            <div key={d} className="contents">
              <div className="sticky left-0 z-10 flex items-center rounded-xl bg-slate-900/80 px-2 text-sm font-bold text-slate-100 backdrop-blur">
                <span className="hidden sm:inline">{t(`day.${d}`)}</span><span className="sm:hidden">{d}</span>
              </div>
              {slots.map((s) => (
                <div key={s.key} className="min-h-[72px] space-y-1.5 rounded-xl bg-white/[0.02] p-1">
                  {(cell[`${d}|${s.key}`] || []).map((e) => <ClassCard key={e.id} e={e} />)}
                </div>
              ))}
            </div>
          ))}
        </motion.div>
      </AnimatePresence>
      <Legend className="mt-4 border-t border-white/10 pt-3" />
    </div>
    </>
  )
}

function Legend({ className = '' }) {
  const t = useT()
  return (
    <div className={`flex flex-wrap gap-3 text-xs text-slate-400 ${className}`}>
      {Object.entries(KIND).map(([k, v]) => (
        <span key={k} className="inline-flex items-center gap-1.5"><i className={`h-2.5 w-2.5 rounded-full ${v.dot}`} />{t(`kind.${k}`)}</span>
      ))}
    </div>
  )
}

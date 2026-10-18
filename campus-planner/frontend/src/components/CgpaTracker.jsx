import { AnimatePresence, motion } from 'framer-motion'
import { Plus, Save, Trash2, X } from 'lucide-react'
import { analytics } from '../lib/cgpa'
import { useT } from '../lib/prefs'

function SemesterCard({ sem, sgpa, grades, specials, onChange, onSave, onDelete, saving }) {
  const t = useT()
  const setCourse = (i, patch) =>
    onChange({ ...sem, dirty: true, courses: sem.courses.map((c, j) => (j === i ? { ...c, ...patch } : c)) })

  return (
    <motion.div layout initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
      className="glass p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input className="field max-w-[14rem] font-semibold" aria-label={t('cgpa.semesterName')} value={sem.name}
          onChange={(e) => onChange({ ...sem, name: e.target.value, dirty: true })} />
        <span className="rounded-lg border border-violet-400/30 bg-violet-500/10 px-2.5 py-1 text-xs font-semibold text-violet-200">
          {t('cgpa.sgpa')} {sgpa.toFixed(2)}
        </span>
        {sem.dirty && <span className="text-xs text-amber-300">{t('cgpa.unsaved')}</span>}
        <div className="ml-auto flex gap-2">
          <button className="btn-primary" disabled={saving || !sem.dirty} onClick={() => onSave(sem)}>
            <Save size={14} />{saving ? t('cgpa.saving') : t('cgpa.save')}
          </button>
          <button className="btn-danger" aria-label={t('cgpa.deleteSemester')} onClick={() => onDelete(sem)}><Trash2 size={14} /></button>
        </div>
      </div>

      <div className="space-y-2">
        <div className="hidden grid-cols-[1fr_90px_90px_32px] gap-2 px-1 text-xs text-slate-400 sm:grid">
          <span>{t('cgpa.course')}</span><span>{t('cgpa.credits')}</span><span>{t('cgpa.grade')}</span><span />
        </div>
        <AnimatePresence initial={false}>
          {sem.courses.map((c, i) => (
            <motion.div key={i} layout initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
              className="grid grid-cols-[1fr_80px_84px_32px] gap-2 sm:grid-cols-[1fr_90px_90px_32px]">
              <input className="field" placeholder={t('cgpa.courseName')} aria-label={t('cgpa.courseName')} value={c.course_name}
                onChange={(e) => setCourse(i, { course_name: e.target.value })} />
              <input className="field" type="number" min="0.5" max="12" step="0.5" aria-label={t('cgpa.credits')} value={c.credits}
                onChange={(e) => setCourse(i, { credits: e.target.value })} />
              <select className="field" aria-label={t('cgpa.grade')} value={c.grade} onChange={(e) => setCourse(i, { grade: e.target.value })}>
                {grades.map((g) => <option key={g}>{g}</option>)}
                <optgroup label={t('cgpa.notInGpa')}>
                  {Object.entries(specials).map(([g, label]) => <option key={g} value={g}>{g} · {label}</option>)}
                </optgroup>
              </select>
              <button className="text-slate-500 hover:text-rose-300" aria-label={t('cgpa.removeCourse')}
                onClick={() => onChange({ ...sem, dirty: true, courses: sem.courses.filter((_, j) => j !== i) })}>
                <X size={16} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      <button className="btn-ghost mt-3" onClick={() =>
        onChange({ ...sem, dirty: true, courses: [...sem.courses, { course_name: '', credits: 3, grade: 'A' }] })}>
        <Plus size={14} />{t('cgpa.addCourse')}
      </button>
    </motion.div>
  )
}

/** Controlled list of semester editors. Parent owns `sems` so charts update live. */
export default function CgpaTracker({ sems, setSems, onSave, onDelete, savingKey, meta }) {
  const t = useT()
  const a = analytics(sems, meta)
  const grades = Object.keys(meta.scale)
  const sgpaOf = (key) => a.rows.find((r) => r.key === key)?.sgpa ?? 0
  return (
    <div className="space-y-4">
      {meta.policy === 'latest' && (
        <p className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-slate-400">
          {t('cgpa.retakeNote')}
        </p>
      )}
      <AnimatePresence>
        {sems.map((s) => (
          <SemesterCard key={s.key} sem={s} sgpa={sgpaOf(s.key)} saving={savingKey === s.key}
            grades={grades} specials={meta.specials}
            onChange={(n) => setSems((all) => all.map((x) => (x.key === s.key ? n : x)))}
            onSave={onSave} onDelete={onDelete} />
        ))}
      </AnimatePresence>
      <button className="btn-primary" onClick={() =>
        setSems((all) => [...all, { key: `new-${Date.now()}`, name: t('cgpa.defaultName', { n: all.length + 1 }), dirty: true,
          courses: [{ course_name: '', credits: 3, grade: 'A' }] }])}>
        <Plus size={16} />{t('cgpa.addSemester')}
      </button>
    </div>
  )
}

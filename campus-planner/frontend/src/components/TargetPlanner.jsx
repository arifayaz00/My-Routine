import { useState } from 'react'
import { Target } from 'lucide-react'
import { requiredSgpa } from '../lib/cgpa'
import { useT } from '../lib/prefs'

/** "What SGPA do I need next semester to reach CGPA X?" */
export default function TargetPlanner({ a, scale }) {
  const t = useT()
  const [target, setTarget] = useState('3.75')
  const [credits, setCredits] = useState('15')
  const r = a.totalCredits ? requiredSgpa(a, Number(target), Number(credits), scale) : null
  return (
    <div className="glass p-4">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-300"><Target size={15} />{t('target.title')}</h3>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label" htmlFor="tp-target">{t('target.cgpa')}</label>
          <input id="tp-target" className="field" type="number" min="0" max="4" step="0.01" value={target} onChange={(e) => setTarget(e.target.value)} /></div>
        <div><label className="label" htmlFor="tp-credits">{t('target.credits')}</label>
          <input id="tp-credits" className="field" type="number" min="1" max="30" step="0.5" value={credits} onChange={(e) => setCredits(e.target.value)} /></div>
      </div>
      <p className="mt-3 text-sm" aria-live="polite">
        {!r ? <span className="text-slate-400">{t('target.addGraded')}</span>
          : r.alreadyThere ? <span className="text-emerald-300">{t('target.stays', { t: Number(target).toFixed(2) })}</span>
          : r.feasible ? <span className="text-slate-200">{t('target.need', { n: r.needed.toFixed(2) })}</span>
          : <span className="text-rose-300">{t('target.no', { n: r.needed.toFixed(2), m: r.max.toFixed(2) })}</span>}
      </p>
    </div>
  )
}

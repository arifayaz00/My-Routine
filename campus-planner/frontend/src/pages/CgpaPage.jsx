import { useEffect, useMemo, useState } from 'react'
import { FileDown } from 'lucide-react'
import CgpaChart from '../components/CgpaChart'
import CgpaTracker from '../components/CgpaTracker'
import { api, download } from '../lib/api'
import { DEFAULT_SCALE, DEFAULT_SPECIALS, analytics } from '../lib/cgpa'
import { useT } from '../lib/prefs'

const toDraft = (s) => ({ key: `s-${s.id}`, id: s.id, name: s.name, dirty: false,
  courses: s.courses.map(({ course_name, credits, grade }) => ({ course_name, credits, grade })) })

export default function CgpaPage({ toast }) {
  const t = useT()
  const [sems, setSems] = useState(null)
  const [meta, setMeta] = useState({ scale: DEFAULT_SCALE, specials: DEFAULT_SPECIALS, policy: 'latest' })
  const [savingKey, setSavingKey] = useState(null)

  useEffect(() => {
    api.get('/cgpa').then((d) => { setMeta({ scale: d.scale, specials: d.specials, policy: d.policy }); setSems(d.semesters.map(toDraft)) })
      .catch((e) => toast(e.message, 'error'))
  }, [toast])
  const a = useMemo(() => analytics(sems || [], meta), [sems, meta])

  const save = async (s) => {
    const body = { name: s.name, courses: s.courses.filter((c) => c.course_name.trim()).map((c) => ({ ...c, credits: Number(c.credits) })) }
    setSavingKey(s.key)
    try {
      const d = s.id ? await api.put(`/cgpa/semesters/${s.id}`, body) : await api.post('/cgpa/semesters', body)
      const saved = d.semesters.map(toDraft)
      setSems((all) => {  // keep other unsaved drafts; swap this one for the server copy
        const idx = all.findIndex((x) => x.key === s.key)
        const fresh = s.id ? saved.find((x) => x.id === s.id) : saved[saved.length - 1]
        return all.map((x, i) => (i === idx ? fresh : x))
      })
      toast(t('cgpa.saved'), 'success')
    } catch (e) { toast(e.message, 'error') } finally { setSavingKey(null) }
  }
  const remove = async (s) => {
    try { if (s.id) await api.del(`/cgpa/semesters/${s.id}`); setSems((all) => all.filter((x) => x.key !== s.key)) }
    catch (e) { toast(e.message, 'error') }
  }

  if (!sems) return <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="skeleton h-28" />)}</div>

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">{t('cgpa.semesters')}</h2>
          <button className="btn-ghost" onClick={() => download('/cgpa/report.pdf', 'academic-report.pdf').catch((e) => toast(e.message, 'error'))}>
            <FileDown size={16} />{t('cgpa.report')}
          </button>
        </div>
        <CgpaTracker sems={sems} setSems={setSems} onSave={save} onDelete={remove} savingKey={savingKey} meta={meta} />
      </div>
      <div className="lg:sticky lg:top-4 lg:self-start"><CgpaChart a={a} scale={meta.scale} /></div>
    </div>
  )
}

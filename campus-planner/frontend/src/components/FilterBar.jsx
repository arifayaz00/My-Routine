/** Cascading Department -> Batch -> Section selects, plus an optional teacher filter.
 *  `tree` = GET /api/routine/filters, `teachers` = GET /api/routine/teachers. */
import { useT } from '../lib/prefs'

export default function FilterBar({ tree, value, onChange, teachers }) {
  const t = useT()
  const departments = Object.keys(tree)
  const batches = value.department ? Object.keys(tree[value.department] || {}) : []
  const sections = value.department && value.batch ? tree[value.department]?.[value.batch] || [] : []
  const set = (patch) => onChange({ ...value, ...patch })
  const cols = teachers ? 'sm:grid-cols-4' : 'sm:grid-cols-3'

  return (
    <div className={`glass grid gap-3 p-4 ${cols}`}>
      <div>
        <label className="label" htmlFor="f-dept">{t('filter.department')}</label>
        <select id="f-dept" className="field" value={value.department}
          onChange={(e) => set({ department: e.target.value, batch: '', section: '' })}>
          <option value="">{t('filter.allDepartments')}</option>
          {departments.map((d) => <option key={d}>{d}</option>)}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="f-batch">{t('filter.batch')}</label>
        <select id="f-batch" className="field" value={value.batch} disabled={!value.department}
          onChange={(e) => set({ batch: e.target.value, section: '' })}>
          <option value="">{t('filter.allBatches')}</option>
          {batches.map((b) => <option key={b}>{b}</option>)}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="f-sec">{t('filter.section')}</label>
        <select id="f-sec" className="field" value={value.section} disabled={!sections.length}
          onChange={(e) => set({ section: e.target.value })}>
          <option value="">{t('filter.allSections')}</option>
          {sections.map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>
      {teachers && (
        <div>
          <label className="label" htmlFor="f-teacher">{t('filter.teacher')}</label>
          <select id="f-teacher" className="field" value={value.teacher || ''} onChange={(e) => set({ teacher: e.target.value })}>
            <option value="">{t('filter.anyTeacher')}</option>
            {teachers.map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
      )}
    </div>
  )
}

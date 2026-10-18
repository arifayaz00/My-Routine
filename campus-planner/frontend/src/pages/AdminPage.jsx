import { useCallback, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import {
  AlertTriangle, Bell, CheckCircle2, Copy, Database, FileUp, History, Loader2, Pencil, Plus, RotateCcw,
  Trash2, Users, XCircle,
} from 'lucide-react'
import FilterBar from '../components/FilterBar'
import { api } from '../lib/api'
import { DAY_ORDER, KIND } from '../lib/theme'

const fmt = (iso) => (iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '-')

/** Two-step button: first click asks, second click does it. (No window.confirm, so it works everywhere.) */
function ConfirmButton({ onConfirm, children, label = 'Sure?', className = 'btn-danger', ...rest }) {
  const [armed, setArmed] = useState(false)
  useEffect(() => { if (!armed) return; const t = setTimeout(() => setArmed(false), 3500); return () => clearTimeout(t) }, [armed])
  return (
    <button className={className} {...rest} onClick={() => (armed ? (setArmed(false), onConfirm()) : setArmed(true))}>
      {armed ? label : children}
    </button>
  )
}

const STATUS = {
  draft: 'border-amber-400/40 bg-amber-400/10 text-amber-200',
  published: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200',
  failed: 'border-rose-400/40 bg-rose-400/10 text-rose-200',
  rolled_back: 'border-slate-400/40 bg-slate-400/10 text-slate-300',
  discarded: 'border-slate-400/40 bg-slate-400/10 text-slate-300',
}
const Chip = ({ s }) => <span className={`rounded-full border px-2 py-0.5 text-xs ${STATUS[s] || ''}`}>{s.replace('_', ' ')}</span>

function Overview({ toast }) {
  const [s, setS] = useState(null)
  const [cfg, setCfg] = useState({ semester_start: '', semester_end: '' })
  useEffect(() => {
    api.get('/admin/stats').then(setS).catch(() => {})
    api.get('/admin/settings').then((c) => setCfg({ semester_start: c.semester_start || '', semester_end: c.semester_end || '' })).catch(() => {})
  }, [])
  const saveCfg = async (e) => {
    e.preventDefault()
    try { await api.put('/admin/settings', { semester_start: cfg.semester_start || null, semester_end: cfg.semester_end || null }); toast('Semester dates saved. Calendar feeds now follow them.', 'success') }
    catch (x) { toast(x.message, 'error') }
  }
  if (!s) return <div className="skeleton h-24" />
  const cards = [['Students', s.students, `${s.students_7d} new this week`], ['Batches with classes', s.batches, `${s.courses} courses`],
    ['Routine entries', s.entries, `${s.uploads} upload${s.uploads === 1 ? "" : "s"}`], ['Schedule clashes', s.conflicts, s.conflicts ? 'review in Edit routine' : 'none found']]
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map(([l, v, sub]) => (
          <motion.div key={l} whileHover={{ y: -3 }} className="glass flex items-center gap-3 p-4">
            <Database className="shrink-0 text-violet-300" />
            <div className="min-w-0"><div className="text-2xl font-extrabold">{v}</div><div className="text-xs text-slate-300">{l}</div><div className="truncate text-[11px] text-slate-500">{sub}</div></div>
          </motion.div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <form onSubmit={saveCfg} className="glass space-y-3 p-4">
          <h3 className="font-bold">Semester dates</h3>
          <p className="text-xs text-slate-400">Calendar feeds repeat classes from the start date until the end date. Leave empty to repeat from today for 16 weeks.</p>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label" htmlFor="sd-start">First day</label><input id="sd-start" type="date" className="field" value={cfg.semester_start} onChange={(e) => setCfg({ ...cfg, semester_start: e.target.value })} /></div>
            <div><label className="label" htmlFor="sd-end">Last day</label><input id="sd-end" type="date" className="field" value={cfg.semester_end} onChange={(e) => setCfg({ ...cfg, semester_end: e.target.value })} /></div>
          </div>
          <button className="btn-primary">Save dates</button>
        </form>
        <div className="glass p-4 text-sm">
          <h3 className="mb-2 font-bold">Last publish</h3>
          <p className="text-slate-300">{s.last_publish ? fmt(s.last_publish) : 'Nothing published yet'}</p>
          <h3 className="mb-2 mt-4 font-bold">Batches per department</h3>
          {s.by_department.map((d) => <div key={d.department} className="flex justify-between border-t border-white/5 py-1.5"><span>{d.department}</span><span className="text-slate-400">{d.batches}</span></div>)}
          {!s.by_department.length && <p className="text-slate-500">No data yet</p>}
        </div>
      </div>
    </div>
  )
}

function Review({ pv, onDone, toast }) {
  const [busy, setBusy] = useState(false)
  const [showRows, setShowRows] = useState(false)
  const act = async (a) => {
    setBusy(true)
    try { await api.post(`/admin/uploads/${pv.id}/${a}`); toast(a === 'publish' ? 'Published. Students see it now.' : 'Draft discarded', 'success'); onDone() }
    catch (e) { toast(e.message, 'error') } finally { setBusy(false) }
  }
  return (
    <div className="glass space-y-4 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-bold">Review before publishing</h3><Chip s={pv.status} />
        <span className="text-xs text-slate-400">{pv.filename}{pv.term ? ` · ${pv.term}` : ''}</span>
        {pv.status === 'draft' && (
          <div className="ml-auto flex gap-2">
            <button className="btn-primary" disabled={busy} onClick={() => act('publish')}><CheckCircle2 size={16} />Publish {pv.entries.length} classes</button>
            <ConfirmButton className="btn-ghost" disabled={busy} onConfirm={() => act('discard')}>Discard</ConfirmButton>
          </div>
        )}
      </div>
      <p className="text-xs text-slate-400">Nothing changes for students until you publish. Publishing replaces the PDF-based classes of the batches below. Classes you edited by hand are kept.</p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-left text-sm">
          <thead className="text-xs text-slate-400"><tr><th className="p-2">Department</th><th className="p-2">Batch</th><th className="p-2">Section</th><th className="p-2">Classes in PDF</th><th className="p-2">Live now</th></tr></thead>
          <tbody className="divide-y divide-white/5">
            {pv.per_batch.map((b, i) => (
              <tr key={i}><td className="p-2">{b.department}</td><td className="p-2">{b.batch}</td><td className="p-2">{b.section || '-'}</td>
                <td className="p-2 font-semibold">{b.new}</td>
                <td className="p-2 text-slate-400">{b.is_new_batch ? <span className="text-emerald-300">new batch</span> : b.current}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      {pv.warnings.length > 0 && (
        <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-100">
          <b className="flex items-center gap-2"><AlertTriangle size={15} />{pv.warnings.length} thing(s) the parser could not read</b>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs">{pv.warnings.slice(0, 12).map((w, i) => <li key={i}>{w}</li>)}</ul>
          <p className="mt-1 text-xs opacity-80">You can add or fix these classes in the Edit routine tab after publishing.</p>
        </div>
      )}
      {pv.conflicts.length > 0 && (
        <div className="rounded-xl border border-rose-400/30 bg-rose-400/10 p-3 text-sm text-rose-100">
          <b className="flex items-center gap-2"><AlertTriangle size={15} />{pv.conflicts.length} clash(es) in this PDF</b>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs">{pv.conflicts.slice(0, 12).map((c, i) => <li key={i}><b>{c.type}</b> · {c.when}: {c.message}</li>)}</ul>
          <p className="mt-1 text-xs opacity-80">Clashes can be real (a mistake in the PDF) or a misread cell. Check the source before publishing.</p>
        </div>
      )}
      <button className="text-sm text-violet-300 hover:underline" onClick={() => setShowRows(!showRows)}>{showRows ? 'Hide' : 'Show'} all parsed classes</button>
      {showRows && (
        <div className="max-h-80 overflow-auto rounded-xl border border-white/10">
          <table className="w-full min-w-[640px] text-left text-xs">
            <thead className="sticky top-0 bg-slate-900 text-slate-400"><tr>{['Batch', 'Day', 'Time', 'Course', 'Room', 'Teacher', 'Type'].map((h) => <th key={h} className="p-2 font-medium">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-white/5">
              {pv.entries.map((e, i) => <tr key={i}><td className="p-2">{e.batch}{e.section}</td><td className="p-2">{e.day}</td><td className="p-2 whitespace-nowrap">{e.start}–{e.end}</td><td className="p-2">{e.code}</td><td className="p-2">{e.room}</td><td className="p-2">{e.teacher}</td><td className="p-2">{e.kind}</td></tr>)}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Uploads({ toast }) {
  const [list, setList] = useState([])
  const [busy, setBusy] = useState(false)
  const [term, setTerm] = useState('')
  const [pv, setPv] = useState(null)
  const [failed, setFailed] = useState(null)
  const input = useRef()
  const refresh = useCallback(() => api.get('/admin/uploads').then(setList), [])
  useEffect(() => { refresh() }, [refresh])

  const open = async (id) => { try { setFailed(null); setPv(await api.get(`/admin/uploads/${id}/preview`)) } catch (e) { toast(e.message, 'error') } }
  const send = async (file) => {
    if (!file) return
    setBusy(true); setPv(null); setFailed(null)
    try {
      const r = await api.upload('/admin/uploads', file, { term })
      if (r.status === 'draft') await open(r.id); else setFailed(r)
      refresh()
    } catch (e) { toast(e.message, 'error') } finally { setBusy(false); input.current.value = '' }
  }
  const rollback = async (u) => {
    try { await api.post(`/admin/uploads/${u.id}/rollback`); toast('Rolled back to the previous routine', 'success'); refresh() } catch (e) { toast(e.message, 'error') }
  }
  const latestPublished = list.find((u) => u.status === 'published')?.id

  return (
    <div className="space-y-4">
      <div className="glass flex flex-col items-center gap-3 border-dashed p-8 text-center"
        onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); send(e.dataTransfer.files[0]) }}>
        {busy ? <><Loader2 className="animate-spin text-violet-300" size={32} /><div className="skeleton h-3 w-48" /><p className="text-sm text-slate-400">Reading the PDF…</p></>
          : <><FileUp size={32} className="text-violet-300" /><p className="text-sm text-slate-300">Drop a routine PDF here. You review it before anything goes live.</p>
            <div className="flex flex-wrap items-end justify-center gap-3">
              <div><label className="label" htmlFor="up-term">Term (optional)</label><input id="up-term" className="field w-44" placeholder="Fall 2026" value={term} onChange={(e) => setTerm(e.target.value)} /></div>
              <button className="btn-primary" onClick={() => input.current.click()}>Choose PDF</button>
            </div></>}
        <input ref={input} type="file" accept="application/pdf" hidden onChange={(e) => send(e.target.files[0])} />
      </div>

      {failed && (
        <div className="glass border-rose-400/30 p-4">
          <b className="flex items-center gap-2 text-rose-200"><XCircle size={16} />Could not read this PDF</b>
          <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-black/30 p-3 text-xs text-slate-300">{failed.log}</pre>
        </div>
      )}
      {pv && <Review pv={pv} toast={toast} onDone={() => { setPv(null); refresh() }} />}

      <div className="glass divide-y divide-white/5">
        <div className="flex items-center gap-2 p-3 text-sm font-semibold"><History size={15} />Upload history</div>
        {list.length === 0 && <p className="p-6 text-center text-sm text-slate-400">No uploads yet.</p>}
        {list.map((u) => (
          <div key={u.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
            <Chip s={u.status} />
            <span className="min-w-0 flex-1 truncate">{u.filename}{u.term ? <span className="text-slate-400"> · {u.term}</span> : ''}</span>
            <span className="text-xs text-slate-400">{u.entries} classes · {u.batches} batches · {fmt(u.published_at || u.created_at)}</span>
            {u.status === 'draft' && <button className="btn-ghost" onClick={() => open(u.id)}>Review</button>}
            {u.id === latestPublished && <ConfirmButton className="btn-ghost" label="Roll back?" onConfirm={() => rollback(u)}><RotateCcw size={14} />Roll back</ConfirmButton>}
          </div>
        ))}
      </div>
    </div>
  )
}

const EMPTY = { department: '', batch: '', section: '', code: '', title: '', day: 'Sat', start: '09:00', end: '10:30', room: '', teacher: '', kind: 'theory' }

function Entries({ toast }) {
  const [tree, setTree] = useState({})
  const [filter, setFilter] = useState({ department: '', batch: '', section: '' })
  const [rows, setRows] = useState([])
  const [clashes, setClashes] = useState([])
  const [edit, setEdit] = useState(null)
  const load = useCallback(() => {
    const q = new URLSearchParams(Object.entries(filter).filter(([, v]) => v)).toString()
    api.get(`/admin/entries?${q}`).then(setRows).catch((e) => toast(e.message, 'error'))
    api.get('/admin/conflicts').then(setClashes).catch(() => {})
    api.get('/routine/filters').then(setTree).catch(() => {})
  }, [filter, toast])
  useEffect(() => { load() }, [load])
  const clashIds = new Set(clashes.flatMap((c) => c.ids))

  const save = async () => {
    try {
      if (edit.id) await api.patch(`/admin/entries/${edit.id}`, { day: edit.day, start_time: edit.start, end_time: edit.end, room: edit.room, teacher: edit.teacher, kind: edit.kind, title: edit.title })
      else await api.post('/admin/entries', { department: edit.department, batch: edit.batch, section: edit.section, code: edit.code, title: edit.title, day: edit.day, start_time: edit.start, end_time: edit.end, room: edit.room, teacher: edit.teacher, kind: edit.kind })
      setEdit(null); load(); toast('Saved and pushed live', 'success')
    } catch (e) { toast(e.message, 'error') }
  }
  const del = async (r) => { try { await api.del(`/admin/entries/${r.id}`); load() } catch (e) { toast(e.message, 'error') } }
  const set = (k) => (e) => setEdit({ ...edit, [k]: e.target.value })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1"><FilterBar tree={tree} value={filter} onChange={setFilter} /></div>
        <button className="btn-primary" onClick={() => setEdit({ ...EMPTY, ...filter })}><Plus size={16} />Add class</button>
      </div>
      {clashes.length > 0 && (
        <div className="rounded-xl border border-rose-400/30 bg-rose-400/10 p-3 text-sm text-rose-100">
          <b className="flex items-center gap-2"><AlertTriangle size={15} />{clashes.length} clash(es) in the live routine (rows highlighted)</b>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs">{clashes.slice(0, 6).map((c, i) => <li key={i}><b>{c.type}</b> · {c.when}: {c.message}</li>)}</ul>
        </div>
      )}
      <div className="glass overflow-x-auto">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead className="text-xs text-slate-400"><tr>{['Course', 'Batch', 'Day', 'Time', 'Room', 'Teacher', 'Type', ''].map((h) => <th key={h} className="p-3 font-medium">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-white/5">
            {rows.map((r) => (
              <tr key={r.id} className={clashIds.has(r.id) ? 'bg-rose-500/10' : 'hover:bg-white/5'}>
                <td className="p-3 font-semibold">{clashIds.has(r.id) && <AlertTriangle size={13} className="mr-1 inline text-rose-300" aria-label="clash" />}{r.code}{r.is_manual && <span className="ml-2 rounded bg-amber-400/15 px-1.5 text-[10px] text-amber-200">edited</span>}</td>
                <td className="p-3">{r.batch}{r.section}</td><td className="p-3">{r.day}</td>
                <td className="p-3 whitespace-nowrap">{r.start}–{r.end}</td><td className="p-3">{r.room}</td><td className="p-3">{r.teacher}</td>
                <td className="p-3"><span className={`rounded-full border px-2 py-0.5 text-xs ${KIND[r.kind]?.cls}`}>{r.kind}</span></td>
                <td className="whitespace-nowrap p-3 text-right">
                  <button className="p-1.5 text-slate-400 hover:text-violet-300" aria-label="Edit" onClick={() => setEdit({ ...r })}><Pencil size={15} /></button>
                  <ConfirmButton className="rounded p-1.5 text-slate-400 hover:text-rose-300" label="Delete?" aria-label="Delete" onConfirm={() => del(r)}><Trash2 size={15} /></ConfirmButton>
                </td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={8} className="p-6 text-center text-slate-400">No classes yet.</td></tr>}
          </tbody>
        </table>
      </div>
      {edit && (
        <div className="fixed inset-0 z-40 grid place-items-center overflow-y-auto bg-black/60 p-4" onClick={() => setEdit(null)}>
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} onClick={(e) => e.stopPropagation()} className="glass w-full max-w-md space-y-3 bg-slate-900 p-5">
            <h3 className="font-bold">{edit.id ? `Edit ${edit.code}` : 'Add class'}</h3>
            {!edit.id && (
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><label className="label" htmlFor="e-dept">Department</label><input id="e-dept" className="field" value={edit.department} onChange={set('department')} /></div>
                <div><label className="label" htmlFor="e-batch">Batch</label><input id="e-batch" className="field" value={edit.batch} onChange={set('batch')} /></div>
                <div><label className="label" htmlFor="e-sec">Section</label><input id="e-sec" className="field" value={edit.section} onChange={set('section')} /></div>
                <div className="col-span-2"><label className="label" htmlFor="e-code">Course code</label><input id="e-code" className="field" placeholder="SWE-101" value={edit.code} onChange={set('code')} /></div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label" htmlFor="e-day">Day</label><select id="e-day" className="field" value={edit.day} onChange={set('day')}>{DAY_ORDER.map((d) => <option key={d}>{d}</option>)}</select></div>
              <div><label className="label" htmlFor="e-kind">Type</label><select id="e-kind" className="field" value={edit.kind} onChange={set('kind')}>{Object.keys(KIND).map((k) => <option key={k}>{k}</option>)}</select></div>
              <div><label className="label" htmlFor="e-start">Start (24h)</label><input id="e-start" className="field" type="time" value={edit.start} onChange={set('start')} /></div>
              <div><label className="label" htmlFor="e-end">End (24h)</label><input id="e-end" className="field" type="time" value={edit.end} onChange={set('end')} /></div>
              <div><label className="label" htmlFor="e-room">Room</label><input id="e-room" className="field" value={edit.room} onChange={set('room')} /></div>
              <div><label className="label" htmlFor="e-teacher">Teacher</label><input id="e-teacher" className="field" value={edit.teacher} onChange={set('teacher')} /></div>
            </div>
            <div><label className="label" htmlFor="e-title">Course title</label><input id="e-title" className="field" value={edit.title} onChange={set('title')} /></div>
            <div className="flex justify-end gap-2"><button className="btn-ghost" onClick={() => setEdit(null)}>Cancel</button><button className="btn-primary" onClick={save}>Save & publish</button></div>
          </motion.div>
        </div>
      )}
    </div>
  )
}

function Notices({ toast }) {
  const [f, setF] = useState({ title: '', body: '', level: 'info' })
  const [list, setList] = useState([])
  const load = () => api.get('/notices').then(setList)
  useEffect(() => { load() }, [])
  const send = async (e) => {
    e.preventDefault()
    try { await api.post('/admin/notices', f); setF({ title: '', body: '', level: 'info' }); load(); toast('Notice sent to every open dashboard', 'success') }
    catch (x) { toast(x.message, 'error') }
  }
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <form onSubmit={send} className="glass space-y-3 p-4">
        <h3 className="flex items-center gap-2 font-bold"><Bell size={16} />Broadcast notice</h3>
        <input className="field" aria-label="Title" placeholder="Title" required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        <textarea className="field min-h-24" aria-label="Details" placeholder="Details (optional)" value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} />
        <select className="field" aria-label="Level" value={f.level} onChange={(e) => setF({ ...f, level: e.target.value })}>
          <option value="info">Info</option><option value="change">Routine change</option><option value="urgent">Urgent</option>
        </select>
        <button className="btn-primary">Send</button>
      </form>
      <div className="glass divide-y divide-white/5">
        {list.map((n) => (
          <div key={n.id} className="flex items-start gap-3 p-3 text-sm">
            <div className="min-w-0 flex-1"><b>{n.title}</b> <span className="text-xs text-slate-400">· {n.level} · {fmt(n.created_at)}</span><p className="text-slate-400">{n.body}</p></div>
            <ConfirmButton className="text-slate-500 hover:text-rose-300" label="Delete?" aria-label="Delete notice" onConfirm={async () => { await api.del(`/admin/notices/${n.id}`); load() }}><Trash2 size={15} /></ConfirmButton>
          </div>
        ))}
        {!list.length && <p className="p-6 text-center text-slate-400">No notices.</p>}
      </div>
    </div>
  )
}

function UsersTab({ toast }) {
  const [list, setList] = useState([])
  const [temp, setTemp] = useState(null)
  useEffect(() => { api.get('/admin/users').then(setList).catch((e) => toast(e.message, 'error')) }, [toast])
  const reset = async (u) => {
    try { setTemp(await api.post(`/admin/users/${u.id}/reset-password`)) } catch (e) { toast(e.message, 'error') }
  }
  const copy = async () => { try { await navigator.clipboard.writeText(temp.temporary_password); toast('Copied', 'success') } catch { toast('Select the password and copy it manually', 'info') } }
  return (
    <div className="space-y-4">
      {temp && (
        <div className="glass border-emerald-400/30 p-4 text-sm">
          <b>Temporary password for {temp.email}</b>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code className="select-all rounded-lg bg-black/40 px-3 py-1.5 text-emerald-200">{temp.temporary_password}</code>
            <button className="btn-ghost" onClick={copy}><Copy size={14} />Copy</button>
          </div>
          <p className="mt-2 text-xs text-slate-400">Shown once. Give it to the student; they can change it under Account. They were signed out on every device.</p>
        </div>
      )}
      <div className="glass overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="text-xs text-slate-400"><tr>{['Name', 'Email', 'Role', 'Joined', ''].map((h) => <th key={h} className="p-3 font-medium">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-white/5">
            {list.map((u) => (
              <tr key={u.id}><td className="p-3">{u.name}</td><td className="p-3">{u.email}</td><td className="p-3">{u.role}</td><td className="p-3 whitespace-nowrap">{fmt(u.created_at)}</td>
                <td className="p-3 text-right"><ConfirmButton className="btn-ghost" label="Reset password?" onConfirm={() => reset(u)}>Reset password</ConfirmButton></td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function AuditTab() {
  const [list, setList] = useState([])
  useEffect(() => { api.get('/admin/audit').then(setList).catch(() => {}) }, [])
  return (
    <div className="glass overflow-x-auto">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead className="text-xs text-slate-400"><tr>{['When', 'Who', 'Action', 'Detail'].map((h) => <th key={h} className="p-3 font-medium">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-white/5">
          {list.map((a) => <tr key={a.id}><td className="p-3 whitespace-nowrap text-slate-400">{fmt(a.created_at)}</td><td className="p-3">{a.user}</td><td className="p-3 font-semibold">{a.action}</td><td className="p-3 text-slate-300">{a.detail}</td></tr>)}
          {!list.length && <tr><td colSpan={4} className="p-6 text-center text-slate-400">No admin actions recorded yet.</td></tr>}
        </tbody>
      </table>
    </div>
  )
}

const TABS = [['overview', 'Overview'], ['uploads', 'PDF uploads'], ['entries', 'Edit routine'], ['notices', 'Notices'], ['users', 'Students'], ['audit', 'Activity log']]
export default function AdminPage({ toast }) {
  const [tab, setTab] = useState('overview')
  return (
    <div className="space-y-4">
      <div className="flex gap-1 overflow-x-auto" role="tablist">
        {TABS.map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`relative whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium ${tab === k ? 'text-white' : 'text-slate-400 hover:text-slate-200'}`}>
            {tab === k && <motion.span layoutId="admin-tab" className="absolute inset-0 rounded-lg bg-violet-500/25" />}
            <span className="relative">{l}</span>
          </button>
        ))}
      </div>
      <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        {tab === 'overview' && <Overview toast={toast} />}
        {tab === 'uploads' && <Uploads toast={toast} />}
        {tab === 'entries' && <Entries toast={toast} />}
        {tab === 'notices' && <Notices toast={toast} />}
        {tab === 'users' && <UsersTab toast={toast} />}
        {tab === 'audit' && <AuditTab />}
      </motion.div>
    </div>
  )
}

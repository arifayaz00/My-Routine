// Demo mode: replaces fetch/EventSource with an in-memory fake API so the UI runs with no backend.
const E = (id, department, batch, section, day, start, end, code, title, room, teacher, kind) =>
  ({ id, department, batch, section, day, start, end, code, title, room, teacher, kind, is_manual: false, updated_at: new Date().toISOString() })
const SWE = 'Software Engineering', CSE = 'Computer Science & Engineering'
let entries = [
  E(1, SWE, '40', 'A', 'Sat', '09:00', '10:30', 'SWE-101', 'Intro to Programming', '301', 'Dr. Rahim', 'theory'),
  E(2, SWE, '40', 'A', 'Sat', '10:30', '12:00', 'SWE-103', 'Discrete Mathematics', '302', 'Prof. Salma', 'theory'),
  E(3, SWE, '40', 'A', 'Sat', '14:00', '15:30', 'SWE-102', 'Programming Lab', '405', 'Md. Karim', 'lab'),
  E(4, SWE, '40', 'A', 'Sun', '09:00', '10:30', 'SWE-201', 'Data Structures', '302', 'Dr. Rahim', 'theory'),
  E(5, SWE, '40', 'A', 'Sun', '14:00', '15:30', 'SWE-202', 'Data Structures Lab', '406', 'Md. Karim', 'lab'),
  E(6, SWE, '40', 'A', 'Mon', '10:30', '12:00', 'SWE-211', 'Software Design Elective', '210', 'Prof. Jalil', 'elective'),
  E(7, SWE, '40', 'A', 'Mon', '14:00', '15:30', 'SWE-103', 'Discrete Mathematics', '302', 'Prof. Salma', 'theory'),
  E(8, SWE, '40', 'A', 'Tue', '09:00', '10:30', 'SWE-300', 'Capstone Project', '101', 'Dr. Jalil', 'project'),
  E(9, SWE, '40', 'A', 'Tue', '10:30', '12:00', 'SWE-101', 'Makeup Class (Substitute)', '301', 'Dr. Rahim', 'exam'),
  E(10, SWE, '40', 'A', 'Wed', '09:00', '10:30', 'SWE-201', 'Data Structures', '302', 'Dr. Rahim', 'theory'),
  E(11, SWE, '40', 'B', 'Sat', '09:00', '10:30', 'SWE-101', 'Intro to Programming', '303', 'Dr. Nasrin', 'theory'),
  E(12, CSE, '38', 'B', 'Mon', '09:00', '10:30', 'CSE-310', 'Artificial Intelligence', '210', 'Prof. Salma', 'elective'),
  E(13, CSE, '38', 'B', 'Tue', '14:00', '15:30', 'CSE-400', 'Thesis Project', '101', 'Dr. Jalil', 'project'),
]
let notices = [
  { id: 2, title: 'SWE-101 Tuesday makeup class', body: 'Room 301, 10:30 AM. Attendance counts.', level: 'change', created_at: new Date(Date.now() - 36e5).toISOString() },
  { id: 1, title: 'Midterm schedule published', body: 'See the department notice board.', level: 'info', created_at: new Date(Date.now() - 864e5).toISOString() },
]
let uploads = [{ id: 1, filename: 'routine-fall-2026.pdf', status: 'success', entries: 13, batches: 4, created_at: new Date(Date.now() - 2 * 864e5).toISOString(),
  log: 'Opened PDF: 4 page(s)\np1: Software Engineering / batch 40 / sec A -> 10 entries\np2: Software Engineering / batch 40 / sec B -> 1 entries\np3: Computer Science & Engineering / batch 38 / sec B -> 2 entries\nWARN p4: table without recognisable day/time header skipped' }]
const mk = (id, name, rows) => ({ id, name, courses: rows.map(([course_name, credits, grade]) => ({ course_name, credits, grade })) })
let sems = [
  mk(1, 'Semester 1', [['Calculus I', 3, 'A'], ['Physics I', 3, 'B+'], ['English', 3, 'A-'], ['Intro to Programming', 3, 'A+'], ['Programming Lab', 1.5, 'A']]),
  mk(2, 'Semester 2', [['Calculus II', 3, 'B'], ['Discrete Math', 3, 'B+'], ['Data Structures', 3, 'A-'], ['DS Lab', 1.5, 'A']]),
  mk(3, 'Semester 3', [['Algorithms', 3, 'A'], ['Digital Logic', 3, 'A-'], ['OOP', 3, 'A+'], ['OOP Lab', 1.5, 'A+']]),
  mk(4, 'Semester 4', [['Database', 3, 'A+'], ['Operating Systems', 3, 'A'], ['Software Design', 3, 'A+'], ['DB Lab', 1.5, 'A+']]),
]
let nextId = 100
const tree = () => entries.reduce((t, e) => { ((t[e.department] ||= {})[e.batch] ||= []); if (!t[e.department][e.batch].includes(e.section)) t[e.department][e.batch].push(e.section); return t }, {})
const user = { id: 1, name: 'Admin (demo)', email: 'admin@demo', role: 'admin', prefs: { department: SWE, batch: '40', section: 'A' } }
const json = (d, s = 200) => new Response(s === 204 ? null : JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json' } })
const iso = (msAgo = 0) => new Date(Date.now() - msAgo).toISOString()
const SCALE = { 'A+': 4, A: 3.75, 'A-': 3.5, 'B+': 3.25, B: 3, 'B-': 2.75, 'C+': 2.5, C: 2.25, D: 2, F: 0 }
const SPECIALS = { P: 'Pass (non-credit)', W: 'Withdrawn', I: 'Incomplete', T: 'Transfer credit' }
let settings = { semester_start: '2026-09-05', semester_end: '2026-12-24' }
let users = [
  { id: 1, name: 'Admin (demo)', email: 'admin@demo', role: 'admin', created_at: iso(30 * 864e5) },
  { id: 2, name: 'Rafi Ahmed', email: 'rafi@example.com', role: 'user', created_at: iso(3 * 864e5) },
  { id: 3, name: 'Nusrat Jahan', email: 'nusrat@example.com', role: 'user', created_at: iso(864e5) },
]
let audit = [
  { id: 3, user: 'admin@demo', action: 'publish', detail: 'routine-fall-2026.pdf (13 rows)', created_at: iso(2 * 864e5) },
  { id: 2, user: 'admin@demo', action: 'upload', detail: 'routine-fall-2026.pdf', created_at: iso(2 * 864e5 + 6e4) },
  { id: 1, user: 'admin@demo', action: 'notice', detail: 'Midterm schedule published', created_at: iso(864e5) },
]
const sampleDraft = () => ({
  entries: entries.slice(0, 6).map((e) => ({ ...e })),
  warnings: ['p3: unrecognised cell \'Dept. meeting 2pm\'', 'p4: table without recognisable day/time header skipped'],
  conflicts: [{ type: 'teacher', when: 'Sat 09:00-10:30', message: 'Dr. Rahim is booked for SWE-101 (40A) and CSE-110 (38B)', ids: [1, 99] }],
})
let drafts = {}
uploads = uploads.map((u) => ({ ...u, term: 'Fall 2026', published_at: u.created_at }))
uploads[0].status = 'published'

const batchCounts = (rows) => {
  const m = {}; rows.forEach((e) => { const k = `${e.department}|${e.batch}|${e.section}`; m[k] = (m[k] || 0) + 1 })
  return Object.entries(m).map(([k, n]) => { const [department, batch, section] = k.split('|'); return { department, batch, section, new: n, current: entries.filter((e) => e.department === department && e.batch === batch && e.section === section).length, is_new_batch: false } })
}
const out = (u) => ({ id: u.id, filename: u.filename, term: u.term || null, status: u.status, entries: u.entries, batches: u.batches, created_at: u.created_at, published_at: u.published_at || null, log: u.log })
const filt = (q) => entries.filter((e) => (!q.get('department') || e.department === q.get('department')) && (!q.get('batch') || e.batch === q.get('batch')) && (!q.get('section') || e.section === q.get('section')) && (!q.get('teacher') || e.teacher === q.get('teacher')))

function handle(path, method, body, url) {
  const q = url.searchParams
  const id = +path.split('/').filter((x) => /^\d+$/.test(x)).pop()
  if (path === '/auth/me') return user
  if (path === '/auth/login' || path === '/auth/register') return { token: 'demo', user }
  if (path === '/auth/logout') return { ok: true }
  if (path === '/auth/change-password') return { ok: true }
  if (path === '/auth/preferences') return user
  if (path === '/routine/filters') return tree()
  if (path === '/routine/teachers') return [...new Set(entries.map((e) => e.teacher).filter(Boolean))].sort()
  if (path === '/routine' || path === '/admin/entries') return filt(q)
  if (path === '/routine/meta') return { updated_at: iso(36e5), ...settings }
  if (path === '/notices') return notices
  if (path === '/admin/stats') return { students: 128, students_7d: 9, batches: 4, courses: 11, entries: entries.length, uploads: uploads.length, conflicts: 1, last_publish: iso(2 * 864e5), by_department: [{ department: SWE, batches: 2 }, { department: CSE, batches: 1 }] }
  if (path === '/admin/conflicts') return sampleDraft().conflicts
  if (path === '/admin/settings') { if (method === 'PUT') settings = { semester_start: body.semester_start || null, semester_end: body.semester_end || null }; return settings }
  if (path === '/admin/users') return users
  if (path.endsWith('/reset-password')) return { email: users.find((u) => u.id === id)?.email, temporary_password: 'Demo-Temp-9xQ' }
  if (path === '/admin/audit') return audit
  if (path === '/admin/uploads' && method === 'GET') return uploads.map((u) => out({ ...u, log: undefined }))
  if (path === '/admin/uploads' && method === 'POST') {
    const d = sampleDraft(); const u = { id: nextId++, filename: 'new-routine.pdf', term: 'Fall 2026', status: 'draft', entries: d.entries.length, batches: 2, created_at: iso(), log: 'Demo mode: nothing was actually parsed.\nThe real app parses your PDF here.' }
    drafts[u.id] = d; uploads = [u, ...uploads]; return out(u)
  }
  if (path.endsWith('/preview')) { const u = uploads.find((x) => x.id === id); const d = drafts[id] || sampleDraft(); return { id, filename: u.filename, term: u.term, status: u.status, entries: d.entries, warnings: d.warnings, conflicts: d.conflicts, per_batch: batchCounts(d.entries) } }
  if (/\/uploads\/\d+\/(publish|discard|rollback)$/.test(path)) {
    const u = uploads.find((x) => x.id === id); const a = path.split('/').pop()
    u.status = { publish: 'published', discard: 'discarded', rollback: 'rolled_back' }[a]; if (a === 'publish') u.published_at = iso()
    return out(u)
  }
  if (/\/uploads\/\d+$/.test(path)) return out(uploads.find((x) => x.id === id))
  if (path === '/admin/entries' && method === 'POST') { const e = { id: nextId++, ...body, start: body.start_time, end: body.end_time, is_manual: true, updated_at: iso() }; entries = [...entries, e]; return e }
  if (path.startsWith('/admin/entries/')) {
    if (method === 'DELETE') { entries = entries.filter((e) => e.id !== id); return null }
    const e = entries.find((x) => x.id === id)
    const { start_time, end_time, ...rest } = body
    Object.assign(e, rest, start_time && { start: start_time }, end_time && { end: end_time }, { is_manual: true }); return e
  }
  if (path === '/admin/notices' && method === 'POST') { notices = [{ id: nextId++, ...body, created_at: iso() }, ...notices]; return { id: 1 } }
  if (path.startsWith('/admin/notices/')) { notices = notices.filter((n) => n.id !== id); return null }
  const cg = () => ({ semesters: sems, scale: SCALE, specials: SPECIALS, policy: 'latest' })
  if (path === '/cgpa') return cg()
  if (path === '/cgpa/semesters' && method === 'POST') { sems = [...sems, { id: nextId++, ...body }]; return cg() }
  if (path.startsWith('/cgpa/semesters/')) {
    sems = method === 'DELETE' ? sems.filter((s) => s.id !== id) : sems.map((s) => (s.id === id ? { id, ...body } : s))
    return cg()
  }
  return { detail: 'Not available in the demo' }
}

export function installDemo() {
  const real = window.fetch.bind(window)
  window.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url, location.href)
    if (!url.pathname.startsWith('/api/')) return real(input, init)
    if (/\.(ics|pdf)$/.test(url.pathname)) return new Response(new Blob(['demo']), { status: 200 })
    const body = typeof init.body === 'string' ? JSON.parse(init.body) : undefined
    const res = handle(url.pathname.slice(4), (init.method || 'GET').toUpperCase(), body, url)
    await new Promise((r) => setTimeout(r, 250)) // let the loading skeletons show
    return res === null ? json(null, 204) : res?.detail ? json(res, 404) : json(res)
  }
  window.EventSource = class { addEventListener() {} close() {} }
  try { localStorage.setItem('cp_session', '1') } catch {}  // pretend an admin session exists
}

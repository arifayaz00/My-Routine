// Mirrors backend/app/services/cgpa.py (rules are documented there). Both are tested against
// shared/cgpa-vectors.json, so the live preview in the browser always matches the server.
export const DEFAULT_SCALE = {
  'A+': 4.0, A: 3.75, 'A-': 3.5, 'B+': 3.25, B: 3.0, 'B-': 2.75, 'C+': 2.5, C: 2.25, D: 2.0, F: 0,
}
export const DEFAULT_SPECIALS = { P: 'Pass (non-credit)', W: 'Withdrawn', I: 'Incomplete', T: 'Transfer credit' }

const r2 = (n) => Math.floor(n * 100 + 0.5 + 1e-9) / 100
const norm = (s) => (s || '').trim().toLowerCase().replace(/\s+/g, ' ')
const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k)
const graded = (c, scale) => has(scale, c.grade) && c.credits > 0

export const cgpaBadge = (v) => (v > 3.75 ? 'emerald' : v > 3.5 ? 'blue' : v > 3.0 ? 'amber' : 'red')

function counted(sems, scale, policy) {
  const last = {}
  if (policy === 'latest') {
    sems.forEach((s, i) => s.courses.forEach((c) => { if (graded(c, scale) && norm(c.course_name)) last[norm(c.course_name)] = i }))
  }
  const out = []
  sems.forEach((s, i) => s.courses.forEach((c) => {
    const n = norm(c.course_name)
    if (graded(c, scale) && !(policy === 'latest' && n && last[n] !== i)) out.push(c)
  }))
  return out
}
const sum = (list, f) => list.reduce((a, c) => a + f(c), 0)

export function analytics(semesters, { scale = DEFAULT_SCALE, policy = 'latest' } = {}) {
  const sems = semesters.map((s) => ({ ...s, courses: s.courses.map((c) => ({ ...c, credits: Number(c.credits) || 0 })) }))
  const dist = {}
  const rows = sems.map((s, i) => {
    const own = s.courses.filter((c) => graded(c, scale))
    const cr = sum(own, (c) => c.credits)
    const pts = sum(own, (c) => scale[c.grade] * c.credits)
    own.forEach((c) => { dist[c.grade] = (dist[c.grade] || 0) + 1 })
    const cum = counted(sems.slice(0, i + 1), scale, policy)
    const ccr = sum(cum, (c) => c.credits)
    return { key: s.key, name: s.name, credits: cr, sgpa: cr ? r2(pts / cr) : 0,
             cgpa: ccr ? r2(sum(cum, (c) => scale[c.grade] * c.credits) / ccr) : 0 }
  })
  const fin = counted(sems, scale, policy)
  const totalCredits = sum(fin, (c) => c.credits)
  const totalPoints = sum(fin, (c) => scale[c.grade] * c.credits)
  const earnedCredits = sum(fin.filter((c) => scale[c.grade] > 0), (c) => c.credits)
    + sum(sems.flatMap((s) => s.courses).filter((c) => c.grade === 'T'), (c) => c.credits)
  const cgpa = totalCredits ? r2(totalPoints / totalCredits) : 0
  const sg = rows.filter((r) => r.credits).map((r) => r.sgpa)
  let status = 'Good'
  if (sg.length && (cgpa < 3 || sg[sg.length - 1] < 2.5)) status = 'Critical'
  else if (sg.length > 1 && sg[sg.length - 1] > sg[sg.length - 2] + 0.05) status = 'Improving'
  return {
    rows, cgpa, totalCredits, earnedCredits, totalPoints, badge: cgpaBadge(cgpa), status,
    distribution: Object.keys(scale).map((g) => ({ grade: g, count: dist[g] || 0 })),
  }
}

/** SGPA needed next semester to reach `target` CGPA (retakes in that semester are not modelled). */
export function requiredSgpa(a, target, nextCredits, scale = DEFAULT_SCALE) {
  if (!(nextCredits > 0) || !(target > 0)) return null
  const needed = (target * (a.totalCredits + nextCredits) - a.totalPoints) / nextCredits
  const max = Math.max(...Object.values(scale))
  return { needed: r2(Math.max(needed, 0)), feasible: needed <= max + 1e-9, alreadyThere: needed <= 0, max }
}

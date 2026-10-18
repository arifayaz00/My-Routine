import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { analytics, requiredSgpa } from '../src/lib/cgpa.js'

const vectors = JSON.parse(readFileSync(new URL('../../shared/cgpa-vectors.json', import.meta.url)))

for (const v of vectors) {
  test(`cgpa vector: ${v.name}`, () => {
    const a = analytics(v.semesters, { policy: v.policy })
    const e = v.expect
    assert.deepEqual(a.rows.map((r) => r.sgpa), e.sgpa)
    assert.deepEqual(a.rows.map((r) => r.cgpa), e.cgpa_by_semester)
    assert.equal(a.cgpa, e.cgpa)
    assert.equal(a.totalCredits, e.total_credits)
    assert.equal(a.earnedCredits, e.earned_credits)
    assert.equal(a.badge, e.badge)
    assert.equal(a.status, e.status)
  })
}

test('string credits from form inputs are handled', () => {
  const a = analytics([{ name: 'S', courses: [{ course_name: 'X', credits: '3', grade: 'A' }] }])
  assert.equal(a.cgpa, 3.75)
})

test('target planner', () => {
  const a = analytics(vectors[0].semesters) // 10.5 credits, 38.25 points
  const r = requiredSgpa(a, 3.8, 15)        // (3.8*25.5 - 38.25)/15 = 3.91
  assert.equal(r.needed, 3.91)
  assert.ok(r.feasible)
  assert.equal(requiredSgpa(a, 4.0, 3).feasible, false)  // (4*13.5-38.25)/3 = 5.25 > 4.00
  assert.ok(requiredSgpa(a, 1.0, 15).alreadyThere)
})

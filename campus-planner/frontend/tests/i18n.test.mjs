import test from 'node:test'
import assert from 'node:assert/strict'
import { DICT, translate } from '../src/lib/i18n.js'

const vars = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',')

test('every English key has a Bengali translation and vice versa', () => {
  const en = Object.keys(DICT.en), bn = Object.keys(DICT.bn)
  assert.deepEqual(en.filter((k) => !bn.includes(k)), [], 'missing in bn')
  assert.deepEqual(bn.filter((k) => !en.includes(k)), [], 'unknown keys in bn')
})

test('placeholders match between languages', () => {
  for (const k of Object.keys(DICT.en)) assert.equal(vars(DICT.bn[k]), vars(DICT.en[k]), `placeholder mismatch in "${k}"`)
})

test('no empty translations', () => {
  for (const lang of ['en', 'bn']) for (const [k, v] of Object.entries(DICT[lang])) assert.ok(v.trim(), `${lang}.${k} is empty`)
})

test('translate() fills variables and falls back to English, then to the key', () => {
  assert.equal(translate('en', 'routine.updatedOn', { d: 'today' }), 'Updated on today')
  assert.match(translate('bn', 'routine.updatedOn', { d: 'আজ' }), /আজ/)
  assert.equal(translate('bn', 'no.such.key'), 'no.such.key')
})

test('every day, course type and status used by the UI is translated', () => {
  for (const d of ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri']) assert.ok(DICT.bn[`day.${d}`])
  for (const k of ['theory', 'lab', 'elective', 'project', 'exam']) assert.ok(DICT.bn[`kind.${k}`] && DICT.bn[`kindShort.${k}`])
  for (const s of ['Good', 'Improving', 'Critical']) assert.ok(DICT.bn[`status.${s}`])
})

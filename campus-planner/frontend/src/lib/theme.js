// Pastel badge colours per course type (full class strings so Tailwind keeps them).
export const KIND = {
  theory:   { label: 'Theory',   cls: 'bg-sky-400/15 text-sky-200 border-sky-300/30',         dot: 'bg-sky-300' },
  lab:      { label: 'Lab',      cls: 'bg-emerald-400/15 text-emerald-200 border-emerald-300/30', dot: 'bg-emerald-300' },
  elective: { label: 'Elective', cls: 'bg-amber-400/15 text-amber-200 border-amber-300/30',   dot: 'bg-amber-300' },
  project:  { label: 'Project',  cls: 'bg-violet-400/15 text-violet-200 border-violet-300/30', dot: 'bg-violet-300' },
  exam:     { label: 'Exam / Substitute', cls: 'bg-rose-400/15 text-rose-200 border-rose-300/30', dot: 'bg-rose-300' },
}
export const CGPA_BADGE = {
  emerald: 'bg-emerald-400/15 text-emerald-300 border-emerald-400/40',
  blue: 'bg-sky-400/15 text-sky-300 border-sky-400/40',
  amber: 'bg-amber-400/15 text-amber-300 border-amber-400/40',
  red: 'bg-rose-400/15 text-rose-300 border-rose-400/40',
}
export const STATUS_BADGE = {
  Good: 'bg-emerald-400/15 text-emerald-300 border-emerald-400/40',
  Improving: 'bg-sky-400/15 text-sky-300 border-sky-400/40',
  Critical: 'bg-rose-400/15 text-rose-300 border-rose-400/40',
}
export const DAY_ORDER = ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri']
export const DAY_NAME = { Sat: 'Saturday', Sun: 'Sunday', Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday' }
export const to12h = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number)
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}

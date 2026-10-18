import { motion } from 'framer-motion'
import { Award, BookOpen, TrendingUp } from 'lucide-react'
import TargetPlanner from './TargetPlanner'
import {
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { CGPA_BADGE, STATUS_BADGE } from '../lib/theme'
import { useT } from '../lib/prefs'

const tip = { background: 'var(--tip-bg)', color: 'var(--tip-fg)', border: '1px solid var(--tip-bd)', borderRadius: 12, fontSize: 12 }
const grid = { stroke: '#94a3b8', strokeOpacity: 0.22, vertical: false }

function Stat({ icon: Icon, label, children }) {
  return (
    <div className="glass flex items-center gap-3 p-4">
      <div className="rounded-xl bg-violet-500/15 p-2.5 text-violet-300"><Icon size={20} /></div>
      <div><div className="text-xs text-slate-400">{label}</div><div className="text-lg font-bold">{children}</div></div>
    </div>
  )
}

/** `a` = result of lib/cgpa.analytics(). Shows headline badges, SGPA/CGPA trend, grade distribution. */
export default function CgpaChart({ a, scale }) {
  const t = useT()
  const data = a.rows.filter((r) => r.credits)
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat icon={Award} label={t('cgpa.cumulative')}>
          <motion.span key={a.cgpa} initial={{ scale: 1.25 }} animate={{ scale: 1 }}
            className={`inline-block rounded-lg border px-2.5 py-0.5 ${CGPA_BADGE[a.badge]}`}>{a.cgpa.toFixed(2)}</motion.span>
        </Stat>
        <Stat icon={BookOpen} label={t('cgpa.earned')}>{a.earnedCredits}</Stat>
        <Stat icon={TrendingUp} label={t('cgpa.status')}>
          <span className={`rounded-lg border px-2.5 py-0.5 text-base ${STATUS_BADGE[a.status]}`}>{t(`status.${a.status}`)}</span>
        </Stat>
      </div>

      <TargetPlanner a={a} scale={scale} />

      <div className="glass p-4">
        <h3 className="mb-3 text-sm font-semibold text-slate-300">{t('cgpa.trend')}</h3>
        {data.length ? (
          <div role="img" aria-label={t('cgpa.trendAria')} className="h-64">
            <ResponsiveContainer>
              <LineChart data={data} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                <CartesianGrid {...grid} />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
                <YAxis domain={[0, 4]} ticks={[0, 1, 2, 3, 4]} stroke="#94a3b8" fontSize={12} />
                <Tooltip contentStyle={tip} />
                <Legend />
                <ReferenceLine y={3} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: '3.00', fill: '#d97706', fontSize: 11 }} />
                <Line type="monotone" dataKey="sgpa" name={t('cgpa.sgpa')} stroke="#8b5cf6" strokeWidth={2.5} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="cgpa" name={t('nav.cgpa')} stroke="#10b981" strokeWidth={2.5} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : <p className="py-10 text-center text-sm text-slate-400">{t('cgpa.trendEmpty')}</p>}
      </div>

      <div className="glass p-4">
        <h3 className="mb-3 text-sm font-semibold text-slate-300">{t('cgpa.distribution')}</h3>
        <div role="img" aria-label={t('cgpa.distAria')} className="h-56">
          <ResponsiveContainer>
            <BarChart data={a.distribution} margin={{ top: 8, right: 12, left: -24, bottom: 0 }}>
              <CartesianGrid {...grid} />
              <XAxis dataKey="grade" stroke="#94a3b8" fontSize={12} />
              <YAxis allowDecimals={false} stroke="#94a3b8" fontSize={12} />
              <Tooltip contentStyle={tip} cursor={{ fill: 'rgba(148,163,184,.12)' }} />
              <Bar dataKey="count" name={t('cgpa.courses')} fill="#6366f1" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

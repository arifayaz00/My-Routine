import { useState } from 'react'
import { motion } from 'framer-motion'
import { LogIn, UserPlus } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { useT } from '../lib/prefs'

export default function AuthPage({ onDone }) {
  const { authenticate } = useAuth()
  const t = useT()
  const [mode, setMode] = useState('login')
  const [f, setF] = useState({ name: '', email: '', password: '' })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true)
    try {
      await authenticate(mode, mode === 'login' ? { email: f.email, password: f.password } : f)
      onDone?.()
    } catch (x) { setErr(x.message) } finally { setBusy(false) }
  }
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  return (
    <motion.form onSubmit={submit} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      className="glass mx-auto mt-10 max-w-sm space-y-4 p-6">
      <h2 className="text-xl font-bold">{mode === 'login' ? t('auth.welcome') : t('auth.create')}</h2>
      {mode === 'register' && (
        <div><label className="label" htmlFor="a-name">{t('auth.name')}</label>
          <input id="a-name" className="field" required value={f.name} onChange={set('name')} /></div>
      )}
      <div><label className="label" htmlFor="a-email">{t('auth.email')}</label>
        <input id="a-email" type="email" className="field" required value={f.email} onChange={set('email')} /></div>
      <div><label className="label" htmlFor="a-pw">{t('auth.password')} {mode === 'register' && t('auth.pwMin')}</label>
        <input id="a-pw" type="password" className="field" required minLength={mode === 'register' ? 8 : 1}
          value={f.password} onChange={set('password')} /></div>
      {err && <p role="alert" className="rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-300">{err}</p>}
      <button className="btn-primary w-full" disabled={busy}>
        {mode === 'login' ? <LogIn size={16} /> : <UserPlus size={16} />}{busy ? t('auth.wait') : mode === 'login' ? t('auth.signin') : t('auth.signup')}
      </button>
      <button type="button" className="w-full text-center text-sm text-violet-300 hover:underline"
        onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setErr('') }}>
        {mode === 'login' ? t('auth.newHere') : t('auth.haveAccount')}
      </button>
    </motion.form>
  )
}

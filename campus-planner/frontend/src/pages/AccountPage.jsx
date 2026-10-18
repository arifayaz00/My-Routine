import { useState } from 'react'
import { KeyRound } from 'lucide-react'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useT } from '../lib/prefs'

export default function AccountPage({ toast }) {
  const { user } = useAuth()
  const t = useT()
  const [f, setF] = useState({ current_password: '', new_password: '' })
  const [busy, setBusy] = useState(false)
  const submit = async (e) => {
    e.preventDefault(); setBusy(true)
    try {
      await api.post('/auth/change-password', f)
      setF({ current_password: '', new_password: '' })
      toast(t('account.changed'), 'success')
    } catch (x) { toast(x.message, 'error') } finally { setBusy(false) }
  }
  return (
    <div className="mx-auto max-w-md space-y-4">
      <div className="glass p-5">
        <div className="text-lg font-bold">{user.name}</div>
        <div className="text-sm text-slate-400">{user.email} · {user.role}</div>
      </div>
      <form onSubmit={submit} className="glass space-y-3 p-5">
        <h2 className="flex items-center gap-2 font-bold"><KeyRound size={16} />{t('account.change')}</h2>
        <div><label className="label" htmlFor="pw-cur">{t('account.current')}</label>
          <input id="pw-cur" type="password" className="field" required autoComplete="current-password" value={f.current_password}
            onChange={(e) => setF({ ...f, current_password: e.target.value })} /></div>
        <div><label className="label" htmlFor="pw-new">{t('account.new')}</label>
          <input id="pw-new" type="password" className="field" required minLength={8} autoComplete="new-password" value={f.new_password}
            onChange={(e) => setF({ ...f, new_password: e.target.value })} /></div>
        <button className="btn-primary" disabled={busy}>{busy ? t('account.saving') : t('account.update')}</button>
      </form>
    </div>
  )
}

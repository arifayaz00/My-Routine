import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { api } from './api'

const Ctx = createContext(null)
export const useAuth = () => useContext(Ctx)
// Non-secret hint so signed-out visitors don't trigger a pointless /auth/me call (and a 401 in the console).
const FLAG = 'cp_session'
const flag = { get: () => { try { return localStorage.getItem(FLAG) } catch { return null } },
  set: () => { try { localStorage.setItem(FLAG, '1') } catch {} },
  clear: () => { try { localStorage.removeItem(FLAG) } catch {} } }

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(!flag.get())

  useEffect(() => {
    if (!flag.get()) return
    api.get('/auth/me').then(setUser).catch(() => flag.clear()).finally(() => setReady(true))
  }, [])
  useEffect(() => {
    const out = () => { flag.clear(); setUser(null) }
    window.addEventListener('cp-unauth', out)
    return () => window.removeEventListener('cp-unauth', out)
  }, [])

  const authenticate = useCallback(async (mode, payload) => {
    const r = await api.post(`/auth/${mode}`, payload)
    flag.set(); setUser(r.user)
  }, [])
  const logout = useCallback(async () => {
    await api.post('/auth/logout').catch(() => {})
    flag.clear(); setUser(null)
  }, [])

  return <Ctx.Provider value={{ user, setUser, ready, authenticate, logout }}>{children}</Ctx.Provider>
}

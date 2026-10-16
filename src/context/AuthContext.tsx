import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { User } from '@/types'
import { authApi } from '@/api/client'
import { clearActivityMark, markActivityNow } from '@/lib/hooks'

interface AuthContextValue {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<User>
  logout: () => Promise<void>
  reload: () => Promise<void>
  setUser: (user: User) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const me = await authApi.me()
      setUserState(me)
    } catch {
      // Backend tidak dapat dihubungi atau sesi tidak valid -> anggap belum masuk.
      setUserState(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const login = useCallback(async (email: string, password: string) => {
    const session = await authApi.login(email, password)
    // Mulai hitungan "tidak ada kegiatan" dari sekarang.
    markActivityNow()
    setUserState(session.user)
    return session.user
  }, [])

  const logout = useCallback(async () => {
    // Akhiri sesi lokal SEGERA, tanpa menunggu server: di jaringan ponsel
    // permintaan bisa menggantung lama, dan auto-logout harus tampak langsung.
    clearActivityMark()
    setUserState(null)
    try {
      await authApi.logout()
    } catch {
      /* abaikan kegagalan jaringan — sesi lokal sudah diakhiri */
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, login, logout, reload, setUser: setUserState }),
    [user, loading, login, logout, reload],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth harus dipakai di dalam AuthProvider')
  return ctx
}

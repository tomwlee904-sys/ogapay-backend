import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface AuthContextType {
  isAuthed: boolean
  login: () => void
  logout: () => void
}

const AuthContext = createContext<AuthContextType>({
  isAuthed: false,
  login: () => {},
  logout: () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthed, setIsAuthed] = useState(() => {
    try { return localStorage.getItem('ogapay-authenticated') === 'true' } catch { return false }
  })

  useEffect(() => {
    document.body.setAttribute('data-auth', isAuthed ? 'authed' : 'public')
  }, [isAuthed])

  const login = () => {
    try { localStorage.setItem('ogapay-authenticated', 'true') } catch {}
    setIsAuthed(true)
  }

  const logout = () => {
    try {
      localStorage.removeItem('ogapay-authenticated')
      localStorage.removeItem('token')
      sessionStorage.removeItem('token')
    } catch {}
    setIsAuthed(false)
  }

  return (
    <AuthContext.Provider value={{ isAuthed, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)

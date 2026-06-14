import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Layout from '../components/Layout'

const API_BASE = 'https://ogapay-production.up.railway.app/api/v1'

export default function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [showForm, setShowForm] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [pairingCode, setPairingCode] = useState('')
  const [transactionRef, setTransactionRef] = useState('')
  const [error, setError] = useState('')

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const r = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const j = await r.json()
      if (j.success && j.tokens) {
        localStorage.setItem('token', j.tokens.accessToken || j.tokens.token)
        sessionStorage.setItem('token', j.tokens.accessToken || j.tokens.token)
        login()
        navigate('/dashboard')
      } else {
        setError(j.message || 'Invalid credentials')
      }
    } catch { setError('Network error') }
    setLoading(false)
  }

  const handleTransactionSignin = async () => {
    setLoading(true)
    setError('')
    try {
      const r = await fetch(`${API_BASE}/auth/signin-transaction`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionRef }),
      })
      const j = await r.json()
      if (j.success && j.tokens) {
        localStorage.setItem('token', j.tokens.accessToken || j.tokens.token)
        login()
        navigate('/dashboard')
      } else {
        setError(j.message || 'Invalid transaction reference')
      }
    } catch { setError('Network error') }
    setLoading(false)
  }

  const handlePairDevice = async () => {
    setLoading(true)
    setError('')
    try {
      const r = await fetch(`${API_BASE}/auth/pair-device`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: pairingCode.replace(/[^0-9]/g, '') }),
      })
      const j = await r.json()
      if (j.success && j.tokens) {
        localStorage.setItem('token', j.tokens.accessToken || j.tokens.token)
        login()
        navigate('/dashboard')
      } else {
        setError(j.message || 'Invalid pairing code')
      }
    } catch { setError('Network error') }
    setLoading(false)
  }

  return (
    <Layout sidebar={false}>
      <style>{`
        .lp-wrap{min-height:80vh;display:flex;align-items:center;justify-content:center;padding:40px 20px}
        .lp-card{width:100%;max-width:420px;background:var(--card);border:1px solid var(--border);border-radius:20px;padding:36px 32px}
        .lp-card h1{font-family:Outfit;font-size:28px;font-weight:900;margin:0 0 4px}
        .lp-card .lp-sub{color:var(--text2);font-size:14px;margin-bottom:28px}
        .lp-option{width:100%;padding:14px 16px;border-radius:12px;border:1.5px solid var(--border);background:var(--card);cursor:pointer;font-weight:700;font-size:14px;display:flex;align-items:center;gap:12px;transition:all .2s;font-family:inherit;text-align:left;margin-bottom:8px}
        .lp-option:hover{border-color:var(--accent);background:rgba(124,58,237,.03)}
        .lp-option i:first-child{font-size:20px;color:#191C6B;width:24px;text-align:center}
        .lp-option span{flex:1}
        .lp-back{width:100%;padding:12px;margin-top:8px;border-radius:8px;border:1px solid var(--border);background:transparent;font-weight:700;cursor:pointer;font-family:inherit;font-size:14px}
        .lp-input{width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:8px;background:var(--bg);font-family:inherit;font-size:14px;margin-bottom:12px;outline:0;transition:border-color .2s;box-sizing:border-box}
        .lp-input:focus{border-color:var(--accent)}
        .lp-btn{width:100%;padding:12px;border-radius:8px;background:#191C6B;color:#fff;border:none;font-weight:700;font-size:14px;cursor:pointer;font-family:inherit;transition:all .2s}
        .lp-btn:hover{opacity:.9}
        .lp-btn:disabled{opacity:.5;cursor:not-allowed}
        .lp-code-display{background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:16px;margin-bottom:12px;text-align:center}
        .lp-code-display .lpc-label{font-size:12px;color:var(--text3);margin-bottom:6px;text-transform:uppercase;letter-spacing:.05em;font-weight:700}
        .lp-code-display .lpc-account{font-family:monospace;font-weight:700;font-size:18px;margin-bottom:8px}
        .lp-code-display .lpc-bank{font-weight:700;font-size:14px}
        .lp-err{background:rgba(220,38,38,.08);color:#dc2626;font-size:13px;padding:8px 12px;border-radius:8px;margin-bottom:12px;font-weight:600;text-align:center}
      `}</style>

      <div className="lp-wrap">
        <div className="lp-card">
          {!showForm ? (
            <>
              <div style={{ textAlign: 'center', marginBottom: 32 }}>
                <h1>Work, Earn, Grow</h1>
                <p className="lp-sub">Choose how you want to sign in</p>
              </div>

              <button className="lp-option" onClick={() => setShowForm('email')}>
                <i className="ti ti-mail" />
                <span>Sign in with Email</span>
                <i className="ti ti-chevron-right" style={{ color: 'var(--text3)', marginLeft: 'auto' }} />
              </button>

              <button className="lp-option" onClick={() => setShowForm('transaction')}>
                <i className="ti ti-send" />
                <span>Sign in with Transaction</span>
                <i className="ti ti-chevron-right" style={{ color: 'var(--text3)', marginLeft: 'auto' }} />
              </button>

              <button className="lp-option" onClick={() => setShowForm('pair-device')}>
                <i className="ti ti-device-mobile" />
                <span>Pair Device</span>
                <i className="ti ti-chevron-right" style={{ color: 'var(--text3)', marginLeft: 'auto' }} />
              </button>
            </>
          ) : showForm === 'email' ? (
            <form onSubmit={handleEmailLogin}>
              <h2 style={{ marginBottom: 16, fontSize: 20, fontWeight: 900 }}>Sign in with Email</h2>
              {error && <div className="lp-err">{error}</div>}
              <input className="lp-input" type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="Email address" required />
              <input className="lp-input" type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="Password" required />
              <button className="lp-btn" type="submit" disabled={loading}>
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
              <button type="button" className="lp-back" onClick={() => setShowForm(null)}>Back</button>
            </form>
          ) : showForm === 'transaction' ? (
            <div>
              <h2 style={{ marginBottom: 16, fontSize: 20, fontWeight: 900 }}>Sign in with Transaction</h2>
              <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 16 }}>
                Send N1 to verify account ownership
              </p>
              {error && <div className="lp-err">{error}</div>}
              <div className="lp-code-display">
                <div className="lpc-label">Bank Account</div>
                <div className="lpc-account">0234567890</div>
                <div className="lpc-label">Bank Name</div>
                <div className="lpc-bank">OgaPay Verification</div>
              </div>
              <input className="lp-input" value={transactionRef} onChange={e => setTransactionRef(e.target.value)}
                placeholder="Paste transaction reference here" />
              <button className="lp-btn" onClick={handleTransactionSignin} disabled={loading || !transactionRef}>
                {loading ? 'Verifying...' : 'Verify & Sign In'}
              </button>
              <button className="lp-back" onClick={() => setShowForm(null)}>Back</button>
            </div>
          ) : showForm === 'pair-device' ? (
            <div>
              <h2 style={{ marginBottom: 16, fontSize: 20, fontWeight: 900 }}>Pair Device</h2>
              <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 16 }}>
                Enter the pairing code from another device
              </p>
              {error && <div className="lp-err">{error}</div>}
              <input className="lp-input" value={pairingCode} onChange={e => setPairingCode(e.target.value.toUpperCase())}
                placeholder="000000" maxLength={6}
                style={{ fontFamily: 'monospace', fontSize: 24, textAlign: 'center', letterSpacing: 6, fontWeight: 700 }} />
              <button className="lp-btn" onClick={handlePairDevice} disabled={loading || pairingCode.length < 4}>
                {loading ? 'Pairing...' : 'Pair Device'}
              </button>
              <button className="lp-back" onClick={() => setShowForm(null)}>Back</button>
            </div>
          ) : null}
        </div>
      </div>
    </Layout>
  )
}

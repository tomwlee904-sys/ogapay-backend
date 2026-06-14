import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
 
const API_BASE = 'https://ogapay-production.up.railway.app/api/v1'
 
function getToken() {
  return localStorage.getItem('token') || sessionStorage.getItem('token') || ''
}
 
function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${getToken()}`,
  }
}
 
/* ─── Types ─── */
interface ProfileForm {
  fullName: string
  username: string
  email: string
  phone: string
  location: string
  bio: string
}
 
interface PrefsForm {
  emailNotifications: boolean
  smsNotifications: boolean
  pushNotifications: boolean
  publicProfile: boolean
  showEarnings: boolean
}
 
interface PasswordForm {
  current: string
  next: string
  confirm: string
}
 
/* ─── Toggle Switch ─── */
function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      style={{
        position: 'relative', display: 'inline-flex', alignItems: 'center',
        width: 44, height: 24, borderRadius: 999, border: 'none', cursor: 'pointer',
        background: checked ? '#121566' : 'var(--border)',
        transition: 'background .2s', flexShrink: 0, padding: 0,
      }}
    >
      <span style={{
        position: 'absolute', left: checked ? 22 : 2,
        width: 20, height: 20, borderRadius: '50%',
        background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,.2)',
        transition: 'left .2s',
      }} />
    </button>
  )
}
 
/* ─── Field ─── */
function Field({
  label, type = 'text', value, onChange, placeholder, disabled, textarea, hint
}: {
  label: string; type?: string; value: string; onChange: (v: string) => void
  placeholder?: string; disabled?: boolean; textarea?: boolean; hint?: string
}) {
  const [focused, setFocused] = useState(false)
  const base: React.CSSProperties = {
    width: '100%', padding: textarea ? '10px 12px' : '0 12px',
    border: `1px solid ${focused ? '#121566' : 'var(--border)'}`,
    borderRadius: 10, background: disabled ? 'var(--bg2)' : 'var(--bg2)',
    color: disabled ? 'var(--text3)' : 'var(--text)',
    fontSize: 13, outline: 'none', transition: 'border-color .2s',
    height: textarea ? undefined : 40,
    minHeight: textarea ? 80 : undefined,
    resize: textarea ? 'vertical' as const : undefined,
    fontFamily: 'inherit',
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </label>
      {textarea
        ? <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} disabled={disabled}
            onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} style={base} />
        : <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} disabled={disabled}
            onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} style={base} />
      }
      {hint && <p style={{ fontSize: 11, color: 'var(--text3)', margin: 0 }}>{hint}</p>}
    </div>
  )
}
 
/* ─── Card ─── */
function Card({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--card)', border: '1px solid var(--border)',
      borderRadius: 16, padding: 24,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 10,
          background: 'rgba(18,21,102,0.1)', border: '1px solid rgba(18,21,102,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <i className={`ti ${icon}`} style={{ fontSize: 15, color: '#121566' }} />
        </div>
        <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>{title}</span>
      </div>
      {children}
    </div>
  )
}
 
/* ─── Toast ─── */
function Toast({ message, type, visible }: { message: string; type: 'success' | 'error'; visible: boolean }) {
  return (
    <div style={{
      position: 'fixed', bottom: 88, left: '50%', zIndex: 999,
      transform: `translateX(-50%) translateY(${visible ? 0 : 12}px)`,
      opacity: visible ? 1 : 0,
      background: type === 'success' ? '#16a34a' : '#dc2626',
      color: '#fff', padding: '10px 20px', borderRadius: 12,
      fontSize: 13, fontWeight: 700, boxShadow: '0 8px 24px rgba(0,0,0,.2)',
      transition: 'all .3s', pointerEvents: 'none', whiteSpace: 'nowrap',
      display: 'flex', alignItems: 'center', gap: 8,
    }}>
      <i className={`ti ${type === 'success' ? 'ti-check' : 'ti-alert-circle'}`} />
      {message}
    </div>
  )
}
 
/* ─── Avatar Upload ─── */
function AvatarUpload({ name }: { name: string }) {
  const [preview, setPreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const ref = useRef<HTMLInputElement>(null)
 
  const handle = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => setPreview(ev.target?.result as string)
    reader.readAsDataURL(file)
    setUploading(true)
    // Simulate upload; replace with actual endpoint if available
    await new Promise(r => setTimeout(r, 1200))
    setUploading(false)
  }
 
  const initials = name ? name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : 'U'
 
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
      <div style={{ position: 'relative' }}>
        <div style={{
          width: 64, height: 64, borderRadius: 16,
          background: preview ? 'transparent' : '#121566',
          overflow: 'hidden',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22, fontWeight: 900, color: '#fff',
          border: '2px solid var(--border)',
        }}>
          {preview
            ? <img src={preview} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : initials
          }
          {uploading && (
            <div style={{
              position: 'absolute', inset: 0,
              background: 'rgba(0,0,0,0.5)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <div className="spinner" style={{ width: 20, height: 20, borderWidth: 2, borderColor: '#fff3', borderTopColor: '#fff' }} />
            </div>
          )}
        </div>
      </div>
      <div>
        <button type="button" onClick={() => ref.current?.click()} style={{
          height: 34, padding: '0 16px', borderRadius: 10,
          border: '1px solid var(--border)', background: 'var(--bg2)',
          color: 'var(--text2)', fontSize: 12, fontWeight: 700, cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', gap: 6,
        }}>
          <i className="ti ti-upload" style={{ fontSize: 13 }} />
          {uploading ? 'Uploading...' : 'Change Photo'}
        </button>
        <p style={{ fontSize: 11, color: 'var(--text3)', margin: '4px 0 0' }}>JPG, PNG up to 5MB</p>
        <input ref={ref} type="file" accept="image/*" style={{ display: 'none' }} onChange={handle} />
      </div>
    </div>
  )
}
 
/* ─── Main Component ─── */
export default function Settings() {
  const navigate = useNavigate()
 
  // ── profile state ──
  const [profile, setProfile] = useState<ProfileForm>({
    fullName: '', username: '', email: '', phone: '', location: '', bio: '',
  })
  const [profileLoading, setProfileLoading] = useState(true)
  const [profileSaving, setProfileSaving] = useState(false)
 
  // ── prefs state ──
  const [prefs, setPrefs] = useState<PrefsForm>({
    emailNotifications: true, smsNotifications: false,
    pushNotifications: true, publicProfile: true, showEarnings: false,
  })
  const [prefsSaving, setPrefsSaving] = useState(false)
 
  // ── password state ──
  const [pwd, setPwd] = useState<PasswordForm>({ current: '', next: '', confirm: '' })
  const [pwdSaving, setPwdSaving] = useState(false)
  const [showPwd, setShowPwd] = useState(false)
 
  // ── 2FA state ──
  const [twoFA, setTwoFA] = useState(false)
  const [twoFASaving, setTwoFASaving] = useState(false)
 
  // ── delete state ──
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleteModal, setDeleteModal] = useState(false)
 
  // ── toast ──
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' as 'success' | 'error' })
 
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ visible: true, message, type })
    setTimeout(() => setToast(t => ({ ...t, visible: false })), 3000)
  }
 
  /* ─── Load profile on mount ─── */
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${API_BASE}/auth/me`, { headers: authHeaders() })
        const json = await res.json()
        if (!res.ok || !json.success) {
          // Not authenticated — redirect to login
          navigate('/login')
          return
        }
        const u = json.data?.user || json.data || {}
        setProfile({
          fullName: u.fullName || u.name || '',
          username: u.username || '',
          email: u.email || '',
          phone: u.phone || u.phoneNumber || '',
          location: u.location || '',
          bio: u.bio || '',
        })
        setTwoFA(!!u.twoFactorEnabled)
        if (u.preferences) {
          setPrefs(p => ({
            ...p,
            emailNotifications: u.preferences.emailNotifications ?? p.emailNotifications,
            smsNotifications: u.preferences.smsNotifications ?? p.smsNotifications,
            pushNotifications: u.preferences.pushNotifications ?? p.pushNotifications,
            publicProfile: u.preferences.publicProfile ?? p.publicProfile,
            showEarnings: u.preferences.showEarnings ?? p.showEarnings,
          }))
        }
      } catch {
        showToast('Could not load profile', 'error')
      }
      setProfileLoading(false)
    }
    load()
  }, [])
 
  /* ─── Save profile ─── */
  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setProfileSaving(true)
    try {
      const res = await fetch(`${API_BASE}/profile`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({
          fullName: profile.fullName,
          username: profile.username,
          phone: profile.phone,
          location: profile.location,
          bio: profile.bio,
        }),
      })
      const json = await res.json()
      if (res.ok && json.success) {
        showToast('Profile updated successfully')
      } else {
        showToast(json.message || 'Failed to update profile', 'error')
      }
    } catch {
      showToast('Network error', 'error')
    }
    setProfileSaving(false)
  }
 
  /* ─── Save preferences ─── */
  const savePrefs = async () => {
    setPrefsSaving(true)
    try {
      const res = await fetch(`${API_BASE}/auth/update-preferences`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ preferences: prefs }),
      })
      const json = await res.json()
      if (res.ok && json.success) {
        showToast('Preferences saved')
      } else {
        showToast(json.message || 'Failed to save preferences', 'error')
      }
    } catch {
      showToast('Network error', 'error')
    }
    setPrefsSaving(false)
  }
 
  /* ─── Change password ─── */
  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (pwd.next !== pwd.confirm) {
      showToast('New passwords do not match', 'error')
      return
    }
    if (pwd.next.length < 8) {
      showToast('Password must be at least 8 characters', 'error')
      return
    }
    setPwdSaving(true)
    try {
      const res = await fetch(`${API_BASE}/auth/change-password`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ currentPassword: pwd.current, newPassword: pwd.next }),
      })
      const json = await res.json()
      if (res.ok && json.success) {
        showToast('Password changed successfully')
        setPwd({ current: '', next: '', confirm: '' })
        setShowPwd(false)
      } else {
        showToast(json.message || 'Incorrect current password', 'error')
      }
    } catch {
      showToast('Network error', 'error')
    }
    setPwdSaving(false)
  }
 
  /* ─── Toggle 2FA ─── */
  const toggle2FA = async () => {
    setTwoFASaving(true)
    try {
      const endpoint = twoFA ? 'disable-2fa' : 'enable-2fa'
      const res = await fetch(`${API_BASE}/auth/${endpoint}`, {
        method: 'POST',
        headers: authHeaders(),
      })
      const json = await res.json()
      if (res.ok && json.success) {
        setTwoFA(!twoFA)
        showToast(`2FA ${twoFA ? 'disabled' : 'enabled'} successfully`)
      } else {
        showToast(json.message || 'Failed to update 2FA', 'error')
      }
    } catch {
      showToast('Network error', 'error')
    }
    setTwoFASaving(false)
  }
 
  /* ─── Delete account ─── */
  const deleteAccount = async () => {
    if (deleteConfirm.toLowerCase() !== 'delete') return
    try {
      const res = await fetch(`${API_BASE}/auth/delete-account`, {
        method: 'DELETE',
        headers: authHeaders(),
      })
      const json = await res.json()
      if (res.ok && json.success) {
        localStorage.clear()
        sessionStorage.clear()
        navigate('/login')
      } else {
        showToast(json.message || 'Failed to delete account', 'error')
        setDeleteModal(false)
      }
    } catch {
      showToast('Network error', 'error')
    }
  }
 
  /* ─── Logout ─── */
  const logout = () => {
    localStorage.clear()
    sessionStorage.clear()
    navigate('/login')
  }
 
  if (profileLoading) {
    return (
      <Layout>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 20px', gap: 10, color: 'var(--text3)' }}>
          <div className="spinner" />
          Loading settings...
        </div>
      </Layout>
    )
  }
 
  return (
    <Layout>
      {/* ─── Hero ─── */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: 'Outfit, sans-serif', fontSize: 26, fontWeight: 900, margin: '0 0 4px', color: 'var(--text)' }}>
          Settings
        </h1>
        <p style={{ color: 'var(--text2)', fontSize: 14, margin: 0 }}>
          Manage your account preferences and personal information
        </p>
      </div>
 
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 40 }}>
 
        {/* ─── PROFILE ─── */}
        <form onSubmit={saveProfile}>
          <Card title="Profile Information" icon="ti-user">
            <AvatarUpload name={profile.fullName} />
 
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <Field label="Full Name" value={profile.fullName}
                onChange={v => setProfile(p => ({ ...p, fullName: v }))} placeholder="Your full name" />
              <Field label="Username" value={profile.username}
                onChange={v => setProfile(p => ({ ...p, username: v }))} placeholder="@username" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <Field label="Email" type="email" value={profile.email}
                onChange={() => {}} disabled hint="Email cannot be changed here" />
              <Field label="Phone" type="tel" value={profile.phone}
                onChange={v => setProfile(p => ({ ...p, phone: v }))} placeholder="+234 800 000 0000" />
            </div>
            <div style={{ marginBottom: 12 }}>
              <Field label="Location" value={profile.location}
                onChange={v => setProfile(p => ({ ...p, location: v }))} placeholder="City, Country" />
            </div>
            <div style={{ marginBottom: 16 }}>
              <Field label="Bio" textarea value={profile.bio}
                onChange={v => setProfile(p => ({ ...p, bio: v }))} placeholder="Tell us about yourself..." />
            </div>
 
            <button type="submit" disabled={profileSaving} style={{
              height: 40, padding: '0 20px', borderRadius: 10, border: 'none',
              background: '#121566', color: '#fff', fontWeight: 700, fontSize: 13,
              cursor: profileSaving ? 'not-allowed' : 'pointer', opacity: profileSaving ? 0.6 : 1,
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}>
              {profileSaving
                ? <><span className="spinner" style={{ width: 14, height: 14, borderWidth: 2, borderColor: '#fff4', borderTopColor: '#fff' }} /> Saving...</>
                : <><i className="ti ti-check" /> Save Profile</>
              }
            </button>
          </Card>
        </form>
 
        {/* ─── PREFERENCES ─── */}
        <Card title="Notifications & Privacy" icon="ti-bell">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {([
              { key: 'emailNotifications', label: 'Email Notifications', desc: 'Task updates, earnings and platform news via email' },
              { key: 'smsNotifications', label: 'SMS Alerts', desc: 'Critical alerts sent to your phone number' },
              { key: 'pushNotifications', label: 'Push Notifications', desc: 'Browser notifications for new tasks and approvals' },
              { key: 'publicProfile', label: 'Public Profile', desc: 'Allow others to see your profile and earnings rank' },
              { key: 'showEarnings', label: 'Show Earnings on Profile', desc: 'Display your total earnings publicly on your profile' },
            ] as { key: keyof PrefsForm; label: string; desc: string }[]).map((item, i) => (
              <div key={item.key} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 0',
                borderBottom: i < 4 ? '1px solid var(--border)' : 'none',
              }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', margin: '0 0 2px' }}>{item.label}</p>
                  <p style={{ fontSize: 12, color: 'var(--text2)', margin: 0 }}>{item.desc}</p>
                </div>
                <Toggle checked={prefs[item.key] as boolean}
                  onChange={v => setPrefs(p => ({ ...p, [item.key]: v }))} />
              </div>
            ))}
          </div>
          <div style={{ marginTop: 16 }}>
            <button type="button" onClick={savePrefs} disabled={prefsSaving} style={{
              height: 40, padding: '0 20px', borderRadius: 10, border: 'none',
              background: '#121566', color: '#fff', fontWeight: 700, fontSize: 13,
              cursor: prefsSaving ? 'not-allowed' : 'pointer', opacity: prefsSaving ? 0.6 : 1,
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}>
              {prefsSaving
                ? <><span className="spinner" style={{ width: 14, height: 14, borderWidth: 2, borderColor: '#fff4', borderTopColor: '#fff' }} /> Saving...</>
                : <><i className="ti ti-check" /> Save Preferences</>
              }
            </button>
          </div>
        </Card>
 
        {/* ─── SECURITY ─── */}
        <Card title="Security" icon="ti-shield-lock">
          {/* 2FA */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 0', borderBottom: '1px solid var(--border)',
          }}>
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', margin: '0 0 2px' }}>
                Two-Factor Authentication
                {twoFA && (
                  <span style={{
                    marginLeft: 8, fontSize: 10, fontWeight: 700, padding: '2px 8px',
                    borderRadius: 999, background: 'rgba(22,163,74,.12)',
                    color: '#16a34a', border: '1px solid rgba(22,163,74,.25)',
                  }}>ACTIVE</span>
                )}
              </p>
              <p style={{ fontSize: 12, color: 'var(--text2)', margin: 0 }}>
                {twoFA ? 'Your account has an extra layer of security' : 'Add an extra layer of security to your account'}
              </p>
            </div>
            <button type="button" onClick={toggle2FA} disabled={twoFASaving} style={{
              height: 34, padding: '0 14px', borderRadius: 8,
              border: twoFA ? '1px solid rgba(220,38,38,.3)' : '1px solid rgba(18,21,102,.3)',
              background: twoFA ? 'rgba(220,38,38,.08)' : 'rgba(18,21,102,.08)',
              color: twoFA ? '#dc2626' : '#121566',
              fontWeight: 700, fontSize: 12, cursor: 'pointer', opacity: twoFASaving ? 0.5 : 1,
            }}>
              {twoFASaving ? '...' : twoFA ? 'Disable' : 'Enable'}
            </button>
          </div>
 
          {/* Change Password */}
          <div style={{ padding: '14px 0', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: showPwd ? 16 : 0 }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', margin: '0 0 2px' }}>Password</p>
                <p style={{ fontSize: 12, color: 'var(--text2)', margin: 0 }}>Change your account password</p>
              </div>
              <button type="button" onClick={() => setShowPwd(s => !s)} style={{
                height: 34, padding: '0 14px', borderRadius: 8,
                border: '1px solid var(--border)', background: 'var(--bg2)',
                color: 'var(--text2)', fontWeight: 700, fontSize: 12, cursor: 'pointer',
              }}>
                {showPwd ? 'Cancel' : 'Change'}
              </button>
            </div>
            {showPwd && (
              <form onSubmit={changePassword} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <Field label="Current Password" type="password" value={pwd.current}
                  onChange={v => setPwd(p => ({ ...p, current: v }))} placeholder="••••••••" />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <Field label="New Password" type="password" value={pwd.next}
                    onChange={v => setPwd(p => ({ ...p, next: v }))} placeholder="••••••••"
                    hint="Min. 8 characters" />
                  <Field label="Confirm Password" type="password" value={pwd.confirm}
                    onChange={v => setPwd(p => ({ ...p, confirm: v }))} placeholder="••••••••" />
                </div>
                {pwd.next && pwd.confirm && pwd.next !== pwd.confirm && (
                  <p style={{ fontSize: 11, color: '#dc2626', margin: 0, fontWeight: 600 }}>
                    ⚠ Passwords do not match
                  </p>
                )}
                <button type="submit" disabled={pwdSaving || !pwd.current || !pwd.next || !pwd.confirm} style={{
                  alignSelf: 'flex-start', height: 38, padding: '0 18px', borderRadius: 10, border: 'none',
                  background: '#121566', color: '#fff', fontWeight: 700, fontSize: 13,
                  cursor: 'pointer', opacity: (pwdSaving || !pwd.current || !pwd.next || !pwd.confirm) ? 0.5 : 1,
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                }}>
                  {pwdSaving ? 'Changing...' : 'Update Password'}
                </button>
              </form>
            )}
          </div>
 
          {/* Active Sessions */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0' }}>
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', margin: '0 0 2px' }}>Active Session</p>
              <p style={{ fontSize: 12, color: 'var(--text2)', margin: 0 }}>
                {navigator.platform || 'Unknown device'} · Just now
              </p>
            </div>
            <button type="button" onClick={logout} style={{
              height: 34, padding: '0 14px', borderRadius: 8,
              border: '1px solid var(--border)', background: 'var(--bg2)',
              color: 'var(--text2)', fontWeight: 700, fontSize: 12, cursor: 'pointer',
            }}>
              Sign Out
            </button>
          </div>
        </Card>
 
        {/* ─── BANK / PAYOUT ─── */}
        <Card title="Payout Details" icon="ti-building-bank">
          <p style={{ fontSize: 13, color: 'var(--text2)', margin: '0 0 16px' }}>
            Add your bank account to receive earnings. All payouts are processed weekly.
          </p>
          <button type="button" onClick={() => navigate('/wallet')} style={{
            height: 40, padding: '0 20px', borderRadius: 10,
            border: '1px solid rgba(18,21,102,.3)', background: 'rgba(18,21,102,.08)',
            color: '#121566', fontWeight: 700, fontSize: 13, cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: 8,
          }}>
            <i className="ti ti-external-link" />
            Manage Payout Methods
          </button>
        </Card>
 
        {/* ─── DANGER ZONE ─── */}
        <div style={{
          background: 'rgba(220,38,38,0.05)', border: '1px solid rgba(220,38,38,0.2)',
          borderRadius: 16, padding: 24,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 10,
              background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <i className="ti ti-alert-triangle" style={{ fontSize: 15, color: '#dc2626' }} />
            </div>
            <span style={{ fontSize: 14, fontWeight: 800, color: '#dc2626' }}>Danger Zone</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', margin: '0 0 2px' }}>Delete Account</p>
              <p style={{ fontSize: 12, color: 'var(--text2)', margin: 0 }}>
                Permanently delete your account and all associated data. This cannot be undone.
              </p>
            </div>
            <button type="button" onClick={() => setDeleteModal(true)} style={{
              height: 36, padding: '0 16px', borderRadius: 10,
              border: '1px solid rgba(220,38,38,.4)', background: 'rgba(220,38,38,.1)',
              color: '#dc2626', fontWeight: 700, fontSize: 12, cursor: 'pointer',
            }}>
              Delete Account
            </button>
          </div>
        </div>
 
      </div>
 
      {/* ─── DELETE MODAL ─── */}
      {deleteModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 50,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.7)', backdropFilter: 'blur(4px)' }}
            onClick={() => setDeleteModal(false)} />
          <div style={{
            position: 'relative', width: '100%', maxWidth: 400,
            background: 'var(--card)', border: '1px solid rgba(220,38,38,.3)',
            borderRadius: 20, padding: 28,
          }}>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{
                width: 52, height: 52, borderRadius: 14,
                background: 'rgba(220,38,38,.1)', border: '1px solid rgba(220,38,38,.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 12px',
              }}>
                <i className="ti ti-trash" style={{ fontSize: 24, color: '#dc2626' }} />
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 900, color: 'var(--text)', margin: '0 0 6px' }}>Delete Account?</h3>
              <p style={{ fontSize: 13, color: 'var(--text2)', margin: 0, lineHeight: 1.6 }}>
                This will permanently delete your account, tasks, and earnings history. Type <strong>delete</strong> to confirm.
              </p>
            </div>
            <Field label='Type "delete" to confirm' value={deleteConfirm}
              onChange={setDeleteConfirm} placeholder="delete" />
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button type="button" onClick={() => { setDeleteModal(false); setDeleteConfirm('') }} style={{
                flex: 1, height: 40, borderRadius: 10,
                border: '1px solid var(--border)', background: 'var(--bg2)',
                color: 'var(--text2)', fontWeight: 700, fontSize: 13, cursor: 'pointer',
              }}>
                Cancel
              </button>
              <button type="button" onClick={deleteAccount}
                disabled={deleteConfirm.toLowerCase() !== 'delete'} style={{
                  flex: 1, height: 40, borderRadius: 10, border: 'none',
                  background: deleteConfirm.toLowerCase() === 'delete' ? '#dc2626' : 'var(--bg2)',
                  color: deleteConfirm.toLowerCase() === 'delete' ? '#fff' : 'var(--text3)',
                  fontWeight: 700, fontSize: 13,
                  cursor: deleteConfirm.toLowerCase() === 'delete' ? 'pointer' : 'not-allowed',
                }}>
                Delete Forever
              </button>
            </div>
          </div>
        </div>
      )}
 
      <Toast visible={toast.visible} message={toast.message} type={toast.type} />
    </Layout>
  )
}

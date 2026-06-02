import { useState } from 'react'
import Layout from '../components/Layout'

export default function Settings() {
  const [saved, setSaved] = useState(false)

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <Layout>
      <style>{`
        .st-hero{margin-bottom:20px}
        .st-hero h1{font-family:Outfit;font-size:28px;font-weight:900;margin:0 0 4px}
        .st-hero p{color:var(--text2);font-size:14px;margin:0}
        .st-sections{display:grid;gap:14px}
        .st-card{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:24px;transition:all .25s}
        .st-card:hover{border-color:var(--border2)}
        .st-card-title{font-weight:800;font-size:14px;margin-bottom:16px;display:flex;align-items:center;gap:8px}
        .st-card-title i{color:var(--accent)}
        .st-field{margin-bottom:14px}
        .st-field label{display:block;font-size:11px;font-weight:700;color:var(--text3);margin-bottom:4px;text-transform:uppercase;letter-spacing:.04em}
        .st-field input,.st-field textarea,.st-field select{width:100%;padding:0 12px;border:1px solid var(--border);border-radius:8px;background:var(--bg2);color:var(--text);font-size:13px;outline:0;transition:border-color .2s;height:38px}
        .st-field textarea{height:80px;padding:10px 12px;resize:vertical}
        .st-field input:focus,.st-field textarea:focus,.st-field select:focus{border-color:var(--accent)}
        .st-row{display:grid;grid-template-columns:1fr 1fr;gap:14px}
        @media(max-width:500px){.st-row{grid-template-columns:1fr}}
        .st-save-btn{height:40px;padding:0 24px;border-radius:10px;border:0;background:var(--accent);color:#fff;font-weight:700;font-size:13px;display:inline-flex;align-items:center;gap:6px;cursor:pointer;transition:all .2s;margin-top:4px}
        .st-save-btn:hover{box-shadow:0 4px 16px rgba(124,58,237,.2)}
        .st-toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:var(--green);color:#fff;padding:10px 20px;border-radius:10px;font-size:13px;font-weight:700;z-index:999;opacity:0;transition:all .3s;pointer-events:none}
        .st-toast.show{opacity:1;transform:translateX(-50%) translateY(0)}
      `}</style>

      <div className="st-hero">
        <h1>Settings</h1>
        <p>Manage your account preferences and personal information</p>
      </div>

      <form onSubmit={handleSave}>
        <div className="st-sections">
          {/* Profile Information */}
          <div className="st-card">
            <div className="st-card-title"><i className="ti ti-user" /> Profile Information</div>
            <div className="st-row">
              <div className="st-field">
                <label>Full Name</label>
                <input type="text" defaultValue="User Name" />
              </div>
              <div className="st-field">
                <label>Username</label>
                <input type="text" defaultValue="@username" />
              </div>
            </div>
            <div className="st-row">
              <div className="st-field">
                <label>Email</label>
                <input type="email" defaultValue="user@email.com" />
              </div>
              <div className="st-field">
                <label>Phone</label>
                <input type="tel" defaultValue="+234 800 000 0000" />
              </div>
            </div>
            <div className="st-field">
              <label>Location</label>
              <input type="text" defaultValue="Lagos, Nigeria" />
            </div>
            <div className="st-field">
              <label>Bio</label>
              <textarea placeholder="Tell us about yourself..." defaultValue="Task worker & community member on OgaPay" />
            </div>
          </div>

          {/* Preferences */}
          <div className="st-card">
            <div className="st-card-title"><i className="ti ti-settings" /> Preferences</div>
            <div className="st-field" style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <div>
                <div style={{fontWeight:700,fontSize:13}}>Email Notifications</div>
                <div style={{fontSize:12,color:'var(--text2)'}}>Receive email updates about tasks and earnings</div>
              </div>
              <label style={{position:'relative',display:'inline-block',width:40,height:22}}>
                <input type="checkbox" defaultChecked style={{opacity:0,width:0,height:0}} />
                <span style={{position:'absolute',cursor:'pointer',inset:0,background:'var(--border)',borderRadius:11,transition:'.2s'}} className="st-toggle" />
              </label>
            </div>
            <div className="st-field" style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <div>
                <div style={{fontWeight:700,fontSize:13}}>Public Profile</div>
                <div style={{fontSize:12,color:'var(--text2)'}}>Make your profile visible to everyone</div>
              </div>
              <label style={{position:'relative',display:'inline-block',width:40,height:22}}>
                <input type="checkbox" defaultChecked style={{opacity:0,width:0,height:0}} />
                <span style={{position:'absolute',cursor:'pointer',inset:0,background:'var(--accent)',borderRadius:11,transition:'.2s'}} className="st-toggle" />
              </label>
            </div>
          </div>

          {/* Security */}
          <div className="st-card">
            <div className="st-card-title"><i className="ti ti-shield-lock" /> Security</div>
            <div className="st-field" style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <div>
                <div style={{fontWeight:700,fontSize:13}}>Two-Factor Authentication</div>
                <div style={{fontSize:12,color:'var(--text2)'}}>Add an extra layer of security to your account</div>
              </div>
              <button type="button" style={{height:34,padding:'0 14px',borderRadius:8,border:'1px solid var(--border)',background:'transparent',color:'var(--text2)',fontWeight:600,fontSize:11,cursor:'pointer'}}>Enable</button>
            </div>
            <div className="st-field" style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <div>
                <div style={{fontWeight:700,fontSize:13}}>Password</div>
                <div style={{fontSize:12,color:'var(--text2)'}}>Last changed 30 days ago</div>
              </div>
              <button type="button" style={{height:34,padding:'0 14px',borderRadius:8,border:'1px solid var(--border)',background:'transparent',color:'var(--text2)',fontWeight:600,fontSize:11,cursor:'pointer'}}>Change</button>
            </div>
          </div>

          <button type="submit" className="st-save-btn"><i className="ti ti-check" /> {saved ? 'Saved!' : 'Save Changes'}</button>
        </div>
      </form>

      <div className={`st-toast ${saved ? 'show' : ''}`}>Settings saved successfully</div>
    </Layout>
  )
}

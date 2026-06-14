import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import Layout from '../components/Layout'

const quickLinks = [
  { icon: 'ti ti-checklist', label: 'Browse Tasks', href: '/app/tasks', color: '#7C3AED' },
  { icon: 'ti ti-wallet', label: 'Wallet', href: '/app/wallet', color: '#16a34a' },
  { icon: 'ti ti-building-store', label: 'My Store', href: '/app/my-store', color: '#2563EB' },
  { icon: 'ti ti-users', label: 'Communities', href: '/app/communities', color: '#EC4899' },
  { icon: 'ti ti-bell', label: 'Notifications', href: '/app/notifications', color: '#F59E0B' },
  { icon: 'ti ti-settings', label: 'Settings', href: '/app/settings', color: '#6B7280' },
]

const moreLinks = [
  { icon: 'ti ti-briefcase', label: 'Worker Portal', href: '/app/worker-portal' },
  { icon: 'ti ti-message', label: 'Messages', href: '/app/messages' },
  { icon: 'ti ti-affiliate', label: 'Referrals', href: '/app/referrals' },
  { icon: 'ti ti-vault', label: 'Vault', href: '/app/vault' },
  { icon: 'ti ti-article', label: 'Blog', href: '/blog' },
  { icon: 'ti ti-headset', label: 'Support', href: '/support' },
]

export default function Profile() {
  const { isAuthed } = useAuth()
  const [moreOpen, setMoreOpen] = useState(false)

  if (!isAuthed) {
    return (
      <Layout sidebar={false}>
        <div className="loading"><div className="spinner" /> Sign in to view your profile</div>
      </Layout>
    )
  }

  return (
    <Layout>
      <style>{`
        .pf-row{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-bottom:18px}
        @media(max-width:700px){.pf-row{grid-template-columns:1fr}}
        .pf-card{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:24px;transition:all .25s}
        .pf-card:hover{border-color:var(--border2)}
        .pf-card-title{font-size:11px;font-weight:800;color:var(--text3);letter-spacing:.06em;text-transform:uppercase;margin-bottom:14px}
        .pf-bal{font-family:Outfit;font-size:32px;font-weight:900;color:var(--text);margin:0 0 2px}
        .pf-bal-sub{font-size:13px;color:var(--text2);margin-bottom:14px}
        .pf-actions{display:flex;gap:6px;flex-wrap:wrap}
        .pfa-btn{height:34px;padding:0 14px;border-radius:8px;font-weight:700;font-size:12px;display:inline-flex;align-items:center;gap:5px;cursor:pointer;transition:all .2s;text-decoration:none;border:1px solid var(--border);background:var(--bg2);color:var(--text)}
        .pfa-btn.primary{background:var(--accent);color:#fff;border-color:var(--accent)}
        .pfa-btn.primary:hover{box-shadow:0 4px 20px rgba(124,58,237,.2)}
        .pfa-btn:hover{border-color:var(--accent);color:var(--accent)}
        .pf-profile{display:flex;gap:16px;align-items:flex-start}
        .pf-avatar{width:64px;height:64px;border-radius:50%;background:var(--bg2);display:grid;place-items:center;border:3px solid var(--accent);flex-shrink:0;overflow:hidden}
        .pf-avatar i{font-size:28px;color:var(--text3)}
        .pf-name{font-family:Outfit;font-size:20px;font-weight:800;margin:0 0 2px}
        .pf-uname{color:var(--text2);font-size:13px;margin-bottom:4px}
        .pf-bio{color:var(--text2);font-size:13px;margin-bottom:10px;max-width:280px}
        .pf-badges{display:flex;gap:5px;flex-wrap:wrap;margin-bottom:10px}
        .pf-badge{display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:6px;font-size:10px;font-weight:700;border:1px solid}
        .pf-badge.verified{border-color:var(--green);color:var(--green);background:rgba(22,163,74,.08)}
        .pf-badge.rank{border-color:var(--accent);color:var(--accent);background:rgba(124,58,237,.08)}
        .pf-badge.rep{border-color:var(--gold);color:var(--gold);background:rgba(245,179,1,.08)}
        .pf-ref-card{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:20px 24px;margin-bottom:18px;transition:all .25s}
        .pf-ref-card:hover{border-color:var(--border2)}
        .pf-ref-title{font-weight:700;font-size:15px;margin-bottom:4px}
        .pf-ref-desc{font-size:13px;color:var(--text2);margin-bottom:12px}
        .pf-ref-row{display:flex;gap:8px}
        .pf-ref-row input{flex:1;height:36px;padding:0 12px;border:1px solid var(--border);border-radius:8px;background:var(--bg2);color:var(--text);font-size:12px;outline:0}
        .pf-ref-row input:focus{border-color:var(--accent)}
        .pf-ref-row button{height:36px;padding:0 14px;border-radius:8px;font-weight:700;font-size:12px;display:inline-flex;align-items:center;gap:5px;cursor:pointer;border:0;background:var(--accent);color:#fff;transition:all .2s}
        .pf-ref-row button:hover{box-shadow:0 4px 16px rgba(124,58,237,.25)}
        .pf-quick-links{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:12px}
        @media(max-width:500px){.pf-quick-links{grid-template-columns:repeat(2,1fr)}}
        .pf-ql{display:flex;flex-direction:column;align-items:center;gap:8px;padding:14px 10px;background:var(--card);border:1px solid var(--border);border-radius:12px;text-align:center;cursor:pointer;transition:all .2s;text-decoration:none}
        .pf-ql:hover{transform:translateY(-2px);border-color:var(--accent);box-shadow:0 0 20px rgba(124,58,237,.06)}
        .pf-ql i{font-size:22px}
        .pf-ql span{font-size:12px;font-weight:700;color:var(--text)}
        .pf-more-btn{width:100%;height:38px;display:flex;align-items:center;justify-content:center;gap:6px;padding:0 14px;border:1px dashed var(--border);border-radius:10px;background:transparent;color:var(--text2);font-size:12px;font-weight:600;cursor:pointer;transition:all .2s}
        .pf-more-btn:hover{border-color:var(--accent);color:var(--accent)}
        .pf-more-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:10px}
        @media(max-width:500px){.pf-more-grid{grid-template-columns:repeat(2,1fr)}}
        .pf-ml{display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:8px;text-decoration:none;color:var(--text2);font-size:12px;font-weight:600;transition:all .14s}
        .pf-ml:hover{background:var(--bg2);color:var(--text)}
        .pf-ml i{font-size:16px;width:18px;text-align:center}
      `}</style>

      {/* Breadcrumb */}
      <div className="bread" style={{marginBottom:16}}>
        <a href="/app" style={{color:'var(--text2)'}}>Home</a>
        <i className="ti ti-chevron-right" style={{fontSize:10,margin:'0 6px',color:'var(--text3)'}} />
        <span style={{color:'var(--text)'}}>Profile</span>
      </div>

      {/* Two-column: Account Info + Profile */}
      <div className="pf-row">
        {/* Left: Account Info */}
        <div className="pf-card">
          <div className="pf-card-title">Account Information</div>
          <div className="pf-bal">NGN 12,450.00</div>
          <div className="pf-bal-sub">Available Balance: NGN 8,250.00</div>
          <div className="pf-actions">
            <a href="/app/wallet" className="pfa-btn primary"><i className="ti ti-plus" /> Withdraw</a>
            <a href="/app/wallet" className="pfa-btn"><i className="ti ti-logout" /> Deposit</a>
            <a href="/app/wallet" className="pfa-btn"><i className="ti ti-transfer" /> Transfer</a>
          </div>
        </div>

        {/* Right: Profile */}
        <div className="pf-card">
          <div className="pf-profile">
            <div className="pf-avatar">
              <i className="ti ti-user" />
            </div>
            <div style={{flex:1}}>
              <div className="pf-name">User Name</div>
              <div className="pf-uname">@username</div>
              <div className="pf-bio">Task poster &amp; community builder on OgaPay</div>
              <div className="pf-badges">
                <span className="pf-badge rank"><i className="ti ti-crown" /> Gold Tier</span>
                <span className="pf-badge rep"><i className="ti ti-star" /> 4.8 Rep</span>
                <span className="pf-badge verified"><i className="ti ti-circle-check" /> Verified</span>
              </div>
              <div className="pf-actions">
                <a href="/app/settings" className="pfa-btn primary"><i className="ti ti-edit" /> Edit Profile</a>
                <button className="pfa-btn"><i className="ti ti-share" /> Share</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Referral Program */}
      <div className="pf-ref-card">
        <div className="pf-ref-title"><i className="ti ti-affiliate" style={{color:'var(--accent)',marginRight:6}} />Referral Program</div>
        <div className="pf-ref-desc">Share your referral link and earn rewards when friends join OgaPay</div>
        <div className="pf-ref-row">
          <input type="text" value="https://ogapay.app/ref/your-code" readOnly />
          <button onClick={() => { const t = document.querySelector<HTMLInputElement>('.pf-ref-row input'); t?.select(); try { document.execCommand('copy') } catch {} }}>Copy Link</button>
        </div>
      </div>

      {/* Quick Links */}
      <div className="pf-card-title" style={{padding:'0 2px'}}>Quick Links</div>
      <div className="pf-quick-links">
        {quickLinks.map((q, i) => (
          <a className="pf-ql" href={q.href} key={i}>
            <i className={q.icon} style={{color: q.color}} />
            <span>{q.label}</span>
          </a>
        ))}
      </div>

      {/* More Links */}
      <button className="pf-more-btn" onClick={() => setMoreOpen(!moreOpen)}>
        <i className={`ti ${moreOpen ? 'ti-chevron-up' : 'ti-chevron-down'}`} />
        {moreOpen ? 'Less Links' : 'More Links'}
      </button>

      {moreOpen && (
        <div className="pf-more-grid">
          {moreLinks.map((m, i) => (
            <a className="pf-ml" href={m.href} key={i}>
              <i className={m.icon} style={{color:'var(--accent)'}} />
              {m.label}
            </a>
          ))}
        </div>
      )}
    </Layout>
  )
}

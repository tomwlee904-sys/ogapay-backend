import { useState } from 'react'
import Layout from '../components/Layout'

const faqCategories = [
  { icon: 'ti ti-wallet', title: 'Payments', desc: 'Withdrawals, deposits, and billing', count: 6 },
  { icon: 'ti ti-shield-check', title: 'Account', desc: 'Verification, security, and settings', count: 4 },
  { icon: 'ti ti-clipboard-check', title: 'Tasks', desc: 'Completing and submitting tasks', count: 5 },
  { icon: 'ti ti-users', title: 'Community', desc: 'Communities and social features', count: 3 },
]

const contactOptions = [
  { icon: 'ti ti-mail', title: 'Email Support', desc: 'Get a response within 24 hours', action: 'support@ogapay.app', href: 'mailto:support@ogapay.app' },
  { icon: 'ti ti-message', title: 'Live Chat', desc: 'Chat with our support team', action: 'Start Chat', href: '#' },
  { icon: 'ti ti-send', title: 'Telegram', desc: 'Join our community group', action: 'Join Group', href: 'https://t.me/ogapay' },
  { icon: 'ti ti-file-text', title: 'Documentation', desc: 'Read our guides and tutorials', action: 'View Docs', href: '/app/faq' },
]

const tickets = [
  { id: 'TKT-001', subject: 'Withdrawal not processed', status: 'Open', date: '2 hours ago', priority: 'High', color: '#DC2626' },
  { id: 'TKT-002', subject: 'Account verification issue', status: 'In Progress', date: '1 day ago', priority: 'Medium', color: '#F59E0B' },
  { id: 'TKT-003', subject: 'Task submission rejected', status: 'Resolved', date: '3 days ago', priority: 'Low', color: '#16a34a' },
]

export default function Support() {
  const [showTicket, setShowTicket] = useState(false)
  const [search, setSearch] = useState('')

  return (
    <Layout>
      <style>{`
        .sp-hero{text-align:center;padding:36px 20px 28px;margin-bottom:24px;background:linear-gradient(135deg,rgba(124,58,237,.08),rgba(37,99,235,.06),var(--card));border-radius:16px;border:1px solid var(--border)}
        .sp-hero h1{font-family:Outfit;font-size:32px;font-weight:900;margin:0 0 6px}
        .sp-hero p{color:var(--text2);font-size:14px;margin:0 0 20px;max-width:480px;margin-left:auto;margin-right:auto}
        .sp-search{max-width:480px;margin:0 auto;display:flex;align-items:center;gap:8px;height:44px;padding:0 16px;border:1px solid var(--border);border-radius:12px;background:var(--card);transition:border-color .2s}
        .sp-search:focus-within{border-color:var(--accent)}
        .sp-search input{flex:1;border:0;background:transparent;outline:0;color:var(--text);font-size:14px}
        .sp-search input::placeholder{color:var(--text3)}
        .sp-search i{color:var(--text3);font-size:18px}
        .sp-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:24px}
        @media(max-width:600px){.sp-grid{grid-template-columns:1fr}}
        .sp-card{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:16px;cursor:pointer;transition:all .2s}
        .sp-card:hover{transform:translateY(-2px);border-color:var(--accent)}
        .sp-card i{font-size:22px;color:var(--accent);margin-bottom:6px;display:block}
        .sp-card h3{font-family:Outfit;font-size:14px;font-weight:800;margin:0 0 2px}
        .sp-card p{color:var(--text2);font-size:12px;margin:0}
        .sp-contact{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:24px}
        @media(max-width:500px){.sp-contact{grid-template-columns:1fr}}
        .sp-contact-card{padding:16px;border:1px solid var(--border);border-radius:12px;background:var(--card);display:flex;align-items:center;gap:14px;transition:all .2s;text-decoration:none;color:inherit}
        .sp-contact-card:hover{border-color:var(--accent)}
        .sp-contact-card i{font-size:22px;color:var(--accent);flex-shrink:0}
        .sp-cc-info{flex:1}
        .sp-cc-info strong{display:block;font-size:13px;margin-bottom:2px}
        .sp-cc-info span{font-size:11px;color:var(--text2)}
        .sp-cc-action{font-size:11px;font-weight:700;color:var(--accent);white-space:nowrap}
        .sp-section-title{font-family:Outfit;font-size:15px;font-weight:800;margin:0 0 12px;display:flex;align-items:center;gap:6px}
        .sp-tickets{display:grid;gap:6px;margin-bottom:24px}
        .sp-ticket{display:flex;align-items:center;gap:12px;padding:12px 16px;background:var(--card);border:1px solid var(--border);border-radius:10px;transition:all .2s;cursor:pointer}
        .sp-ticket:hover{border-color:var(--border2)}
        .sp-ticket-id{font-size:11px;font-weight:700;color:var(--text3);min-width:65px}
        .sp-ticket-sub{flex:1;font-weight:700;font-size:13px}
        .sp-ticket-date{font-size:11px;color:var(--text3)}
        .sp-ticket-status{padding:3px 8px;border-radius:5px;font-size:10px;font-weight:700}
        .sp-empty{text-align:center;padding:32px;color:var(--text2)}
        .sp-empty i{font-size:32px;color:var(--text3);margin-bottom:8px;display:block}
        /* Modal */
        .sp-overlay{position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:400;display:none;align-items:center;justify-content:center;padding:20px}
        .sp-overlay.open{display:flex}
        .sp-modal{background:var(--card);border:1px solid var(--border);border-radius:16px;padding:24px;width:min(480px,100%)}
        .sp-modal h2{font-family:Outfit;font-size:20px;font-weight:900;margin:0 0 16px}
        .sp-field{margin-bottom:12px}
        .sp-field label{display:block;font-size:11px;font-weight:700;color:var(--text3);margin-bottom:4px;text-transform:uppercase}
        .sp-field input,.sp-field select,.sp-field textarea{width:100%;padding:0 12px;border:1px solid var(--border);border-radius:8px;background:var(--bg2);color:var(--text);font-size:13px;outline:0;font-family:inherit}
        .sp-field input,.sp-field select{height:38px}
        .sp-field textarea{height:80px;padding:10px 12px;resize:vertical}
        .sp-field input:focus,.sp-field select:focus,.sp-field textarea:focus{border-color:var(--accent)}
        .sp-modal-actions{display:flex;gap:8px;margin-top:16px;justify-content:flex-end}
      `}</style>

      <div className="sp-hero">
        <h1>Support</h1>
        <p>Get help with your account, tasks, payments, and more</p>
        <div className="sp-search">
          <i className="ti ti-search" />
          <input type="text" placeholder="Search for help..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {/* FAQ Categories */}
      <div className="sp-section-title"><i className="ti ti-help-circle" style={{color:'var(--accent)'}} /> Help Topics</div>
      <div className="sp-grid">
        {faqCategories.map((c, i) => (
          <a className="sp-card" href="/app/faq" key={i}>
            <i className={c.icon} />
            <h3>{c.title}</h3>
            <p>{c.desc}</p>
          </a>
        ))}
      </div>

      {/* Contact */}
      <div className="sp-section-title"><i className="ti ti-headset" style={{color:'var(--accent)'}} /> Contact Us</div>
      <div className="sp-contact">
        {contactOptions.map((c, i) => (
          <a className="sp-contact-card" href={c.href} key={i}>
            <i className={c.icon} />
            <div className="sp-cc-info">
              <strong>{c.title}</strong>
              <span>{c.desc}</span>
            </div>
            <span className="sp-cc-action">{c.action}</span>
          </a>
        ))}
      </div>

      {/* Tickets */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
        <div className="sp-section-title" style={{margin:0}}>
          <i className="ti ti-ticket" style={{color:'var(--accent)'}} /> My Tickets
        </div>
        <button className="cmp-btn" style={{height:32,padding:'0 12px',border:'1px solid var(--border)',borderRadius:8,background:'transparent',color:'var(--text2)',fontSize:11,fontWeight:600,cursor:'pointer'}} onClick={() => setShowTicket(true)}>
          <i className="ti ti-plus" /> New Ticket
        </button>
      </div>

      <div className="sp-tickets">
        {tickets.length === 0 ? (
          <div className="sp-empty">
            <i className="ti ti-ticket" />
            <h3 style={{fontFamily:'Outfit',fontWeight:800,margin:'0 0 4px',color:'var(--text)'}}>No tickets yet</h3>
            <p style={{fontSize:13,margin:0}}>Create a support ticket to get help</p>
          </div>
        ) : (
          tickets.map(t => (
            <div className="sp-ticket" key={t.id}>
              <span className="sp-ticket-id">{t.id}</span>
              <span className="sp-ticket-sub">{t.subject}</span>
              <span className="sp-ticket-date">{t.date}</span>
              <span className="sp-ticket-status" style={{background: `${t.color}15`, color: t.color}}>{t.status}</span>
            </div>
          ))
        )}
      </div>

      {/* New Ticket Modal */}
      <div className={`sp-overlay ${showTicket ? 'open' : ''}`} onClick={() => setShowTicket(false)}>
        <div className="sp-modal" onClick={e => e.stopPropagation()}>
          <h2>New Support Ticket</h2>
          <div className="sp-field">
            <label>Subject</label>
            <input type="text" placeholder="Brief description of your issue" />
          </div>
          <div className="sp-field">
            <label>Category</label>
            <select>
              <option>Payments & Withdrawals</option>
              <option>Account & Login</option>
              <option>Tasks & Submissions</option>
              <option>Referrals</option>
              <option>Technical Issue</option>
              <option>Other</option>
            </select>
          </div>
          <div className="sp-field">
            <label>Priority</label>
            <select>
              <option>Low</option>
              <option>Medium</option>
              <option>High</option>
            </select>
          </div>
          <div className="sp-field">
            <label>Description</label>
            <textarea placeholder="Describe your issue in detail..." />
          </div>
          <div className="sp-modal-actions">
            <button className="cmp-btn" onClick={() => setShowTicket(false)}>Cancel</button>
            <button className="cmp-btn primary" style={{background:'var(--accent)',color:'#fff',border:'0'}} onClick={() => setShowTicket(false)}>Submit Ticket</button>
          </div>
        </div>
      </div>
    </Layout>
  )
}

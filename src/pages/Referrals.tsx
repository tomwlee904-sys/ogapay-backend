import { useState } from 'react'
import Layout from '../components/Layout'

const referrals = [
  { name: 'John Doe', date: '2 days ago', earnings: 'NGN 500', status: 'Active' },
  { name: 'Jane Smith', date: '1 week ago', earnings: 'NGN 300', status: 'Active' },
  { name: 'Mike Johnson', date: '2 weeks ago', earnings: 'NGN 200', status: 'Active' },
]

export default function Referrals() {
  const [copied, setCopied] = useState(false)

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText('https://ogapay.app/ref/your-code')
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  return (
    <Layout>
      <style>{`
        .rf-hero{margin-bottom:20px}
        .rf-hero .rf-greeting{color:var(--text2);font-size:13px;font-weight:600;margin-bottom:2px}
        .rf-hero h1{font-family:Outfit;font-size:28px;font-weight:900;margin:0 0 4px}
        .rf-hero p{color:var(--text2);font-size:14px;margin:0}
        .rf-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px}
        @media(max-width:500px){.rf-stats{grid-template-columns:1fr}}
        .rf-stat{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:16px;text-align:center;transition:all .25s}
        .rf-stat:hover{transform:translateY(-2px);border-color:var(--accent)}
        .rf-stat i{font-size:24px;margin-bottom:6px;display:block}
        .rf-stat .rf-num{font-family:Outfit;font-size:24px;font-weight:900}
        .rf-stat .rf-label{font-size:12px;color:var(--text2);margin-top:2px}
        .rf-ref-card{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:20px 24px;margin-bottom:20px;transition:all .25s}
        .rf-ref-card:hover{border-color:var(--border2)}
        .rf-ref-title{font-weight:700;font-size:15px;margin-bottom:4px}
        .rf-ref-desc{font-size:13px;color:var(--text2);margin-bottom:12px}
        .rf-ref-row{display:flex;gap:8px}
        .rf-ref-row input{flex:1;height:38px;padding:0 12px;border:1px solid var(--border);border-radius:8px;background:var(--bg2);color:var(--text);font-size:13px;outline:0}
        .rf-ref-row input:focus{border-color:var(--accent)}
        .rf-ref-row button{height:38px;padding:0 16px;border-radius:8px;font-weight:700;font-size:12px;display:inline-flex;align-items:center;gap:5px;cursor:pointer;border:0;background:var(--accent);color:#fff;transition:all .2s}
        .rf-ref-row button:hover{box-shadow:0 4px 16px rgba(124,58,237,.25)}
        .rf-list{display:grid;gap:6px}
        .rf-item{display:flex;align-items:center;gap:14px;padding:12px 16px;background:var(--card);border:1px solid var(--border);border-radius:10px;transition:all .2s}
        .rf-item:hover{border-color:var(--border2)}
        .rf-avatar{width:36px;height:36px;border-radius:50%;background:var(--bg2);display:grid;place-items:center;flex-shrink:0;font-size:16px;color:var(--text3)}
        .rf-info{flex:1;min-width:0}
        .rf-name{font-weight:700;font-size:13px;margin-bottom:1px}
        .rf-date{font-size:11px;color:var(--text3)}
        .rf-earn{font-weight:700;font-size:13px;color:var(--green);white-space:nowrap}
        .rf-empty{text-align:center;padding:48px 20px;color:var(--text2)}
        .rf-empty i{font-size:36px;color:var(--text3);margin-bottom:12px;display:block}
      `}</style>

      <div className="rf-hero">
        <div className="rf-greeting">Earn by sharing</div>
        <h1>Referrals</h1>
        <p>Invite friends and earn rewards when they join OgaPay</p>
      </div>

      <div className="rf-stats">
        {[
          { icon: 'ti ti-users', color: '#7C3AED', count: '3', label: 'Total Referrals' },
          { icon: 'ti ti-coin', color: '#16a34a', count: 'NGN 1,000', label: 'Total Earned' },
          { icon: 'ti ti-trending-up', color: '#2563EB', count: 'NGN 500', label: 'This Month' },
        ].map((s, i) => (
          <div className="rf-stat" key={i}>
            <i className={s.icon} style={{color: s.color}} />
            <div className="rf-num" style={{color: s.color}}>{s.count}</div>
            <div className="rf-label">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="rf-ref-card">
        <div className="rf-ref-title"><i className="ti ti-link" style={{color:'var(--accent)',marginRight:6}} />Your Referral Link</div>
        <div className="rf-ref-desc">Share this link with friends — you earn when they sign up and complete tasks</div>
        <div className="rf-ref-row">
          <input type="text" value="https://ogapay.app/ref/your-code" readOnly />
          <button onClick={copyLink}>{copied ? 'Copied!' : 'Copy Link'}</button>
        </div>
      </div>

      <div style={{fontFamily:'Outfit',fontSize:15,fontWeight:800,marginBottom:12}}>
        <i className="ti ti-list" style={{color:'var(--accent)',marginRight:6}} />Referral History
      </div>

      {referrals.length === 0 ? (
        <div className="rf-empty">
          <i className="ti ti-users" />
          <h3 style={{fontFamily:'Outfit',fontWeight:800,margin:'0 0 4px',color:'var(--text)'}}>No referrals yet</h3>
          <p style={{fontSize:13,margin:0}}>Share your link to start earning</p>
        </div>
      ) : (
        <div className="rf-list">
          {referrals.map((r, i) => (
            <div className="rf-item" key={i}>
              <div className="rf-avatar"><i className="ti ti-user" /></div>
              <div className="rf-info">
                <div className="rf-name">{r.name}</div>
                <div className="rf-date">{r.date}</div>
              </div>
              <div className="rf-earn">{r.earnings}</div>
            </div>
          ))}
        </div>
      )}
    </Layout>
  )
}

import { useState } from 'react'
import Layout from '../components/Layout'

const transactions = [
  { date: 'Today', type: 'Deposit', amount: '+NGN 5,000', status: 'Completed', statusColor: 'var(--green)' as const },
  { date: 'Yesterday', type: 'Withdrawal', amount: '-NGN 2,000', status: 'Processing', statusColor: 'var(--gold)' as const },
  { date: '3 days ago', type: 'Task Reward', amount: '+NGN 1,200', status: 'Completed', statusColor: 'var(--green)' as const },
  { date: '5 days ago', type: 'Referral Bonus', amount: '+NGN 300', status: 'Completed', statusColor: 'var(--green)' as const },
  { date: '1 week ago', type: 'Withdrawal', amount: '-NGN 5,000', status: 'Completed', statusColor: 'var(--green)' as const },
]

export default function Wallet() {
  const [activeTab, setActiveTab] = useState('all')

  const filtered = activeTab === 'all' ? transactions : transactions.filter(t => t.type.toLowerCase().includes(activeTab))

  return (
    <Layout>
      <style>{`
        .wl-hero{background:linear-gradient(135deg,rgba(124,58,237,.1),var(--card));border:1px solid var(--border);border-radius:14px;padding:28px 32px;margin-bottom:24px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:16px}
        .wl-hero .wlh-label{color:var(--text2);font-size:13px;font-weight:600;margin-bottom:4px}
        .wl-hero .wlh-bal{font-family:Outfit;font-size:36px;font-weight:900;background:linear-gradient(135deg,#fff,var(--accent));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
        .wl-hero .wlh-sub{color:var(--text2);font-size:14px}
        .wl-actions{display:flex;gap:8px;flex-wrap:wrap}
        .wla-btn{height:40px;padding:0 20px;border-radius:10px;font-weight:700;font-size:13px;display:inline-flex;align-items:center;gap:6px;cursor:pointer;transition:all .2s;text-decoration:none}
        .wla-btn.primary{background:var(--accent);color:#fff;border:0}
        .wla-btn.primary:hover{box-shadow:0 4px 20px rgba(124,58,237,.3)}
        .wla-btn.outline{border:1px solid var(--border);background:transparent;color:var(--text2)}
        .wla-btn.outline:hover{border-color:var(--accent);color:var(--accent)}
        .wl-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:24px}
        @media(max-width:900px){.wl-stats{grid-template-columns:repeat(2,1fr)}}
        .wl-stat{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:18px;transition:all .25s}
        .wl-stat:hover{transform:translateY(-2px);border-color:var(--accent)}
        .wl-stat .wsi{width:36px;height:36px;border-radius:8px;display:grid;place-items:center;margin-bottom:8px}
        .wl-stat .wsn{font-family:Outfit;font-size:24px;font-weight:900}
        .wl-stat .wsl{color:var(--text2);font-size:13px;margin-top:2px}
        .wl-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:24px}
        @media(max-width:600px){.wl-grid{grid-template-columns:1fr}}
        .wl-card{display:flex;flex-direction:column;align-items:center;gap:8px;padding:20px;background:var(--card);border:1px solid var(--border);border-radius:14px;text-align:center;cursor:pointer;transition:all .25s;text-decoration:none}
        .wl-card:hover{transform:translateY(-3px);border-color:var(--accent);box-shadow:0 0 30px rgba(124,58,237,.08)}
        .wl-card i{font-size:28px}
        .wl-card .wlc-label{font-weight:700;font-size:14px;color:var(--text)}
        .wl-card .wlc-desc{color:var(--text2);font-size:12px}
        .wl-tabs{display:flex;gap:4px;margin-bottom:16px;flex-wrap:wrap}
        .wl-tab{padding:8px 16px;border-radius:8px;border:1px solid var(--border);background:transparent;color:var(--text2);font-size:12px;font-weight:600;cursor:pointer;transition:all .2s}
        .wl-tab.active,.wl-tab:hover{border-color:var(--accent);color:var(--accent);background:rgba(124,58,237,.08)}
        .wl-table{width:100%;border-collapse:collapse;font-size:13px}
        .wl-table th{text-align:left;padding:10px 12px;color:var(--text3);font-size:11px;font-weight:600;border-bottom:1px solid var(--border)}
        .wl-table td{padding:12px;border-bottom:1px solid var(--border);color:var(--text2)}
        .wl-table td strong{color:var(--text);font-weight:600}
        .wl-table .amt{font-weight:700}
        .wl-table .amt.plus{color:var(--green)}
        .wl-table .amt.minus{color:var(--red)}
        .sec-title{font-family:Outfit;font-size:18px;font-weight:800;margin:0 0 14px;display:flex;align-items:center;gap:8px}
        .sec-title i{font-size:20px;color:var(--accent)}
        .wl-empty{text-align:center;padding:48px;color:var(--text2);font-size:14px}
      `}</style>

      <div className="wl-hero">
        <div>
          <div className="wlh-label">Wallet Balance</div>
          <div className="wlh-bal">NGN 12,450.00</div>
          <div className="wlh-sub">$8.42 USDC &middot; 0.045 SOL</div>
        </div>
        <div className="wl-actions">
          <a href="#" className="wla-btn primary"><i className="ti ti-plus" /> Deposit</a>
          <a href="#" className="wla-btn outline"><i className="ti ti-logout" /> Withdraw</a>
          <a href="#" className="wla-btn outline"><i className="ti ti-transfer" /> Transfer</a>
        </div>
      </div>

      <div className="wl-stats">
        {[
          { icon: 'ti ti-wallet', color: '#7C3AED', num: 'NGN 12,450', label: 'Balance' },
          { icon: 'ti ti-coin', color: '#16a34a', num: '$8.42 USDC', label: 'Crypto' },
          { icon: 'ti ti-trending-up', color: '#2563EB', num: 'NGN 45,200', label: 'Total Deposits' },
          { icon: 'ti ti-trending-down', color: '#f5b301', num: 'NGN 7,000', label: 'Total Withdrawn' },
        ].map((s, i) => (
          <div className="wl-stat" key={i}>
            <div className="wsi" style={{ background: `${s.color}15`, color: s.color }}><i className={s.icon} /></div>
            <div className="wsn">{s.num}</div>
            <div className="wsl">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="wl-grid">
        {[
          { icon: 'ti ti-plus-circle', color: '#7C3AED', label: 'Deposit', desc: 'Add funds to your wallet' },
          { icon: 'ti ti-logout', color: '#2563EB', label: 'Withdraw', desc: 'Withdraw to bank or crypto' },
          { icon: 'ti ti-transfer', color: '#16a34a', label: 'Transfer', desc: 'Send to another user' },
        ].map((c, i) => (
          <a className="wl-card" href="#" key={i}>
            <i className={c.icon} style={{ color: c.color }} />
            <div className="wlc-label">{c.label}</div>
            <div className="wlc-desc">{c.desc}</div>
          </a>
        ))}
      </div>

      <div className="sec-title"><i className="ti ti-history" /> Transaction History</div>
      <div className="wl-tabs">
        {['all', 'deposit', 'withdrawal', 'reward'].map(t => (
          <button key={t} className={`wl-tab ${activeTab === t ? 'active' : ''}`} onClick={() => setActiveTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="wl-empty"><i className="ti ti-history" style={{ fontSize: 32, marginBottom: 8, display: 'block', color: 'var(--text3)' }} />No transactions found</div>
      ) : (
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
          <table className="wl-table">
            <thead><tr><th>Date</th><th>Type</th><th>Amount</th><th>Status</th></tr></thead>
            <tbody>
              {filtered.map((t, i) => (
                <tr key={i}>
                  <td><strong>{t.date}</strong></td>
                  <td>{t.type}</td>
                  <td className={`amt ${t.amount.startsWith('+') ? 'plus' : 'minus'}`}>{t.amount}</td>
                  <td style={{ color: t.statusColor, fontWeight: 600 }}>{t.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Layout>
  )
}

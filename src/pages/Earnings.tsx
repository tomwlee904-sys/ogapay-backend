import { useState } from 'react'
import Layout from '../components/Layout'

const earningsData = {
  total: 45200,
  available: 12450,
  pending: 3200,
  month: 8900,
  jobs: 124,
  referrals: 2300,
  tips: 450,
  vault: 1200,
}

const graphValues: Record<string, number[]> = {
  '7d': [35, 55, 42, 70, 48, 62, 85],
  '30d': [45, 62, 38, 55, 72, 48, 58, 65, 42, 58, 70, 52, 48, 62, 78, 55, 48, 62, 70, 52, 58, 45, 62, 68, 52, 58, 72, 48, 55, 62],
}

const history = [
  { date: 'Today', source: 'Task: Social Media', amount: '+NGN 500', type: 'Task' },
  { date: 'Yesterday', source: 'Referral Bonus', amount: '+NGN 300', type: 'Referral' },
  { date: '3 days ago', source: 'Tip Received', amount: '+NGN 200', type: 'Tip' },
  { date: '5 days ago', source: 'Task: Content Review', amount: '+NGN 800', type: 'Task' },
  { date: '1 week ago', source: 'Vault Reward', amount: '+NGN 150', type: 'Vault' },
]

export default function Earnings() {
  const [period, setPeriod] = useState('7d')
  const [tab, setTab] = useState('all')
  const bars = graphValues[period] || graphValues['7d']

  const filtered = tab === 'all' ? history : history.filter(h => h.type.toLowerCase() === tab)

  return (
    <Layout>
      <style>{`
        .en-hero{margin-bottom:20px}
        .en-hero h1{font-family:Outfit;font-size:28px;font-weight:900;margin:0 0 4px}
        .en-hero p{color:var(--text2);font-size:14px;margin:0}
        .en-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px}
        @media(max-width:800px){.en-grid{grid-template-columns:repeat(2,1fr)}}
        @media(max-width:500px){.en-grid{grid-template-columns:1fr}}
        .en-stat{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:16px;transition:all .25s}
        .en-stat:hover{transform:translateY(-2px);border-color:var(--accent)}
        .en-stat .esi{width:32px;height:32px;border-radius:8px;display:grid;place-items:center;margin-bottom:8px}
        .en-stat .esn{font-family:Outfit;font-size:22px;font-weight:900}
        .en-stat .esl{color:var(--text2);font-size:12px;margin-top:2px}
        .en-graph-card{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:20px 24px;margin-bottom:24px}
        .en-graph-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:8px}
        .en-graph-title{font-family:Outfit;font-size:15px;font-weight:800}
        .en-tabs{display:flex;gap:4px}
        .en-tab{padding:5px 12px;border-radius:6px;border:1px solid var(--border);background:transparent;color:var(--text2);font-size:11px;font-weight:600;cursor:pointer;transition:all .2s}
        .en-tab:hover,.en-tab.active{border-color:var(--accent);color:var(--accent);background:rgba(124,58,237,.08)}
        .en-graph{display:flex;align-items:flex-end;gap:4px;height:120px}
        .en-bar{flex:1;border-radius:4px 4px 0 0;min-height:8px;position:relative;background:linear-gradient(to top, rgba(124,58,237,.3), var(--accent));transition:height .3s}
        .en-bar .en-val{position:absolute;top:-22px;left:50%;transform:translateX(-50%);font-size:9px;color:var(--text3);white-space:nowrap}
        .en-history{margin-top:16px}
        .en-h-item{display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border)}
        .en-h-item:last-child{border-bottom:0}
        .en-h-date{font-size:11px;color:var(--text3);min-width:70px}
        .en-h-source{flex:1;font-size:13px;font-weight:600}
        .en-h-amount{font-weight:700;font-size:13px;color:var(--green);white-space:nowrap}
      `}</style>

      <div className="en-hero">
        <h1>Earnings</h1>
        <p>Track your income from tasks, referrals, tips, and vault rewards</p>
      </div>

      {/* Stats */}
      <div className="en-grid">
        {[
          { icon: 'ti ti-coin', color: '#7C3AED', num: `NGN ${earningsData.total.toLocaleString()}`, label: 'Total Earned' },
          { icon: 'ti ti-wallet', color: '#16a34a', num: `NGN ${earningsData.available.toLocaleString()}`, label: 'Available Balance' },
          { icon: 'ti ti-clock', color: '#F59E0B', num: `NGN ${earningsData.pending.toLocaleString()}`, label: 'Pending Earnings' },
          { icon: 'ti ti-trending-up', color: '#2563EB', num: `NGN ${earningsData.month.toLocaleString()}`, label: 'This Month' },
        ].map((s, i) => (
          <div className="en-stat" key={i}>
            <div className="esi" style={{ background: `${s.color}15`, color: s.color }}><i className={s.icon} /></div>
            <div className="esn" style={{ color: s.color }}>{s.num}</div>
            <div className="esl">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Graph */}
      <div className="en-graph-card">
        <div className="en-graph-header">
          <span className="en-graph-title"><i className="ti ti-trending-up" style={{color:'var(--accent)',marginRight:6}} />Earnings Overview</span>
          <div className="en-tabs">
            {['7d', '30d'].map(p => (
              <button key={p} className={`en-tab ${period === p ? 'active' : ''}`} onClick={() => setPeriod(p)}>
                {p === '7d' ? '7 Days' : '30 Days'}
              </button>
            ))}
          </div>
        </div>
        <div className="en-graph">
          {bars.map((b, i) => (
            <div key={i} className="en-bar" style={{ height: Math.min(b * 1.1, 90) + '%' }}>
              <div className="en-val">NGN {b * 10}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Breakdown */}
      <div className="en-grid" style={{marginBottom:24}}>
        {[
          { icon: 'ti ti-briefcase', color: '#7C3AED', num: `NGN ${earningsData.total - earningsData.referrals - earningsData.tips - earningsData.vault}`, label: 'From Tasks', sub: `${earningsData.jobs} jobs completed` },
          { icon: 'ti ti-affiliate', color: '#2563EB', num: `NGN ${earningsData.referrals.toLocaleString()}`, label: 'From Referrals', sub: '3 active referrals' },
          { icon: 'ti ti-gift', color: '#F59E0B', num: `NGN ${earningsData.tips.toLocaleString()}`, label: 'From Tips', sub: '12 tips received' },
          { icon: 'ti ti-vault', color: '#16a34a', num: `NGN ${earningsData.vault.toLocaleString()}`, label: 'From Vault', sub: 'Vault rewards' },
        ].map((s, i) => (
          <div className="en-stat" key={i}>
            <div className="esi" style={{ background: `${s.color}15`, color: s.color }}><i className={s.icon} /></div>
            <div className="esn">{s.num}</div>
            <div className="esl">{s.label}</div>
            <div style={{fontSize:11,color:'var(--text3)',marginTop:2}}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* History */}
      <div className="en-graph-card">
        <div className="en-graph-header">
          <span className="en-graph-title"><i className="ti ti-history" style={{color:'var(--accent)',marginRight:6}} />Earnings History</span>
          <div className="en-tabs">
            {['all', 'task', 'referral', 'tip', 'vault'].map(t => (
              <button key={t} className={`en-tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div className="en-history">
          {filtered.map((h, i) => (
            <div className="en-h-item" key={i}>
              <span className="en-h-date">{h.date}</span>
              <span className="en-h-source">{h.source}</span>
              <span className="en-h-amount">{h.amount}</span>
            </div>
          ))}
          {filtered.length === 0 && (
            <div style={{textAlign:'center',padding:24,color:'var(--text2)',fontSize:13}}>No entries found</div>
          )}
        </div>
      </div>
    </Layout>
  )
}

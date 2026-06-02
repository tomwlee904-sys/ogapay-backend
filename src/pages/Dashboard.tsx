import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import Layout from '../components/Layout'

const earnings = { total: 45200, available: 12450, pending: 3200, month: 8900 }

const graphData: Record<string, number[]> = {
  '7d': [35, 55, 42, 70, 48, 62, 85],
  '30d': [45, 62, 38, 55, 72, 48, 58, 65, 42, 58, 70, 52, 48, 62, 78, 55, 48, 62, 70, 52, 58, 45, 62, 68, 52, 58, 72, 48, 55, 62],
  'all': [30, 40, 35, 50, 45, 55, 60, 48, 52, 58, 42, 55, 48, 62, 58, 52, 65, 58, 62, 68, 55, 60, 58, 62, 65, 58, 62, 68, 72, 78],
}

const activeTasks = [
  { title: 'Social Media Engagement', reward: 500, progress: 60, done: 6, total: 10 },
  { title: 'Content Review', reward: 1200, progress: 20, done: 1, total: 5 },
  { title: 'UI Feedback', reward: 800, progress: 0, done: 0, total: 1 },
]

const pendingTasks = [
  { title: 'Logo Design', reward: 2500, status: 'Awaiting approval', statusColor: 'var(--gold)' as const },
  { title: 'Twitter Thread', reward: 600, status: 'Revision requested', statusColor: 'var(--red)' as const },
  { title: 'Market Research', reward: 1000, status: 'Under review', statusColor: 'var(--text3)' as const },
]

const recommended = [
  { title: 'Video Editing', reward: 3000, time: '2 hours' },
  { title: 'Community Moderation', reward: 1500, time: '1 hour' },
  { title: 'Copywriting', reward: 2000, time: '30 min' },
  { title: 'Beta Testing', reward: 1800, time: '1.5 hours' },
]

const recentActivity = [
  { text: 'Earned ', highlight: 'NGN 500', highlightColor: 'var(--green)' as const, suffix: ' from Social Media Task', time: '2h ago', icon: 'ti ti-coin' },
  { text: 'Completed ', highlight: 'Content Review', highlightColor: 'var(--accent)' as const, suffix: ' task', time: '5h ago', icon: 'ti ti-check' },
  { text: 'Withdrew ', highlight: 'NGN 2,000', highlightColor: 'var(--green)' as const, suffix: ' to bank account', time: '1d ago', icon: 'ti ti-logout' },
  { text: 'Referral bonus ', highlight: 'NGN 300', highlightColor: 'var(--green)' as const, suffix: ' credited', time: '2d ago', icon: 'ti ti-affiliate' },
  { text: 'Task ', highlight: 'UI Feedback', highlightColor: 'var(--accent)' as const, suffix: ' approved', time: '3d ago', icon: 'ti ti-check' },
]

const announcements = [
  { title: 'New Task Categories Added', date: '2 hours ago', desc: 'We\'ve added new task categories including AI training and data labeling.' },
  { title: 'Platform Upgrade', date: '1 day ago', desc: 'We\'ve upgraded our payment system. Withdrawals are now faster.' },
  { title: 'Community Challenge', date: '3 days ago', desc: 'Join the weekly community challenge and earn bonus rewards.' },
]

const communityUpdates = [
  { name: 'Solana Builders', badge: 'Active', desc: 'New tasks available - 5 slots open' },
  { name: 'Design Masters', badge: 'Trending', desc: 'Weekly design challenge live now' },
  { name: 'Crypto Traders', badge: '2,500 members', desc: 'Trading competition starts tomorrow' },
]

export default function Dashboard() {
  const { isAuthed } = useAuth()
  const [graphPeriod, setGraphPeriod] = useState('7d')

  if (!isAuthed) {
    return (
      <Layout sidebar={false}>
        <div className="loading"><div className="spinner" /> Sign in to view your dashboard</div>
      </Layout>
    )
  }

  const bars = graphData[graphPeriod] || graphData['7d']

  return (
    <Layout sidebar={false}>
      <style>{`
        .dash-welcome{background:linear-gradient(135deg,rgba(124,58,237,.08),var(--card));border:1px solid var(--border);border-radius:14px;padding:28px 32px;margin-bottom:24px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:16px}
        .dash-welcome .dwg{font-family:Outfit;font-size:22px;font-weight:800;margin:0 0 4px}
        .dash-welcome .dwb{font-family:Outfit;font-size:36px;font-weight:900;margin:0 0 2px;background:linear-gradient(135deg,#fff,var(--accent));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
        .dash-welcome .dw-actions{display:flex;gap:8px;flex-wrap:wrap}
        .dw-btn{height:40px;padding:0 20px;border-radius:10px;font-weight:700;font-size:13px;display:inline-flex;align-items:center;gap:6px;cursor:pointer;transition:all .2s;text-decoration:none}
        .dw-btn.primary{background:var(--accent);color:#fff;border:0}
        .dw-btn.primary:hover{box-shadow:0 4px 20px rgba(124,58,237,.3)}
        .dw-btn.outline{border:1px solid var(--border);background:transparent;color:var(--text2)}
        .dw-btn.outline:hover{border-color:var(--accent);color:var(--accent)}
        .dash-stat{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:18px;transition:all .25s}
        .dash-stat:hover{transform:translateY(-2px);border-color:var(--accent)}
        .dash-stat .ds-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}
        .dash-stat .ds-head .dsi{width:36px;height:36px;border-radius:8px;display:grid;place-items:center}
        .dash-stat .ds-head .ds-ch{font-size:12px;font-weight:700;padding:2px 8px;border-radius:999px}
        .dash-stat .ds-head .ds-ch.up{background:rgba(22,163,74,.1);color:var(--green)}
        .dash-stat .ds-head .ds-ch.down{background:rgba(220,38,38,.1);color:var(--red)}
        .dash-stat .ds-num{font-family:Outfit;font-size:26px;font-weight:900}
        .dash-stat .ds-lbl{color:var(--text2);font-size:13px;margin-top:2px}
        .dash-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:24px}
        @media(max-width:900px){.dash-stats{grid-template-columns:repeat(2,1fr)}}
        @media(max-width:500px){.dash-stats{grid-template-columns:1fr}}
        .dash-wallet{display:grid;grid-template-columns:2fr 1fr;gap:14px;margin-bottom:24px}
        @media(max-width:700px){.dash-wallet{grid-template-columns:1fr}}
        .wallet-main{background:linear-gradient(135deg,rgba(124,58,237,.08),var(--card));border:1px solid var(--border);border-radius:14px;padding:22px;position:relative;overflow:hidden}
        .wallet-main .wml{color:var(--text2);font-size:13px;font-weight:600;margin-bottom:4px}
        .wallet-main .wmb{font-family:Outfit;font-size:32px;font-weight:900;margin-bottom:2px}
        .wallet-main .wmu{color:var(--text2);font-size:14px;margin-bottom:16px}
        .wallet-main .wma{display:flex;gap:8px}
        .wallet-main .wma a{height:38px;padding:0 18px;border-radius:9px;font-size:13px;font-weight:700;display:inline-flex;align-items:center;gap:6px;cursor:pointer;transition:all .2s;text-decoration:none}
        .wallet-main .wma .wma-p{background:var(--accent);color:#fff;border:0}
        .wallet-main .wma .wma-o{border:1px solid var(--border);background:transparent;color:var(--text2)}
        .wallet-main .wma .wma-o:hover{border-color:var(--accent);color:var(--accent)}
        .wallet-grid{display:grid;background:var(--card);border:1px solid var(--border);border-radius:14px;padding:16px;grid-template-columns:1fr 1fr 1fr;gap:4px}
        .wg-item{text-align:center;padding:10px 4px;border-radius:8px;cursor:pointer;transition:all .2s;text-decoration:none;color:inherit}
        .wg-item:hover{background:var(--bg2)}
        .wg-item i{font-size:22px;color:var(--accent);margin-bottom:4px;display:block}
        .wg-item .wgl{font-size:12px;font-weight:600;color:var(--text2)}
        .dash-graph{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:22px;margin-bottom:24px}
        .dash-graph .dg-h{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:8px}
        .gtabs{display:flex;gap:4px}
        .gtab{padding:6px 14px;border-radius:6px;border:1px solid var(--border);background:transparent;color:var(--text2);font-size:12px;font-weight:600;cursor:pointer;transition:all .2s}
        .gtab.active,.gtab:hover{border-color:var(--accent);color:var(--accent);background:rgba(124,58,237,.08)}
        .gv{height:160px;display:flex;align-items:flex-end;gap:4px;padding:0 4px}
        .gv .gv-bar{flex:1;border-radius:4px 4px 0 0;background:rgba(124,58,237,.15);position:relative;transition:all .3s;min-height:4px}
        .gv .gv-bar:hover{background:var(--accent);opacity:.8}
        .gv .gv-bar .gv-t{position:absolute;top:-22px;left:50%;transform:translateX(-50%);font-size:9px;font-weight:700;color:var(--text2);white-space:nowrap;display:none}
        .gv .gv-bar:hover .gv-t{display:block}
        .dash-tasks{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px;margin-bottom:24px}
        .dtask{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:18px;transition:all .25s}
        .dtask:hover{transform:translateY(-2px);border-color:rgba(124,58,237,.2)}
        .dtask .dt-h{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px}
        .dtask .dt-t{font-weight:700;font-size:15px}
        .dtask .dt-r{color:var(--green);font-weight:700;font-size:14px}
        .dtask .dt-desc{color:var(--text2);font-size:13px;margin-bottom:10px;line-height:1.4}
        .dtask .dt-p{height:4px;border-radius:999px;background:var(--bg2);margin-bottom:8px;overflow:hidden}
        .dtask .dt-p .dt-pf{height:100%;border-radius:999px;background:var(--accent);transition:width .5s}
        .dtask .dt-s{font-size:11px;font-weight:600;color:var(--text3);margin-bottom:8px}
        .dtask .dt-start{height:34px;padding:0 16px;border-radius:8px;border:1px solid var(--accent);background:transparent;color:var(--accent);font-size:12px;font-weight:700;cursor:pointer;transition:all .2s}
        .dtask .dt-start:hover{background:var(--accent);color:#fff}
        .dash-rec{display:flex;gap:14px;overflow-x:auto;padding:4px 0 12px;margin-bottom:24px;scroll-snap-type:x mandatory}
        .dash-rec::-webkit-scrollbar{height:4px}
        .dash-rec::-webkit-scrollbar-thumb{background:var(--border2);border-radius:999px}
        .dash-rec .dtask{min-width:250px;scroll-snap-align:start;flex-shrink:0}
        .dash-act{display:grid;gap:8px;margin-bottom:24px}
        .dact{display:flex;align-items:center;gap:12px;padding:12px 16px;background:var(--card);border:1px solid var(--border);border-radius:10px;transition:all .2s}
        .dact:hover{border-color:var(--accent)}
        .dact .dai{width:34px;height:34px;border-radius:8px;display:grid;place-items:center;flex-shrink:0}
        .dact .dai.green{background:rgba(22,163,74,.1);color:var(--green)}
        .dact .dai.purple{background:rgba(124,58,237,.1);color:var(--accent)}
        .dact .dai.gold{background:rgba(245,179,1,.1);color:var(--gold)}
        .dact .dat{flex:1;font-size:13px}
        .dact .dat strong{font-weight:600}
        .dact .dat .da-amt{color:var(--green);font-weight:700}
        .dact .dati{color:var(--text3);font-size:11px}
        .dash-2col{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:24px}
        @media(max-width:700px){.dash-2col{grid-template-columns:1fr}}
        .dash-card{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:18px}
        .dash-card .dc-item{padding:12px 0;border-bottom:1px solid var(--border)}
        .dash-card .dc-item:last-child{border-bottom:0;padding-bottom:0}
        .dash-card .dc-item .dc-t{font-weight:600;font-size:14px;margin-bottom:2px}
        .dash-card .dc-item .dc-d{color:var(--text3);font-size:11px}
        .dash-card .dc-item .dc-desc{color:var(--text2);font-size:12px;margin-top:4px;line-height:1.4}
        .dash-card .dc-item .dc-badge{font-size:10px;font-weight:700;padding:2px 8px;border-radius:999px;background:rgba(124,58,237,.1);color:var(--accent);width:fit-content;margin-top:2px}
        .sec-title{font-family:Outfit;font-size:18px;font-weight:800;margin:0 0 14px;display:flex;align-items:center;gap:8px}
        .sec-title i{font-size:20px;color:var(--accent)}
      `}</style>

      {/* Welcome Banner */}
      <div className="dash-welcome">
        <div>
          <div className="dwg">Welcome back!</div>
          <div className="dwb">NGN {earnings.available.toLocaleString()}.00</div>
          <div style={{ color: 'var(--text2)', fontSize: 14 }}>Available Balance</div>
        </div>
        <div className="dw-actions">
          <a href="/app/tasks" className="dw-btn primary"><i className="ti ti-layout-grid" /> Browse Tasks</a>
          <a href="/app/wallet" className="dw-btn outline"><i className="ti ti-logout" /> Withdraw</a>
        </div>
      </div>

      {/* Earnings Summary */}
      <div className="sec-title"><i className="ti ti-coin" /> Earnings Summary</div>
      <div className="dash-stats">
        <Stat icon="ti ti-coin" change="+12%" up num={earnings.total} label="Total Earned" />
        <Stat icon="ti ti-wallet" change="+5%" up num={earnings.available} label="Available Balance" />
        <Stat icon="ti ti-clock" change="-2%" up={false} num={earnings.pending} label="Pending Earnings" />
        <Stat icon="ti ti-trending-up" change="+18%" up num={earnings.month} label="This Month" />
      </div>

      {/* Wallet Overview */}
      <div className="sec-title"><i className="ti ti-wallet" /> Wallet Overview</div>
      <div className="dash-wallet">
        <div className="wallet-main">
          <div className="wml">Wallet Balance</div>
          <div className="wmb">NGN {earnings.available.toLocaleString()}.00</div>
          <div className="wmu">$8.42 USDC</div>
          <div className="wma">
            <a href="#" className="wma-p"><i className="ti ti-plus" /> Deposit</a>
            <a href="/app/wallet" className="wma-o"><i className="ti ti-logout" /> Withdraw</a>
            <a href="#" className="wma-o"><i className="ti ti-transfer" /> Transfer</a>
          </div>
        </div>
        <div className="wallet-grid">
          <a href="/app/earnings" className="wg-item"><i className="ti ti-coin" /><div className="wgl">Earnings</div></a>
          <a href="/app/wallet" className="wg-item"><i className="ti ti-wallet" /><div className="wgl">Wallet</div></a>
          <a href="/app/referrals" className="wg-item"><i className="ti ti-affiliate" /><div className="wgl">Referrals</div></a>
          <a href="/app/vault" className="wg-item"><i className="ti ti-vault" /><div className="wgl">Vault</div></a>
          <a href="/app/my-store" className="wg-item"><i className="ti ti-building-store" /><div className="wgl">My Store</div></a>
          <a href="/app/worker-portal" className="wg-item"><i className="ti ti-briefcase" /><div className="wgl">Worker</div></a>
        </div>
      </div>

      {/* Earnings Graph */}
      <div className="sec-title"><i className="ti ti-trending-up" /> Earnings Overview</div>
      <div className="dash-graph">
        <div className="dg-h">
          <span style={{ fontWeight: 700, fontSize: 15 }}>Earnings</span>
          <div className="gtabs">
            {['7d', '30d', 'all'].map(p => (
              <button key={p} className={`gtab ${graphPeriod === p ? 'active' : ''}`} onClick={() => setGraphPeriod(p)}>
                {p === '7d' ? '7 Days' : p === '30d' ? '30 Days' : 'All Time'}
              </button>
            ))}
          </div>
        </div>
        <div className="gv">
          {bars.map((b, i) => (
            <div key={i} className="gv-bar" style={{ height: Math.min(b * 1.1, 90) + '%' }}>
              <div className="gv-t">NGN {b * 10}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Active Tasks */}
      <div className="sec-title"><i className="ti ti-player-play" /> Active Tasks</div>
      <div className="dash-tasks">
        {activeTasks.map((t, i) => (
          <div className="dtask" key={i}>
            <div className="dt-h"><span className="dt-t">{t.title}</span><span className="dt-r">NGN {t.reward.toLocaleString()}</span></div>
            <div className="dt-desc">Complete tasks and earn rewards</div>
            <div className="dt-p"><div className="dt-pf" style={{ width: t.progress + '%' }}></div></div>
            <div className="dt-s">{t.done}/{t.total} completed</div>
            <button className="dt-start">{t.progress === 0 ? 'Start' : 'Continue'}</button>
          </div>
        ))}
      </div>

      {/* Pending Tasks */}
      <div className="sec-title"><i className="ti ti-clock" /> Pending Tasks</div>
      <div className="dash-tasks">
        {pendingTasks.map((t, i) => (
          <div className="dtask" key={i}>
            <div className="dt-h"><span className="dt-t">{t.title}</span><span className="dt-r">NGN {t.reward.toLocaleString()}</span></div>
            <div className="dt-desc" style={{ color: t.statusColor }}>{t.status}</div>
            <button className="dt-start" style={{ borderColor: t.statusColor, color: t.statusColor }}>View</button>
          </div>
        ))}
      </div>

      {/* Recommended Tasks */}
      <div className="sec-title"><i className="ti ti-star" /> Recommended Tasks</div>
      <div className="dash-rec">
        {recommended.map((t, i) => (
          <div className="dtask" key={i}>
            <div className="dt-h"><span className="dt-t">{t.title}</span><span className="dt-r">NGN {t.reward.toLocaleString()}</span></div>
            <div className="dt-desc">Est. {t.time}</div>
            <button className="dt-start">Start Task</button>
          </div>
        ))}
      </div>

      {/* Recent Activity */}
      <div className="sec-title"><i className="ti ti-activity" /> Recent Activity</div>
      <div className="dash-act">
        {recentActivity.map((a, i) => (
          <div className="dact" key={i}>
            <div className={`dai ${a.icon === 'ti ti-coin' || a.icon === 'ti ti-logout' || a.icon === 'ti ti-affiliate' ? 'green' : a.icon === 'ti ti-check' ? 'purple' : 'gold'}`}>
              <i className={a.icon} />
            </div>
            <div className="dat">{a.text}<span className="da-amt">{a.highlight}</span>{a.suffix}</div>
            <span className="dati">{a.time}</span>
          </div>
        ))}
      </div>

      {/* Announcements + Community Updates */}
      <div className="dash-2col">
        <div>
          <div className="sec-title"><i className="ti ti-bullhorn" /> Announcements</div>
          <div className="dash-card">
            {announcements.map((a, i) => (
              <div className="dc-item" key={i}>
                <div className="dc-t">{a.title}</div>
                <div className="dc-d">{a.date}</div>
                <div className="dc-desc">{a.desc}</div>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="sec-title"><i className="ti ti-users" /> Community Updates</div>
          <div className="dash-card">
            {communityUpdates.map((c, i) => (
              <div className="dc-item" key={i}>
                <div className="dc-t">{c.name}</div>
                <div className="dc-badge">{c.badge}</div>
                <div className="dc-desc">{c.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  )
}

function Stat({ icon, change, up = true, num, label }: { icon: string; change: string; up?: boolean; num: number; label: string }) {
  return (
    <div className="dash-stat">
      <div className="ds-head">
        <div className="dsi" style={{ background: 'rgba(124,58,237,.08)', color: 'var(--accent)' }}><i className={icon} /></div>
        <span className={`ds-ch ${up ? 'up' : 'down'}`}>{change}</span>
      </div>
      <div className="ds-num">NGN {num.toLocaleString()}</div>
      <div className="ds-lbl">{label}</div>
    </div>
  )
}

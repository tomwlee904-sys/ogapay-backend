import { useState } from 'react'
import Layout from '../components/Layout'

const users = [
  { rank: 1, name: 'CryptoKing', earnings: 'NGN 125,400', tasks: 342, badge: '🥇', color: '#7C3AED', avatar: 'CK' },
  { rank: 2, name: 'TaskMaster', earnings: 'NGN 98,200', tasks: 287, badge: '🥈', color: '#2563EB', avatar: 'TM' },
  { rank: 3, name: 'EarnQueen', earnings: 'NGN 82,500', tasks: 254, badge: '🥉', color: '#16a34a', avatar: 'EQ' },
  { rank: 4, name: 'BizWizard', earnings: 'NGN 67,800', tasks: 198, color: '#F59E0B', avatar: 'BW' },
  { rank: 5, name: 'SolaPro', earnings: 'NGN 54,200', tasks: 167, color: '#EC4899', avatar: 'SP' },
  { rank: 6, name: 'Web3Ninja', earnings: 'NGN 42,100', tasks: 143, color: '#6366F1', avatar: 'WN' },
  { rank: 7, name: 'GigHunter', earnings: 'NGN 35,600', tasks: 121, color: '#14B8A6', avatar: 'GH' },
  { rank: 8, name: 'ChainWurk', earnings: 'NGN 28,400', tasks: 98, color: '#F97316', avatar: 'CW' },
]

const categories = [
  { id: 'earners', icon: 'ti ti-coin', label: 'Top Earners', color: '#7C3AED', users: users.slice(0, 5) },
  { id: 'posters', icon: 'ti ti-briefcase', label: 'Top Task Posters', color: '#2563EB', users: users.slice(0, 5) },
  { id: 'referrers', icon: 'ti ti-affiliate', label: 'Top Referrers', color: '#16a34a', users: users.slice(0, 5) },
  { id: 'leaders', icon: 'ti ti-users', label: 'Community Leaders', color: '#F59E0B', users: users.slice(0, 5) },
]

const achievements = [
  { icon: '💎', name: 'Gold Earner', desc: 'Earn over NGN 100K' },
  { icon: '🥈', name: 'Silver Earner', desc: 'Earn over NGN 50K' },
  { icon: '🥉', name: 'Bronze Earner', desc: 'Earn over NGN 25K' },
  { icon: '🔥', name: 'Top Referrer', desc: 'Refer 10+ users' },
  { icon: '⚡', name: 'Fast Worker', desc: 'Complete 50 tasks' },
  { icon: '👑', name: 'Community Leader', desc: 'Lead a community' },
]

const periodTabs = ['Weekly', 'Monthly', 'All Time']

export default function Leaderboard() {
  const [period, setPeriod] = useState('Monthly')
  const [catTab, setCatTab] = useState('earners')
  const currentCat = categories.find(c => c.id === catTab) || categories[0]

  return (
    <Layout>
      <style>{`
        .lb-hero{text-align:center;padding:36px 20px 28px;margin-bottom:24px;background:linear-gradient(135deg,rgba(124,58,237,.08),rgba(37,99,235,.06),var(--card));border-radius:16px;border:1px solid var(--border);position:relative;overflow:hidden}
        .lb-hero::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse at 30% 40%,rgba(124,58,237,.12),transparent 60%),radial-gradient(ellipse at 70% 60%,rgba(37,99,235,.08),transparent 50%);pointer-events:none}
        .lb-hero-inner{position:relative;z-index:1}
        .lb-hero h1{font-family:Outfit;font-size:32px;font-weight:900;margin:0 0 6px}
        .lb-hero p{color:var(--text2);font-size:14px;margin:0 auto;max-width:480px}
        .lb-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:24px}
        @media(max-width:600px){.lb-stats{grid-template-columns:repeat(2,1fr)}}
        .lb-stat{text-align:center;padding:14px;background:var(--card);border:1px solid var(--border);border-radius:12px}
        .lb-stat .lb-num{font-family:Outfit;font-size:22px;font-weight:900;color:var(--accent)}
        .lb-stat .lb-lbl{font-size:11px;color:var(--text2);margin-top:2px;font-weight:600}
        .lb-period{display:flex;gap:4px;background:var(--bg2);border-radius:10px;padding:4px;width:fit-content;margin:0 auto 20px}
        .lb-period button{padding:7px 16px;border:0;border-radius:8px;background:transparent;color:var(--text2);font-size:12px;font-weight:700;cursor:pointer;transition:all .15s}
        .lb-period button.active{background:var(--card);color:var(--text);box-shadow:0 1px 4px rgba(0,0,0,.06)}
        .lb-podium{display:grid;grid-template-columns:1fr 1.2fr 1fr;align-items:end;gap:10px;margin-bottom:24px}
        @media(max-width:600px){.lb-podium{grid-template-columns:1fr;gap:8px}.lb-podium .first{order:-1}}
        .lb-pcard{text-align:center;padding:18px 12px;border-radius:14px;background:var(--card);border:1px solid var(--border);transition:all .3s}
        .lb-pcard:hover{transform:translateY(-3px)}
        .lb-pcard.first{background:linear-gradient(180deg,rgba(245,179,1,.08),transparent);border-color:rgba(245,179,1,.25);padding:24px 14px}
        .lb-pcard.first .lb-av{width:52px;height:52px;font-size:20px}
        .lb-pcard .lb-av{width:44px;height:44px;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 8px;font-weight:900;color:#fff;font-family:Outfit;font-size:18px}
        .lb-pcard .lb-pname{font-weight:800;font-size:13px}
        .lb-pcard .lb-pearn{font-size:15px;font-weight:900;color:var(--accent);margin-top:2px}
        .lb-pcard .lb-prank{font-size:11px;color:var(--text3);margin-bottom:4px}
        .lb-pcard.first .lb-prank{color:var(--gold);font-weight:700}
        .lb-cats{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:24px}
        @media(max-width:600px){.lb-cats{grid-template-columns:1fr}}
        .lb-cat{border:1px solid var(--border);border-radius:14px;background:var(--card);overflow:hidden}
        .lb-cat-head{display:flex;align-items:center;gap:8px;padding:12px 14px 8px}
        .lb-cat-head i{font-size:18px}
        .lb-cat-head h3{font-family:Outfit;font-size:13px;font-weight:800;margin:0}
        .lb-cat-list{padding:0 14px 12px}
        .lb-cat-row{display:flex;align-items:center;gap:8px;padding:6px 0;font-size:12px}
        .lb-cat-rr{width:20px;font-weight:800;color:var(--text3);text-align:center}
        .lb-cat-av{width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;color:#fff;flex-shrink:0}
        .lb-cat-name{flex:1;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .lb-cat-sc{font-weight:800;color:var(--accent)}
        .lb-user-card{background:linear-gradient(135deg,var(--card),var(--bg2));border:1px solid var(--border);border-radius:14px;padding:20px;margin-bottom:24px}
        .lb-user-card h3{font-family:Outfit;font-size:15px;font-weight:900;margin:0 0 12px;display:flex;align-items:center;gap:8px}
        .lb-ur-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:10px}
        @media(max-width:500px){.lb-ur-grid{grid-template-columns:repeat(2,1fr)}}
        .lb-ur-item{text-align:center}
        .lb-ur-item .urv{font-family:Outfit;font-size:18px;font-weight:900}
        .lb-ur-item .url{font-size:10px;color:var(--text2);margin-top:2px;font-weight:600}
        .lb-progress{height:6px;border-radius:99px;background:var(--bg2);overflow:hidden}
        .lb-progress .lb-bar{height:100%;border-radius:99px;background:linear-gradient(90deg,var(--accent),var(--accent2));transition:width .6s;width:65%}
        .lb-next{font-size:11px;color:var(--text2);margin-top:4px;text-align:right}
        .lb-ach{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:24px}
        @media(max-width:500px){.lb-ach{grid-template-columns:repeat(2,1fr)}}
        .lb-ach-item{text-align:center;padding:14px 10px;background:var(--card);border:1px solid var(--border);border-radius:12px;transition:all .2s}
        .lb-ach-item:hover{transform:translateY(-2px)}
        .lb-ach-item .achi{font-size:24px;margin-bottom:4px}
        .lb-ach-item .achn{font-weight:800;font-size:11px}
        .lb-ach-item .achd{font-size:9px;color:var(--text3);margin-top:2px}
      `}</style>

      <div className="lb-hero">
        <div className="lb-hero-inner">
          <h1>Leaderboard</h1>
          <p>Discover the top earners, task creators, referrers, and community leaders on OgaPay</p>
        </div>
      </div>

      <div className="lb-stats">
        {[
          { num: 'NGN 2.4M', label: 'Total Rewards Paid' },
          { num: '12,847', label: 'Tasks Completed' },
          { num: '3,240', label: 'Active Workers' },
          { num: '186', label: 'Communities' },
        ].map((s, i) => (
          <div className="lb-stat" key={i}>
            <div className="lb-num">{s.num}</div>
            <div className="lb-lbl">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Period tabs */}
      <div className="lb-period">
        {periodTabs.map(p => (
          <button key={p} className={period === p ? 'active' : ''} onClick={() => setPeriod(p)}>{p}</button>
        ))}
      </div>

      {/* Podium */}
      <div className="lb-podium">
        {[users[1], users[0], users[2]].map((u, i) => (
          <div key={i} className={`lb-pcard ${i === 1 ? 'first' : i === 0 ? 'second' : 'third'}`}>
            <div className="lb-prank">#{u.rank}</div>
            <div className="lb-av" style={{background: u.color}}>{u.avatar}</div>
            <div className="lb-pname">{u.name}</div>
            <div className="lb-pearn">{u.earnings}</div>
          </div>
        ))}
      </div>

      {/* Categories */}
      <div className="lb-cats">
        {categories.map(c => (
          <div className="lb-cat" key={c.id}>
            <div className="lb-cat-head">
              <i className={c.icon} style={{color: c.color}} />
              <h3>{c.label}</h3>
            </div>
            <div className="lb-cat-list">
              {c.users.map((u, i) => (
                <div className="lb-cat-row" key={i}>
                  <span className="lb-cat-rr">#{i + 1}</span>
                  <div className="lb-cat-av" style={{background: u.color}}>{u.avatar}</div>
                  <span className="lb-cat-name">{u.name}</span>
                  <span className="lb-cat-sc">{u.earnings}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* User ranking */}
      <div className="lb-user-card">
        <h3><i className="ti ti-trophy" style={{color:'var(--accent)'}} /> My Ranking</h3>
        <div className="lb-ur-grid">
          {[
            { val: '#--', label: 'Position' },
            { val: 'NGN 0', label: 'Earnings' },
            { val: '0', label: 'Tasks Done' },
            { val: '0', label: 'Referrals' },
          ].map((r, i) => (
            <div className="lb-ur-item" key={i}>
              <div className="urv">{r.val}</div>
              <div className="url">{r.label}</div>
            </div>
          ))}
        </div>
        <div className="lb-progress"><div className="lb-bar" /></div>
        <div className="lb-next">Complete 5 more tasks to reach Silver Tier</div>
      </div>

      {/* Achievements */}
      <div className="lb-ach">
        {achievements.map((a, i) => (
          <div className="lb-ach-item" key={i}>
            <div className="achi">{a.icon}</div>
            <div className="achn">{a.name}</div>
            <div className="achd">{a.desc}</div>
          </div>
        ))}
      </div>
    </Layout>
  )
}

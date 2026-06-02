import { useState } from 'react'
import Layout from '../components/Layout'

const communities = [
  { id: 1, name: 'Solana Builders', category: 'crypto', members: 2840, tasks: 456, rewards: 45000, badge: 'Crypto', desc: 'Building the future on Solana. Discussions, development, and alpha.', trending: true, initials: 'SB' },
  { id: 2, name: 'Design Masters', category: 'design', members: 1820, tasks: 320, rewards: 28000, badge: 'Design', desc: 'Premium design resources, feedback, and collaborations.', trending: true, initials: 'DM' },
  { id: 3, name: 'Content Creators Hub', category: 'content', members: 3150, tasks: 540, rewards: 52000, badge: 'Content', desc: 'Create, share, and earn. Video, writing, and multimedia.', trending: true, initials: 'CC' },
  { id: 4, name: 'Web3 Marketing', category: 'marketing', members: 1240, tasks: 210, rewards: 18000, badge: 'Marketing', desc: 'Web3 marketing strategies, campaigns, and growth hacking.', trending: false, initials: 'WM' },
  { id: 5, name: 'Crypto Traders', category: 'crypto', members: 4200, tasks: 680, rewards: 95000, badge: 'Crypto', desc: 'Trade signals, analysis, and DeFi strategies.', trending: true, initials: 'CT' },
  { id: 6, name: 'Business Network', category: 'business', members: 960, tasks: 145, rewards: 12000, badge: 'Business', desc: 'Entrepreneurship, business development, and partnerships.', trending: false, initials: 'BN' },
  { id: 7, name: 'AI & Automation', category: 'crypto', members: 2100, tasks: 380, rewards: 34000, badge: 'Crypto', desc: 'AI agents, automation tools, and bot development.', trending: true, initials: 'AA' },
  { id: 8, name: 'Community Managers', category: 'marketing', members: 780, tasks: 190, rewards: 15000, badge: 'Marketing', desc: 'Best practices for community growth and engagement.', trending: false, initials: 'CM' },
  { id: 9, name: 'UI/UX Collective', category: 'design', members: 1450, tasks: 275, rewards: 22000, badge: 'Design', desc: 'User interface and experience design community.', trending: false, initials: 'UC' },
  { id: 10, name: 'DeFi Degens', category: 'crypto', members: 3800, tasks: 590, rewards: 78000, badge: 'Crypto', desc: 'Decentralized finance, yield farming, and liquidity.', trending: true, initials: 'DD' },
  { id: 11, name: 'Content Writers Guild', category: 'content', members: 920, tasks: 167, rewards: 14000, badge: 'Content', desc: 'Professional writing, copywriting, and editing.', trending: false, initials: 'WG' },
  { id: 12, name: 'Growth Hackers', category: 'marketing', members: 1650, tasks: 290, rewards: 25000, badge: 'Marketing', desc: 'Growth strategies, viral loops, and user acquisition.', trending: false, initials: 'GH' },
]

const filters = ['All', 'Trending', 'New', 'Crypto', 'Business', 'Content', 'Design', 'Marketing']

function getGradient(cat: string) {
  const g: Record<string, string> = { crypto: '#1a1a4e,#7C3AED', design: '#4a1a4e,#EC4899', content: '#1a4e3a,#22C55E', marketing: '#4e3a1a,#F5B301', business: '#1a2a4e,#3B82F6' }
  return g[cat] || '#1a1a4e,#7C3AED'
}

export default function Communities() {
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')

  const filtered = communities.filter(c => {
    if (filter === 'trending' && !c.trending) return false
    if (filter === 'new' && c.id > 12) return false
    if (filter !== 'all' && filter !== 'trending' && filter !== 'new' && c.category !== filter) return false
    if (search) {
      const q = search.toLowerCase()
      return c.name.toLowerCase().includes(q) || c.desc.toLowerCase().includes(q) || c.badge.toLowerCase().includes(q)
    }
    return true
  })

  const trending = communities.filter(c => c.trending)

  return (
    <Layout>
      <style>{`
        .ch-hero{text-align:center;padding:40px 24px 36px;background:radial-gradient(ellipse at 50% 0%,rgba(124,58,237,.08) 0%,transparent 70%);border-radius:14px;margin-bottom:28px}
        .ch-hero h1{font-family:Outfit;font-size:38px;font-weight:900;margin:0 0 8px;background:linear-gradient(135deg,#fff 30%,var(--accent) 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
        .ch-hero p{color:var(--text2);font-size:14px;max-width:500px;margin:0 auto 20px;line-height:1.6}
        .ch-search{display:flex;align-items:center;gap:0;max-width:500px;margin:0 auto;background:var(--card);border:1.5px solid var(--border);border-radius:12px;overflow:hidden;transition:all .2s}
        .ch-search:focus-within{border-color:var(--accent);box-shadow:0 0 0 3px rgba(124,58,237,.1)}
        .ch-search input{flex:1;border:0;background:transparent;color:var(--text);font-size:14px;padding:12px 16px;outline:none}
        .ch-search input::placeholder{color:var(--text3)}
        .ch-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:28px}
        @media(max-width:768px){.ch-stats{grid-template-columns:repeat(2,1fr)}}
        .ch-stat{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:16px;text-align:center}
        .ch-stat .csi{width:34px;height:34px;border-radius:8px;background:rgba(124,58,237,.08);color:var(--accent);display:grid;place-items:center;margin:0 auto 6px;font-size:18px}
        .ch-stat .csn{font-family:Outfit;font-size:22px;font-weight:800}
        .ch-stat .csl{color:var(--text2);font-size:12px;margin-top:2px}
        .ch-filters{display:flex;gap:6px;margin-bottom:20px;flex-wrap:wrap}
        .ch-pill{height:32px;padding:0 14px;border-radius:999px;border:1px solid var(--border);background:var(--bg);color:var(--text2);font-size:12px;font-weight:600;cursor:pointer;transition:all .2s;display:flex;align-items:center;gap:4px}
        .ch-pill:hover,.ch-pill.active{background:var(--accent);color:#fff;border-color:var(--accent)}
        .ch-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:28px}
        @media(max-width:1024px){.ch-grid{grid-template-columns:repeat(2,1fr)}}
        @media(max-width:640px){.ch-grid{grid-template-columns:1fr}}
        .ch-card{background:var(--card);border:1px solid var(--border);border-radius:14px;overflow:hidden;transition:all .3s;cursor:pointer;display:flex;flex-direction:column}
        .ch-card:hover{transform:translateY(-4px);border-color:var(--accent);box-shadow:0 8px 24px rgba(124,58,237,.1)}
        .ch-card .ccb{height:90px;position:relative;overflow:hidden}
        .ch-card .cca{width:48px;height:48px;border-radius:50%;border:3px solid var(--card);background:var(--bg2);display:grid;place-items:center;font-size:16px;font-weight:800;color:var(--accent);margin-top:-24px;margin-left:14px;position:relative;z-index:1}
        .ch-card .cc-body{padding:6px 14px 14px;flex:1;display:flex;flex-direction:column}
        .ch-card .cc-name{font-weight:700;font-size:15px;margin-bottom:2px}
        .ch-card .cc-badge{display:inline-flex;align-items:center;gap:3px;padding:2px 8px;border-radius:999px;font-size:10px;font-weight:700;background:rgba(124,58,237,.08);color:var(--accent);width:fit-content;margin-bottom:6px}
        .ch-card .cc-meta{display:flex;gap:12px;margin-bottom:8px;flex-wrap:wrap}
        .ch-card .cc-meta span{display:flex;align-items:center;gap:4px;color:var(--text2);font-size:12px}
        .ch-card .cc-r{color:var(--text2);font-size:12px;margin-bottom:8px}
        .ch-card .cc-r strong{color:var(--green)}
        .ch-card .cc-actions{display:flex;gap:8px;margin-top:auto}
        .ch-card .cc-actions button{flex:1;height:32px;border-radius:8px;font-size:11px;font-weight:700;transition:all .2s;cursor:pointer}
        .ch-join{border:1px solid var(--accent);background:transparent;color:var(--accent)}
        .ch-join:hover{background:var(--accent);color:#fff}
        .ch-preview{border:1px solid var(--border);background:transparent;color:var(--text2)}
        .ch-preview:hover{border-color:var(--accent);color:var(--accent)}
        .ch-trend{display:flex;gap:14px;overflow-x:auto;padding:4px 0 16px;scroll-snap-type:x mandatory}
        .ch-trend::-webkit-scrollbar{height:4px}
        .ch-trend::-webkit-scrollbar-thumb{background:var(--border2);border-radius:999px}
        .ch-trend .ch-card{min-width:260px;scroll-snap-align:start}
        .sec-title{font-family:Outfit;font-size:18px;font-weight:800;margin:0 0 4px}
        .sec-sub{color:var(--text2);font-size:13px;margin:0 0 16px}
        .ch-empty{text-align:center;padding:48px 24px;color:var(--text2);font-size:14px}
      `}</style>

      <div className="ch-hero">
        <h1>Communities</h1>
        <p>Discover and join vibrant communities. Connect with creators, earn rewards, and grow together.</p>
        <div className="ch-search">
          <input type="text" placeholder="Search communities..." value={search} onChange={e => setSearch(e.target.value)} />
          <button style={{ height: 44, padding: '0 18px', border: 0, background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
            <i className="ti ti-search" /> Search
          </button>
        </div>
      </div>

      <div className="ch-stats">
        {[{ icon: 'ti ti-users', num: '24', label: 'Communities' }, { icon: 'ti ti-users-group', num: '8,420', label: 'Active Members' }, { icon: 'ti ti-checklist', num: '3,280', label: 'Tasks Completed' }, { icon: 'ti ti-coin', num: 'NGN 128K', label: 'Rewards Distributed' }].map((s, i) => (
          <div className="ch-stat" key={i}><div className="csi"><i className={s.icon} /></div><div className="csn">{s.num}</div><div className="csl">{s.label}</div></div>
        ))}
      </div>

      <div className="ch-filters">
        {filters.map(f => (
          <button key={f} className={`ch-pill ${filter === f.toLowerCase() ? 'active' : ''}`} onClick={() => setFilter(f.toLowerCase())}>{f}</button>
        ))}
      </div>

      <div className="sec-title">Trending Communities</div>
      <div className="sec-sub">Most active communities this week</div>
      <div className="ch-trend">
        {trending.map(c => (
          <div className="ch-card" key={c.id} style={{ minWidth: 260 }}>
            <div className="ccb" style={{ background: `linear-gradient(135deg,${getGradient(c.category)})` }} />
            <div className="cca">{c.initials}</div>
            <div className="cc-body">
              <div className="cc-name">{c.name}</div>
              <div className="cc-badge">{c.badge}</div>
              <div className="cc-meta"><span><i className="ti ti-users" /> {c.members.toLocaleString()}</span></div>
              <button className="ch-join" style={{ marginTop: 'auto', height: 30, fontSize: 11 }}>Join</button>
            </div>
          </div>
        ))}
      </div>

      <div className="sec-title">All Communities</div>
      <div className="sec-sub">Discover and join communities that match your interests</div>

      {filtered.length === 0 ? (
        <div className="ch-empty"><i className="ti ti-users" style={{ fontSize: 32, marginBottom: 8, display: 'block', color: 'var(--text3)' }} />No communities found. Try a different filter.</div>
      ) : (
        <div className="ch-grid">
          {filtered.map(c => (
            <div className="ch-card" key={c.id}>
              <div className="ccb" style={{ background: `linear-gradient(135deg,${getGradient(c.category)})` }} />
              <div className="cca">{c.initials}</div>
              <div className="cc-body">
                <div className="cc-name">{c.name}</div>
                <div className="cc-badge">{c.badge}</div>
                <div className="cc-meta">
                  <span><i className="ti ti-users" /> {c.members.toLocaleString()}</span>
                  <span><i className="ti ti-checklist" /> {c.tasks} tasks</span>
                </div>
                <div className="cc-r">Rewards: <strong>NGN {c.rewards.toLocaleString()}</strong>/week</div>
                <div className="cc-actions">
                  <button className="ch-join">Join</button>
                  <button className="ch-preview">Preview</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Layout>
  )
}

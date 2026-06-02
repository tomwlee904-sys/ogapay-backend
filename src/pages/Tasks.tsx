import { useState } from 'react'
import Layout from '../components/Layout'

const allTasks = [
  { id: 1, title: 'Social Media Engagement', reward: 500, time: '10 min', slots: 50, difficulty: 'Easy', category: 'Social', color: '#16a34a' },
  { id: 2, title: 'App Testing - UI/UX Feedback', reward: 1200, time: '25 min', slots: 20, difficulty: 'Medium', category: 'Testing', color: '#F59E0B' },
  { id: 3, title: 'Content Review - Proofread', reward: 800, time: '15 min', slots: 30, difficulty: 'Easy', category: 'Content', color: '#16a34a' },
  { id: 4, title: 'Video Reaction - Product Review', reward: 2000, time: '30 min', slots: 10, difficulty: 'Medium', category: 'Video', color: '#F59E0B' },
  { id: 5, title: 'Community Engagement - Discord/TG', reward: 350, time: '5 min', slots: 100, difficulty: 'Easy', category: 'Social', color: '#16a34a' },
  { id: 6, title: 'Data Entry - Product Listing', reward: 1500, time: '45 min', slots: 15, difficulty: 'Hard', category: 'Data', color: '#DC2626' },
  { id: 7, title: 'Logo Design Contest', reward: 5000, time: '2 hours', slots: 5, difficulty: 'Hard', category: 'Design', color: '#DC2626' },
  { id: 8, title: 'Twitter Thread Writing', reward: 600, time: '20 min', slots: 40, difficulty: 'Easy', category: 'Content', color: '#16a34a' },
  { id: 9, title: 'Market Research Survey', reward: 1000, time: '30 min', slots: 25, difficulty: 'Medium', category: 'Research', color: '#F59E0B' },
  { id: 10, title: 'Beta Testing - New DApp', reward: 3000, time: '1 hour', slots: 8, difficulty: 'Hard', category: 'Testing', color: '#DC2626' },
  { id: 11, title: 'Copywriting - Product Desc', reward: 2000, time: '40 min', slots: 12, difficulty: 'Medium', category: 'Content', color: '#F59E0B' },
  { id: 12, title: 'Telegram Group Moderation', reward: 450, time: '10 min', slots: 60, difficulty: 'Easy', category: 'Social', color: '#16a34a' },
]

const categories = ['All', 'Social', 'Content', 'Testing', 'Design', 'Video', 'Data', 'Research']

export default function Tasks() {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [applied, setApplied] = useState<number[]>([])

  const filtered = allTasks.filter(t => {
    const matchSearch = t.title.toLowerCase().includes(search.toLowerCase())
    const matchCategory = category === 'All' || t.category === category
    return matchSearch && matchCategory
  })

  return (
    <Layout>
      <style>{`
        .tk-hero{margin-bottom:20px}
        .tk-hero .tk-greeting{color:var(--text2);font-size:13px;font-weight:600;margin-bottom:2px}
        .tk-hero h1{font-family:Outfit;font-size:28px;font-weight:900;margin:0 0 4px}
        .tk-hero p{color:var(--text2);font-size:14px;margin:0}
        .tk-controls{display:flex;gap:8px;margin-bottom:18px;flex-wrap:wrap}
        .tk-search{flex:1;min-width:200px;display:flex;align-items:center;gap:8px;height:40px;padding:0 14px;border:1px solid var(--border);border-radius:10px;background:var(--card);transition:border-color .2s}
        .tk-search:focus-within{border-color:var(--accent)}
        .tk-search input{flex:1;border:0;background:transparent;outline:0;color:var(--text);font-size:13px}
        .tk-search input::placeholder{color:var(--text3)}
        .tk-search i{color:var(--text3);font-size:16px}
        .tk-cats{display:flex;gap:4px;flex-wrap:wrap}
        .tk-cat{padding:6px 12px;border-radius:8px;border:1px solid var(--border);background:transparent;color:var(--text2);font-size:11px;font-weight:600;cursor:pointer;transition:all .2s}
        .tk-cat:hover,.tk-cat.active{border-color:var(--accent);color:var(--accent);background:rgba(124,58,237,.08)}
        .tk-grid{display:grid;grid-template-columns:1fr;gap:10px}
        .tk-card{display:flex;align-items:center;gap:14px;padding:16px 18px;background:var(--card);border:1px solid var(--border);border-radius:14px;transition:all .25s;text-decoration:none;color:inherit}
        .tk-card:hover{transform:translateY(-2px);border-color:var(--accent);box-shadow:0 0 24px rgba(124,58,237,.06)}
        .tk-card-left{flex:1;min-width:0}
        .tk-card-title{font-weight:700;font-size:14px;margin-bottom:6px;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
        .tk-diff{padding:2px 8px;border-radius:5px;font-size:9px;font-weight:800;letter-spacing:.03em;text-transform:uppercase}
        .tk-meta{display:flex;gap:12px;flex-wrap:wrap;font-size:12px;color:var(--text2)}
        .tk-meta span{display:flex;align-items:center;gap:4px}
        .tk-meta i{font-size:14px}
        .tk-right{text-align:right;flex-shrink:0}
        .tk-reward{font-family:Outfit;font-size:20px;font-weight:900;color:var(--accent);white-space:nowrap}
        .tk-reward-sub{font-size:11px;color:var(--text3);margin-top:2px}
        .tk-apply{height:32px;padding:0 14px;border-radius:8px;font-weight:700;font-size:11px;display:inline-flex;align-items:center;gap:4px;cursor:pointer;border:0;background:var(--accent);color:#fff;transition:all .2s;margin-top:8px}
        .tk-apply:hover{box-shadow:0 4px 16px rgba(124,58,237,.2)}
        .tk-apply.applied{background:rgba(22,163,74,.12);color:var(--green);cursor:default}
        .tk-empty{text-align:center;padding:48px 20px;color:var(--text2)}
        .tk-empty i{font-size:36px;color:var(--text3);margin-bottom:12px;display:block}
        .tk-empty h3{font-family:Outfit;font-weight:800;margin:0 0 4px;color:var(--text)}
        .tk-empty p{font-size:13px;margin:0;color:var(--text2)}
      `}</style>

      <div className="tk-hero">
        <div className="tk-greeting">Available Work</div>
        <h1>Tasks</h1>
        <p>Complete tasks and earn rewards instantly</p>
      </div>

      <div className="tk-controls">
        <div className="tk-search">
          <i className="ti ti-search" />
          <input type="text" placeholder="Search tasks..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="tk-cats">
          {categories.map(c => (
            <button key={c} className={`tk-cat ${category === c ? 'active' : ''}`} onClick={() => setCategory(c)}>{c}</button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="tk-empty">
          <i className="ti ti-search-off" />
          <h3>No tasks found</h3>
          <p>Try adjusting your search or filter</p>
        </div>
      ) : (
        <div className="tk-grid">
          {filtered.map(t => (
            <a className="tk-card" href={`/app/tasks/${t.id}`} key={t.id}>
              <div className="tk-card-left">
                <div className="tk-card-title">
                  {t.title}
                  <span className="tk-diff" style={{background: `${t.color}15`, color: t.color}}>{t.difficulty}</span>
                </div>
                <div className="tk-meta">
                  <span><i className="ti ti-clock" /> ~{t.time}</span>
                  <span><i className="ti ti-users" /> {t.slots} slots</span>
                </div>
              </div>
              <div className="tk-right">
                <div className="tk-reward">NGN {t.reward.toLocaleString()}</div>
                <div className="tk-reward-sub">per task</div>
                <button className={`tk-apply ${applied.includes(t.id) ? 'applied' : ''}`} onClick={e => {
                  e.preventDefault()
                  if (!applied.includes(t.id)) {
                    setApplied([...applied, t.id])
                  }
                }}>
                  {applied.includes(t.id) ? 'Applied' : 'Apply'}
                </button>
              </div>
            </a>
          ))}
        </div>
      )}
    </Layout>
  )
}

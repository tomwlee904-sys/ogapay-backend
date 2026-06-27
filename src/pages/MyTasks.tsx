import { useState, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import Layout from '../components/Layout'

interface TaskItem {
  id: number
  title: string
  reward: number
  status: string
  progress: number
  date: string
  color: string
}

const myTasks: TaskItem[] = [
  { id: 1, title: 'Social Media Engagement', reward: 500, status: 'In Progress', progress: 60, date: 'Today', color: '#7C3AED' },
  { id: 2, title: 'Content Review', reward: 800, status: 'Under Review', progress: 100, date: 'Yesterday', color: '#F59E0B' },
  { id: 3, title: 'App Testing', reward: 1200, status: 'Approved', progress: 100, date: '3 days ago', color: '#16a34a' },
  { id: 4, title: 'Data Entry', reward: 1500, status: 'Rejected', progress: 80, date: '1 week ago', color: '#DC2626' },
]

const statusColors: Record<string, string> = {
  'in progress': '#7C3AED',
  'under review': '#F59E0B',
  'approved': '#16a34a',
  'rejected': '#DC2626',
}

const tabs = [
  { id: 'all', label: 'All' },
  { id: 'in progress', label: 'In Progress' },
  { id: 'under review', label: 'Under Review' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
]

export default function MyTasks() {
  const { isAuthed } = useAuth()
  const [tab, setTab] = useState('all')

  const filtered = useMemo(
    () => tab === 'all' ? myTasks : myTasks.filter(t => t.status.toLowerCase() === tab),
    [tab]
  )

  if (!isAuthed) {
    return (
      <Layout sidebar={false}>
        <div className="loading"><div className="spinner" /> Sign in to view your tasks</div>
      </Layout>
    )
  }

  return (
    <Layout>
      <style>{`
        .mt-hero{margin-bottom:20px}
        .mt-hero h1{font-family:Outfit;font-size:28px;font-weight:900;margin:0 0 4px}
        .mt-hero p{color:var(--text2);font-size:14px;margin:0}
        .mt-tabs{display:flex;gap:4px;margin-bottom:14px;flex-wrap:wrap}
        .mt-tab{padding:6px 14px;border-radius:8px;border:1px solid var(--border);background:transparent;color:var(--text2);font-size:11px;font-weight:600;cursor:pointer;transition:all .2s}
        .mt-tab:hover,.mt-tab.active{border-color:var(--accent);color:var(--accent);background:rgba(124,58,237,.08)}
        .mt-list{display:grid;gap:6px}
        .mt-item{display:flex;align-items:center;gap:14px;padding:14px 16px;background:var(--card);border:1px solid var(--border);border-radius:12px;transition:all .2s}
        .mt-item:hover{border-color:var(--border2)}
        .mt-icon{width:36px;height:36px;border-radius:9px;display:grid;place-items:center;flex-shrink:0;font-size:16px}
        .mt-info{flex:1;min-width:0}
        .mt-title{font-weight:700;font-size:13px;margin-bottom:4px}
        .mt-progress{height:4px;border-radius:2px;background:var(--bg2);overflow:hidden;margin-bottom:4px;max-width:200px}
        .mt-progress .mt-pf{height:100%;border-radius:2px;transition:width .3s}
        .mt-meta{font-size:11px;color:var(--text3);display:flex;gap:10px}
        .mt-right{text-align:right;flex-shrink:0}
        .mt-reward{font-weight:700;font-size:14px;margin-bottom:4px}
        .mt-status{padding:3px 8px;border-radius:5px;font-size:10px;font-weight:700;display:inline-block}
        .mt-empty{text-align:center;padding:48px 20px;color:var(--text2)}
        .mt-empty i{font-size:36px;color:var(--text3);margin-bottom:12px;display:block}
        .mt-empty h3{font-family:Outfit;font-weight:800;margin:0 0 4px;color:var(--text)}
        .mt-empty p{font-size:13px;margin:0}
      `}</style>

      <div className="mt-hero">
        <h1>My Tasks</h1>
        <p>Track your submitted tasks and their status</p>
      </div>

      <div className="mt-tabs">
        {tabs.map(t => (
          <button key={t.id} className={`mt-tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="mt-empty">
          <i className="ti ti-checklist" />
          <h3>No tasks found</h3>
          <p>Browse available tasks to get started</p>
          <a href="/app/tasks" className="mst-add-btn" style={{display:'inline-flex',marginTop:12,height:36,padding:'0 16px',borderRadius:8,border:0,background:'var(--accent)',color:'#fff',fontWeight:700,fontSize:12,alignItems:'center',gap:6,textDecoration:'none'}}>Browse Tasks</a>
        </div>
      ) : (
        <div className="mt-list">
          {filtered.map(t => {
            const c = t.color || statusColors[t.status.toLowerCase()] || 'var(--text3)'
            return (
              <div className="mt-item" key={t.id}>
                <div className="mt-icon" style={{background: `${c}15`, color: c}}>
                  <i className="ti ti-file-text" />
                </div>
                <div className="mt-info">
                  <div className="mt-title">{t.title}</div>
                  <div className="mt-progress">
                    <div className="mt-pf" style={{width: t.progress + '%', background: c}} />
                  </div>
                  <div className="mt-meta">
                    <span>{t.date}</span>
                    <span>{t.progress}% complete</span>
                  </div>
                </div>
                <div className="mt-right">
                  <div className="mt-reward">NGN {t.reward.toLocaleString()}</div>
                  <span className="mt-status" style={{background: `${c}15`, color: c}}>{t.status}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Layout>
  )
}

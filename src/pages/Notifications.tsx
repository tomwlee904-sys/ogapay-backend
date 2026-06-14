import { useState } from 'react'
import Layout from '../components/Layout'

const initialNotifications = [
  { id: 1, icon: 'ti ti-coin', title: 'Earnings Received', desc: 'You earned NGN 500 from Social Media Task', time: '2m ago', read: false, color: '#16a34a' },
  { id: 2, icon: 'ti ti-check', title: 'Task Approved', desc: 'Your submission for Content Review has been approved', time: '1h ago', read: false, color: '#7C3AED' },
  { id: 3, icon: 'ti ti-wallet', title: 'Withdrawal Processed', desc: 'Your withdrawal of NGN 2,000 has been sent', time: '3h ago', read: false, color: '#2563EB' },
  { id: 4, icon: 'ti ti-user-plus', title: 'New Referral', desc: 'Someone joined using your referral link', time: '5h ago', read: true, color: '#F59E0B' },
  { id: 5, icon: 'ti ti-message', title: 'New Message', desc: 'You have a new message from Task Creator', time: '1d ago', read: true, color: '#EC4899' },
  { id: 6, icon: 'ti ti-bullhorn', title: 'Platform Update', desc: 'New features have been added to the platform', time: '2d ago', read: true, color: '#7C3AED' },
  { id: 7, icon: 'ti ti-star', title: 'Achievement Unlocked', desc: 'You completed 10 tasks! Keep it up', time: '3d ago', read: true, color: '#F59E0B' },
]

export default function Notifications() {
  const [notifs, setNotifs] = useState(initialNotifications)
  const [filter, setFilter] = useState('all')

  const filtered = filter === 'all' ? notifs : filter === 'unread' ? notifs.filter(n => !n.read) : notifs.filter(n => n.read)
  const unreadCount = notifs.filter(n => !n.read).length

  const markAllRead = () => {
    setNotifs(notifs.map(n => ({ ...n, read: true })))
  }

  return (
    <Layout>
      <style>{`
        .nt-hero{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:8px}
        .nt-hero-left{}
        .nt-hero-left .nt-greeting{color:var(--text2);font-size:13px;font-weight:600;margin-bottom:2px}
        .nt-hero-left h1{font-family:Outfit;font-size:28px;font-weight:900;margin:0}
        .nt-hero-right{display:flex;gap:8px}
        .nt-tabs{display:flex;gap:4px;margin-bottom:16px}
        .nt-tab{padding:6px 14px;border-radius:8px;border:1px solid var(--border);background:transparent;color:var(--text2);font-size:11px;font-weight:600;cursor:pointer;transition:all .2s}
        .nt-tab:hover,.nt-tab.active{border-color:var(--accent);color:var(--accent);background:rgba(124,58,237,.08)}
        .nt-mark-btn{height:32px;padding:0 12px;border-radius:8px;border:1px solid var(--border);background:transparent;color:var(--text2);font-size:11px;font-weight:600;cursor:pointer;transition:all .2s}
        .nt-mark-btn:hover{border-color:var(--accent);color:var(--accent)}
        .nt-list{display:grid;gap:6px}
        .nt-item{display:flex;gap:14px;padding:14px 16px;background:var(--card);border:1px solid var(--border);border-radius:12px;transition:all .2s;cursor:pointer}
        .nt-item:hover{border-color:var(--border2)}
        .nt-item.unread{border-left:3px solid var(--accent);background:rgba(124,58,237,.03)}
        .nt-icon{width:36px;height:36px;border-radius:9px;display:grid;place-items:center;flex-shrink:0;font-size:16px}
        .nt-content{flex:1;min-width:0}
        .nt-title{font-weight:700;font-size:13px;margin-bottom:2px}
        .nt-desc{color:var(--text2);font-size:12px;margin-bottom:2px}
        .nt-time{font-size:11px;color:var(--text3)}
        .nt-empty{text-align:center;padding:48px 20px;color:var(--text2)}
        .nt-empty i{font-size:36px;color:var(--text3);margin-bottom:12px;display:block}
      `}</style>

      <div className="nt-hero">
        <div className="nt-hero-left">
          <div className="nt-greeting">Updates</div>
          <h1>Notifications {unreadCount > 0 && <span style={{fontSize:14,color:'var(--accent)',fontWeight:700}}>({unreadCount})</span>}</h1>
        </div>
        <div className="nt-hero-right">
          {unreadCount > 0 && (
            <button className="nt-mark-btn" onClick={markAllRead}><i className="ti ti-check-double" /> Mark all read</button>
          )}
        </div>
      </div>

      <div className="nt-tabs">
        {[
          { id: 'all', label: 'All' },
          { id: 'unread', label: `Unread (${unreadCount})` },
          { id: 'read', label: 'Read' },
        ].map(t => (
          <button key={t.id} className={`nt-tab ${filter === t.id ? 'active' : ''}`} onClick={() => setFilter(t.id)}>{t.label}</button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="nt-empty">
          <i className="ti ti-bell-off" />
          <h3 style={{fontFamily:'Outfit',fontWeight:800,margin:'0 0 4px',color:'var(--text)'}}>All caught up!</h3>
          <p style={{fontSize:13,margin:0}}>No notifications here</p>
        </div>
      ) : (
        <div className="nt-list">
          {filtered.map(n => (
            <div className={`nt-item ${!n.read ? 'unread' : ''}`} key={n.id} onClick={() => {
              setNotifs(notifs.map(x => x.id === n.id ? { ...x, read: true } : x))
            }}>
              <div className="nt-icon" style={{background: `${n.color}15`, color: n.color}}>
                <i className={n.icon} />
              </div>
              <div className="nt-content">
                <div className="nt-title">{n.title}</div>
                <div className="nt-desc">{n.desc}</div>
                <div className="nt-time">{n.time}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Layout>
  )
}

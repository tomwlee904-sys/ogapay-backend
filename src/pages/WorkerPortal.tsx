import Layout from '../components/Layout'

const quickLinks = [
  { icon: 'ti ti-building-store', label: 'My Store', href: '/app/my-store' },
  { icon: 'ti ti-article', label: 'My Blogs', href: '/blog' },
  { icon: 'ti ti-briefcase', label: 'My Work', href: '/app/my-tasks' },
  { icon: 'ti ti-message', label: 'Messages', href: '/app/messages' },
  { icon: 'ti ti-users', label: 'Communities', href: '/app/communities' },
  { icon: 'ti ti-file-check', label: 'My Submissions', href: '/app/submissions' },
  { icon: 'ti ti-star', label: 'Reviews To Write', href: '/app/reviews' },
  { icon: 'ti ti-list', label: 'My Reviews', href: '/app/my-reviews' },
  { icon: 'ti ti-eye', label: 'View Public Profile', href: '/u/username' },
]

const stats = [
  { icon: 'ti ti-star', color: '#F59E0B', count: '124', label: 'Reviews' },
  { icon: 'ti ti-trophy', color: '#7C3AED', count: '8', label: 'Challenges Participated' },
  { icon: 'ti ti-medal', color: '#16a34a', count: '12', label: 'Wins' },
  { icon: 'ti ti-heart', color: '#EC4899', count: '34', label: 'Compliments' },
  { icon: 'ti ti-users', color: '#2563EB', count: '15', label: 'Communities' },
  { icon: 'ti ti-coin', color: '#F59E0B', count: '28', label: 'Tips Received' },
  { icon: 'ti ti-article', color: '#7C3AED', count: '6', label: 'Blogs' },
]

export default function WorkerPortal() {
  return (
    <Layout>
      <style>{`
        .wp-bread{display:flex;align-items:center;gap:6px;font-size:13px;margin-bottom:16px;color:var(--text3)}
        .wp-bread a{color:var(--text2);text-decoration:none}
        .wp-bread a:hover{color:var(--text)}
        .wp-hero{margin-bottom:24px}
        .wp-hero .wph-greeting{color:var(--text2);font-size:13px;font-weight:600;margin-bottom:2px}
        .wp-hero h1{font-family:Outfit;font-size:28px;font-weight:900;margin:0}
        .wp-quick-links{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:28px}
        @media(max-width:600px){.wp-quick-links{grid-template-columns:repeat(2,1fr)}}
        .wp-ql{display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--card);border:1px solid var(--border);border-radius:10px;text-decoration:none;color:var(--text);font-size:13px;font-weight:600;transition:all .2s}
        .wp-ql:hover{transform:translateY(-2px);border-color:var(--accent);box-shadow:0 0 20px rgba(124,58,237,.06)}
        .wp-ql i{font-size:18px;width:22px;text-align:center;color:var(--accent)}
        .wp-profile{display:flex;align-items:center;gap:18px;padding:20px 24px;background:var(--card);border:1px solid var(--border);border-radius:14px;margin-bottom:24px}
        .wp-avatar{width:56px;height:56px;border-radius:50%;background:var(--bg2);display:grid;place-items:center;border:3px solid var(--accent);flex-shrink:0;overflow:hidden}
        .wp-avatar i{font-size:24px;color:var(--text3)}
        .wp-name{font-family:Outfit;font-size:18px;font-weight:800;margin:0 0 2px}
        .wp-bio{color:var(--text2);font-size:13px;margin:0 0 8px;max-width:320px}
        .wp-edit-btn{height:32px;padding:0 14px;border-radius:8px;font-weight:600;font-size:11px;display:inline-flex;align-items:center;gap:5px;cursor:pointer;border:1px solid var(--border);background:var(--bg2);color:var(--text2);text-decoration:none;transition:all .2s}
        .wp-edit-btn:hover{border-color:var(--accent);color:var(--accent)}
        .wp-stats{margin-bottom:24px}
        .wp-stat{display:flex;align-items:center;gap:14px;padding:12px 16px;background:var(--card);border:1px solid var(--border);border-radius:10px;margin-bottom:6px;transition:all .2s}
        .wp-stat:hover{border-color:var(--border2)}
        .wp-stat-icon{width:32px;height:32px;border-radius:8px;display:grid;place-items:center;font-size:16px;flex-shrink:0}
        .wp-stat-count{font-family:Outfit;font-size:18px;font-weight:900;min-width:36px}
        .wp-stat-label{color:var(--text2);font-size:13px;font-weight:600}
        .wp-section-title{font-family:Outfit;font-size:15px;font-weight:800;margin:0 0 12px;display:flex;align-items:center;gap:6px;color:var(--text)}
      `}</style>

      <div className="wp-bread">
        <a href="/app">Home</a>
        <i className="ti ti-chevron-right" style={{fontSize:10}} />
        <span>Worker Portal</span>
      </div>

      <div className="wp-hero">
        <div className="wph-greeting">Your workspace</div>
        <h1>Worker Portal</h1>
      </div>

      {/* Quick Links */}
      <div className="wp-section-title"><i className="ti ti-link" style={{color:'var(--accent)'}} /> Quick Links</div>
      <div className="wp-quick-links">
        {quickLinks.map((q, i) => (
          <a className="wp-ql" href={q.href} key={i}>
            <i className={q.icon} />
            {q.label}
          </a>
        ))}
      </div>

      {/* Worker Profile Summary */}
      <div className="wp-section-title"><i className="ti ti-user" style={{color:'var(--accent)'}} /> Worker Profile</div>
      <div className="wp-profile">
        <div className="wp-avatar">
          <i className="ti ti-user" />
        </div>
        <div style={{flex:1}}>
          <div className="wp-name">User Name</div>
          <div className="wp-bio">Freelancer &amp; task worker on OgaPay</div>
          <a className="wp-edit-btn" href="/app/settings"><i className="ti ti-edit" /> Edit Profile</a>
        </div>
      </div>

      {/* Worker Statistics */}
      <div className="wp-section-title"><i className="ti ti-trending-up" style={{color:'var(--accent)'}} /> Statistics</div>
      <div className="wp-stats">
        {stats.map((s, i) => (
          <div className="wp-stat" key={i}>
            <div className="wp-stat-icon" style={{background: `${s.color}15`, color: s.color}}>
              <i className={s.icon} />
            </div>
            <span className="wp-stat-count" style={{color: s.color}}>{s.count}</span>
            <span className="wp-stat-label">{s.label}</span>
          </div>
        ))}
      </div>
    </Layout>
  )
}

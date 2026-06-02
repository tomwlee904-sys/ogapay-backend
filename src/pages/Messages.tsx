import { useState } from 'react'
import Layout from '../components/Layout'

const conversations = [
  { id: 1, name: 'Task Creator', lastMsg: 'Great work! I have approved your submission.', time: '2m ago', unread: 2, online: true, avatar: 'TC' },
  { id: 2, name: 'Community Admin', lastMsg: 'Welcome to the Solana Builders community!', time: '1h ago', unread: 0, online: false, avatar: 'CA' },
  { id: 3, name: 'Support Team', lastMsg: 'Your withdrawal request has been processed.', time: '3h ago', unread: 1, online: true, avatar: 'ST' },
  { id: 4, name: 'Referral Bonus', lastMsg: 'You earned NGN 300 from a referral!', time: '1d ago', unread: 0, online: false, avatar: 'RB' },
]

export default function Messages() {
  const [search, setSearch] = useState('')

  const filtered = conversations.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.lastMsg.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <Layout>
      <style>{`
        .ms-hero{margin-bottom:20px}
        .ms-hero h1{font-family:Outfit;font-size:28px;font-weight:900;margin:0 0 4px}
        .ms-hero p{color:var(--text2);font-size:14px;margin:0}
        .ms-search{display:flex;align-items:center;gap:8px;height:38px;padding:0 12px;border:1px solid var(--border);border-radius:10px;background:var(--card);margin-bottom:14px;transition:border-color .2s}
        .ms-search:focus-within{border-color:var(--accent)}
        .ms-search input{flex:1;border:0;background:transparent;outline:0;color:var(--text);font-size:13px}
        .ms-search input::placeholder{color:var(--text3)}
        .ms-search i{color:var(--text3);font-size:16px}
        .ms-list{display:grid;gap:6px}
        .ms-item{display:flex;gap:14px;padding:14px 16px;background:var(--card);border:1px solid var(--border);border-radius:12px;cursor:pointer;transition:all .2s;text-decoration:none;color:inherit}
        .ms-item:hover{border-color:var(--accent);transform:translateY(-1px)}
        .ms-avatar{width:40px;height:40px;border-radius:50%;background:var(--bg2);display:grid;place-items:center;flex-shrink:0;font-size:12px;font-weight:800;color:var(--text);position:relative}
        .ms-online{width:10px;height:10px;border-radius:50%;background:var(--green);position:absolute;bottom:0;right:0;border:2px solid var(--card)}
        .ms-content{flex:1;min-width:0}
        .ms-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:4px}
        .ms-name{font-weight:700;font-size:13px}
        .ms-time{font-size:11px;color:var(--text3)}
        .ms-preview{font-size:12px;color:var(--text2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .ms-badge{background:var(--accent);color:#fff;font-size:10px;font-weight:800;width:18px;height:18px;border-radius:50%;display:grid;place-items:center;flex-shrink:0}
        .ms-empty{text-align:center;padding:48px 20px;color:var(--text2)}
        .ms-empty i{font-size:36px;color:var(--text3);margin-bottom:12px;display:block}
      `}</style>

      <div className="ms-hero">
        <h1>Messages</h1>
        <p>Chat with task creators, community members, and support</p>
      </div>

      <div className="ms-search">
        <i className="ti ti-search" />
        <input type="text" placeholder="Search conversations..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {filtered.length === 0 ? (
        <div className="ms-empty">
          <i className="ti ti-message-off" />
          <h3 style={{fontFamily:'Outfit',fontWeight:800,margin:'0 0 4px',color:'var(--text)'}}>No conversations</h3>
          <p style={{fontSize:13,margin:0}}>Your messages will appear here</p>
        </div>
      ) : (
        <div className="ms-list">
          {filtered.map(c => (
            <div className="ms-item" key={c.id} onClick={() => {/* open conversation */}}>
              <div className="ms-avatar">
                {c.avatar}
                {c.online && <span className="ms-online" />}
              </div>
              <div className="ms-content">
                <div className="ms-head">
                  <span className="ms-name">{c.name}</span>
                  <span className="ms-time">{c.time}</span>
                </div>
                <div className="ms-preview">{c.lastMsg}</div>
              </div>
              {c.unread > 0 && <span className="ms-badge">{c.unread}</span>}
            </div>
          ))}
        </div>
      )}
    </Layout>
  )
}

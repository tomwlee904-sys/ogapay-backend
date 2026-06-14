import { useState } from 'react'
import Layout from '../components/Layout'

const documents = [
  { id: 1, name: 'Business Permit', type: 'PDF', size: '2.4 MB', date: 'Mar 2025', status: 'Verified', color: '#16a34a' },
  { id: 2, name: 'ID Document', type: 'Image', size: '1.8 MB', date: 'Feb 2025', status: 'Verified', color: '#16a34a' },
  { id: 3, name: 'KYC Verification', type: 'PDF', size: '3.2 MB', date: 'Jan 2025', status: 'Pending', color: '#F59E0B' },
  { id: 4, name: 'Tax Certificate', type: 'PDF', size: '1.1 MB', date: 'Dec 2024', status: 'Verified', color: '#16a34a' },
  { id: 5, name: 'Portfolio', type: 'Image', size: '5.6 MB', date: 'Nov 2024', status: 'Verified', color: '#16a34a' },
]

const stats = [
  { icon: 'ti ti-vault', color: '#7C3AED', count: '5', label: 'Documents' },
  { icon: 'ti ti-lock', color: '#16a34a', count: '14 MB', label: 'Storage Used' },
  { icon: 'ti ti-shield-check', color: '#2563EB', count: '4', label: 'Verified' },
]

export default function Vault() {
  const [search, setSearch] = useState('')

  const filtered = documents.filter(d => d.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <Layout>
      <style>{`
        .vt-hero{margin-bottom:20px}
        .vt-hero .vt-greeting{color:var(--text2);font-size:13px;font-weight:600;margin-bottom:2px}
        .vt-hero h1{font-family:Outfit;font-size:28px;font-weight:900;margin:0 0 4px}
        .vt-hero p{color:var(--text2);font-size:14px;margin:0}
        .vt-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px}
        @media(max-width:500px){.vt-stats{grid-template-columns:1fr}}
        .vt-stat{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:16px;text-align:center;transition:all .25s}
        .vt-stat:hover{transform:translateY(-2px);border-color:var(--accent)}
        .vt-stat i{font-size:24px;margin-bottom:6px;display:block}
        .vt-stat .vt-num{font-family:Outfit;font-size:24px;font-weight:900}
        .vt-stat .vt-label{font-size:12px;color:var(--text2);margin-top:2px}
        .vt-controls{display:flex;gap:8px;margin-bottom:16px}
        .vt-search{flex:1;display:flex;align-items:center;gap:8px;height:38px;padding:0 12px;border:1px solid var(--border);border-radius:10px;background:var(--card);transition:border-color .2s}
        .vt-search:focus-within{border-color:var(--accent)}
        .vt-search input{flex:1;border:0;background:transparent;outline:0;color:var(--text);font-size:13px}
        .vt-search input::placeholder{color:var(--text3)}
        .vt-search i{color:var(--text3);font-size:16px}
        .vt-upload-btn{height:38px;padding:0 14px;border-radius:10px;border:0;background:var(--accent);color:#fff;font-weight:700;font-size:12px;display:inline-flex;align-items:center;gap:6px;cursor:pointer;transition:all .2s}
        .vt-upload-btn:hover{box-shadow:0 4px 16px rgba(124,58,237,.2)}
        .vt-list{display:grid;gap:6px}
        .vt-item{display:flex;align-items:center;gap:14px;padding:14px 16px;background:var(--card);border:1px solid var(--border);border-radius:12px;transition:all .2s}
        .vt-item:hover{border-color:var(--border2)}
        .vt-icon{width:36px;height:36px;border-radius:9px;display:grid;place-items:center;flex-shrink:0;font-size:16px}
        .vt-info{flex:1;min-width:0}
        .vt-name{font-weight:700;font-size:13px;margin-bottom:2px}
        .vt-meta{font-size:11px;color:var(--text3);display:flex;gap:10px}
        .vt-status{padding:3px 8px;border-radius:5px;font-size:10px;font-weight:700}
        .vt-empty{text-align:center;padding:48px 20px;color:var(--text2)}
        .vt-empty i{font-size:36px;color:var(--text3);margin-bottom:12px;display:block}
      `}</style>

      <div className="vt-hero">
        <div className="vt-greeting">Secure Storage</div>
        <h1>Vault</h1>
        <p>Store and manage your important documents securely</p>
      </div>

      <div className="vt-stats">
        {stats.map((s, i) => (
          <div className="vt-stat" key={i}>
            <i className={s.icon} style={{color: s.color}} />
            <div className="vt-num" style={{color: s.color}}>{s.count}</div>
            <div className="vt-label">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="vt-controls">
        <div className="vt-search">
          <i className="ti ti-search" />
          <input type="text" placeholder="Search documents..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button className="vt-upload-btn"><i className="ti ti-upload" /> Upload</button>
      </div>

      {filtered.length === 0 ? (
        <div className="vt-empty">
          <i className="ti ti-vault" />
          <h3 style={{fontFamily:'Outfit',fontWeight:800,margin:'0 0 4px',color:'var(--text)'}}>No documents found</h3>
          <p style={{fontSize:13,margin:0}}>Upload your first document to get started</p>
        </div>
      ) : (
        <div className="vt-list">
          {filtered.map(d => (
            <div className="vt-item" key={d.id}>
              <div className="vt-icon" style={{background: `${d.color}15`, color: d.color}}>
                <i className="ti ti-file-text" />
              </div>
              <div className="vt-info">
                <div className="vt-name">{d.name}</div>
                <div className="vt-meta">
                  <span>{d.type}</span>
                  <span>{d.size}</span>
                  <span>{d.date}</span>
                </div>
              </div>
              <span className="vt-status" style={{background: `${d.color}15`, color: d.color}}>{d.status}</span>
            </div>
          ))}
        </div>
      )}
    </Layout>
  )
}

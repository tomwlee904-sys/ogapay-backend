import { useState } from 'react'
import Layout from '../components/Layout'

const categories = [
  { id: 'design', name: 'Design', icon: 'ti ti-palette', count: 12 },
  { id: 'social', name: 'Social Media', icon: 'ti ti-share', count: 8 },
  { id: 'marketing', name: 'Marketing', icon: 'ti ti-trending-up', count: 6 },
  { id: 'dev', name: 'Development', icon: 'ti ti-code', count: 10 },
  { id: 'communities', name: 'Communities', icon: 'ti ti-users', count: 5 },
  { id: 'content', name: 'Content', icon: 'ti ti-edit', count: 7 },
  { id: 'crypto', name: 'Crypto', icon: 'ti ti-coin', count: 9 },
  { id: 'ai', name: 'AI Tools', icon: 'ti ti-robot', count: 4 },
  { id: 'templates', name: 'Templates', icon: 'ti ti-files', count: 11 },
]

const products = [
  { id: 1, name: 'X Premium Membership', category: 'Social Media', price: 12500, seller: 'Afzan', initials: 'AF', verified: true, stars: 4.8, reviews: 124, desc: 'Get your X Premium subscription activated quickly and safely.' },
  { id: 2, name: 'YouTube Thumbnail Design', category: 'Design', price: 8500, seller: 'Kashem', initials: 'KA', verified: true, stars: 4.9, reviews: 89, desc: 'High-CTR thumbnails that stop the scroll.' },
  { id: 3, name: 'Web3 Landing Page', category: 'Development', price: 55000, seller: 'Toxictoad', initials: 'TX', verified: true, stars: 4.7, reviews: 56, desc: 'Modern, responsive landing pages for Web3 projects.' },
  { id: 4, name: 'Community Management', category: 'Communities', price: 35000, seller: 'BlueTick', initials: 'BT', verified: true, stars: 4.6, reviews: 203, desc: 'Full-service community management and engagement.' },
  { id: 5, name: 'Logo Design Bundle', category: 'Design', price: 15000, seller: 'DesignLab', initials: 'DL', verified: false, stars: 4.5, reviews: 67, desc: 'Professional logo design with multiple concepts.' },
  { id: 6, name: 'Smart Contract Audit', category: 'Crypto', price: 95000, seller: 'CryptoPro', initials: 'CP', verified: true, stars: 4.9, reviews: 42, desc: 'Comprehensive smart contract security audit.' },
  { id: 7, name: 'Content Writing Pack', category: 'Content', price: 12000, seller: 'Sidmaurya', initials: 'SM', verified: false, stars: 4.4, reviews: 158, desc: 'SEO-optimized content for your platform.' },
  { id: 8, name: 'Social Media Growth', category: 'Social Media', price: 25000, seller: 'Afzan', initials: 'AF', verified: true, stars: 4.7, reviews: 312, desc: 'Organic social media growth strategies.' },
  { id: 9, name: 'AI Chatbot Setup', category: 'AI Tools', price: 45000, seller: 'Toxictoad', initials: 'TX', verified: true, stars: 4.8, reviews: 28, desc: 'Custom AI chatbot for your business.' },
]

const sortOptions = ['quality_desc', 'newest', 'stars_desc', 'random']

export default function Store() {
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('quality_desc')

  const sorted = [...products].sort((a, b) => {
    if (sort === 'newest') return b.id - a.id
    if (sort === 'stars_desc') return b.stars - a.stars
    if (sort === 'random') return Math.random() - 0.5
    return (b.stars * b.reviews) - (a.stars * a.reviews)
  })

  const filtered = sorted.filter(p => {
    if (!search) return true
    const q = search.toLowerCase()
    return p.name.toLowerCase().includes(q) || p.seller.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)
  })

  return (
    <Layout>
      <style>{`
        .st-hero{text-align:center;padding:40px 24px 36px;background:radial-gradient(ellipse at 50% 0%,rgba(124,58,237,.08) 0%,transparent 70%);border-radius:14px;margin-bottom:28px}
        .st-hero h1{font-family:Outfit;font-size:38px;font-weight:900;margin:0 0 8px;background:linear-gradient(135deg,#fff 30%,var(--accent) 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
        .st-hero p{color:var(--text2);font-size:14px;max-width:500px;margin:0 auto 20px;line-height:1.6}
        .st-search{display:flex;align-items:center;gap:0;max-width:500px;margin:0 auto;background:var(--card);border:1.5px solid var(--border);border-radius:12px;overflow:hidden;transition:all .2s}
        .st-search:focus-within{border-color:var(--accent);box-shadow:0 0 0 3px rgba(124,58,237,.1)}
        .st-search input{flex:1;border:0;background:transparent;color:var(--text);font-size:14px;padding:12px 16px;outline:none}
        .st-search input::placeholder{color:var(--text3)}
        .st-row{display:flex;align-items:center;justify-content:center;gap:10px;margin-top:14px;flex-wrap:wrap}
        .st-sort{height:36px;padding:0 12px;border:1px solid var(--border);border-radius:8px;background:var(--card);color:var(--text2);font-size:12px;font-weight:600;outline:none;cursor:pointer}
        .st-cats{display:grid;grid-template-columns:repeat(9,1fr);gap:10px;margin-bottom:28px}
        @media(max-width:900px){.st-cats{grid-template-columns:repeat(3,1fr)}}
        @media(max-width:480px){.st-cats{grid-template-columns:repeat(2,1fr)}}
        .st-cat{display:flex;flex-direction:column;align-items:center;gap:6px;padding:20px 10px;background:var(--card);border:1px solid var(--border);border-radius:14px;text-align:center;cursor:pointer;transition:all .25s;position:relative;overflow:hidden}
        .st-cat:hover{transform:translateY(-3px);border-color:var(--accent);box-shadow:0 0 30px rgba(124,58,237,.1)}
        .st-cat i{font-size:28px;color:var(--accent)}
        .st-cat .scn{font-weight:700;font-size:13px}
        .st-cat .scc{color:var(--text3);font-size:11px}
        .st-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:8px}
        .st-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:28px}
        @media(max-width:1024px){.st-grid{grid-template-columns:repeat(2,1fr)}}
        @media(max-width:640px){.st-grid{grid-template-columns:1fr}}
        .st-card{background:var(--card);border:1px solid var(--border);border-radius:14px;overflow:hidden;transition:all .3s;cursor:pointer;display:flex;flex-direction:column}
        .st-card:hover{transform:translateY(-5px);border-color:var(--accent);box-shadow:0 8px 24px rgba(124,58,237,.1)}
        .st-card .sc-img{height:160px;background:var(--bg2);display:grid;place-items:center;position:relative}
        .st-card .sc-img i{font-size:36px;color:var(--text3)}
        .st-card .sc-badge{position:absolute;top:10px;right:10px;padding:3px 8px;border-radius:999px;font-size:9px;font-weight:700;background:rgba(22,163,74,.12);color:var(--green);border:1px solid rgba(22,163,74,.25);display:flex;align-items:center;gap:3px}
        .st-card .sc-body{padding:14px;flex:1;display:flex;flex-direction:column}
        .st-card .sc-name{font-weight:700;font-size:14px;margin-bottom:2px;line-height:1.3}
        .st-card .sc-desc{color:var(--text2);font-size:12px;margin-bottom:10px;line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
        .st-card .sc-seller{display:flex;align-items:center;gap:8px;margin-bottom:10px}
        .st-card .sc-seller .sa{width:24px;height:24px;border-radius:50%;background:var(--bg2);display:grid;place-items:center;font-size:10px;font-weight:700;color:var(--accent);flex-shrink:0}
        .st-card .sc-seller .sn{font-size:12px;font-weight:600}
        .st-card .sc-seller svg{width:14px;height:14px;color:var(--accent);flex-shrink:0}
        .st-card .sc-seller .sr{color:var(--gold);font-size:11px;margin-left:auto}
        .st-card .sc-row{display:flex;align-items:center;justify-content:space-between;margin-top:auto;padding-top:10px;border-top:1px solid var(--border)}
        .st-card .sc-price .sp-ngn{font-weight:800;font-size:15px}
        .st-card .sc-price .sp-label{color:var(--text3);font-size:11px}
        .st-card .sc-view{height:30px;padding:0 12px;border-radius:7px;border:1px solid var(--accent);background:transparent;color:var(--accent);font-size:11px;font-weight:700;cursor:pointer;transition:all .2s}
        .st-card .sc-view:hover{background:var(--accent);color:#fff}
        .sec-title{font-family:Outfit;font-size:18px;font-weight:800;margin:0 0 4px}
        .sec-sub{color:var(--text2);font-size:13px;margin:0 0 16px}
      `}</style>

      <div className="st-hero">
        <h1>Marketplace</h1>
        <p>Buy and sell digital products, services, templates, social packages, design assets, community tools, and crypto services.</p>
        <div className="st-search">
          <input type="text" placeholder="Search products..." value={search} onChange={e => setSearch(e.target.value)} />
          <button style={{ height: 44, padding: '0 18px', border: 0, background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
            <i className="ti ti-search" /> Search
          </button>
        </div>
        <div className="st-row">
          <select className="st-sort" value={sort} onChange={e => setSort(e.target.value)}>
            <option value="quality_desc">Highest Rated</option>
            <option value="newest">Newest</option>
            <option value="stars_desc">Most Stars</option>
            <option value="random">Random</option>
          </select>
        </div>
      </div>

      <div className="sec-title">Categories</div>
      <div className="sec-sub">Browse products by category</div>
      <div className="st-cats">
        {categories.map(c => (
          <div className="st-cat" key={c.id}>
            <i className={c.icon} />
            <div className="scn">{c.name}</div>
            <div className="scc">{c.count} products</div>
          </div>
        ))}
      </div>

      <div className="st-header">
        <div className="sec-title" style={{ margin: 0 }}>All Products</div>
        <span style={{ color: 'var(--text2)', fontSize: 13 }}>Showing <strong style={{ color: 'var(--text)' }}>{filtered.length}</strong> products</span>
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--text2)', fontSize: 14 }}>
          <i className="ti ti-building-store" style={{ fontSize: 36, marginBottom: 8, display: 'block', color: 'var(--text3)' }} />
          No products found. Try different search terms.
        </div>
      ) : (
        <div className="st-grid">
          {filtered.map(p => (
            <div className="st-card" key={p.id}>
              <div className="sc-img">
                <i className="ti ti-photo" />
                <div className="sc-badge"><i className="ti ti-circle-filled" style={{ fontSize: 6, color: 'var(--green)' }} /> Active</div>
              </div>
              <div className="sc-body">
                <div className="sc-name">{p.name}</div>
                <div className="sc-desc">{p.desc}</div>
                <div className="sc-seller">
                  <div className="sa">{p.initials}</div>
                  <span className="sn">{p.seller}</span>
                  {p.verified && <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.4 7.2L22 9.2l-5.6 4.8L18 21l-6-3.6L6 21l1.6-7L2 9.2l7.6-.8L12 2z" /></svg>}
                  <span className="sr">{'★'.repeat(Math.round(p.stars))}</span>
                </div>
                <div className="sc-row">
                  <div className="sc-price"><div className="sp-ngn">NGN {p.price.toLocaleString()}</div><div className="sp-label">Starting price</div></div>
                  <button className="sc-view">View Details</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Layout>
  )
}

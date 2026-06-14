import { useState } from 'react'
import Layout from '../components/Layout'

const products = [
  { id: 1, name: 'Social Media Growth', price: 'NGN 5,000', sales: 12, status: 'Active', color: '#16a34a' },
  { id: 2, name: 'Logo Design Package', price: 'NGN 15,000', sales: 8, status: 'Active', color: '#16a34a' },
  { id: 3, name: 'Content Writing Bundle', price: 'NGN 10,000', sales: 5, status: 'Draft', color: '#F59E0B' },
]

export default function MyStore() {
  const [tab, setTab] = useState('all')

  const filtered = tab === 'all' ? products : products.filter(p => p.status.toLowerCase() === tab)

  return (
    <Layout>
      <style>{`
        .mst-hero{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:10px}
        .mst-hero-left h1{font-family:Outfit;font-size:28px;font-weight:900;margin:0 0 4px}
        .mst-hero-left p{color:var(--text2);font-size:14px;margin:0}
        .mst-add-btn{height:38px;padding:0 16px;border-radius:10px;border:0;background:var(--accent);color:#fff;font-weight:700;font-size:12px;display:inline-flex;align-items:center;gap:6px;cursor:pointer;transition:all .2s;text-decoration:none}
        .mst-add-btn:hover{box-shadow:0 4px 16px rgba(124,58,237,.2)}
        .mst-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px}
        @media(max-width:500px){.mst-stats{grid-template-columns:1fr}}
        .mst-stat{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:16px;text-align:center;transition:all .25s}
        .mst-stat:hover{transform:translateY(-2px);border-color:var(--accent)}
        .mst-stat i{font-size:24px;margin-bottom:6px;display:block}
        .mst-stat .mst-num{font-family:Outfit;font-size:24px;font-weight:900}
        .mst-stat .mst-label{font-size:12px;color:var(--text2);margin-top:2px}
        .mst-tabs{display:flex;gap:4px;margin-bottom:14px}
        .mst-tab{padding:6px 14px;border-radius:8px;border:1px solid var(--border);background:transparent;color:var(--text2);font-size:11px;font-weight:600;cursor:pointer;transition:all .2s}
        .mst-tab:hover,.mst-tab.active{border-color:var(--accent);color:var(--accent);background:rgba(124,58,237,.08)}
        .mst-list{display:grid;gap:6px}
        .mst-item{display:flex;align-items:center;gap:14px;padding:14px 16px;background:var(--card);border:1px solid var(--border);border-radius:12px;transition:all .2s}
        .mst-item:hover{border-color:var(--border2)}
        .mst-icon{width:36px;height:36px;border-radius:9px;display:grid;place-items:center;flex-shrink:0;font-size:16px}
        .mst-info{flex:1;min-width:0}
        .mst-name{font-weight:700;font-size:13px;margin-bottom:2px}
        .mst-meta{font-size:11px;color:var(--text3);display:flex;gap:10px}
        .mst-right{text-align:right;flex-shrink:0}
        .mst-price{font-weight:700;font-size:14px}
        .mst-status{padding:3px 8px;border-radius:5px;font-size:10px;font-weight:700;display:inline-block;margin-top:4px}
        .mst-empty{text-align:center;padding:48px 20px;color:var(--text2)}
        .mst-empty i{font-size:36px;color:var(--text3);margin-bottom:12px;display:block}
      `}</style>

      <div className="mst-hero">
        <div className="mst-hero-left">
          <h1>My Store</h1>
          <p>Manage your products and services</p>
        </div>
        <a className="mst-add-btn" href="#"><i className="ti ti-plus" /> Add Product</a>
      </div>

      <div className="mst-stats">
        {[
          { icon: 'ti ti-building-store', color: '#7C3AED', count: '3', label: 'Products' },
          { icon: 'ti ti-coin', color: '#16a34a', count: 'NGN 0', label: 'Sales' },
          { icon: 'ti ti-shopping-cart', color: '#2563EB', count: '25', label: 'Orders' },
        ].map((s, i) => (
          <div className="mst-stat" key={i}>
            <i className={s.icon} style={{color: s.color}} />
            <div className="mst-num" style={{color: s.color}}>{s.count}</div>
            <div className="mst-label">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="mst-tabs">
        {['all', 'active', 'draft'].map(t => (
          <button key={t} className={`mst-tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="mst-empty">
          <i className="ti ti-building-store" />
          <h3 style={{fontFamily:'Outfit',fontWeight:800,margin:'0 0 4px',color:'var(--text)'}}>No products yet</h3>
          <p style={{fontSize:13,margin:0}}>Start adding products to your store</p>
        </div>
      ) : (
        <div className="mst-list">
          {filtered.map(p => (
            <div className="mst-item" key={p.id}>
              <div className="mst-icon" style={{background: `${p.color}15`, color: p.color}}>
                <i className="ti ti-box" />
              </div>
              <div className="mst-info">
                <div className="mst-name">{p.name}</div>
                <div className="mst-meta">
                  <span>{p.sales} sales</span>
                </div>
              </div>
              <div className="mst-right">
                <div className="mst-price">{p.price}</div>
                <span className="mst-status" style={{background: `${p.color}15`, color: p.color}}>{p.status}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </Layout>
  )
}

import { useState, useEffect } from 'react'
import Layout from '../components/Layout'

const API_BASE = 'https://ogapay-production.up.railway.app/api/v1'
function getToken() { return localStorage.getItem('token') || sessionStorage.getItem('token') || '' }
function authHeaders() { return { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` } }

const NIGERIA_BANKS = [
  { code: '000001', name: 'Access Bank' }, { code: '000002', name: 'Access Bank (Diamond)' },
  { code: '000003', name: 'Accion Microfinance Bank' }, { code: '000004', name: 'ALAT by WEMA' },
  { code: '000005', name: 'ASO Savings and Loans' }, { code: '000006', name: 'Bowen Microfinance Bank' },
  { code: '000007', name: 'Carbon' }, { code: '000008', name: 'CBN' },
  { code: '000009', name: 'Citibank Nigeria' }, { code: '000010', name: 'Coronation Merchant Bank' },
  { code: '000011', name: 'Ecobank Nigeria' }, { code: '000012', name: 'Ekondo Microfinance Bank' },
  { code: '000013', name: 'Fidelity Bank' }, { code: '000014', name: 'First Bank of Nigeria' },
  { code: '000015', name: 'First City Monument Bank (FCMB)' }, { code: '000016', name: 'FSDH Merchant Bank' },
  { code: '000017', name: 'Globus Bank' }, { code: '000018', name: 'GTBank (GTCO)' },
  { code: '000019', name: 'Heritage Bank' }, { code: '000020', name: 'Jaiz Bank' },
  { code: '000021', name: 'Keystone Bank' }, { code: '000022', name: 'Kuda Bank' },
  { code: '000023', name: 'Lotus Bank' }, { code: '000024', name: 'Mint Finex MFB' },
  { code: '000025', name: 'Moniepoint MFB' }, { code: '000026', name: 'Opay' },
  { code: '000027', name: 'Palmpay' }, { code: '000028', name: 'Parallex Bank' },
  { code: '000029', name: 'Polaris Bank' }, { code: '000030', name: 'PremiumTrust Bank' },
  { code: '000031', name: 'Providus Bank' }, { code: '000032', name: 'Rubies MFB' },
  { code: '000033', name: 'Sparkle Bank' }, { code: '000034', name: 'Stanbic IBTC Bank' },
  { code: '000035', name: 'Standard Chartered Bank' }, { code: '000036', name: 'Sterling Bank' },
  { code: '000037', name: 'SunTrust Bank' }, { code: '000038', name: 'Taj Bank' },
  { code: '000039', name: 'Titan Bank' }, { code: '000040', name: 'Union Bank of Nigeria' },
  { code: '000041', name: 'United Bank for Africa (UBA)' }, { code: '000042', name: 'Unity Bank' },
  { code: '000043', name: 'VFD Microfinance Bank' }, { code: '000044', name: 'Wema Bank' },
  { code: '000045', name: 'Zenith Bank' },
]

const transactions = [
  { date: 'Today', type: 'Deposit', amount: '+NGN 5,000', status: 'Completed', statusColor: 'var(--green)' as const },
  { date: 'Yesterday', type: 'Withdrawal', amount: '-NGN 2,000', status: 'Processing', statusColor: 'var(--gold)' as const },
  { date: '3 days ago', type: 'Task Reward', amount: '+NGN 1,200', status: 'Completed', statusColor: 'var(--green)' as const },
  { date: '5 days ago', type: 'Referral Bonus', amount: '+NGN 300', status: 'Completed', statusColor: 'var(--green)' as const },
  { date: '1 week ago', type: 'Withdrawal', amount: '-NGN 5,000', status: 'Completed', statusColor: 'var(--green)' as const },
]

export default function Wallet() {
  const [activeTab, setActiveTab] = useState('all')
  const [bankAccounts, setBankAccounts] = useState<any[]>([])
  const [showAddBank, setShowAddBank] = useState(false)
  const [addingBank, setAddingBank] = useState(false)
  const [bankForm, setBankForm] = useState({ bankCode: '', accountNumber: '', accountName: '' })
  const [toast, setToast] = useState({ visible: false, message: '' })
  const showToast = (msg: string) => { setToast({ visible: true, message: msg }); setTimeout(() => setToast(t => ({ ...t, visible: false })), 2500) }

  const loadBanks = async () => {
    try {
      const r = await fetch(`${API_BASE}/links/banks`, { headers: authHeaders() })
      const j = await r.json()
      if (j.success) setBankAccounts(j.data || [])
    } catch {}
  }

  const handleAddBank = async () => {
    if (!bankForm.bankCode || !bankForm.accountNumber) return
    setAddingBank(true)
    const bankName = NIGERIA_BANKS.find(b => b.code === bankForm.bankCode)?.name || 'Unknown'
    try {
      const r = await fetch(`${API_BASE}/links/bank/add`, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ ...bankForm, bankName }),
      })
      const j = await r.json()
      if (j.success) {
        setBankAccounts((b: any[]) => [...b, j.data])
        setShowAddBank(false)
        setBankForm({ bankCode: '', accountNumber: '', accountName: '' })
        showToast('Bank account added')
      } else alert(j.message || 'Failed to add bank')
    } catch { alert('Network error') }
    setAddingBank(false)
  }

  const disconnectBank = async (id: string) => {
    try {
      const r = await fetch(`${API_BASE}/links/bank/${id}`, { method: 'DELETE', headers: authHeaders() })
      const j = await r.json()
      if (j.success) {
        setBankAccounts((b: any[]) => b.filter((x: any) => x.id !== id))
        showToast('Bank account removed')
      }
    } catch {}
  }

  useEffect(() => { loadBanks() }, [])

  const filtered = activeTab === 'all' ? transactions : transactions.filter(t => t.type.toLowerCase().includes(activeTab))

  return (
    <Layout>
      <style>{`
        .wl-hero{background:linear-gradient(135deg,rgba(124,58,237,.1),var(--card));border:1px solid var(--border);border-radius:14px;padding:28px 32px;margin-bottom:24px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:16px}
        .wl-hero .wlh-label{color:var(--text2);font-size:13px;font-weight:600;margin-bottom:4px}
        .wl-hero .wlh-bal{font-family:Outfit;font-size:36px;font-weight:900;background:linear-gradient(135deg,#fff,var(--accent));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
        .wl-hero .wlh-sub{color:var(--text2);font-size:14px}
        .wl-actions{display:flex;gap:8px;flex-wrap:wrap}
        .wla-btn{height:40px;padding:0 20px;border-radius:10px;font-weight:700;font-size:13px;display:inline-flex;align-items:center;gap:6px;cursor:pointer;transition:all .2s;text-decoration:none}
        .wla-btn.primary{background:var(--accent);color:#fff;border:0}
        .wla-btn.primary:hover{box-shadow:0 4px 20px rgba(124,58,237,.3)}
        .wla-btn.outline{border:1px solid var(--border);background:transparent;color:var(--text2)}
        .wla-btn.outline:hover{border-color:var(--accent);color:var(--accent)}
        .wl-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:24px}
        @media(max-width:900px){.wl-stats{grid-template-columns:repeat(2,1fr)}}
        .wl-stat{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:18px;transition:all .25s}
        .wl-stat:hover{transform:translateY(-2px);border-color:var(--accent)}
        .wl-stat .wsi{width:36px;height:36px;border-radius:8px;display:grid;place-items:center;margin-bottom:8px}
        .wl-stat .wsn{font-family:Outfit;font-size:24px;font-weight:900}
        .wl-stat .wsl{color:var(--text2);font-size:13px;margin-top:2px}
        .wl-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:24px}
        @media(max-width:600px){.wl-grid{grid-template-columns:1fr}}
        .wl-card{display:flex;flex-direction:column;align-items:center;gap:8px;padding:20px;background:var(--card);border:1px solid var(--border);border-radius:14px;text-align:center;cursor:pointer;transition:all .25s;text-decoration:none}
        .wl-card:hover{transform:translateY(-3px);border-color:var(--accent);box-shadow:0 0 30px rgba(124,58,237,.08)}
        .wl-card i{font-size:28px}
        .wl-card .wlc-label{font-weight:700;font-size:14px;color:var(--text)}
        .wl-card .wlc-desc{color:var(--text2);font-size:12px}
        .wl-tabs{display:flex;gap:4px;margin-bottom:16px;flex-wrap:wrap}
        .wl-tab{padding:8px 16px;border-radius:8px;border:1px solid var(--border);background:transparent;color:var(--text2);font-size:12px;font-weight:600;cursor:pointer;transition:all .2s}
        .wl-tab.active,.wl-tab:hover{border-color:var(--accent);color:var(--accent);background:rgba(124,58,237,.08)}
        .wl-table{width:100%;border-collapse:collapse;font-size:13px}
        .wl-table th{text-align:left;padding:10px 12px;color:var(--text3);font-size:11px;font-weight:600;border-bottom:1px solid var(--border)}
        .wl-table td{padding:12px;border-bottom:1px solid var(--border);color:var(--text2)}
        .wl-table td strong{color:var(--text);font-weight:600}
        .wl-table .amt{font-weight:700}
        .wl-table .amt.plus{color:var(--green)}
        .wl-table .amt.minus{color:var(--red)}
        .sec-title{font-family:Outfit;font-size:18px;font-weight:800;margin:0 0 14px;display:flex;align-items:center;gap:8px}
        .sec-title i{font-size:20px;color:var(--accent)}
        .wl-empty{text-align:center;padding:48px;color:var(--text2);font-size:14px}
      `}</style>

      <div className="wl-hero">
        <div>
          <div className="wlh-label">Wallet Balance</div>
          <div className="wlh-bal">NGN 12,450.00</div>
          <div className="wlh-sub">$8.42 USDC &middot; 0.045 SOL</div>
        </div>
        <div className="wl-actions">
          <a href="#" className="wla-btn primary"><i className="ti ti-plus" /> Deposit</a>
          <a href="#" className="wla-btn outline"><i className="ti ti-logout" /> Withdraw</a>
          <a href="#" className="wla-btn outline"><i className="ti ti-transfer" /> Transfer</a>
        </div>
      </div>

      <div className="wl-stats">
        {[
          { icon: 'ti ti-wallet', color: '#7C3AED', num: 'NGN 12,450', label: 'Balance' },
          { icon: 'ti ti-coin', color: '#16a34a', num: '$8.42 USDC', label: 'Crypto' },
          { icon: 'ti ti-trending-up', color: '#2563EB', num: 'NGN 45,200', label: 'Total Deposits' },
          { icon: 'ti ti-trending-down', color: '#f5b301', num: 'NGN 7,000', label: 'Total Withdrawn' },
        ].map((s, i) => (
          <div className="wl-stat" key={i}>
            <div className="wsi" style={{ background: `${s.color}15`, color: s.color }}><i className={s.icon} /></div>
            <div className="wsn">{s.num}</div>
            <div className="wsl">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="wl-grid">
        {[
          { icon: 'ti ti-plus-circle', color: '#7C3AED', label: 'Deposit', desc: 'Add funds to your wallet' },
          { icon: 'ti ti-logout', color: '#2563EB', label: 'Withdraw', desc: 'Withdraw to bank or crypto' },
          { icon: 'ti ti-transfer', color: '#16a34a', label: 'Transfer', desc: 'Send to another user' },
        ].map((c, i) => (
          <a className="wl-card" href="#" key={i}>
            <i className={c.icon} style={{ color: c.color }} />
            <div className="wlc-label">{c.label}</div>
            <div className="wlc-desc">{c.desc}</div>
          </a>
        ))}
      </div>

      <div className="sec-title"><i className="ti ti-history" /> Transaction History</div>
      <div className="wl-tabs">
        {['all', 'deposit', 'withdrawal', 'reward'].map(t => (
          <button key={t} className={`wl-tab ${activeTab === t ? 'active' : ''}`} onClick={() => setActiveTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="wl-empty"><i className="ti ti-history" style={{ fontSize: 32, marginBottom: 8, display: 'block', color: 'var(--text3)' }} />No transactions found</div>
      ) : (
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
          <table className="wl-table">
            <thead><tr><th>Date</th><th>Type</th><th>Amount</th><th>Status</th></tr></thead>
            <tbody>
              {filtered.map((t, i) => (
                <tr key={i}>
                  <td><strong>{t.date}</strong></td>
                  <td>{t.type}</td>
                  <td className={`amt ${t.amount.startsWith('+') ? 'plus' : 'minus'}`}>{t.amount}</td>
                  <td style={{ color: t.statusColor, fontWeight: 600 }}>{t.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {/* Bank Accounts */}
      <div className="sec-title" style={{ marginTop: 32 }}><i className="ti ti-building-bank" /> Bank Accounts</div>
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: 20, marginBottom: 24 }}>
        <p style={{ fontSize: 13, color: 'var(--text2)', margin: '0 0 16px' }}>Withdraw NGN directly to your bank account</p>
        {bankAccounts.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            {bankAccounts.map((b: any) => (
              <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 14px', border: '1px solid var(--border)', borderRadius: 10 }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{b.bankName}</div>
                  <div style={{ fontSize: 12, color: 'var(--text2)' }}>Account: {b.accountNumber?.slice(-4)}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>Verified {new Date(b.verifiedAt).toLocaleDateString()}</div>
                </div>
                <button onClick={() => disconnectBank(b.id)} style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid #dc2626', color: '#dc2626', background: 'transparent', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                  Remove
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ fontSize: 13, color: 'var(--text3)', textAlign: 'center', padding: 12 }}>No bank accounts linked</p>
        )}
        <button onClick={() => setShowAddBank(true)}
          style={{ width: '100%', padding: '12px 16px', borderRadius: 10, border: '1.5px dashed var(--border)', background: 'transparent', color: '#191C6B', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <i className="ti ti-plus" /> Add Bank Account
        </button>
      </div>

      {/* Add Bank Modal */}
      {showAddBank && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setShowAddBank(false)}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(4px)' }} />
          <div style={{ position: 'relative', width: '100%', maxWidth: 400, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 20, padding: 28 }} onClick={e => e.stopPropagation()}>
            <h2 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 900 }}>Add Bank Account</h2>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Select Bank</label>
              <select value={bankForm.bankCode} onChange={e => setBankForm({ ...bankForm, bankCode: e.target.value })}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg)', fontFamily: 'inherit', fontSize: 14 }}>
                <option value="">Choose a bank...</option>
                {NIGERIA_BANKS.map(b => <option key={b.code} value={b.code}>{b.name}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Account Number</label>
              <input value={bankForm.accountNumber} onChange={e => setBankForm({ ...bankForm, accountNumber: e.target.value })}
                placeholder="0123456789" maxLength={10}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg)', fontFamily: 'inherit', fontSize: 14 }} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Account Name (optional)</label>
              <input value={bankForm.accountName} onChange={e => setBankForm({ ...bankForm, accountName: e.target.value })}
                placeholder="Full name on account"
                style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg)', fontFamily: 'inherit', fontSize: 14 }} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { setShowAddBank(false); setBankForm({ bankCode: '', accountNumber: '', accountName: '' }) }}
                style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', cursor: 'pointer', fontWeight: 700 }}>Cancel</button>
              <button onClick={handleAddBank} disabled={addingBank || !bankForm.bankCode || !bankForm.accountNumber}
                style={{ flex: 1, padding: '10px', borderRadius: 8, background: '#191C6B', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700, opacity: addingBank ? 0.6 : 1 }}>
                {addingBank ? 'Adding...' : 'Add Account'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast.visible && (
        <div style={{ position: 'fixed', bottom: 88, left: '50%', zIndex: 999, transform: 'translateX(-50%)', background: '#16a34a', color: '#fff', padding: '10px 20px', borderRadius: 12, fontSize: 13, fontWeight: 700, boxShadow: '0 8px 24px rgba(0,0,0,.2)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <i className="ti ti-check" /> {toast.message}
        </div>
      )}
    </Layout>
  )
}

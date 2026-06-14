import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import Layout from '../components/Layout'

const earnings = { total: 45200, available: 12450, pending: 3200, month: 8900 }

const graphData: Record<string, number[]> = {
  '7d': [35, 55, 42, 70, 48, 62, 85],
  '30d': [45, 62, 38, 55, 72, 48, 58, 65, 42, 58, 70, 52, 48, 62, 78, 55, 48, 62, 70, 52, 58, 45, 62, 68, 52, 58, 72, 48, 55, 62],
  'all': [30, 40, 35, 50, 45, 55, 60, 48, 52, 58, 42, 55, 48, 62, 58, 52, 65, 58, 62, 68, 55, 60, 58, 62, 65, 58, 62, 68, 72, 78],
}

const activeTasks = [
  { title: 'Social Media Engagement', reward: 500, progress: 60, done: 6, total: 10 },
  { title: 'Content Review', reward: 1200, progress: 20, done: 1, total: 5 },
  { title: 'UI Feedback', reward: 800, progress: 0, done: 0, total: 1 },
]

const pendingTasks = [
  { title: 'Logo Design', reward: 2500, status: 'Awaiting approval', statusColor: 'var(--gold)' as const },
  { title: 'Twitter Thread', reward: 600, status: 'Revision requested', statusColor: 'var(--red)' as const },
  { title: 'Market Research', reward: 1000, status: 'Under review', statusColor: 'var(--text3)' as const },
]

const recommended = [
  { title: 'Video Editing', reward: 3000, time: '2 hours' },
  { title: 'Community Moderation', reward: 1500, time: '1 hour' },
  { title: 'Copywriting', reward: 2000, time: '30 min' },
  { title: 'Beta Testing', reward: 1800, time: '1.5 hours' },
]

const recentActivity = [
  { text: 'Earned ', highlight: 'NGN 500', highlightColor: 'var(--green)' as const, suffix: ' from Social Media Task', time: '2h ago', icon: 'ti ti-coin' },
  { text: 'Completed ', highlight: 'Content Review', highlightColor: 'var(--accent)' as const, suffix: ' task', time: '5h ago', icon: 'ti ti-check' },
  { text: 'Withdrew ', highlight: 'NGN 2,000', highlightColor: 'var(--green)' as const, suffix: ' to bank account', time: '1d ago', icon: 'ti ti-logout' },
  { text: 'Referral bonus ', highlight: 'NGN 300', highlightColor: 'var(--green)' as const, suffix: ' credited', time: '2d ago', icon: 'ti ti-affiliate' },
  { text: 'Task ', highlight: 'UI Feedback', highlightColor: 'var(--accent)' as const, suffix: ' approved', time: '3d ago', icon: 'ti ti-check' },
]

const announcements = [
  { title: 'New Task Categories Added', date: '2 hours ago', desc: 'We\'ve added new task categories including AI training and data labeling.' },
  { title: 'Platform Upgrade', date: '1 day ago', desc: 'We\'ve upgraded our payment system. Withdrawals are now faster.' },
  { title: 'Community Challenge', date: '3 days ago', desc: 'Join the weekly community challenge and earn bonus rewards.' },
]

const communityUpdates = [
  { name: 'Solana Builders', badge: 'Active', desc: 'New tasks available - 5 slots open' },
  { name: 'Design Masters', badge: 'Trending', desc: 'Weekly design challenge live now' },
  { name: 'Crypto Traders', badge: '2,500 members', desc: 'Trading competition starts tomorrow' },
]

const API_BASE = 'https://ogapay-production.up.railway.app/api/v1'

function getToken() {
  return localStorage.getItem('token') || sessionStorage.getItem('token') || ''
}
function authHeaders() {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` }
}

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

export default function Dashboard() {
  const { isAuthed } = useAuth()
  const { login } = useAuth()
  const [graphPeriod, setGraphPeriod] = useState('7d')
  const [showWalletManager, setShowWalletManager] = useState(false)
  const [connectedWallets, setConnectedWallets] = useState<any[]>([])
  const [walletLoading, setWalletLoading] = useState(false)
  const [addingWallet, setAddingWallet] = useState(false)
  const [showAddBank, setShowAddBank] = useState(false)
  const [bankAccounts, setBankAccounts] = useState<any[]>([])
  const [addingBank, setAddingBank] = useState(false)
  const [bankForm, setBankForm] = useState({ bankCode: '', accountNumber: '', accountName: '' })
  const [transactionRef, setTransactionRef] = useState('')
  const [showForm, setShowForm] = useState<string | null>(null)
  const [pairingCode, setPairingCode] = useState('')

  const loadWallets = async () => {
    setWalletLoading(true)
    try {
      const r = await fetch(`${API_BASE}/links/wallets`, { headers: authHeaders() })
      const j = await r.json()
      if (j.success) setConnectedWallets(j.data || [])
    } catch {}
    setWalletLoading(false)
  }

  const loadBanks = async () => {
    try {
      const r = await fetch(`${API_BASE}/links/banks`, { headers: authHeaders() })
      const j = await r.json()
      if (j.success) setBankAccounts(j.data || [])
    } catch {}
  }

  const connectWallet = async (type: string) => {
    setAddingWallet(true)
    try {
      const addr = `${type.toLowerCase()}-${Date.now().toString(36)}`
      const r = await fetch(`${API_BASE}/links/wallet/add`, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ type, address: addr, label: `My ${type} Wallet` }),
      })
      const j = await r.json()
      if (j.success) {
        setConnectedWallets((w: any[]) => [...w, j.data])
        showToastLocal(`${type} wallet connected`)
      } else alert(j.message || 'Failed to connect')
    } catch { alert('Network error') }
    setAddingWallet(false)
  }

  const disconnectWallet = async (id: string) => {
    try {
      const r = await fetch(`${API_BASE}/links/wallet/${id}`, { method: 'DELETE', headers: authHeaders() })
      const j = await r.json()
      if (j.success) {
        setConnectedWallets((w: any[]) => w.filter((x: any) => x.id !== id))
        showToastLocal('Wallet disconnected')
      }
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
        showToastLocal('Bank account added')
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
        showToastLocal('Bank account removed')
      }
    } catch {}
  }

  const handleTransactionSignin = async () => {
    try {
      const r = await fetch(`${API_BASE}/auth/signin-transaction`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionRef }),
      })
      const j = await r.json()
      if (j.success && j.tokens) {
        localStorage.setItem('token', j.tokens.accessToken)
        login()
      } else alert(j.message || 'Invalid transaction reference')
    } catch { alert('Network error') }
  }

  const handlePairDevice = async () => {
    try {
      const r = await fetch(`${API_BASE}/auth/pair-device`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: pairingCode.replace(/[^0-9]/g, '') }),
      })
      const j = await r.json()
      if (j.success && j.tokens) {
        localStorage.setItem('token', j.tokens.accessToken)
        login()
      } else alert(j.message || 'Invalid pairing code')
    } catch { alert('Network error') }
  }

  const [toastLocal, setToastLocal] = useState({ visible: false, message: '' })
  const showToastLocal = (message: string) => {
    setToastLocal({ visible: true, message })
    setTimeout(() => setToastLocal(t => ({ ...t, visible: false })), 2500)
  }

  if (!isAuthed) {
    return (
      <Layout sidebar={false}>
        <div className="loading"><div className="spinner" /> Sign in to view your dashboard</div>
      </Layout>
    )
  }

  const bars = graphData[graphPeriod] || graphData['7d']

  return (
    <Layout sidebar={false}>
      <style>{`
        .dash-welcome{background:linear-gradient(135deg,rgba(124,58,237,.08),var(--card));border:1px solid var(--border);border-radius:14px;padding:28px 32px;margin-bottom:24px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:16px}
        .dash-welcome .dwg{font-family:Outfit;font-size:22px;font-weight:800;margin:0 0 4px}
        .dash-welcome .dwb{font-family:Outfit;font-size:36px;font-weight:900;margin:0 0 2px;background:linear-gradient(135deg,#fff,var(--accent));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
        .dash-welcome .dw-actions{display:flex;gap:8px;flex-wrap:wrap}
        .dw-btn{height:40px;padding:0 20px;border-radius:10px;font-weight:700;font-size:13px;display:inline-flex;align-items:center;gap:6px;cursor:pointer;transition:all .2s;text-decoration:none}
        .dw-btn.primary{background:var(--accent);color:#fff;border:0}
        .dw-btn.primary:hover{box-shadow:0 4px 20px rgba(124,58,237,.3)}
        .dw-btn.outline{border:1px solid var(--border);background:transparent;color:var(--text2)}
        .dw-btn.outline:hover{border-color:var(--accent);color:var(--accent)}
        .dash-stat{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:18px;transition:all .25s}
        .dash-stat:hover{transform:translateY(-2px);border-color:var(--accent)}
        .dash-stat .ds-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}
        .dash-stat .ds-head .dsi{width:36px;height:36px;border-radius:8px;display:grid;place-items:center}
        .dash-stat .ds-head .ds-ch{font-size:12px;font-weight:700;padding:2px 8px;border-radius:999px}
        .dash-stat .ds-head .ds-ch.up{background:rgba(22,163,74,.1);color:var(--green)}
        .dash-stat .ds-head .ds-ch.down{background:rgba(220,38,38,.1);color:var(--red)}
        .dash-stat .ds-num{font-family:Outfit;font-size:26px;font-weight:900}
        .dash-stat .ds-lbl{color:var(--text2);font-size:13px;margin-top:2px}
        .dash-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:24px}
        @media(max-width:900px){.dash-stats{grid-template-columns:repeat(2,1fr)}}
        @media(max-width:500px){.dash-stats{grid-template-columns:1fr}}
        .dash-wallet{display:grid;grid-template-columns:2fr 1fr;gap:14px;margin-bottom:24px}
        @media(max-width:700px){.dash-wallet{grid-template-columns:1fr}}
        .wallet-main{background:linear-gradient(135deg,rgba(124,58,237,.08),var(--card));border:1px solid var(--border);border-radius:14px;padding:22px;position:relative;overflow:hidden}
        .wallet-main .wml{color:var(--text2);font-size:13px;font-weight:600;margin-bottom:4px}
        .wallet-main .wmb{font-family:Outfit;font-size:32px;font-weight:900;margin-bottom:2px}
        .wallet-main .wmu{color:var(--text2);font-size:14px;margin-bottom:16px}
        .wallet-main .wma{display:flex;gap:8px}
        .wallet-main .wma a{height:38px;padding:0 18px;border-radius:9px;font-size:13px;font-weight:700;display:inline-flex;align-items:center;gap:6px;cursor:pointer;transition:all .2s;text-decoration:none}
        .wallet-main .wma .wma-p{background:var(--accent);color:#fff;border:0}
        .wallet-main .wma .wma-o{border:1px solid var(--border);background:transparent;color:var(--text2)}
        .wallet-main .wma .wma-o:hover{border-color:var(--accent);color:var(--accent)}
        .wallet-grid{display:grid;background:var(--card);border:1px solid var(--border);border-radius:14px;padding:16px;grid-template-columns:1fr 1fr 1fr;gap:4px}
        .wg-item{text-align:center;padding:10px 4px;border-radius:8px;cursor:pointer;transition:all .2s;text-decoration:none;color:inherit}
        .wg-item:hover{background:var(--bg2)}
        .wg-item i{font-size:22px;color:var(--accent);margin-bottom:4px;display:block}
        .wg-item .wgl{font-size:12px;font-weight:600;color:var(--text2)}
        .dash-graph{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:22px;margin-bottom:24px}
        .dash-graph .dg-h{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:8px}
        .gtabs{display:flex;gap:4px}
        .gtab{padding:6px 14px;border-radius:6px;border:1px solid var(--border);background:transparent;color:var(--text2);font-size:12px;font-weight:600;cursor:pointer;transition:all .2s}
        .gtab.active,.gtab:hover{border-color:var(--accent);color:var(--accent);background:rgba(124,58,237,.08)}
        .gv{height:160px;display:flex;align-items:flex-end;gap:4px;padding:0 4px}
        .gv .gv-bar{flex:1;border-radius:4px 4px 0 0;background:rgba(124,58,237,.15);position:relative;transition:all .3s;min-height:4px}
        .gv .gv-bar:hover{background:var(--accent);opacity:.8}
        .gv .gv-bar .gv-t{position:absolute;top:-22px;left:50%;transform:translateX(-50%);font-size:9px;font-weight:700;color:var(--text2);white-space:nowrap;display:none}
        .gv .gv-bar:hover .gv-t{display:block}
        .dash-tasks{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px;margin-bottom:24px}
        .dtask{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:18px;transition:all .25s}
        .dtask:hover{transform:translateY(-2px);border-color:rgba(124,58,237,.2)}
        .dtask .dt-h{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px}
        .dtask .dt-t{font-weight:700;font-size:15px}
        .dtask .dt-r{color:var(--green);font-weight:700;font-size:14px}
        .dtask .dt-desc{color:var(--text2);font-size:13px;margin-bottom:10px;line-height:1.4}
        .dtask .dt-p{height:4px;border-radius:999px;background:var(--bg2);margin-bottom:8px;overflow:hidden}
        .dtask .dt-p .dt-pf{height:100%;border-radius:999px;background:var(--accent);transition:width .5s}
        .dtask .dt-s{font-size:11px;font-weight:600;color:var(--text3);margin-bottom:8px}
        .dtask .dt-start{height:34px;padding:0 16px;border-radius:8px;border:1px solid var(--accent);background:transparent;color:var(--accent);font-size:12px;font-weight:700;cursor:pointer;transition:all .2s}
        .dtask .dt-start:hover{background:var(--accent);color:#fff}
        .dash-rec{display:flex;gap:14px;overflow-x:auto;padding:4px 0 12px;margin-bottom:24px;scroll-snap-type:x mandatory}
        .dash-rec::-webkit-scrollbar{height:4px}
        .dash-rec::-webkit-scrollbar-thumb{background:var(--border2);border-radius:999px}
        .dash-rec .dtask{min-width:250px;scroll-snap-align:start;flex-shrink:0}
        .dash-act{display:grid;gap:8px;margin-bottom:24px}
        .dact{display:flex;align-items:center;gap:12px;padding:12px 16px;background:var(--card);border:1px solid var(--border);border-radius:10px;transition:all .2s}
        .dact:hover{border-color:var(--accent)}
        .dact .dai{width:34px;height:34px;border-radius:8px;display:grid;place-items:center;flex-shrink:0}
        .dact .dai.green{background:rgba(22,163,74,.1);color:var(--green)}
        .dact .dai.purple{background:rgba(124,58,237,.1);color:var(--accent)}
        .dact .dai.gold{background:rgba(245,179,1,.1);color:var(--gold)}
        .dact .dat{flex:1;font-size:13px}
        .dact .dat strong{font-weight:600}
        .dact .dat .da-amt{color:var(--green);font-weight:700}
        .dact .dati{color:var(--text3);font-size:11px}
        .dash-2col{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:24px}
        @media(max-width:700px){.dash-2col{grid-template-columns:1fr}}
        .dash-card{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:18px}
        .dash-card .dc-item{padding:12px 0;border-bottom:1px solid var(--border)}
        .dash-card .dc-item:last-child{border-bottom:0;padding-bottom:0}
        .dash-card .dc-item .dc-t{font-weight:600;font-size:14px;margin-bottom:2px}
        .dash-card .dc-item .dc-d{color:var(--text3);font-size:11px}
        .dash-card .dc-item .dc-desc{color:var(--text2);font-size:12px;margin-top:4px;line-height:1.4}
        .dash-card .dc-item .dc-badge{font-size:10px;font-weight:700;padding:2px 8px;border-radius:999px;background:rgba(124,58,237,.1);color:var(--accent);width:fit-content;margin-top:2px}
        .sec-title{font-family:Outfit;font-size:18px;font-weight:800;margin:0 0 14px;display:flex;align-items:center;gap:8px}
        .sec-title i{font-size:20px;color:var(--accent)}
      `}</style>

      {/* Welcome Banner */}
      <div className="dash-welcome">
        <div>
          <div className="dwg">Welcome back!</div>
          <div className="dwb">NGN {earnings.available.toLocaleString()}.00</div>
          <div style={{ color: 'var(--text2)', fontSize: 14 }}>Available Balance</div>
        </div>
        <div className="dw-actions">
          <a href="/app/tasks" className="dw-btn primary"><i className="ti ti-layout-grid" /> Browse Tasks</a>
          <a href="/app/wallet" className="dw-btn outline"><i className="ti ti-logout" /> Withdraw</a>
        </div>
      </div>

      {/* Earnings Summary */}
      <div className="sec-title"><i className="ti ti-coin" /> Earnings Summary</div>
      <div className="dash-stats">
        <Stat icon="ti ti-coin" change="+12%" up num={earnings.total} label="Total Earned" />
        <Stat icon="ti ti-wallet" change="+5%" up num={earnings.available} label="Available Balance" />
        <Stat icon="ti ti-clock" change="-2%" up={false} num={earnings.pending} label="Pending Earnings" />
        <Stat icon="ti ti-trending-up" change="+18%" up num={earnings.month} label="This Month" />
      </div>

      {/* Wallet Overview */}
      <div className="sec-title"><i className="ti ti-wallet" /> Wallet Overview</div>
      <div className="dash-wallet">
        <div className="wallet-main">
          <div className="wml">Wallet Balance</div>
          <div className="wmb">NGN {earnings.available.toLocaleString()}.00</div>
          <div className="wmu">$8.42 USDC</div>
          <div className="wma">
            <a href="#" className="wma-p"><i className="ti ti-plus" /> Deposit</a>
            <a href="/app/wallet" className="wma-o"><i className="ti ti-logout" /> Withdraw</a>
            <button onClick={() => { loadWallets(); setShowWalletManager(true) }} className="wma-o" style={{ height: 38, padding: '0 12px', borderRadius: 9, fontSize: 13, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text2)', fontFamily: 'inherit' }}>
              <i className="ti ti-wallet" /> Wallets
            </button>
          </div>
        </div>
        <div className="wallet-grid">
          <a href="/app/earnings" className="wg-item"><i className="ti ti-coin" /><div className="wgl">Earnings</div></a>
          <a href="/app/wallet" className="wg-item"><i className="ti ti-wallet" /><div className="wgl">Wallet</div></a>
          <a href="/app/referrals" className="wg-item"><i className="ti ti-affiliate" /><div className="wgl">Referrals</div></a>
          <a href="/app/vault" className="wg-item"><i className="ti ti-vault" /><div className="wgl">Vault</div></a>
          <a href="/app/my-store" className="wg-item"><i className="ti ti-building-store" /><div className="wgl">My Store</div></a>
          <a href="/app/worker-portal" className="wg-item"><i className="ti ti-briefcase" /><div className="wgl">Worker</div></a>
        </div>
      </div>

      {/* Earnings Graph */}
      <div className="sec-title"><i className="ti ti-trending-up" /> Earnings Overview</div>
      <div className="dash-graph">
        <div className="dg-h">
          <span style={{ fontWeight: 700, fontSize: 15 }}>Earnings</span>
          <div className="gtabs">
            {['7d', '30d', 'all'].map(p => (
              <button key={p} className={`gtab ${graphPeriod === p ? 'active' : ''}`} onClick={() => setGraphPeriod(p)}>
                {p === '7d' ? '7 Days' : p === '30d' ? '30 Days' : 'All Time'}
              </button>
            ))}
          </div>
        </div>
        <div className="gv">
          {bars.map((b, i) => (
            <div key={i} className="gv-bar" style={{ height: Math.min(b * 1.1, 90) + '%' }}>
              <div className="gv-t">NGN {b * 10}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Active Tasks */}
      <div className="sec-title"><i className="ti ti-player-play" /> Active Tasks</div>
      <div className="dash-tasks">
        {activeTasks.map((t, i) => (
          <div className="dtask" key={i}>
            <div className="dt-h"><span className="dt-t">{t.title}</span><span className="dt-r">NGN {t.reward.toLocaleString()}</span></div>
            <div className="dt-desc">Complete tasks and earn rewards</div>
            <div className="dt-p"><div className="dt-pf" style={{ width: t.progress + '%' }}></div></div>
            <div className="dt-s">{t.done}/{t.total} completed</div>
            <button className="dt-start">{t.progress === 0 ? 'Start' : 'Continue'}</button>
          </div>
        ))}
      </div>

      {/* Pending Tasks */}
      <div className="sec-title"><i className="ti ti-clock" /> Pending Tasks</div>
      <div className="dash-tasks">
        {pendingTasks.map((t, i) => (
          <div className="dtask" key={i}>
            <div className="dt-h"><span className="dt-t">{t.title}</span><span className="dt-r">NGN {t.reward.toLocaleString()}</span></div>
            <div className="dt-desc" style={{ color: t.statusColor }}>{t.status}</div>
            <button className="dt-start" style={{ borderColor: t.statusColor, color: t.statusColor }}>View</button>
          </div>
        ))}
      </div>

      {/* Recommended Tasks */}
      <div className="sec-title"><i className="ti ti-star" /> Recommended Tasks</div>
      <div className="dash-rec">
        {recommended.map((t, i) => (
          <div className="dtask" key={i}>
            <div className="dt-h"><span className="dt-t">{t.title}</span><span className="dt-r">NGN {t.reward.toLocaleString()}</span></div>
            <div className="dt-desc">Est. {t.time}</div>
            <button className="dt-start">Start Task</button>
          </div>
        ))}
      </div>

      {/* Recent Activity */}
      <div className="sec-title"><i className="ti ti-activity" /> Recent Activity</div>
      <div className="dash-act">
        {recentActivity.map((a, i) => (
          <div className="dact" key={i}>
            <div className={`dai ${a.icon === 'ti ti-coin' || a.icon === 'ti ti-logout' || a.icon === 'ti ti-affiliate' ? 'green' : a.icon === 'ti ti-check' ? 'purple' : 'gold'}`}>
              <i className={a.icon} />
            </div>
            <div className="dat">{a.text}<span className="da-amt">{a.highlight}</span>{a.suffix}</div>
            <span className="dati">{a.time}</span>
          </div>
        ))}
      </div>

      {/* Wallet Manager Modal */}
      {showWalletManager && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setShowWalletManager(false)}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(4px)' }} />
          <div style={{ position: 'relative', width: '100%', maxWidth: 480, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 20, padding: 28, maxHeight: '90vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900 }}>Connected Wallets</h2>
              <button onClick={() => setShowWalletManager(false)} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg2)', cursor: 'pointer', fontSize: 16, display: 'grid', placeItems: 'center' }}>
                <i className="ti ti-x" />
              </button>
            </div>
            {walletLoading ? (
              <p style={{ textAlign: 'center', padding: 20, color: 'var(--text3)' }}><span className="spinner" style={{ width: 14, height: 14, display: 'inline-block', marginRight: 6 }} /> Loading...</p>
            ) : connectedWallets.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                {connectedWallets.map((w: any) => (
                  <div key={w.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', border: '1px solid var(--border)', borderRadius: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <i className="ti ti-wallet" style={{ fontSize: 24, color: '#191C6B' }} />
                      <div>
                        <div style={{ fontWeight: 700 }}>{w.type} Wallet</div>
                        <div style={{ fontSize: 12, color: 'var(--text2)', fontFamily: 'monospace' }}>
                          {w.address?.slice(0, 8)}...{w.address?.slice(-6)}
                        </div>
                      </div>
                    </div>
                    <button onClick={() => disconnectWallet(w.id)} style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid #dc2626', color: '#dc2626', background: 'transparent', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                      Disconnect
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ textAlign: 'center', padding: 20, color: 'var(--text3)' }}>No wallets connected yet</p>
            )}
            <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 800 }}>Add Another Wallet</h3>
            <div style={{ display: 'flex', gap: 8 }}>
              {['Phantom', 'Backpack', 'Solflare'].map(w => (
                <button key={w} onClick={() => connectWallet(w)} disabled={addingWallet}
                  style={{ flex: 1, padding: '12px 8px', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--bg)', cursor: 'pointer', fontWeight: 700, fontSize: 12, transition: 'all .2s', opacity: addingWallet ? 0.6 : 1 }}>
                  <i className="ti ti-wallet" style={{ fontSize: 18, marginRight: 6 }} /> {w}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Bank Accounts Section */}
      <div className="sec-title" style={{ marginTop: 16 }}><i className="ti ti-building-bank" /> Bank Accounts</div>
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
        <button onClick={() => { loadBanks(); setShowAddBank(true) }}
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
      {toastLocal.visible && (
        <div style={{ position: 'fixed', bottom: 88, left: '50%', zIndex: 999, transform: 'translateX(-50%)', background: '#16a34a', color: '#fff', padding: '10px 20px', borderRadius: 12, fontSize: 13, fontWeight: 700, boxShadow: '0 8px 24px rgba(0,0,0,.2)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <i className="ti ti-check" /> {toastLocal.message}
        </div>
      )}

      {/* Announcements + Community Updates */}
      <div className="dash-2col">
        <div>
          <div className="sec-title"><i className="ti ti-bullhorn" /> Announcements</div>
          <div className="dash-card">
            {announcements.map((a, i) => (
              <div className="dc-item" key={i}>
                <div className="dc-t">{a.title}</div>
                <div className="dc-d">{a.date}</div>
                <div className="dc-desc">{a.desc}</div>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="sec-title"><i className="ti ti-users" /> Community Updates</div>
          <div className="dash-card">
            {communityUpdates.map((c, i) => (
              <div className="dc-item" key={i}>
                <div className="dc-t">{c.name}</div>
                <div className="dc-badge">{c.badge}</div>
                <div className="dc-desc">{c.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  )
}

function Stat({ icon, change, up = true, num, label }: { icon: string; change: string; up?: boolean; num: number; label: string }) {
  return (
    <div className="dash-stat">
      <div className="ds-head">
        <div className="dsi" style={{ background: 'rgba(124,58,237,.08)', color: 'var(--accent)' }}><i className={icon} /></div>
        <span className={`ds-ch ${up ? 'up' : 'down'}`}>{change}</span>
      </div>
      <div className="ds-num">NGN {num.toLocaleString()}</div>
      <div className="ds-lbl">{label}</div>
    </div>
  )
}

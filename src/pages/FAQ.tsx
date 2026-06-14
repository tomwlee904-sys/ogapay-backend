import { useState } from 'react'
import Layout from '../components/Layout'

const categories = [
  { id: 'earnings', icon: 'ti ti-wallet', label: 'Earnings & Rewards', count: 4 },
  { id: 'tasks', icon: 'ti ti-clipboard-check', label: 'Tasks & Submissions', count: 3 },
  { id: 'referrals', icon: 'ti ti-affiliate', label: 'Referrals', count: 2 },
  { id: 'account', icon: 'ti ti-shield-check', label: 'Account & Security', count: 3 },
  { id: 'withdrawals', icon: 'ti ti-credit-card', label: 'Withdrawals', count: 2 },
  { id: 'communities', icon: 'ti ti-users', label: 'Communities', count: 2 },
]

const faqData: Record<string, { q: string; a: string }[]> = {
  earnings: [
    { q: 'How do I earn on OgaPay?', a: 'You can earn by completing tasks, participating in community activities, referring new users, and selling products in the marketplace.' },
    { q: 'When do I receive rewards?', a: 'Rewards are credited to your wallet after a task is approved by the creator. This typically happens within 24 hours of submission.' },
    { q: 'How are earnings calculated?', a: 'Earnings depend on the task reward, your performance rating, and any bonus multipliers from your tier level.' },
    { q: 'Can I track my earnings?', a: 'Yes! Your dashboard shows real-time earnings, including total earned, available balance, pending payments, and monthly statistics.' },
  ],
  tasks: [
    { q: 'How do I complete a task?', a: 'Browse available tasks, read the instructions carefully, complete the required actions, and submit proof through the submission form.' },
    { q: 'What happens after I submit?', a: 'Your submission enters a review queue. The task creator reviews it and can approve, request revisions, or reject it.' },
    { q: 'Can I withdraw my task submission?', a: 'Once submitted, you cannot withdraw. Ensure you meet all requirements before submitting.' },
  ],
  referrals: [
    { q: 'How do referrals work?', a: 'Share your unique referral link. When someone signs up and completes their first task, you earn a bonus.' },
    { q: 'How much can I earn from referrals?', a: 'You earn 10% of the rewards earned by your referred users in their first 30 days on the platform.' },
  ],
  account: [
    { q: 'How do I verify my account?', a: 'Go to Settings > Security and complete the KYC verification process. You will need a valid government ID.' },
    { q: 'Can I change my username?', a: 'Usernames can be changed once every 30 days from your profile settings page.' },
    { q: 'How do I reset my password?', a: 'Click "Forgot Password" on the login page and follow the instructions sent to your email.' },
  ],
  withdrawals: [
    { q: 'How do withdrawals work?', a: 'Navigate to your Wallet, click Withdraw, enter the amount and your preferred payment method (bank transfer or crypto).' },
    { q: 'How long do withdrawals take?', a: 'Bank transfers take 1-3 business days. Crypto withdrawals are processed within a few hours.' },
  ],
  communities: [
    { q: 'How do I join a community?', a: 'Browse communities on the Communities page, click Join, and wait for approval from the community admin.' },
    { q: 'Can I create my own community?', a: 'Yes! Any verified user can create a community. Go to Communities and click "Create Community".' },
  ],
}

const popularQuestions = [
  'How do I complete a task?',
  'When do I receive rewards?',
  'How do referrals work?',
  'How do withdrawals work?',
  'How do I verify my account?',
]

export default function FAQ() {
  const [search, setSearch] = useState('')
  const [activeCat, setActiveCat] = useState('earnings')
  const [openQ, setOpenQ] = useState<number | null>(null)

  const currentFAQs = faqData[activeCat] || []
  const filtered = currentFAQs.filter(f =>
    f.q.toLowerCase().includes(search.toLowerCase()) ||
    f.a.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <Layout>
      <style>{`
        .faq-hero{text-align:center;padding:32px 20px 24px;margin-bottom:24px;background:linear-gradient(135deg,rgba(124,58,237,.05),var(--card));border-radius:16px;border:1px solid var(--border)}
        .faq-hero h1{font-family:Outfit;font-size:32px;font-weight:900;margin:0 0 8px}
        .faq-hero p{color:var(--text2);font-size:14px;margin:0 0 20px;max-width:480px;margin-left:auto;margin-right:auto}
        .faq-search{max-width:480px;margin:0 auto;display:flex;align-items:center;gap:8px;height:44px;padding:0 16px;border:1px solid var(--border);border-radius:12px;background:var(--card);transition:border-color .2s}
        .faq-search:focus-within{border-color:var(--accent)}
        .faq-search input{flex:1;border:0;background:transparent;outline:0;color:var(--text);font-size:14px}
        .faq-search input::placeholder{color:var(--text3)}
        .faq-search i{color:var(--text3);font-size:18px}
        .faq-cats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:24px}
        @media(max-width:600px){.faq-cats{grid-template-columns:repeat(2,1fr)}}
        .faq-cat{padding:16px 14px;border:1px solid var(--border);border-radius:12px;background:var(--card);cursor:pointer;transition:all .2s;text-align:center}
        .faq-cat:hover,.faq-cat.active{border-color:var(--accent);background:rgba(124,58,237,.04)}
        .faq-cat i{font-size:24px;color:var(--accent);margin-bottom:6px;display:block}
        .faq-cat .fc-label{font-weight:700;font-size:12px;margin-bottom:2px}
        .faq-cat .fc-count{font-size:11px;color:var(--text3)}
        .faq-popular{margin-bottom:24px}
        .faq-pop-title{font-family:Outfit;font-size:15px;font-weight:800;margin-bottom:10px}
        .faq-pop-tags{display:flex;gap:6px;flex-wrap:wrap}
        .faq-pop-tag{padding:6px 12px;border-radius:8px;border:1px solid var(--border);font-size:12px;color:var(--text2);cursor:pointer;transition:all .2s;background:var(--card)}
        .faq-pop-tag:hover{border-color:var(--accent);color:var(--accent)}
        .faq-list{display:grid;gap:6px;margin-bottom:24px}
        .faq-item{border:1px solid var(--border);border-radius:12px;background:var(--card);overflow:hidden;transition:all .2s}
        .faq-item:hover{border-color:var(--border2)}
        .faq-q{display:flex;align-items:center;gap:12px;padding:14px 16px;cursor:pointer;border:0;background:transparent;color:var(--text);font-size:13px;font-weight:700;text-align:left;width:100%;transition:all .2s}
        .faq-q:hover{color:var(--accent)}
        .faq-q i{font-size:18px;color:var(--accent);flex-shrink:0}
        .faq-q .faq-chevron{margin-left:auto;color:var(--text3);transition:transform .2s;font-size:16px}
        .faq-item.open .faq-chevron{transform:rotate(180deg)}
        .faq-a{padding:0 16px 14px 46px;font-size:13px;color:var(--text2);line-height:1.6;display:none}
        .faq-item.open .faq-a{display:block}
        .faq-empty{text-align:center;padding:32px;color:var(--text2)}
        .faq-empty i{font-size:32px;color:var(--text3);margin-bottom:8px;display:block}
      `}</style>

      <div className="faq-hero">
        <h1>Help Center</h1>
        <p>Everything you need to know about tasks, earnings, referrals, communities, and more</p>
        <div className="faq-search">
          <i className="ti ti-search" />
          <input type="text" placeholder="Search for answers..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {/* Popular questions */}
      <div className="faq-popular">
        <div className="faq-pop-title"><i className="ti ti-star" style={{color:'var(--accent)',marginRight:6}} /> Popular Questions</div>
        <div className="faq-pop-tags">
          {popularQuestions.map((q, i) => (
            <button key={i} className="faq-pop-tag" onClick={() => setSearch(q)}>{q}</button>
          ))}
        </div>
      </div>

      {/* Categories */}
      <div className="faq-cats">
        {categories.map(c => (
          <div key={c.id} className={`faq-cat ${activeCat === c.id ? 'active' : ''}`} onClick={() => { setActiveCat(c.id); setSearch('') }}>
            <i className={c.icon} />
            <div className="fc-label">{c.label}</div>
            <div className="fc-count">{c.count} articles</div>
          </div>
        ))}
      </div>

      {/* FAQ items */}
      {filtered.length === 0 ? (
        <div className="faq-empty">
          <i className="ti ti-search-off" />
          <div style={{fontWeight:700,marginBottom:4}}>No articles found</div>
          <div style={{fontSize:13}}>Try another keyword</div>
        </div>
      ) : (
        <div className="faq-list">
          {filtered.map((f, i) => (
            <div key={i} className={`faq-item ${openQ === i ? 'open' : ''}`}>
              <button className="faq-q" onClick={() => setOpenQ(openQ === i ? null : i)}>
                <i className="ti ti-help-circle" />
                {f.q}
                <i className="ti ti-chevron-down faq-chevron" />
              </button>
              <div className="faq-a">{f.a}</div>
            </div>
          ))}
        </div>
      )}
    </Layout>
  )
}

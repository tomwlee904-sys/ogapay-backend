import { useAuth } from '../context/AuthContext'

export default function Sidebar() {
  const { isAuthed } = useAuth()
  if (!isAuthed) return null

  return (
    <aside className="sidebar">
      <div className="sidebar-nav">
        <div className="sidebar-section">Main</div>
        <a className="sidebar-link" href="/app"><i className="ti ti-dashboard" /> Dashboard</a>
        <a className="sidebar-link" href="/app/tasks"><i className="ti ti-checklist" /> Tasks</a>
        <a className="sidebar-link" href="/app/store"><i className="ti ti-building-store" /> Store</a>
        <a className="sidebar-link" href="/app/worker-portal"><i className="ti ti-briefcase" /> Worker Portal</a>
        <a className="sidebar-link" href="/app/communities"><i className="ti ti-users" /> Communities</a>
        <a className="sidebar-link" href="/app/earnings"><i className="ti ti-coin" /> Earnings</a>
        <a className="sidebar-link" href="/app/leaderboard"><i className="ti ti-trophy" /> Leaderboard</a>
        <a className="sidebar-link" href="/app/campaigns"><i className="ti ti-megaphone" /> Campaigns</a>

        <div className="sidebar-section">Finance</div>
        <a className="sidebar-link" href="/app/wallet"><i className="ti ti-wallet" /> Wallet</a>
        <a className="sidebar-link" href="/app/referrals"><i className="ti ti-affiliate" /> Referrals</a>
        <a className="sidebar-link" href="/app/vault"><i className="ti ti-vault" /> Vault</a>

        <div className="sidebar-section">Account</div>
        <a className="sidebar-link" href="/app/profile"><i className="ti ti-user" /> Profile</a>
        <a className="sidebar-link" href="/app/notifications"><i className="ti ti-bell" /> Notifications</a>
        <a className="sidebar-link" href="/app/messages"><i className="ti ti-message" /> Messages</a>
        <a className="sidebar-link" href="/app/settings"><i className="ti ti-settings" /> Settings</a>
        <a className="sidebar-link" href="/app/faq"><i className="ti ti-help-circle" /> FAQ</a>
        <a className="sidebar-link" href="/app/support"><i className="ti ti-headset" /> Support</a>
      </div>
    </aside>
  )
}

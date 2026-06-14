import { useAuth } from '../context/AuthContext'

interface DrawerProps {
  open: boolean
  onClose: () => void
}

export default function Drawer({ open, onClose }: DrawerProps) {
  const { isAuthed, logout } = useAuth()

  return (
    <div className={`mobile-menu ${open ? 'open' : ''}`} id="mobileMenu">
      <div className="mobile-overlay" onClick={onClose} />
      <div className="oga-drawer">
        <div className="oga-drawer-head">
          <span style={{ fontFamily: 'Outfit', fontWeight: 900, fontSize: 17 }}>Menu</span>
          <button className="oga-drawer-close" data-close-menu onClick={onClose}>
            <i className="ti ti-x" />
          </button>
        </div>

        {/* Public nav */}
        <nav className="oga-drawer-nav public-only">
          <a className="oga-drawer-item" href="/app/tasks" onClick={onClose}>
            <span className="oga-drawer-icon"><i className="ti ti-checklist" /></span>
            <span><strong>Tasks</strong><small>Browse available tasks</small></span>
          </a>
          <a className="oga-drawer-item" href="/app/store" onClick={onClose}>
            <span className="oga-drawer-icon"><i className="ti ti-building-store" /></span>
            <span><strong>Store</strong><small>Browse products &amp; gigs</small></span>
          </a>
          <a className="oga-drawer-item" href="/blog" onClick={onClose}>
            <span className="oga-drawer-icon"><i className="ti ti-article" /></span>
            <span><strong>Blog</strong><small>Latest insights</small></span>
          </a>
          <a className="oga-drawer-item" href="/vault" onClick={onClose}>
            <span className="oga-drawer-icon"><i className="ti ti-vault" /></span>
            <span><strong>Vault</strong><small>Secure storage</small></span>
          </a>
          <a className="oga-drawer-item" href="/faq" onClick={onClose}>
            <span className="oga-drawer-icon"><i className="ti ti-help-circle" /></span>
            <span><strong>FAQ</strong><small>Frequently asked questions</small></span>
          </a>
          <a className="oga-drawer-item" href="/support" onClick={onClose}>
            <span className="oga-drawer-icon"><i className="ti ti-headset" /></span>
            <span><strong>Support</strong><small>Get help</small></span>
          </a>
          <div style={{ padding: '12px 10px', marginTop: 8 }}>
            <a className="wallet-btn" href="/login" style={{ width: '100%', justifyContent: 'center' }} onClick={onClose}>
              <i className="ti ti-login" /> Login
            </a>
          </div>
        </nav>

        {/* Authed nav */}
        <nav className="oga-drawer-nav authed-only">
          <a className="oga-drawer-item" href="/app" onClick={onClose}>
            <span className="oga-drawer-icon"><i className="ti ti-dashboard" /></span>
            <span><strong>Dashboard</strong><small>Your overview</small></span>
          </a>

          {/* Create Job */}
          <a className="oga-drawer-item" href="/app/tasks/new" onClick={onClose}>
            <span className="oga-drawer-icon"><i className="ti ti-plus-circle" /></span>
            <span><strong>Create Job</strong><small>Post a new task</small></span>
          </a>

          {/* Jobs accordion */}
          <DrawerGroup icon="ti ti-briefcase" label="Jobs" desc="Manage your tasks">
            <DrawerSub href="/app/tasks" label="Browse Tasks" onClick={onClose} />
            <DrawerSub href="/app/my-tasks" label="My Tasks" onClick={onClose} />
            <DrawerSub href="/app/task-history" label="Task History" onClick={onClose} />
          </DrawerGroup>

          {/* Store accordion */}
          <DrawerGroup icon="ti ti-building-store" label="Store" desc="Marketplace">
            <DrawerSub href="/app/store" label="Wurker Store" onClick={onClose} />
            <DrawerSub href="/app/my-store" label="My Store" onClick={onClose} />
            <DrawerSub href="/app/worker-portal" label="Wurker Portal" onClick={onClose} />
            <DrawerSub href="/app/messages" label="Messages" onClick={onClose} />
          </DrawerGroup>

          <a className="oga-drawer-item" href="/app/communities" onClick={onClose}>
            <span className="oga-drawer-icon"><i className="ti ti-users" /></span>
            <span><strong>Communities</strong><small>Connect with others</small></span>
          </a>
          <a className="oga-drawer-item" href="/blog" onClick={onClose}>
            <span className="oga-drawer-icon"><i className="ti ti-article" /></span>
            <span><strong>Blog</strong><small>Latest insights</small></span>
          </a>
          <a className="oga-drawer-item" href="/app/vault" onClick={onClose}>
            <span className="oga-drawer-icon"><i className="ti ti-vault" /></span>
            <span><strong>Vault</strong><small>Secure documents</small></span>
          </a>
          <a className="oga-drawer-item" href="/app/notifications" onClick={onClose}>
            <span className="oga-drawer-icon"><i className="ti ti-bell" /></span>
            <span><strong>Notifications</strong><small>Alerts &amp; updates</small></span>
          </a>
          <a className="oga-drawer-item" href="/faq" onClick={onClose}>
            <span className="oga-drawer-icon"><i className="ti ti-help-circle" /></span>
            <span><strong>FAQ</strong><small>Frequently asked questions</small></span>
          </a>
          <a className="oga-drawer-item" href="/support" onClick={onClose}>
            <span className="oga-drawer-icon"><i className="ti ti-headset" /></span>
            <span><strong>Support</strong><small>Get help</small></span>
          </a>
        </nav>

        {/* Authed footer */}
        <div className="oga-drawer-foot authed-only">
          <div className="oga-drawer-foot-label">Account</div>
          <a className="oga-drawer-item" href="/app/profile" onClick={onClose}>
            <span className="oga-drawer-icon"><i className="ti ti-user" /></span>
            <span><strong>My Profile</strong><small>View and edit profile</small></span>
          </a>
          <a className="oga-drawer-item" href="/app/settings" onClick={onClose}>
            <span className="oga-drawer-icon"><i className="ti ti-settings" /></span>
            <span><strong>Settings</strong><small>Account preferences</small></span>
          </a>
          <button className="oga-drawer-item" onClick={() => { localStorage.clear(); sessionStorage.clear(); logout(); onClose() }}>
            <span className="oga-drawer-icon"><i className="ti ti-logout" /></span>
            <span><strong>Logout</strong><small>Sign out of your account</small></span>
          </button>
        </div>
      </div>
    </div>
  )
}

function DrawerGroup({ icon, label, desc, children }: { icon: string; label: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="oga-drawer-group">
      <button className="oga-drawer-item oga-drawer-group-toggle" aria-expanded="false">
        <span className="oga-drawer-icon"><i className={icon} /></span>
        <span><strong>{label}</strong><small>{desc}</small></span>
        <i className="ti ti-chevron-down oga-drawer-chevron" />
      </button>
      <div className="oga-drawer-subnav">
        {children}
      </div>
    </div>
  )
}

function DrawerSub({ href, label, onClick }: { href: string; label: string; onClick: () => void }) {
  return <a href={href} onClick={onClick}><i className="ti ti-arrow-right" />{label}</a>
}

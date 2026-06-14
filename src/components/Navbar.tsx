import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'

const OGA_LOGO = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 34 34" fill="none"><rect width="34" height="34" rx="8" fill="#0d1323"/><path d="M17 6c6.075 0 11 4.925 11 11s-4.925 11-11 11S6 23.075 6 17 10.925 6 17 6z" fill="#7C3AED" opacity=".9"/><path d="M17 9a8 8 0 018 8 8 8 0 01-8 8 8 8 0 01-8-8 8 8 0 018-8z" fill="#0d1323"/><path d="M17 12c2.76 0 5 2.24 5 5s-2.24 5-5 5-5-2.24-5-5 2.24-5 5-5z" fill="#7C3AED"/><path d="M17 15a2 2 0 012 2 2 2 0 01-2 2 2 2 0 01-2-2 2 2 0 012-2z" fill="#fff"/></svg>`

interface NavbarProps {
  onMenuToggle: () => void
}

export default function Navbar({ onMenuToggle }: NavbarProps) {
  const { isAuthed } = useAuth()
  const { theme, toggle } = useTheme()

  return (
    <header className="nav">
      <div className="nav-inner">
        <a className="brand" href="/app">
          <span className="logo-mark" dangerouslySetInnerHTML={{ __html: OGA_LOGO }} />
          OgaPay
        </a>
        <div className="nav-links">
          <a className="nav-link" href="/" data-navlink="index.html"><i className="ti ti-home" />Home</a>
          <a className="nav-link" href="/app/tasks" data-navlink="tasks"><i className="ti ti-checklist" />Tasks</a>
          <a className="nav-link" href="/app/store" data-navlink="store"><i className="ti ti-building-store" />Store</a>
          <a className="nav-link" href="/app/communities" data-navlink="communities"><i className="ti ti-users" />Communities</a>
          <a className="nav-link" href="/faq" data-navlink="faq.html"><i className="ti ti-help-circle" />FAQ</a>
        </div>
        <div className="nav-actions">
          {!isAuthed && (
            <>
              <a className="wallet-btn" href="/login"><i className="ti ti-login" /> Login</a>
              <a className="wallet-btn" href="/login" style={{ background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)' }}>
                <i className="ti ti-user-plus" /> Get Started
              </a>
            </>
          )}
          {isAuthed && (
            <a className="wallet-btn" href="/app/wallet">
              <i className="ti ti-wallet" /> &#8358;0.00
            </a>
          )}
          <button className="icon-btn" id="themeToggle" onClick={toggle} aria-label="Toggle theme">
            <i className={`ti ${theme === 'dark' ? 'ti-sun' : 'ti-moon'}`} />
          </button>
          <button className="icon-btn" id="menuBtn" onClick={onMenuToggle} aria-label="Open menu">
            <i className="ti ti-menu-2" />
          </button>
        </div>
      </div>
    </header>
  )
}

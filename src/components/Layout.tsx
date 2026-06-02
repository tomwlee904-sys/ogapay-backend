import { useState, ReactNode } from 'react'
import Navbar from './Navbar'
import Drawer from './Drawer'
import Sidebar from './Sidebar'

interface LayoutProps {
  children: ReactNode
  sidebar?: boolean
}

export default function Layout({ children, sidebar = false }: LayoutProps) {
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <>
      <Navbar onMenuToggle={() => setDrawerOpen(true)} />
      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <div className="app-layout">
        {sidebar && <Sidebar />}
        <main className="main">
          <section className="page">
            {children}
          </section>
        </main>
      </div>
      <div className="toast" id="appToast" />
    </>
  )
}

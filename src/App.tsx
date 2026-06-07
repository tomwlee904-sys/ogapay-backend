import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import Dashboard from './pages/Dashboard'
import Tasks from './pages/Tasks'
import Profile from './pages/Profile'
import Wallet from './pages/Wallet'
import WorkerPortal from './pages/WorkerPortal'
import Store from './pages/Store'
import Communities from './pages/Communities'
import Notifications from './pages/Notifications'
import Vault from './pages/Vault'
import Referrals from './pages/Referrals'
import Settings from './pages/Settings'
import Messages from './pages/Messages'
import MyStore from './pages/MyStore'
import MyTasks from './pages/MyTasks'
import FAQ from './pages/FAQ'
import Earnings from './pages/Earnings'
import Leaderboard from './pages/Leaderboard'
import Campaigns from './pages/Campaigns'
import Support from './pages/Support'
import NotFound from './pages/NotFound'
import CreateTask from './pages/CreateJobPage'

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/tasks/:id" element={<Tasks />} />
          <Route path="/tasks/new" element={<Dashboard />} />
          <Route path="/my-tasks" element={<MyTasks />} />
          <Route path="/create" element={<CreateTask />} />
          <Route path="/create-job" element={<CreateTask />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/wallet" element={<Wallet />} />
          <Route path="/worker-portal" element={<WorkerPortal />} />
          <Route path="/store" element={<Store />} />
          <Route path="/my-store" element={<MyStore />} />
          <Route path="/communities" element={<Communities />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/vault" element={<Vault />} />
          <Route path="/referrals" element={<Referrals />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/messages" element={<Messages />} />
          <Route path="/faq" element={<FAQ />} />
          <Route path="/earnings" element={<Earnings />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/campaigns" element={<Campaigns />} />
          <Route path="/support" element={<Support />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </ThemeProvider>
  )
}

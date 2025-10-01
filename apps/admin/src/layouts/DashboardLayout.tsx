import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Navbar from '@/components/Navbar.tsx'
import Sidebar from '@/components/Sidebar.tsx'

function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen flex">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <div className="flex-1 flex flex-col">
        <Navbar onMenuClick={() => setSidebarOpen(true)} />
        
        <main className="flex-1 p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default DashboardLayout 
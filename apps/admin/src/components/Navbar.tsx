import ThemeToggle from './ThemeToggle.tsx'
import { useAdminAuth } from '@/hooks/useAdminAuth.ts'
import { LogOut } from 'lucide-react'

interface NavbarProps {
  onMenuClick: () => void
}

function Navbar({ onMenuClick }: NavbarProps) {
  const { user, handleLogout } = useAdminAuth()

  return (
    <nav className="bg-surface shadow-sm border-b border-default px-4 md:px-6 py-3 flex items-center justify-between transition-colors">
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          aria-label="Toggle menu"
        >
          <svg
            className="w-6 h-6 text-primary"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </button>
        <h1 className="text-xl font-bold text-primary">Resomix Admin</h1>
      </div>
      <div className="flex items-center gap-3">
        <ThemeToggle />
        
        {user && (
          <div className="flex items-center gap-3 pl-3 border-l border-default">
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-sm font-semibold text-primary">{user.name || user.username}</span>
              <span className="text-[10px] text-secondary tracking-wider uppercase font-semibold">Administrator</span>
            </div>
            <div className="w-8 h-8 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold">
              {user.name ? user.name[0].toUpperCase() : user.username[0].toUpperCase()}
            </div>
            <button
              onClick={handleLogout}
              className="p-2 rounded-lg text-secondary hover:text-red-500 hover:bg-red-500/10 transition-all duration-200 flex items-center justify-center cursor-pointer"
              title="Logout"
            >
              <LogOut size={18} />
            </button>
          </div>
        )}
      </div>
    </nav>
  )
}

export default Navbar

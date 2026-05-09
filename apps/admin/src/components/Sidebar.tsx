import { NavLink } from 'react-router-dom'
import { MessageSquare, Mail, ClipboardList, GitBranch, BarChart3, Settings, Music, Music2, Logs, Headphones, Building2 } from 'lucide-react'

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

const navigation = [
  { name: 'Feedback', path: '/feedback', Icon: MessageSquare },
  { name: 'Contact', path: '/contact', Icon: Mail },
  { name: 'Waitlist', path: '/waitlist', Icon: ClipboardList },
  { name: 'Pipeline', path: '/pipeline', Icon: GitBranch },
  { name: 'Analytics', path: '/analytics', Icon: BarChart3 },
  { name: 'Operations', path: '/operations', Icon: Settings },
  { name: 'Spotify Apps', path: '/spotify-apps', Icon: Headphones },
  { name: 'Playlists', path: '/playlists', Icon: Music },
  { name: 'Tracks', path: '/tracks', Icon: Music2 },
  { name: 'Logs', path: '/logs', Icon: Logs },
  { name: 'Partners', path: '/partners', Icon: Building2 },
]

function Sidebar({ isOpen, onClose }: SidebarProps) {
  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-50
          w-64 bg-surface border-r border-default overflow-hidden
          transform transition-all duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <div className="h-full flex flex-col overflow-hidden">
          {/* Logo/Brand */}
          <div className="p-6 border-b border-default flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div 
                  className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white"
                  style={{ backgroundColor: 'var(--color-primary)' }}
                >
                  R
                </div>
                <span className="font-semibold text-primary">Admin</span>
              </div>
              <button
                onClick={onClose}
                className="lg:hidden p-1 rounded transition-colors hover:bg-gray-200 dark:hover:bg-gray-400"
                aria-label="Close menu"
              >
                <svg
                  className="w-5 h-5 text-secondary"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-1">
            {navigation.map((item) => {
              const Icon = item.Icon
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => onClose()}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                      isActive
                        ? 'font-medium'
                        : 'text-secondary hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`
                  }
                  style={({ isActive }) => 
                    isActive ? {
                      backgroundColor: 'var(--opacity-10)',
                      color: 'var(--color-primary)'
                    } : undefined
                  }
                >
                  <Icon size={20} />
                  <span>{item.name}</span>
                </NavLink>
              )
            })}
          </nav>
        </div>
      </aside>
    </>
  )
}

export default Sidebar

import ThemeToggle from './ThemeToggle.tsx'

interface NavbarProps {
  onMenuClick: () => void
}

function Navbar({ onMenuClick }: NavbarProps) {
  return (
    <nav className="bg-surface shadow-sm border-b border-default px-4 py-3 flex items-center justify-between transition-colors">
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
      <div className="flex items-center gap-2">
        <ThemeToggle />
        {/* Future: Add notifications, profile dropdown, etc. */}
      </div>
    </nav>
  )
}

export default Navbar

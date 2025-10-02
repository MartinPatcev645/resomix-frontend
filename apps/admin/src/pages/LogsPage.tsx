function LogsPage() {
  return (
    <div className="w-full">
      <h1 className="text-2xl md:text-3xl font-bold mb-4 md:mb-6 text-primary">Logs</h1>
      <div className="bg-surface rounded-lg shadow border border-default transition-colors p-3 md:p-6 overflow-hidden">
        <p className="text-secondary">Deployment and system logs will be displayed here</p>
      </div>
    </div>
  )
}

export default LogsPage

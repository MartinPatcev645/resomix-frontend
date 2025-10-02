import React from 'react'
import { Input, Select, DatePicker, Button, Space, Tag } from 'antd'
import { RefreshCw, Search, Download, Trash2, FilterX } from 'lucide-react'
import type { ContactItem } from '@/hooks/useContact.ts'
import dayjs from 'dayjs'

const { RangePicker } = DatePicker

interface ContactTableControlsProps {
  searchText: string
  searchColumn: keyof ContactItem
  dateRange: [string, string] | null
  selectedCount: number
  totalCount: number
  exportLoading: boolean
  onSearch: (value: string, column: keyof ContactItem) => void
  onSearchColumnChange: (column: keyof ContactItem) => void
  onDateRangeChange: (dates: [string, string] | null) => void
  onStatusFilter: (status: 'all' | 'open' | 'resolved') => void
  onRefresh: () => void
  onClearFilters: () => void
  onExport: (format: 'csv') => void
  onDeleteSelected: () => void
}

function ContactTableControls({
  searchText,
  searchColumn,
  dateRange,
  selectedCount,
  totalCount,
  exportLoading,
  onSearch,
  onSearchColumnChange,
  onDateRangeChange,
  onStatusFilter,
  onRefresh,
  onClearFilters,
  onExport,
  onDeleteSelected,
}: ContactTableControlsProps) {
  const [statusFilter, setStatusFilter] = React.useState<'all' | 'open' | 'resolved'>('all')
  
  const hasActiveFilters = searchText.trim() !== '' || dateRange !== null || statusFilter !== 'all'
  
  const searchColumns = [
    { label: 'Message', value: 'message' },
    { label: 'ID', value: 'id' },
    { label: 'Email', value: 'email' },
    { label: 'Name', value: 'name' },
  ]
  
  const statusOptions = [
    { label: 'All Status', value: 'all' },
    { label: <Tag color="orange">Open</Tag>, value: 'open' },
    { label: <Tag color="green">Resolved</Tag>, value: 'resolved' },
  ]
  
  const handleClearFiltersClick = () => {
    setStatusFilter('all')
    onClearFilters()
  }

  const handleExportCSV = () => {
    onExport('csv')
  }

  return (
    <div className="mb-6 w-full">
      {/* Top row - Search and filters */}
      <div className="mb-4 overflow-x-auto">
        <Space wrap size="middle" className="w-full">
          {/* Search with column selector */}
          <div className="flex gap-2 flex-wrap w-full md:w-auto">
            <Input
              placeholder={`Search by ${searchColumn}...`}
              value={searchText}
              onChange={(e) => onSearch(e.target.value, searchColumn)}
              prefix={<Search size={16} className="text-secondary" />}
              style={{ minWidth: 200, flex: 1 }}
              allowClear
            />
            
            {/* Search column selector */}
            <Select
              value={searchColumn}
              onChange={(value) => onSearchColumnChange(value as keyof ContactItem)}
              options={searchColumns}
              style={{ width: 120 }}
            />
          </div>

          {/* Date range filter */}
          <RangePicker
            value={dateRange ? [dayjs(dateRange[0]), dayjs(dateRange[1])] : null}
            style={{ width: '100%', maxWidth: 280 }}
            onChange={(dates) => {
              if (dates && dates[0] && dates[1]) {
                onDateRangeChange([
                  dates[0].format('YYYY-MM-DD'),
                  dates[1].format('YYYY-MM-DD'),
                ])
              } else {
                onDateRangeChange(null)
              }
            }}
          />
          
          {/* Status filter */}
          <Select
            value={statusFilter}
            onChange={(value) => {
              setStatusFilter(value)
              onStatusFilter(value)
            }}
            options={statusOptions}
            style={{ width: 150 }}
            placeholder="Filter by status"
          />

          {/* Total Count */}
          <div className="flex items-center px-3 py-1 rounded border border-default bg-surface-secondary">
            <span className="text-sm text-secondary">Total:</span>
            <span className="ml-2 text-sm font-semibold text-primary">{totalCount.toLocaleString()}</span>
          </div>
        </Space>
      </div>

      {/* Bottom row - Action buttons */}
      <div className="flex flex-wrap gap-2 justify-between items-center overflow-x-auto">
        <div className="flex-1" />
        
        <Space wrap size="middle">
          {/* Delete selected */}
          {selectedCount > 0 && (
            <Button
              danger
              icon={<Trash2 size={16} />}
              onClick={onDeleteSelected}
            >
              <span className="hidden sm:inline">Delete</span> ({selectedCount})
            </Button>
          )}

          {/* Clear filters */}
          {hasActiveFilters && (
            <Button
              icon={<FilterX size={16} />}
              onClick={handleClearFiltersClick}
            >
              <span className="hidden sm:inline">Clear Filters</span>
            </Button>
          )}

          {/* Refresh */}
          <Button
            icon={<RefreshCw size={16} />}
            onClick={onRefresh}
          >
            <span className="hidden sm:inline">Refresh</span>
          </Button>

          {/* Export CSV */}
          <Button 
            icon={<Download size={16} />}
            onClick={handleExportCSV}
            loading={exportLoading}
            disabled={exportLoading}
          >
            <span className="hidden sm:inline">{exportLoading ? 'Exporting...' : 'Export CSV'}</span>
          </Button>
        </Space>
      </div>
    </div>
  )
}

export default ContactTableControls

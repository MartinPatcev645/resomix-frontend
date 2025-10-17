import React from 'react'
import { Input, Select, DatePicker, Button, Space, Tag } from 'antd'
import { RefreshCw, Search, Download, Trash2, FilterX, Lock, Unlock } from 'lucide-react'
import dayjs from 'dayjs'

const { RangePicker } = DatePicker

interface PlaylistTableControlsProps {
  searchText: string
  searchColumn: 'id' | 'uuid' | 'name'
  dateRange: [string, string] | null
  selectedCount: number
  totalCount: number
  exportLoading: boolean
  onSearch: (value: string, column: 'id' | 'uuid' | 'name') => void
  onSearchColumnChange: (column: 'id' | 'uuid' | 'name') => void
  onDateRangeChange: (dates: [string, string] | null) => void
  onVisibilityFilter: (visibility: 'all' | 'public' | 'private') => void
  onTypeFilter: (type: 'all' | 'custom' | 'similarity' | 'waiting_segments') => void
  onRefresh: () => void
  onClearFilters: () => void
  onExport: (format: 'csv') => void
  onDeleteSelected: () => void
}

function PlaylistTableControls({
  searchText,
  searchColumn,
  dateRange,
  selectedCount,
  totalCount,
  exportLoading,
  onSearch,
  onSearchColumnChange,
  onDateRangeChange,
  onVisibilityFilter,
  onTypeFilter,
  onRefresh,
  onClearFilters,
  onExport,
  onDeleteSelected,
}: PlaylistTableControlsProps) {
  const [visibilityFilter, setVisibilityFilter] = React.useState<'all' | 'public' | 'private'>('all')
  const [typeFilter, setTypeFilter] = React.useState<'all' | 'custom' | 'similarity' | 'waiting_segments'>('all')
  
  const hasActiveFilters = searchText.trim() !== '' || dateRange !== null || visibilityFilter !== 'all' || typeFilter !== 'all'
  
  const searchColumns = [
    { label: 'Name', value: 'name' },
    { label: 'ID', value: 'id' },
    { label: 'UUID', value: 'uuid' },
  ]
  
  const visibilityOptions = [
    { label: 'All Visibility', value: 'all' },
    { 
      label: <span className="flex items-center gap-2"><Unlock size={14} /> Public</span>, 
      value: 'public' 
    },
    { 
      label: <span className="flex items-center gap-2"><Lock size={14} /> Private</span>, 
      value: 'private' 
    },
  ]

  const typeOptions = [
    { label: 'All Types', value: 'all' },
    { label: <Tag color="blue">Custom</Tag>, value: 'custom' },
    { label: <Tag color="purple">Similarity</Tag>, value: 'similarity' },
    { label: <Tag color="orange">Waiting Segments</Tag>, value: 'waiting_segments' },
  ]
  
  const handleClearFiltersClick = () => {
    setVisibilityFilter('all')
    setTypeFilter('all')
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
              id="search-column-select"
              aria-label="Search column"
              value={searchColumn}
              onChange={(value) => onSearchColumnChange(value as 'id' | 'uuid' | 'name')}
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
          
          {/* Visibility filter */}
          <Select 
            id="visibility-filter-select"
            aria-label="Visibility filter"
            value={visibilityFilter}
            onChange={(value) => {
              setVisibilityFilter(value)
              onVisibilityFilter(value)
            }}
            options={visibilityOptions}
            style={{ width: 160 }}
            placeholder="Filter by visibility"
          />

          {/* Type filter */}
          <Select 
            id="type-filter-select"
            aria-label="Type filter"
            value={typeFilter}
            onChange={(value) => {
              setTypeFilter(value)
              onTypeFilter(value)
            }}
            options={typeOptions}
            style={{ width: 180 }}
            placeholder="Filter by type"
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

export default PlaylistTableControls 
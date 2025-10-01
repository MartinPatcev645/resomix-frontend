import { Input, Select, DatePicker, Button, Space, Dropdown } from 'antd'
import { RefreshCw, Search, Download, Trash2 } from 'lucide-react'
import type { MenuProps } from 'antd'
import type { FeedbackItem } from '@/hooks/useFeedback.ts'

const { RangePicker } = DatePicker

interface FeedbackTableControlsProps {
  searchText: string
  searchColumn: keyof FeedbackItem
  selectedCount: number
  onSearch: (value: string, column: keyof FeedbackItem) => void
  onDateRangeChange: (dates: [string, string] | null) => void
  onRefresh: () => void
  onExport: (format: 'csv' | 'excel' | 'pdf') => void
  onDeleteSelected: () => void
}

function FeedbackTableControls({
  searchText,
  searchColumn,
  selectedCount,
  onSearch,
  onDateRangeChange,
  onRefresh,
  onExport,
  onDeleteSelected,
}: FeedbackTableControlsProps) {
  const searchColumns = [
    { label: 'Message', value: 'message' },
    { label: 'Category', value: 'category' },
    { label: 'User ID', value: 'user_id' },
  ]

  const exportMenuItems: MenuProps['items'] = [
    {
      key: 'csv',
      label: 'Export as CSV',
      onClick: () => onExport('csv'),
    },
    {
      key: 'excel',
      label: 'Export as Excel',
      onClick: () => onExport('excel'),
    },
    {
      key: 'pdf',
      label: 'Export as PDF',
      onClick: () => onExport('pdf'),
    },
  ]

  return (
    <div className="mb-6">
      {/* Top row - Search and filters */}
      <div className="mb-4">
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
              onChange={(value) => onSearch(searchText, value as keyof FeedbackItem)}
              options={searchColumns}
              style={{ width: 120 }}
            />
          </div>

          {/* Date range filter */}
          <RangePicker
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
        </Space>
      </div>

      {/* Bottom row - Action buttons */}
      <div className="flex flex-wrap gap-2 justify-between items-center">
        <div className="flex-1" />
        
        <Space wrap size="middle">
          {/* Delete selected (only show when items are selected) */}
          {selectedCount > 0 && (
            <Button
              danger
              icon={<Trash2 size={16} />}
              onClick={onDeleteSelected}
            >
              <span className="hidden sm:inline">Delete</span> ({selectedCount})
            </Button>
          )}

          {/* Refresh */}
          <Button
            icon={<RefreshCw size={16} />}
            onClick={onRefresh}
          >
            <span className="hidden sm:inline">Refresh</span>
          </Button>

          {/* Export dropdown */}
          <Dropdown menu={{ items: exportMenuItems }} placement="bottomRight">
            <Button icon={<Download size={16} />}>
              <span className="hidden sm:inline">Export</span>
            </Button>
          </Dropdown>
        </Space>
      </div>
    </div>
  )
}

export default FeedbackTableControls

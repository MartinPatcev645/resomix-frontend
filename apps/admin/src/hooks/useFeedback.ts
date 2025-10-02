import { useState, useEffect, useCallback } from 'react'
import { 
  getFeedbackList, 
  deleteFeedback as apiDeleteFeedback,
  batchDeleteFeedback as apiBatchDeleteFeedback,
  markFeedbackStatus,
  type FeedbackItem as ApiFeedbackItem,
  type FeedbackListParams
} from '@resomix/api-client'
import { message } from 'antd'

export interface FeedbackItem {
  id: string
  satisfaction: number | null
  recommendation: number | null
  message: string | null
  status: 'open' | 'resolved'
  submitted_at: string
  user_id: string | null
  category: string | null
}

// Convert API response to frontend format
const convertApiFeedback = (apiData: ApiFeedbackItem): FeedbackItem => ({
  id: String(apiData.id),
  satisfaction: apiData.satisfaction,
  recommendation: apiData.recommendation,
  message: apiData.message,
  status: apiData.status,
  submitted_at: apiData.submitted_at,
  user_id: apiData.user_id,
  category: apiData.category,
})

export function useFeedback() {
  const [data, setData] = useState<FeedbackItem[]>([])
  const [searchText, setSearchText] = useState('')
  const [searchColumn, setSearchColumn] = useState<keyof FeedbackItem>('message')
  const [dateRange, setDateRange] = useState<[string, string] | null>(null)
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'resolved'>('all')
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 30,
    total: 0,
  })
  const [sortBy, setSortBy] = useState<'id' | 'submitted_at' | 'satisfaction' | 'recommendation' | undefined>(undefined)
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | undefined>(undefined)

  // Fetch data from API
  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params: FeedbackListParams = {
        page: pagination.current,
        page_size: pagination.pageSize,
      }

      // Add search filter if present
      if (searchText.trim()) {
        params.search = searchText.trim()
        params.search_column = searchColumn as any
      }

      // Add date range filter if present
      if (dateRange && dateRange[0] && dateRange[1]) {
        params.date_from = dateRange[0]
        params.date_to = dateRange[1]
      }

      // Add status filter if not 'all'
      if (statusFilter !== 'all') {
        params.status = statusFilter
      }

      // Add sorting if present
      if (sortBy) {
        params.sort_by = sortBy
        params.sort_order = sortOrder || 'desc'
      }

      console.log('Fetching feedback with params:', params) // Debug log

      const result = await getFeedbackList(params)
      
      if (result.success && result.data) {
        setData(result.data.map(convertApiFeedback))
        setPagination(prev => ({
          ...prev,
          total: result.pagination.total,
        }))
      } else {
        message.error((result as any).error || 'Failed to fetch feedback')
        setData([])
      }
    } catch (error) {
      console.error('Error fetching feedback:', error) // Debug log
      message.error('An error occurred while fetching feedback')
      setData([])
    } finally {
      setLoading(false)
    }
  }, [pagination.current, pagination.pageSize, searchText, searchColumn, dateRange, statusFilter, sortBy, sortOrder])

  // Load data on mount and when filters change
  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleRefresh = () => {
    // Just refetch with current filters
    fetchData()
  }

  const handleClearFilters = () => {
    // Clear all filters and reset to page 1
    setSearchText('')
    setSearchColumn('message')
    setDateRange(null)
    setStatusFilter('all')
    setSelectedRowKeys([])
    setSortBy(undefined)
    setSortOrder(undefined)
    setPagination(prev => ({ ...prev, current: 1 }))
    // fetchData will be triggered by useEffect when dependencies change
  }

  const handleStatusFilter = (status: 'all' | 'open' | 'resolved') => {
    setStatusFilter(status)
    setPagination(prev => ({ ...prev, current: 1 }))
    // fetchData will be triggered by useEffect when dependencies change
  }

  const handleSearch = (value: string, column: keyof FeedbackItem) => {
    setSearchText(value)
    setSearchColumn(column)
    setPagination(prev => ({ ...prev, current: 1 })) // Reset to first page
    // fetchData will be triggered by useEffect when dependencies change
  }

  const handleDateRangeChange = (dates: [string, string] | null) => {
    setDateRange(dates)
    setPagination(prev => ({ ...prev, current: 1 })) // Reset to first page
    // fetchData will be triggered by useEffect when dependencies change
  }

  const handleDelete = async (ids: string[]) => {
    try {
      // Convert string IDs to numbers (backend expects numeric IDs)
      const numericIds = ids.map(id => Number(id))
      
      console.log('Deleting feedback IDs:', numericIds) // Debug log
      
      if (numericIds.length === 1) {
        const result = await apiDeleteFeedback(numericIds[0])
        console.log('Delete result:', result) // Debug log
        
        if (result.success) {
          message.success('Feedback deleted successfully')
          setSelectedRowKeys([])
          await fetchData()
        } else {
          message.error((result as any).error || 'Failed to delete feedback')
        }
      } else {
        const result = await apiBatchDeleteFeedback(numericIds)
        console.log('Batch delete result:', result) // Debug log
        
        if (result.success) {
          message.success(`${result.deleted_count} feedback entries deleted`)
          setSelectedRowKeys([])
          await fetchData()
        } else {
          message.error((result as any).error || 'Failed to delete feedback')
        }
      }
    } catch (error) {
      console.error('Error deleting feedback:', error) // Debug log
      message.error('An error occurred while deleting')
    }
  }

  const handleMarkStatus = async (id: string, status: 'open' | 'resolved') => {
    try {
      // Convert string ID to number (backend expects numeric ID)
      const numericId = Number(id)
      
      console.log('Marking feedback status:', { id: numericId, status }) // Debug log
      
      const result = await markFeedbackStatus(numericId, status)
      console.log('Mark status result:', result) // Debug log
      
      if (result.success) {
        message.success(`Feedback marked as ${status}`)
        await fetchData()
      } else {
        message.error((result as any).error || 'Failed to update status')
      }
    } catch (error) {
      console.error('Error marking status:', error) // Debug log
      message.error('An error occurred while updating status')
    }
  }

  const handlePageChange = (page: number, pageSize: number) => {
    setPagination(prev => ({ ...prev, current: page, pageSize }))
  }

  const handleExport = (format: 'csv' | 'excel' | 'pdf') => {
    message.info(`Export as ${format} - Feature coming soon`)
    // TODO: Implement export functionality
  }

  const handleSortChange = (sortByField: 'id' | 'submitted_at' | 'satisfaction' | 'recommendation' | undefined, order: 'asc' | 'desc' | undefined) => {
    setSortBy(sortByField)
    setSortOrder(order)
    setPagination(prev => ({ ...prev, current: 1 })) // Reset to first page
  }

  return {
    data,
    loading,
    searchText,
    searchColumn,
    dateRange,
    statusFilter,
    selectedRowKeys,
    pagination,
    sortBy,
    sortOrder,
    setSelectedRowKeys,
    handleRefresh,
    handleClearFilters,
    handleSearch,
    handleDateRangeChange,
    handleStatusFilter,
    handleDelete,
    handleMarkStatus,
    handlePageChange,
    handleExport,
    handleSortChange,
  }
}

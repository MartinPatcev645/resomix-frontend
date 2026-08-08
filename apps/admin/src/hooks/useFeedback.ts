import { useState, useEffect, useCallback } from 'react'
import { 
  getFeedbackList, 
  deleteFeedback as apiDeleteFeedback,
  batchDeleteFeedback as apiBatchDeleteFeedback,
  markFeedbackStatus,
  exportFeedback,
  apiAxiosInstance,
  type FeedbackItem as ApiFeedbackItem,
  type FeedbackListParams,
  type ApiResponse
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
  is_signed_in?: boolean
  user?: ApiFeedbackItem['user']
}

export type FeedbackSearchColumn = FeedbackListParams['search_column']

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
  is_signed_in: apiData.is_signed_in,
  user: apiData.user,
})

interface UseFeedbackOptions {
  onError?: (title: string, message: string) => void
  onSuccess?: (title: string, message: string) => void
}

export function useFeedback(options?: UseFeedbackOptions) {
  const { onError, onSuccess } = options || {}
  const [data, setData] = useState<FeedbackItem[]>([])
  const [searchText, setSearchText] = useState('')
  const [searchColumn, setSearchColumn] = useState<FeedbackListParams['search_column']>('message')
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
  const [exportLoading, setExportLoading] = useState(false)

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
        params.search_column = searchColumn
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

      // console.log('Fetching feedback with params:', params) // Debug log

      const result = await getFeedbackList(params)
      
      if (result.success && result.data) {
        setData(result.data.map(convertApiFeedback))
        setPagination(prev => ({
          ...prev,
          total: result.pagination.total,
        }))
      } else {
        const errorMsg = (result as ApiResponse).error || 'Failed to fetch feedback'
        if (onError) {
          onError('Failed to Load Feedback', errorMsg)
        } else {
          message.error(errorMsg)
        }
        setData([])
      }
    } catch (error) {
      console.error('Error fetching feedback:', error) // Debug log
      const errorMsg = error instanceof Error ? error.message : 'An error occurred while fetching feedback'
      if (onError) {
        onError('Error Fetching Feedback', errorMsg)
      } else {
        message.error(errorMsg)
      }
      setData([])
    } finally {
      setLoading(false)
    }
  }, [pagination.current, pagination.pageSize, searchText, searchColumn, dateRange, statusFilter, sortBy, sortOrder, onError])

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

  const handleSearch = (value: string, column: FeedbackListParams['search_column']) => {
    setSearchColumn(column) // Update column without triggering reload
    setSearchText(value) // This will trigger reload
    setPagination(prev => ({ ...prev, current: 1 })) // Reset to first page
    // fetchData will be triggered by useEffect when dependencies change
  }

  const handleSearchColumnChange = (column: FeedbackListParams['search_column']) => {
    setSearchColumn(column) // Only update column, don't reload
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
      
      // console.log('Deleting feedback IDs:', numericIds) // Debug log
      
      if (numericIds.length === 1) {
        const result = await apiDeleteFeedback(numericIds[0])
        // console.log('Delete result:', result) // Debug log
        
        if (result.success) {
          setSelectedRowKeys([])
          await fetchData()
          if (onSuccess) {
            onSuccess('Feedback Deleted', 'The feedback entry has been successfully deleted.')
          } else {
            message.success('Feedback deleted successfully')
          }
        } else {
          const errorMsg = (result as ApiResponse).error || 'Failed to delete feedback'
          if (onError) {
            onError('Delete Failed', errorMsg)
          } else {
            message.error(errorMsg)
          }
        }
      } else {
        const result = await apiBatchDeleteFeedback(numericIds)
        // console.log('Batch delete result:', result) // Debug log
        
        if (result.success) {
          setSelectedRowKeys([])
          await fetchData()
          if (onSuccess) {
            onSuccess('Feedback Deleted', `Successfully deleted ${result.deleted_count} feedback ${result.deleted_count === 1 ? 'entry' : 'entries'}.`)
          } else {
            message.success(`${result.deleted_count} feedback entries deleted`)
          }
        } else {
          const errorMsg = (result as ApiResponse).error || 'Failed to delete feedback'
          if (onError) {
            onError('Batch Delete Failed', errorMsg)
          } else {
            message.error(errorMsg)
          }
        }
      }
    } catch (error) {
      console.error('Error deleting feedback:', error) // Debug log
      const errorMsg = error instanceof Error ? error.message : 'An error occurred while deleting'
      if (onError) {
        onError('Delete Error', errorMsg)
      } else {
        message.error(errorMsg)
      }
    }
  }

  const handleMarkStatus = async (id: string, status: 'open' | 'resolved') => {
    try {
      // Convert string ID to number (backend expects numeric ID)
      const numericId = Number(id)
      
      // console.log('Marking feedback status:', { id: numericId, status }) // Debug log
      
      const result = await markFeedbackStatus(numericId, status)
      // console.log('Mark status result:', result) // Debug log
      
      if (result.success) {
        await fetchData()
        if (onSuccess) {
          onSuccess(
            'Status Updated', 
            `Feedback has been successfully marked as ${status === 'open' ? 'Open' : 'Resolved'}.`
          )
        } else {
          message.success(`Feedback marked as ${status}`)
        }
      } else {
        const errorMsg = (result as ApiResponse).error || 'Failed to update status'
        if (onError) {
          onError('Status Update Failed', errorMsg)
        } else {
          message.error(errorMsg)
        }
      }
    } catch (error) {
      console.error('Error marking status:', error) // Debug log
      const errorMsg = error instanceof Error ? error.message : 'An error occurred while updating status'
      if (onError) {
        onError('Status Update Error', errorMsg)
      } else {
        message.error(errorMsg)
      }
    }
  }

  const handlePageChange = (page: number, pageSize: number) => {
    setPagination(prev => ({ ...prev, current: page, pageSize }))
  }

  const handleExport = async (format: 'csv') => {
    if (exportLoading) return // Prevent multiple clicks

    try {
      setExportLoading(true)
      message.loading('Preparing export...', 0)

      const result = await exportFeedback(format, {
        search: searchText.trim() || undefined,
        search_column: searchColumn,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        date_from: dateRange?.[0],
        date_to: dateRange?.[1],
        sort_by: sortBy,
        sort_order: sortOrder,
      })

      message.destroy()

      if (result.success && result.download_url) {
        // Download the file with authentication
        await downloadFile(result.download_url, result.filename)
        
        // Show success after download completes
        if (onSuccess) {
          onSuccess('Export Successful', `Your CSV export has been downloaded successfully.\n\nFilename: ${result.filename}`)
        } else {
          message.success('Export downloaded successfully')
        }
      } else {
        const errorMsg = result.error || 'Failed to export feedback'
        if (onError) {
          onError('Export Failed', errorMsg)
        } else {
          message.error(errorMsg)
        }
      }
    } catch (error) {
      message.destroy()
      console.error('Error exporting feedback:', error)
      const errorMsg = error instanceof Error ? error.message : 'An error occurred while exporting feedback'
      if (onError) {
        onError('Export Error', errorMsg)
      } else {
        message.error(errorMsg)
      }
    } finally {
      setExportLoading(false)
    }
  }

  // Helper function to download file with authentication
  const downloadFile = async (url: string, filename: string) => {
    try {
      const response = await apiAxiosInstance.get(url, {
        responseType: 'blob',
      })

      // Create a blob URL and trigger download
      const blob = new Blob([response.data], { type: 'text/csv' })
      const blobUrl = window.URL.createObjectURL(blob)
      
      const link = document.createElement('a')
      link.href = blobUrl
      link.download = filename
      document.body.appendChild(link)
      link.click()
      
      // Cleanup
      document.body.removeChild(link)
      window.URL.revokeObjectURL(blobUrl)
    } catch (error) {
      console.error('Error downloading file:', error)
      const errorMsg = error instanceof Error ? error.message : 'Failed to download file'
      if (onError) {
        onError('Download Error', errorMsg)
      } else {
        message.error(errorMsg)
      }
    }
  }

  const handleSortChange = (sortByField: 'id' | 'submitted_at' | 'satisfaction' | 'recommendation' | undefined, order: 'asc' | 'desc' | undefined) => {
    setSortBy(sortByField)
    setSortOrder(order)
    setPagination(prev => ({ ...prev, current: 1 })) // Reset to first page
  }

  return {
    data,
    loading,
    exportLoading,
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
    handleSearchColumnChange,
    handleDateRangeChange,
    handleStatusFilter,
    handleDelete,
    handleMarkStatus,
    handlePageChange,
    handleExport,
    handleSortChange,
  }
}

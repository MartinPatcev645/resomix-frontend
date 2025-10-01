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
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 30,
    total: 0,
  })

  // Fetch data from API
  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params: FeedbackListParams = {
        page: pagination.current,
        page_size: pagination.pageSize,
      }

      if (searchText) {
        params.search = searchText
        params.search_column = searchColumn as any
      }

      if (dateRange) {
        params.date_from = dateRange[0]
        params.date_to = dateRange[1]
      }

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
      message.error('An error occurred while fetching feedback')
      setData([])
    } finally {
      setLoading(false)
    }
  }, [pagination.current, pagination.pageSize, searchText, searchColumn, dateRange])

  // Load data on mount and when filters change
  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleRefresh = () => {
    setSearchText('')
    setSearchColumn('message')
    setDateRange(null)
    setSelectedRowKeys([])
    setPagination(prev => ({ ...prev, current: 1 }))
    fetchData()
  }

  const handleSearch = (value: string, column: keyof FeedbackItem) => {
    setSearchText(value)
    setSearchColumn(column)
    setPagination(prev => ({ ...prev, current: 1 })) // Reset to first page
  }

  const handleDateRangeChange = (dates: [string, string] | null) => {
    setDateRange(dates)
    setPagination(prev => ({ ...prev, current: 1 })) // Reset to first page
  }

  const handleDelete = async (ids: string[]) => {
    setLoading(true)
    try {
      // Convert string IDs to numbers (backend expects numeric IDs)
      const numericIds = ids.map(id => Number(id))
      
      if (numericIds.length === 1) {
        const result = await apiDeleteFeedback(numericIds[0])
        if (result.success) {
          message.success('Feedback deleted successfully')
          setSelectedRowKeys([])
          fetchData()
        } else {
          message.error((result as any).error || 'Failed to delete feedback')
        }
      } else {
        const result = await apiBatchDeleteFeedback(numericIds)
        if (result.success) {
          message.success(`${result.deleted_count} feedback entries deleted`)
          setSelectedRowKeys([])
          fetchData()
        } else {
          message.error((result as any).error || 'Failed to delete feedback')
        }
      }
    } catch (error) {
      message.error('An error occurred while deleting')
    } finally {
      setLoading(false)
    }
  }

  const handleMarkStatus = async (id: string, status: 'open' | 'resolved') => {
    setLoading(true)
    try {
      // Convert string ID to number (backend expects numeric ID)
      const numericId = Number(id)
      const result = await markFeedbackStatus(numericId, status)
      
      if (result.success) {
        message.success(`Feedback marked as ${status}`)
        fetchData()
      } else {
        message.error((result as any).error || 'Failed to update status')
      }
    } catch (error) {
      message.error('An error occurred while updating status')
    } finally {
      setLoading(false)
    }
  }

  const handlePageChange = (page: number, pageSize: number) => {
    setPagination(prev => ({ ...prev, current: page, pageSize }))
  }

  const handleExport = (format: 'csv' | 'excel' | 'pdf') => {
    message.info(`Export as ${format} - Feature coming soon`)
    // TODO: Implement export functionality
  }

  return {
    data,
    loading,
    searchText,
    searchColumn,
    dateRange,
    selectedRowKeys,
    pagination,
    setSelectedRowKeys,
    handleRefresh,
    handleSearch,
    handleDateRangeChange,
    handleDelete,
    handleMarkStatus,
    handlePageChange,
    handleExport,
  }
}

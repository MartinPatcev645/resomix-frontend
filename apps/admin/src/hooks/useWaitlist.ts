import { useState, useEffect, useCallback } from 'react'
import { 
  getWaitlistList, 
  deleteWaitlist as apiDeleteWaitlist,
  batchDeleteWaitlist as apiBatchDeleteWaitlist,
  updateWaitlistStatus,
  exportWaitlist,
  apiAxiosInstance,
  type WaitlistItem as ApiWaitlistItem,
  type WaitlistListParams
} from '@resomix/api-client'
import { message } from 'antd'

export interface WaitlistItem {
  id: string
  email: string
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
  updated_at: string
}

// Convert API response to frontend format
const convertApiWaitlist = (apiData: ApiWaitlistItem): WaitlistItem => ({
  id: String(apiData.id),
  email: apiData.email,
  status: apiData.status,
  created_at: apiData.created_at,
  updated_at: apiData.updated_at,
})

interface UseWaitlistOptions {
  onError?: (title: string, message: string) => void
  onSuccess?: (title: string, message: string) => void
}

export function useWaitlist(options?: UseWaitlistOptions) {
  const { onError, onSuccess } = options || {}
  const [data, setData] = useState<WaitlistItem[]>([])
  const [searchText, setSearchText] = useState('')
  const [searchColumn, setSearchColumn] = useState<keyof WaitlistItem>('email')
  const [dateRange, setDateRange] = useState<[string, string] | null>(null)
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all')
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 30,
    total: 0,
  })
  const [sortBy, setSortBy] = useState<'id' | 'created_at' | undefined>(undefined)
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | undefined>(undefined)
  const [exportLoading, setExportLoading] = useState(false)

  // Fetch data from API
  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params: WaitlistListParams = {
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

      // console.log('Fetching waitlist with params:', params)

      const result = await getWaitlistList(params)
      
      if (result.success && result.data) {
        setData(result.data.map(convertApiWaitlist))
        setPagination(prev => ({
          ...prev,
          total: result.pagination.total,
        }))
      } else {
        const errorMsg = (result as any).error || 'Failed to fetch waitlist entries'
        if (onError) {
          onError('Failed to Load Waitlist', errorMsg)
        } else {
          message.error(errorMsg)
        }
        setData([])
      }
    } catch (error) {
      console.error('Error fetching waitlist:', error)
      const errorMsg = error instanceof Error ? error.message : 'An error occurred while fetching waitlist'
      if (onError) {
        onError('Error Fetching Waitlist', errorMsg)
      } else {
        message.error(errorMsg)
      }
      setData([])
    } finally {
      setLoading(false)
    }
  }, [pagination.current, pagination.pageSize, searchText, dateRange, statusFilter, sortBy, sortOrder])

  // Load data on mount and when filters change
  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleRefresh = () => {
    fetchData()
  }

  const handleClearFilters = () => {
    setSearchText('')
    setSearchColumn('email')
    setDateRange(null)
    setStatusFilter('all')
    setSelectedRowKeys([])
    setSortBy(undefined)
    setSortOrder(undefined)
    setPagination(prev => ({ ...prev, current: 1 }))
  }

  const handleStatusFilter = (status: 'all' | 'pending' | 'approved' | 'rejected') => {
    setStatusFilter(status)
    setPagination(prev => ({ ...prev, current: 1 }))
  }

  const handleSearch = (value: string, column: keyof WaitlistItem) => {
    setSearchColumn(column)
    setSearchText(value)
    setPagination(prev => ({ ...prev, current: 1 }))
  }

  const handleSearchColumnChange = (column: keyof WaitlistItem) => {
    setSearchColumn(column)
  }

  const handleDateRangeChange = (dates: [string, string] | null) => {
    setDateRange(dates)
    setPagination(prev => ({ ...prev, current: 1 }))
  }

  const handleDelete = async (ids: string[]) => {
    try {
      const numericIds = ids.map(id => Number(id))
      
      // console.log('Deleting waitlist IDs:', numericIds)
      
      if (numericIds.length === 1) {
        const result = await apiDeleteWaitlist(numericIds[0])
        // console.log('Delete result:', result)
        
        if (result.success) {
          setSelectedRowKeys([])
          await fetchData()
          if (onSuccess) {
            onSuccess('Waitlist Entry Deleted', 'The waitlist entry has been successfully deleted.')
          } else {
            message.success('Waitlist entry deleted successfully')
          }
        } else {
          const errorMsg = (result as any).error || 'Failed to delete waitlist entry'
          if (onError) {
            onError('Delete Failed', errorMsg)
          } else {
            message.error(errorMsg)
          }
        }
      } else {
        const result = await apiBatchDeleteWaitlist(numericIds)
        // console.log('Batch delete result:', result)
        
        if (result.success) {
          setSelectedRowKeys([])
          await fetchData()
          if (onSuccess) {
            onSuccess('Waitlist Entries Deleted', `Successfully deleted ${result.deleted_count} waitlist ${result.deleted_count === 1 ? 'entry' : 'entries'}.`)
          } else {
            message.success(`${result.deleted_count} waitlist entries deleted`)
          }
        } else {
          const errorMsg = (result as any).error || 'Failed to delete waitlist entries'
          if (onError) {
            onError('Batch Delete Failed', errorMsg)
          } else {
            message.error(errorMsg)
          }
        }
      }
    } catch (error) {
      console.error('Error deleting waitlist:', error)
      const errorMsg = error instanceof Error ? error.message : 'An error occurred while deleting'
      if (onError) {
        onError('Delete Error', errorMsg)
      } else {
        message.error(errorMsg)
      }
    }
  }

  const handleUpdateStatus = async (id: string, status: 'pending' | 'approved' | 'rejected') => {
    try {
      const numericId = Number(id)
      
      // console.log('Updating waitlist status:', { id: numericId, status })
      
      const result = await updateWaitlistStatus(numericId, status)
      // console.log('Update status result:', result)
      
      if (result.success) {
        await fetchData()
        const statusLabel = status.charAt(0).toUpperCase() + status.slice(1)
        if (onSuccess) {
          onSuccess(
            'Status Updated', 
            `Waitlist entry has been successfully marked as ${statusLabel}.`
          )
        } else {
          message.success(`Waitlist entry marked as ${statusLabel}`)
        }
      } else {
        const errorMsg = (result as any).error || 'Failed to update status'
        if (onError) {
          onError('Status Update Failed', errorMsg)
        } else {
          message.error(errorMsg)
        }
      }
    } catch (error) {
      console.error('Error updating status:', error)
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
    if (exportLoading) return

    try {
      setExportLoading(true)
      message.loading('Preparing export...', 0)

      const result = await exportWaitlist(format, {
        search: searchText.trim() || undefined,
        search_column: searchColumn as any,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        date_from: dateRange?.[0],
        date_to: dateRange?.[1],
        sort_by: sortBy,
        sort_order: sortOrder,
      })

      message.destroy()

      if (result.success && result.download_url) {
        await downloadFile(result.download_url, result.filename)
        
        if (onSuccess) {
          onSuccess('Export Successful', `Your CSV export has been downloaded successfully.\n\nFilename: ${result.filename}`)
        } else {
          message.success('Export downloaded successfully')
        }
      } else {
        const errorMsg = result.error || 'Failed to export waitlist'
        if (onError) {
          onError('Export Failed', errorMsg)
        } else {
          message.error(errorMsg)
        }
      }
    } catch (error) {
      message.destroy()
      console.error('Error exporting waitlist:', error)
      const errorMsg = error instanceof Error ? error.message : 'An error occurred while exporting waitlist'
      if (onError) {
        onError('Export Error', errorMsg)
      } else {
        message.error(errorMsg)
      }
    } finally {
      setExportLoading(false)
    }
  }

  const downloadFile = async (url: string, filename: string) => {
    try {
      const response = await apiAxiosInstance.get(url, {
        responseType: 'blob',
      })

      const blob = new Blob([response.data], { type: 'text/csv' })
      const blobUrl = window.URL.createObjectURL(blob)
      
      const link = document.createElement('a')
      link.href = blobUrl
      link.download = filename
      document.body.appendChild(link)
      link.click()
      
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

  const handleSortChange = (sortByField: 'id' | 'created_at' | undefined, order: 'asc' | 'desc' | undefined) => {
    setSortBy(sortByField)
    setSortOrder(order)
    setPagination(prev => ({ ...prev, current: 1 }))
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
    handleUpdateStatus,
    handlePageChange,
    handleExport,
    handleSortChange,
  }
}

import { useState, useEffect, useCallback } from 'react'
import { 
  getContactList, 
  deleteContact as apiDeleteContact,
  batchDeleteContact as apiBatchDeleteContact,
  markContactStatus,
  exportContact,
  apiAxiosInstance,
  type ContactItem as ApiContactItem,
  type ContactSubmitter,
  type ContactListParams,
  type ApiResponse
} from '@resomix/api-client'
import { message } from 'antd'

export interface ContactItem {
  id: string
  name: string | null
  email: string | null
  subject: string | null
  phone: string | null
  message: string | null
  contact_type: 'consumer' | 'partner'
  // B2B qualification fields. Null on consumer contacts, and on whichever questions the
  // submitting partner form does not ask (/partners and /partners-pilot ask different sets).
  company_name: string | null
  role: string | null
  partner_type: string | null
  preferred_path: string | null
  catalog_context: string | null
  catalog_size: string | null
  estimated_calls: string | null
  status: 'open' | 'resolved'
  submitted_at: string
  user_id: string | null
  /** Whether the submitter was signed in. Derived server-side from the stored user_id. */
  is_signed_in: boolean
  /** The account behind the submission — null when anonymous, or when it was since deleted. */
  user: ContactSubmitter | null
}

export type ContactSearchColumn = ContactListParams['search_column']

// Convert API response to frontend format
const convertApiContact = (apiData: ApiContactItem): ContactItem => ({
  id: String(apiData.id),
  name: apiData.name,
  email: apiData.email,
  subject: apiData.subject,
  phone: apiData.phone,
  message: apiData.message,
  contact_type: apiData.contact_type === 'partner' ? 'partner' : 'consumer',
  company_name: apiData.company_name ?? null,
  role: apiData.role ?? null,
  partner_type: apiData.partner_type ?? null,
  preferred_path: apiData.preferred_path ?? null,
  catalog_context: apiData.catalog_context ?? null,
  catalog_size: apiData.catalog_size ?? null,
  estimated_calls: apiData.estimated_calls ?? null,
  status: apiData.status,
  submitted_at: apiData.submitted_at,
  user_id: apiData.user_id,
  is_signed_in: apiData.is_signed_in ?? apiData.user_id != null,
  user: apiData.user ?? null,
})

interface UseContactOptions {
  onError?: (title: string, message: string) => void
  onSuccess?: (title: string, message: string) => void
}

export function useContact(options?: UseContactOptions) {
  const { onError, onSuccess } = options || {}
  const [data, setData] = useState<ContactItem[]>([])
  const [searchText, setSearchText] = useState('')
  const [searchColumn, setSearchColumn] = useState<ContactListParams['search_column']>('message')
  const [dateRange, setDateRange] = useState<[string, string] | null>(null)
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'resolved'>('all')
  const [typeFilter, setTypeFilter] = useState<'all' | 'consumer' | 'partner'>('all')
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 30,
    total: 0,
  })
  const [sortBy, setSortBy] = useState<'id' | 'submitted_at' | undefined>(undefined)
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | undefined>(undefined)
  const [exportLoading, setExportLoading] = useState(false)

  // Fetch data from API
  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params: ContactListParams = {
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

      // Add type filter if not 'all'
      if (typeFilter !== 'all') {
        params.contact_type = typeFilter
      }

      // Add sorting if present
      if (sortBy) {
        params.sort_by = sortBy
        params.sort_order = sortOrder || 'desc'
      }

      console.log('Fetching contact with params:', params)

      const result = await getContactList(params)
      
      if (result.success && result.data) {
        setData(result.data.map(convertApiContact))
        setPagination(prev => ({
          ...prev,
          total: result.pagination.total,
        }))
      } else {
        const errorMsg = (result as ApiResponse).error || 'Failed to fetch contact submissions'
        if (onError) {
          onError('Failed to Load Contact', errorMsg)
        } else {
          message.error(errorMsg)
        }
        setData([])
      }
    } catch (error) {
      console.error('Error fetching contact:', error)
      const errorMsg = error instanceof Error ? error.message : 'An error occurred while fetching contact'
      if (onError) {
        onError('Error Fetching Contact', errorMsg)
      } else {
        message.error(errorMsg)
      }
      setData([])
    } finally {
      setLoading(false)
    }
  }, [pagination.current, pagination.pageSize, searchText, searchColumn, dateRange, statusFilter, typeFilter, sortBy, sortOrder, onError])

  // Load data on mount and when filters change
  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleRefresh = () => {
    fetchData()
  }

  const handleClearFilters = () => {
    setSearchText('')
    setSearchColumn('message')
    setDateRange(null)
    setStatusFilter('all')
    setTypeFilter('all')
    setSelectedRowKeys([])
    setSortBy(undefined)
    setSortOrder(undefined)
    setPagination(prev => ({ ...prev, current: 1 }))
  }

  const handleStatusFilter = (status: 'all' | 'open' | 'resolved') => {
    setStatusFilter(status)
    setPagination(prev => ({ ...prev, current: 1 }))
  }

  const handleTypeFilter = (type: 'all' | 'consumer' | 'partner') => {
    setTypeFilter(type)
    setPagination(prev => ({ ...prev, current: 1 }))
  }

  const handleSearch = (value: string, column: ContactListParams['search_column']) => {
    setSearchColumn(column)
    setSearchText(value)
    setPagination(prev => ({ ...prev, current: 1 }))
  }

  const handleSearchColumnChange = (column: ContactListParams['search_column']) => {
    setSearchColumn(column)
}

  const handleDateRangeChange = (dates: [string, string] | null) => {
    setDateRange(dates)
    setPagination(prev => ({ ...prev, current: 1 }))
  }

  const handleDelete = async (ids: string[]) => {
    try {
      const numericIds = ids.map(id => Number(id))
      
      console.log('Deleting contact IDs:', numericIds)
      
      if (numericIds.length === 1) {
        const result = await apiDeleteContact(numericIds[0])
        console.log('Delete result:', result)
        
        if (result.success) {
          setSelectedRowKeys([])
          await fetchData()
          if (onSuccess) {
            onSuccess('Contact Deleted', 'The contact submission has been successfully deleted.')
          } else {
            message.success('Contact deleted successfully')
          }
        } else {
          const errorMsg = (result as ApiResponse).error || 'Failed to delete contact'
          if (onError) {
            onError('Delete Failed', errorMsg)
          } else {
            message.error(errorMsg)
          }
        }
      } else {
        const result = await apiBatchDeleteContact(numericIds)
        console.log('Batch delete result:', result)
        
        if (result.success) {
          setSelectedRowKeys([])
          await fetchData()
          if (onSuccess) {
            onSuccess('Contact Deleted', `Successfully deleted ${result.deleted_count} contact ${result.deleted_count === 1 ? 'submission' : 'submissions'}.`)
          } else {
            message.success(`${result.deleted_count} contact submissions deleted`)
          }
        } else {
          const errorMsg = (result as ApiResponse).error || 'Failed to delete contact'
          if (onError) {
            onError('Batch Delete Failed', errorMsg)
          } else {
            message.error(errorMsg)
          }
        }
      }
    } catch (error) {
      console.error('Error deleting contact:', error)
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
      const numericId = Number(id)
      
      console.log('Marking contact status:', { id: numericId, status })
      
      const result = await markContactStatus(numericId, status)
      console.log('Mark status result:', result)
      
      if (result.success) {
        await fetchData()
        if (onSuccess) {
          onSuccess(
            'Status Updated', 
            `Contact has been successfully marked as ${status === 'open' ? 'Open' : 'Resolved'}.`
          )
        } else {
          message.success(`Contact marked as ${status}`)
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
      console.error('Error marking status:', error)
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

      const result = await exportContact(format, {
        search: searchText.trim() || undefined,
        search_column: searchColumn,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        contact_type: typeFilter !== 'all' ? typeFilter : undefined,
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
        const errorMsg = result.error || 'Failed to export contact'
        if (onError) {
          onError('Export Failed', errorMsg)
        } else {
          message.error(errorMsg)
        }
      }
    } catch (error) {
      message.destroy()
      console.error('Error exporting contact:', error)
      const errorMsg = error instanceof Error ? error.message : 'An error occurred while exporting contact'
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

  const handleSortChange = (sortByField: 'id' | 'submitted_at' | undefined, order: 'asc' | 'desc' | undefined) => {
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
    typeFilter,
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
    handleTypeFilter,
    handleDelete,
    handleMarkStatus,
    handlePageChange,
    handleExport,
    handleSortChange,
  }
} 
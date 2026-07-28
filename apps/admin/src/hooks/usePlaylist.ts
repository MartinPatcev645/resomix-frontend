import { useState, useEffect, useCallback } from 'react'
import { 
  getPlaylistList, 
  deletePlaylist as apiDeletePlaylist,
  batchDeletePlaylist as apiBatchDeletePlaylist,
  exportPlaylist,
  adminChangePlaylistVisibility,
  adminBatchChangePlaylistVisibility,
  apiAxiosInstance,
  type PlaylistItem as ApiPlaylistItem,
  type PlaylistListParams
} from '@resomix/api-client'
import { message } from 'antd'

export interface PlaylistItem {
  id: string
  uuid: string
  user_id: string | null
  creator_username: string | null
  guest_visitor_id: string | null
  name: string
  is_public: boolean
  type: 'custom' | 'similarity' | 'waiting_segments'
  seed_track_id: number | null
  created_at: string
}

// Convert API response to frontend format
const convertApiPlaylist = (apiData: ApiPlaylistItem): PlaylistItem => ({
  id: String(apiData.id),
  uuid: apiData.uuid,
  user_id: apiData.user_id,
  creator_username: apiData.creator_username ?? null,
  guest_visitor_id: apiData.guest_visitor_id ?? null,
  name: apiData.name,
  is_public: apiData.is_public,
  type: apiData.type,
  seed_track_id: apiData.seed_track_id,
  created_at: apiData.created_at,
})

interface UsePlaylistOptions {
  onError?: (title: string, message: string) => void
  onSuccess?: (title: string, message: string) => void
}

export function usePlaylist(options?: UsePlaylistOptions) {
  const { onError, onSuccess } = options || {}
  const [data, setData] = useState<PlaylistItem[]>([])
  const [searchText, setSearchText] = useState('')
  const [searchColumn, setSearchColumn] = useState<'id' | 'uuid' | 'name'>('name')
  const [dateRange, setDateRange] = useState<[string, string] | null>(null)
  const [visibilityFilter, setVisibilityFilter] = useState<'all' | 'public' | 'private'>('all')
  const [typeFilter, setTypeFilter] = useState<'all' | 'custom' | 'similarity' | 'waiting_segments'>('all')
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
      const params: PlaylistListParams = {
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

      // Add visibility filter if not 'all'
      if (visibilityFilter !== 'all') {
        params.visibility = visibilityFilter
      }

      // Add type filter if not 'all'
      if (typeFilter !== 'all') {
        params.type = typeFilter
      }

      // Add sorting if present
      if (sortBy) {
        params.sort_by = sortBy
        params.sort_order = sortOrder || 'desc'
      }

      console.log('Fetching playlists with params:', params)

      const result = await getPlaylistList(params)
      
      if (result.success && result.data) {
        setData(result.data.map(convertApiPlaylist))
        setPagination(prev => ({
          ...prev,
          total: result.pagination.total,
        }))
      } else {
        const errorMsg = (result as any).error || 'Failed to fetch playlists'
        if (onError) {
          onError('Failed to Load Playlists', errorMsg)
        } else {
          message.error(errorMsg)
        }
        setData([])
      }
    } catch (error) {
      console.error('Error fetching playlists:', error)
      const errorMsg = error instanceof Error ? error.message : 'An error occurred while fetching playlists'
      if (onError) {
        onError('Error Fetching Playlists', errorMsg)
      } else {
        message.error(errorMsg)
      }
      setData([])
    } finally {
      setLoading(false)
    }
  }, [pagination.current, pagination.pageSize, searchText, searchColumn, dateRange, visibilityFilter, typeFilter, sortBy, sortOrder])

  // Load data on mount and when filters change
  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleRefresh = () => {
    fetchData()
  }

  const handleClearFilters = () => {
    setSearchText('')
    setSearchColumn('name')
    setDateRange(null)
    setVisibilityFilter('all')
    setTypeFilter('all')
    setSelectedRowKeys([])
    setSortBy(undefined)
    setSortOrder(undefined)
    setPagination(prev => ({ ...prev, current: 1 }))
  }

  const handleVisibilityFilter = (visibility: 'all' | 'public' | 'private') => {
    setVisibilityFilter(visibility)
    setPagination(prev => ({ ...prev, current: 1 }))
  }

  const handleTypeFilter = (type: 'all' | 'custom' | 'similarity' | 'waiting_segments') => {
    setTypeFilter(type)
    setPagination(prev => ({ ...prev, current: 1 }))
  }

  const handleSearch = (value: string, column: 'id' | 'uuid' | 'name') => {
    setSearchColumn(column)
    setSearchText(value)
    setPagination(prev => ({ ...prev, current: 1 }))
  }

  const handleSearchColumnChange = (column: 'id' | 'uuid' | 'name') => {
    setSearchColumn(column)
  }

  const handleDateRangeChange = (dates: [string, string] | null) => {
    setDateRange(dates)
    setPagination(prev => ({ ...prev, current: 1 }))
  }

  const handleDelete = async (ids: string[]) => {
    try {
      const numericIds = ids.map(id => Number(id))
      
      console.log('Deleting playlist IDs:', numericIds)
      
      if (numericIds.length === 1) {
        const result = await apiDeletePlaylist(numericIds[0])
        console.log('Delete result:', result)
        
        if (result.success) {
          setSelectedRowKeys([])
          await fetchData()
          if (onSuccess) {
            onSuccess('Playlist Deleted', 'The playlist has been successfully deleted.')
          } else {
            message.success('Playlist deleted successfully')
          }
        } else {
          const errorMsg = (result as any).error || 'Failed to delete playlist'
          if (onError) {
            onError('Delete Failed', errorMsg)
          } else {
            message.error(errorMsg)
          }
        }
      } else {
        const result = await apiBatchDeletePlaylist(numericIds)
        console.log('Batch delete result:', result)
        
        if (result.success) {
          setSelectedRowKeys([])
          await fetchData()
          if (onSuccess) {
            onSuccess('Playlists Deleted', `Successfully deleted ${result.deleted_count} playlist${result.deleted_count === 1 ? '' : 's'}.`)
          } else {
            message.success(`${result.deleted_count} playlists deleted`)
          }
        } else {
          const errorMsg = (result as any).error || 'Failed to delete playlists'
          if (onError) {
            onError('Batch Delete Failed', errorMsg)
          } else {
            message.error(errorMsg)
          }
        }
      }
    } catch (error) {
      console.error('Error deleting playlists:', error)
      const errorMsg = error instanceof Error ? error.message : 'An error occurred while deleting'
      if (onError) {
        onError('Delete Error', errorMsg)
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

      const result = await exportPlaylist(format, {
        search: searchText.trim() || undefined,
        search_column: searchColumn,
        visibility: visibilityFilter !== 'all' ? visibilityFilter : undefined,
        type: typeFilter !== 'all' ? typeFilter : undefined,
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
        const errorMsg = result.error || 'Failed to export playlists'
        if (onError) {
          onError('Export Failed', errorMsg)
        } else {
          message.error(errorMsg)
        }
      }
    } catch (error) {
      message.destroy()
      console.error('Error exporting playlists:', error)
      const errorMsg = error instanceof Error ? error.message : 'An error occurred while exporting playlists'
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

  const handleChangeVisibility = async (ids: string[], isPublic: boolean) => {
    try {
      const numericIds = ids.map(id => Number(id))
      
      if (numericIds.length === 0) {
        if (onError) {
          onError('No Playlists Selected', 'Please select playlists to change visibility.')
        } else {
          message.error('No playlists selected')
        }
        return
      }

      // Use batch endpoint for multiple playlists, single endpoint for one
      let result
      if (numericIds.length === 1) {
        result = await adminChangePlaylistVisibility(numericIds[0], isPublic)
      } else {
        result = await adminBatchChangePlaylistVisibility(numericIds, isPublic)
      }

      if (result.success) {
        setSelectedRowKeys([])
        await fetchData()
        const visibilityText = isPublic ? 'public' : 'private'
        const updatedCount = (result as any).updated_count || numericIds.length
        if (onSuccess) {
          onSuccess(
            'Visibility Updated',
            `Successfully changed ${updatedCount} playlist${updatedCount === 1 ? '' : 's'} to ${visibilityText}.`
          )
        } else {
          message.success(`${updatedCount} playlist${updatedCount === 1 ? '' : 's'} changed to ${visibilityText}`)
        }
      } else {
        const errorMsg = (result as any).error || 'Failed to change playlist visibility'
        if (onError) {
          onError('Update Failed', errorMsg)
        } else {
          message.error(errorMsg)
        }
      }
    } catch (error) {
      console.error('Error changing playlist visibility:', error)
      const errorMsg = error instanceof Error ? error.message : 'An error occurred while changing visibility'
      if (onError) {
        onError('Visibility Change Error', errorMsg)
      } else {
        message.error(errorMsg)
      }
    }
  }

  return {
    data,
    loading,
    exportLoading,
    searchText,
    searchColumn,
    dateRange,
    visibilityFilter,
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
    handleVisibilityFilter,
    handleTypeFilter,
    handleDelete,
    handlePageChange,
    handleExport,
    handleSortChange,
    handleChangeVisibility,
  }
}

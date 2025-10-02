# Playlist Page Implementation Guide

This document provides a comprehensive guide to implementing the Playlist page in the admin panel, based on the existing Contact and Waitlist page implementations.

---

## 📋 Table of Contents

1. [Database Schema](#database-schema)
2. [Playlist Page Specifications](#playlist-page-specifications)
3. [Step-by-Step Implementation](#step-by-step-implementation)
4. [Testing Checklist](#testing-checklist)

---

## 📊 Database Schema

```sql
CREATE TABLE IF NOT EXISTS playlists (
    id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    uuid        VARCHAR(36) NOT NULL UNIQUE,
    user_id     CHAR(36),                         -- nullable (anon)
    name        VARCHAR(150) NOT NULL,
    is_public   TINYINT(1) DEFAULT 0,
    type        ENUM('custom','similarity','waiting_segments') DEFAULT 'custom',
    seed_track_id BIGINT UNSIGNED,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (seed_track_id) REFERENCES tracks(id) ON DELETE SET NULL,
    KEY idx_playlist_user (user_id),
    KEY idx_playlist_uuid (uuid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

---

## 🔄 Playlist Page Specifications

### UI Components

**Table Columns:**
- UUID
- Name
- Type (custom | similarity | waiting_segments)
- Visibility (Public | Private)
- Created At

**View Details Modal:**
- ID
- UUID
- User ID
- Name
- Type
- Visibility
- Seed Track ID
- Created At

**Search Columns:**
- ID
- UUID
- Name

**Filter Options:**

1. **Visibility Filter:**
   - All
   - Public
   - Private

2. **Type Filter:**
   - All
   - Custom
   - Similarity
   - Waiting Segments

**Actions:**
- View Details
- Delete (single or bulk)

**Additional Features:**
- Date range filter
- Export CSV
- Refresh
- Clear filters
- Total count
- Pagination
- Sorting (ID, Created At)

---

## 🚀 Step-by-Step Implementation

### Step 1: Create API Client Types & Functions

**File**: `packages/api-client/src/admin/playlist.ts`

```typescript
import axiosInstance, { axiosWrapper, handleApiError } from "../utils";
import { API_CONFIG } from "../config";

// ─── Types ─────────────────────────────────────────────────

export interface PlaylistItem {
  id: number;
  uuid: string;
  user_id: string | null;
  name: string;
  is_public: boolean;
  type: 'custom' | 'similarity' | 'waiting_segments';
  seed_track_id: number | null;
  created_at: string; // ISO datetime string
}

export interface PlaylistListParams {
  page?: number;
  page_size?: number;
  search?: string;
  search_column?: 'id' | 'uuid' | 'name';
  visibility?: 'public' | 'private' | 'all';
  type?: 'custom' | 'similarity' | 'waiting_segments' | 'all';
  date_from?: string; // YYYY-MM-DD
  date_to?: string; // YYYY-MM-DD
  sort_by?: 'id' | 'created_at';
  sort_order?: 'asc' | 'desc';
}

export interface PlaylistListResponse {
  success: boolean;
  data: PlaylistItem[];
  pagination: {
    page: number;
    page_size: number;
    total: number;
    total_pages: number;
  };
}

export interface PlaylistDeleteResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export interface PlaylistBatchDeleteResponse {
  success: boolean;
  deleted_count: number;
  message?: string;
  error?: string;
}

export interface PlaylistExportResponse {
  success: boolean;
  download_url: string;
  filename: string;
  expires_at: string;
  error?: string;
}

// ─── API Functions ─────────────────────────────────────────

/**
 * Get paginated list of playlists with filtering and search
 */
export const getPlaylistList = async (params: PlaylistListParams = {}) => {
  try {
    const queryParams: Record<string, any> = {
      page: params.page || 1,
      page_size: params.page_size || 30,
    };

    // Add optional filters
    if (params.search) queryParams.search = params.search;
    if (params.search_column) queryParams.search_column = params.search_column;
    if (params.visibility && params.visibility !== 'all') {
      queryParams.is_public = params.visibility === 'public' ? '1' : '0';
    }
    if (params.type && params.type !== 'all') queryParams.type = params.type;
    if (params.date_from) queryParams.date_from = params.date_from;
    if (params.date_to) queryParams.date_to = params.date_to;
    if (params.sort_by) queryParams.sort_by = params.sort_by;
    if (params.sort_order) queryParams.sort_order = params.sort_order;

    const data = await axiosWrapper<PlaylistListResponse>(
      axiosInstance.get(API_CONFIG.ENDPOINTS.ADMIN_PLAYLIST_LIST, { params: queryParams })
    );

    if (data.success) return data;
    
    return {
      success: false,
      error: (data as any).error || "Failed to fetch playlists.",
      data: [],
      pagination: { page: 1, page_size: 30, total: 0, total_pages: 0 },
    };
  } catch (error) {
    return {
      ...handleApiError(error as any),
      data: [],
      pagination: { page: 1, page_size: 30, total: 0, total_pages: 0 },
    };
  }
};

/**
 * Delete a single playlist by ID
 */
export const deletePlaylist = async (playlistId: number) => {
  try {
    const data = await axiosWrapper<{
      success: boolean;
      data?: { message: string };
      error?: string;
    }>(
      axiosInstance.delete(`${API_CONFIG.ENDPOINTS.ADMIN_PLAYLIST_DELETE}${playlistId}`)
    );

    if (data.success) {
      return {
        success: true,
        message: data.data?.message || "Playlist deleted successfully"
      };
    }
    
    return {
      success: false,
      error: (data as any).error || "Failed to delete playlist.",
    };
  } catch (error) {
    return handleApiError(error as any);
  }
};

/**
 * Delete multiple playlists in a batch
 */
export const batchDeletePlaylist = async (playlistIds: number[]) => {
  try {
    const data = await axiosWrapper<PlaylistBatchDeleteResponse>(
      axiosInstance.post(API_CONFIG.ENDPOINTS.ADMIN_PLAYLIST_BATCH_DELETE, {
        ids: playlistIds,
      })
    );

    if (data.success) return data;
    
    return {
      success: false,
      deleted_count: 0,
      error: (data as any).error || "Failed to delete playlists.",
    };
  } catch (error) {
    return {
      ...handleApiError(error as any),
      deleted_count: 0,
    };
  }
};

/**
 * Export playlist data (returns download URL to CSV file)
 */
export const exportPlaylist = async (
  format: 'csv',
  params: PlaylistListParams = {}
) => {
  try {
    const requestBody: Record<string, any> = {
      format,
    };

    // Add optional filters to the request body
    if (params.page) requestBody.page = params.page;
    if (params.page_size) requestBody.page_size = params.page_size;
    if (params.search) requestBody.search = params.search;
    if (params.search_column) requestBody.search_column = params.search_column;
    if (params.visibility && params.visibility !== 'all') {
      requestBody.is_public = params.visibility === 'public' ? '1' : '0';
    }
    if (params.type && params.type !== 'all') requestBody.type = params.type;
    if (params.date_from) requestBody.date_from = params.date_from;
    if (params.date_to) requestBody.date_to = params.date_to;
    if (params.sort_by) requestBody.sort_by = params.sort_by;
    if (params.sort_order) requestBody.sort_order = params.sort_order;

    const data = await axiosWrapper<PlaylistExportResponse>(
      axiosInstance.post(API_CONFIG.ENDPOINTS.ADMIN_PLAYLIST_EXPORT, requestBody)
    );

    if (data.success) return data;
    
    return {
      success: false,
      error: (data as any).error || "Failed to export playlists.",
      download_url: "",
      filename: "",
      expires_at: "",
    };
  } catch (error) {
    return {
      ...handleApiError(error as any),
      download_url: "",
      filename: "",
      expires_at: "",
    };
  }
};
```

---

### Step 2: Add API Endpoints to Config

**File**: `packages/api-client/src/config.ts`

Add to the `ENDPOINTS` interface:

```typescript
ADMIN_PLAYLIST_LIST: string;
ADMIN_PLAYLIST_DELETE: string;
ADMIN_PLAYLIST_BATCH_DELETE: string;
ADMIN_PLAYLIST_EXPORT: string;
```

Add to the `API_CONFIG` object:

```typescript
// Admin - Playlist endpoints
ADMIN_PLAYLIST_LIST: "/admin/playlist/",
ADMIN_PLAYLIST_DELETE: "/admin/playlist/delete/",
ADMIN_PLAYLIST_BATCH_DELETE: "/admin/playlist/batch-delete",
ADMIN_PLAYLIST_EXPORT: "/admin/playlist/export",
```

---

### Step 3: Export from API Client Index

**File**: `packages/api-client/src/index.ts`

Add:

```typescript
export * from "./admin/playlist";
```

---

### Step 4: Create Playlist Data Hook

**File**: `apps/admin/src/hooks/usePlaylist.ts`

```typescript
import { useState, useEffect, useCallback } from 'react'
import { 
  getPlaylistList, 
  deletePlaylist as apiDeletePlaylist,
  batchDeletePlaylist as apiBatchDeletePlaylist,
  exportPlaylist,
  apiAxiosInstance,
  type PlaylistItem as ApiPlaylistItem,
  type PlaylistListParams
} from '@resomix/api-client'
import { message } from 'antd'

export interface PlaylistItem {
  id: string
  uuid: string
  user_id: string | null
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
  }
}
```

---

### Step 5: Create Playlist Table Component

**File**: `apps/admin/src/components/playlist/PlaylistTable.tsx`

```typescript
import { useState } from 'react'
import { Table, Tag, Dropdown, Button, App, Modal } from 'antd'
import type { TableColumnsType, MenuProps } from 'antd'
import { Trash2, MoreVertical, Eye, Lock, Unlock } from 'lucide-react'
import type { PlaylistItem } from '@/hooks/usePlaylist.ts'
import { useConfirmDialog } from '@resomix/hooks'

interface PlaylistTableProps {
  data: PlaylistItem[]
  loading: boolean
  selectedRowKeys: string[]
  pagination: {
    current: number
    pageSize: number
    total: number
  }
  sortBy?: 'id' | 'created_at'
  sortOrder?: 'asc' | 'desc'
  onSelectionChange: (keys: string[]) => void
  onDelete: (ids: string[]) => void
  onPageChange: (page: number, pageSize: number) => void
  onSortChange: (sortBy: 'id' | 'created_at' | undefined, sortOrder: 'asc' | 'desc' | undefined) => void
}

function PlaylistTable({
  data,
  loading,
  selectedRowKeys,
  pagination,
  sortBy,
  sortOrder,
  onSelectionChange,
  onDelete,
  onPageChange,
  onSortChange,
}: PlaylistTableProps) {
  const { modal } = App.useApp()
  const { confirmDelete } = useConfirmDialog()
  const [viewingPlaylist, setViewingPlaylist] = useState<PlaylistItem | null>(null)

  const handleDeleteSingle = (record: PlaylistItem) => {
    confirmDelete({
      title: 'Delete Playlist',
      content: (
        <div>
          <p>Are you sure you want to delete this playlist?</p>
          <p className="mt-2 text-sm text-secondary">
            <strong>Name:</strong> {record.name}
          </p>
          <p className="mt-1 text-sm text-secondary">
            <strong>UUID:</strong> {record.uuid}
          </p>
          <p className="mt-2 text-sm text-red-600">This action cannot be undone.</p>
        </div>
      ),
      onOk: async () => {
        await onDelete([record.id])
      },
    })
  }

  const handleViewPlaylist = (record: PlaylistItem) => {
    setViewingPlaylist(record)
  }

  const handleClosePlaylistModal = () => {
    setViewingPlaylist(null)
  }

  const getActionMenu = (record: PlaylistItem): MenuProps['items'] => [
    {
      key: 'view-playlist',
      label: 'View Details',
      icon: <Eye size={16} />,
      onClick: () => handleViewPlaylist(record),
    },
    {
      type: 'divider',
    },
    {
      key: 'delete',
      label: 'Delete',
      icon: <Trash2 size={16} />,
      danger: true,
      onClick: () => handleDeleteSingle(record),
    },
  ]

  const handleTableChange = (_pagination: any, _filters: any, sorter: any) => {
    if (sorter.columnKey) {
      const order = sorter.order === 'ascend' ? 'asc' : sorter.order === 'descend' ? 'desc' : undefined
      onSortChange(sorter.columnKey, order)
    } else {
      onSortChange(undefined, undefined)
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'custom':
        return 'blue'
      case 'similarity':
        return 'purple'
      case 'waiting_segments':
        return 'orange'
      default:
        return 'default'
    }
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'custom':
        return 'Custom'
      case 'similarity':
        return 'Similarity'
      case 'waiting_segments':
        return 'Waiting Segments'
      default:
        return type
    }
  }

  const columns: TableColumnsType<PlaylistItem> = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
      sorter: true,
      sortOrder: sortBy === 'id' ? (sortOrder === 'asc' ? 'ascend' : 'descend') : null,
      render: (id: string) => (
        <span className="font-mono text-sm text-primary">{id}</span>
      ),
    },
    {
      title: 'UUID',
      dataIndex: 'uuid',
      key: 'uuid',
      width: 200,
      render: (uuid: string) => (
        <span className="font-mono text-xs text-secondary">{uuid}</span>
      ),
    },
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      width: 250,
      render: (name: string) => (
        <span className="text-primary font-medium">{name}</span>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      width: 150,
      render: (type: string) => (
        <Tag color={getTypeColor(type)}>
          {getTypeLabel(type)}
        </Tag>
      ),
    },
    {
      title: 'Visibility',
      dataIndex: 'is_public',
      key: 'is_public',
      width: 120,
      render: (is_public: boolean) => (
        <Tag color={is_public ? 'green' : 'default'} icon={is_public ? <Unlock size={12} /> : <Lock size={12} />}>
          {is_public ? 'Public' : 'Private'}
        </Tag>
      ),
    },
    {
      title: 'Created',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      sorter: true,
      sortOrder: sortBy === 'created_at' ? (sortOrder === 'asc' ? 'ascend' : 'descend') : null,
      render: (created_at: string) => (
        <span className="text-secondary text-sm">
          {new Date(created_at).toLocaleString()}
        </span>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 80,
      align: 'center',
      render: (_, record) => (
        <Dropdown
          menu={{ items: getActionMenu(record) }}
          placement="bottomRight"
          trigger={['click']}
        >
          <Button
            type="text"
            icon={<MoreVertical size={16} />}
            className="hover:bg-gray-100 dark:hover:bg-gray-800"
          />
        </Dropdown>
      ),
    },
  ]

  const rowSelection = {
    selectedRowKeys,
    onChange: (keys: React.Key[]) => {
      onSelectionChange(keys as string[])
    },
  }

  return (
    <>
      <Table
        columns={columns}
        dataSource={data}
        rowKey="id"
        loading={loading}
        rowSelection={rowSelection}
        onChange={handleTableChange}
        pagination={{
          current: pagination.current,
          pageSize: pagination.pageSize,
          total: pagination.total,
          showSizeChanger: true,
          showTotal: (total, range) => (
            <span className="text-secondary">
              {selectedRowKeys.length > 0 && (
                <span className="text-primary font-medium mr-4">
                  {selectedRowKeys.length} selected
                </span>
              )}
              {range[0]}-{range[1]} of {total} items
            </span>
          ),
          pageSizeOptions: ['10', '20', '30', '50', '100'],
          onChange: onPageChange,
        }}
        scroll={{ x: 1000 }}
      />

      {/* View Playlist Modal */}
      <Modal
        title={
          <div className="flex items-center gap-4">
            <span>Playlist Details</span>
            {viewingPlaylist && (
              <>
                <Tag color={getTypeColor(viewingPlaylist.type)}>
                  {getTypeLabel(viewingPlaylist.type)}
                </Tag>
                <Tag 
                  color={viewingPlaylist.is_public ? 'green' : 'default'} 
                  icon={viewingPlaylist.is_public ? <Unlock size={12} /> : <Lock size={12} />}
                >
                  {viewingPlaylist.is_public ? 'Public' : 'Private'}
                </Tag>
              </>
            )}
          </div>
        }
        open={viewingPlaylist !== null}
        onCancel={handleClosePlaylistModal}
        centered
        width={600}
        footer={[
          <Button key="close" onClick={handleClosePlaylistModal}>
            Close
          </Button>,
        ]}
      >
        {viewingPlaylist && (
          <div className="space-y-4">
            {/* Playlist details */}
            <div className="grid grid-cols-2 gap-4 p-4 rounded-lg" style={{ backgroundColor: 'var(--color-background-secondary)' }}>
              <div>
                <p className="text-sm text-secondary">ID</p>
                <p className="font-mono text-sm text-primary">{viewingPlaylist.id}</p>
              </div>
              <div className="col-span-2">
                <p className="text-sm text-secondary">UUID</p>
                <p className="font-mono text-xs text-primary break-all">{viewingPlaylist.uuid}</p>
              </div>
              <div className="col-span-2">
                <p className="text-sm text-secondary">Name</p>
                <p className="text-primary font-medium">{viewingPlaylist.name}</p>
              </div>
              {viewingPlaylist.user_id && (
                <div className="col-span-2">
                  <p className="text-sm text-secondary">User ID</p>
                  <p className="font-mono text-xs text-primary break-all">{viewingPlaylist.user_id}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-secondary">Type</p>
                <Tag color={getTypeColor(viewingPlaylist.type)}>
                  {getTypeLabel(viewingPlaylist.type)}
                </Tag>
              </div>
              <div>
                <p className="text-sm text-secondary">Visibility</p>
                <Tag 
                  color={viewingPlaylist.is_public ? 'green' : 'default'} 
                  icon={viewingPlaylist.is_public ? <Unlock size={12} /> : <Lock size={12} />}
                >
                  {viewingPlaylist.is_public ? 'Public' : 'Private'}
                </Tag>
              </div>
              {viewingPlaylist.seed_track_id && (
                <div>
                  <p className="text-sm text-secondary">Seed Track ID</p>
                  <p className="font-mono text-sm text-primary">{viewingPlaylist.seed_track_id}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-secondary">Created At</p>
                <p className="text-primary text-sm">
                  {new Date(viewingPlaylist.created_at).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}

export default PlaylistTable
```

---

### Step 6: Create Playlist Table Controls Component

**File**: `apps/admin/src/components/playlist/PlaylistTableControls.tsx`

```typescript
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
      <div className="flex flex-wrap gap-2 justify-between items-center">
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
```

---

### Step 7: Create Playlist Page

**File**: `apps/admin/src/pages/PlaylistPage.tsx`

```typescript
import { App } from 'antd'
import { usePlaylist } from '@/hooks/usePlaylist.ts'
import PlaylistTableControls from '@/components/playlist/PlaylistTableControls.tsx'
import PlaylistTable from '@/components/playlist/PlaylistTable.tsx'
import { useStatusModals, useConfirmDialog } from '@resomix/hooks'
import { StatusModal } from '@resomix/ui'

function PlaylistPage() {
  // Use reusable hooks
  const {
    errorModalVisible,
    errorDetails,
    showErrorModal,
    closeErrorModal,
    successModalVisible,
    successDetails,
    showSuccessModal,
    closeSuccessModal,
  } = useStatusModals()
  
  const { confirmDelete } = useConfirmDialog()

  const {
    data,
    loading,
    exportLoading,
    searchText,
    searchColumn,
    dateRange,
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
  } = usePlaylist({
    onError: showErrorModal,
    onSuccess: showSuccessModal
  })

  const handleDeleteSelected = () => {
    if (selectedRowKeys.length === 0) return

    confirmDelete({
      title: 'Delete Selected Playlists',
      content: (
        <div>
          <p>Are you sure you want to delete {selectedRowKeys.length} selected playlist(s)?</p>
          <p className="mt-2 text-sm text-red-600">This action cannot be undone.</p>
        </div>
      ),
      onOk: async () => {
        await handleDelete(selectedRowKeys)
      },
    })
  }

  return (
    <div>
      <h1 className="text-2xl md:text-3xl font-bold mb-4 md:mb-6 text-primary">Playlists</h1>

      <div className="bg-surface rounded-lg shadow border border-default transition-colors p-3 md:p-6">
        {/* Table Controls */}
        <PlaylistTableControls
          searchText={searchText}
          searchColumn={searchColumn}
          dateRange={dateRange}
          selectedCount={selectedRowKeys.length}
          totalCount={pagination.total}
          exportLoading={exportLoading}
          onSearch={handleSearch}
          onSearchColumnChange={handleSearchColumnChange}
          onDateRangeChange={handleDateRangeChange}
          onVisibilityFilter={handleVisibilityFilter}
          onTypeFilter={handleTypeFilter}
          onRefresh={handleRefresh}
          onClearFilters={handleClearFilters}
          onExport={handleExport}
          onDeleteSelected={handleDeleteSelected}
        />

        {/* Data Table */}
        <PlaylistTable
          data={data}
          loading={loading}
          selectedRowKeys={selectedRowKeys}
          pagination={pagination}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSelectionChange={setSelectedRowKeys}
          onDelete={handleDelete}
          onPageChange={handlePageChange}
          onSortChange={handleSortChange}
        />
      </div>

      {/* Status Modals - Reusable Components */}
      <StatusModal
        type="error"
        visible={errorModalVisible}
        title={errorDetails?.title || 'Error'}
        message={errorDetails?.message || ''}
        onClose={closeErrorModal}
      />
      
      <StatusModal
        type="success"
        visible={successModalVisible}
        title={successDetails?.title || 'Success'}
        message={successDetails?.message || ''}
        onClose={closeSuccessModal}
      />
    </div>
  )
}

export default function PlaylistPageWrapper() {
  return (
    <App>
      <PlaylistPage />
    </App>
  )
}
```

---

### Step 8: Add Route to Admin App

**File**: `apps/admin/src/App.tsx`

Add the import:

```typescript
import PlaylistPage from '@/pages/PlaylistPage'
```

Add the route:

```typescript
{
  path: '/playlists',
  element: <PlaylistPage />,
},
```

---

### Step 9: Add Navigation Link

**File**: `apps/admin/src/components/Sidebar.tsx`

Add:

```typescript
import { ListMusic } from 'lucide-react' // or appropriate icon

{
  key: 'playlists',
  icon: <ListMusic size={20} />,
  label: <Link to="/playlists">Playlists</Link>,
},
```

---

## 🧪 Testing Checklist

### Backend Testing

- [ ] `GET /admin/playlist/` returns paginated list
- [ ] Search works for: id, uuid, name
- [ ] Visibility filter works: all, public, private
- [ ] Type filter works: all, custom, similarity, waiting_segments
- [ ] Date range filter works
- [ ] Sorting works: id (asc/desc), created_at (asc/desc)
- [ ] `DELETE /admin/playlist/delete/:id` deletes single entry
- [ ] `POST /admin/playlist/batch-delete` deletes multiple entries
- [ ] `POST /admin/playlist/export` generates CSV with filters

### Frontend Testing

- [ ] Table displays: ID, UUID, Name, Type, Visibility, Created At
- [ ] Sorting works on ID and Created At columns
- [ ] Row selection works
- [ ] Action dropdown shows: View Details, Delete
- [ ] View Details modal shows all fields
- [ ] Delete single entry works with confirmation
- [ ] Delete bulk entries works with confirmation
- [ ] Search works for: id, uuid, name
- [ ] Search column dropdown changes without reload
- [ ] Visibility filter triggers API call (Public/Private)
- [ ] Type filter triggers API call (Custom/Similarity/Waiting Segments)
- [ ] Date range filter works
- [ ] Total count displays correctly
- [ ] Export CSV works and downloads file
- [ ] Export loading state works
- [ ] Success modals display for: delete, export
- [ ] Error modals display for API errors
- [ ] Clear filters resets everything (including both dropdowns)
- [ ] Refresh reloads data
- [ ] Pagination works
- [ ] Type tags display correct colors (blue/purple/orange)
- [ ] Visibility icons display correctly (Lock/Unlock)

---

## 📝 Summary

This implementation provides:

✅ **Complete CRUD operations** for playlists (read & delete)
✅ **Advanced filtering** (search, visibility, type, date range)
✅ **Sorting** (ID, Created At)
✅ **Bulk actions** (delete multiple)
✅ **CSV export** with current filters
✅ **Reusable components** (modals, hooks, confirmations)
✅ **Consistent UX** with Contact, Feedback, and Waitlist pages
✅ **Type safety** throughout
✅ **Error handling** with proper modals
✅ **Loading states** for better UX
✅ **Two-filter system** (Visibility + Type)
✅ **Color-coded tags** for playlist types
✅ **Icons for visibility** (Lock/Unlock)

The Playlist page will have the exact same look and feel as the Contact and Waitlist pages, with playlist-specific fields and dual-filter functionality! 
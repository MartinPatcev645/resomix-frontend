# Contact Page Implementation Guide

This document provides a comprehensive guide to implementing the Contact page in the admin panel, based on the existing Feedback page implementation.

---

## 📋 Table of Contents

1. [Feedback Implementation Overview](#feedback-implementation-overview)
2. [Contact vs Feedback Differences](#contact-vs-feedback-differences)
3. [Step-by-Step Implementation](#step-by-step-implementation)
4. [Testing Checklist](#testing-checklist)

---

## 📊 Feedback Implementation Overview

### Database Schema

```sql
CREATE TABLE IF NOT EXISTS feedback (
    id        BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id   CHAR(36),
    category  VARCHAR(50),
    message   TEXT,
    satisfaction INT UNSIGNED,
    recommendation INT UNSIGNED,
    status    ENUM('open','resolved') DEFAULT 'open',
    submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    KEY idx_fb_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### Architecture Layers

The Feedback page implementation consists of 6 main layers:

#### 1. **API Client Layer** (`packages/api-client/src/admin/feedback.ts`)
- Types: `FeedbackItem`, `FeedbackListParams`, `FeedbackListResponse`
- Functions: `getFeedbackList()`, `deleteFeedback()`, `batchDeleteFeedback()`, `markFeedbackStatus()`, `exportFeedback()`
- Handles all HTTP requests to backend
- Returns typed responses

#### 2. **Data Hook Layer** (`apps/admin/src/hooks/useFeedback.ts`)
- Custom hook: `useFeedback(options)`
- Manages state: data, loading, pagination, filters, sorting
- Provides handlers: `handleDelete`, `handleMarkStatus`, `handleExport`, `handleSearch`, etc.
- Accepts callbacks: `onError`, `onSuccess` for modal integration
- Handles data conversion from API to frontend format

#### 3. **UI Components Layer**
- **FeedbackTable** (`apps/admin/src/components/feedback/FeedbackTable.tsx`)
  - Displays data in sortable table
  - Handles row selection
  - Action dropdown per row (View, Mark Status, Delete)
  - View message modal
  
- **FeedbackTableControls** (`apps/admin/src/components/feedback/FeedbackTableControls.tsx`)
  - Search input with column selector
  - Date range picker
  - Status filter dropdown
  - Total count display
  - Action buttons (Refresh, Clear Filters, Export CSV, Delete Selected)

#### 4. **Page Layer** (`apps/admin/src/pages/FeedbackPage.tsx`)
- Orchestrates all components
- Manages status modals (success/error)
- Handles bulk delete confirmations
- Wraps everything with `App` provider

#### 5. **Reusable Components** (from `@resomix/hooks` and `@resomix/ui`)
- `useStatusModals()` - Manages success/error modal states
- `useConfirmDialog()` - Provides confirmation dialogs
- `StatusModal` - Reusable modal component

#### 6. **Backend API Endpoints**
- `GET /admin/feedback/` - List with pagination, filters, sorting
- `DELETE /admin/feedback/delete/:id` - Delete single item
- `POST /admin/feedback/batch-delete` - Delete multiple items
- `POST /admin/feedback/mark-status/:id` - Update status
- `POST /admin/feedback/export` - Generate CSV export

### Key Features

✅ **Table Features**
- Sortable columns (ID, Satisfaction, Recommendation, Submitted At)
- Row selection with bulk actions
- Action dropdown per row
- View message modal with all details
- Responsive design

✅ **Filtering & Search**
- Search by: Message, ID
- Filter by: Status (Open/Resolved)
- Date range filter
- Total count display

✅ **Actions**
- Mark as Open/Resolved (single)
- Delete (single or bulk)
- Export to CSV with current filters
- View message details

✅ **User Experience**
- Loading states on all actions
- Success/Error modals for feedback
- Confirmation dialogs for destructive actions
- Proper error handling
- Authenticated file downloads

---

## 🔄 Contact vs Feedback Differences

### Database Schema Comparison

| Field | Feedback | Contact |
|-------|----------|---------|
| `id` | ✓ | ✓ |
| `user_id` | ✓ | ✓ |
| `category` | ✓ | ✗ |
| `satisfaction` | ✓ | ✗ |
| `recommendation` | ✓ | ✗ |
| `name` | ✗ | ✓ |
| `email` | ✗ | ✓ |
| `subject` | ✗ | ✓ |
| `phone` | ✗ | ✓ |
| `message` | ✓ | ✓ |
| `status` | ✓ | ✓ |
| `submitted_at` | ✓ | ✓ |

### UI Differences

**Table Columns:**
- **Feedback**: ID, Satisfaction, Recommendation, Submitted At, Status
- **Contact**: ID, Email, Submitted At, Status

**View Details Modal:**
- **Feedback**: ID, Satisfaction, Recommendation, Category, Submitted At, Message
- **Contact**: ID, Name, Email, Phone, Subject, Submitted At, Message

**Search Columns:**
- **Feedback**: Message, ID
- **Contact**: Message, ID, Email, Name

---

## 🚀 Step-by-Step Implementation

### Step 1: Create API Client Types & Functions

**File**: `packages/api-client/src/admin/contact.ts`

```typescript
import axiosInstance, { axiosWrapper, handleApiError } from "../utils";
import { API_CONFIG } from "../config";

// ─── Types ─────────────────────────────────────────────────

export interface ContactItem {
  id: number;
  user_id: string | null;
  name: string | null;
  email: string | null;
  subject: string | null;
  phone: string | null;
  message: string | null;
  status: 'open' | 'resolved';
  submitted_at: string; // ISO datetime string
}

export interface ContactListParams {
  page?: number;
  page_size?: number;
  search?: string;
  search_column?: 'user_id' | 'name' | 'email' | 'message' | 'id';
  status?: 'open' | 'resolved' | 'all';
  date_from?: string; // YYYY-MM-DD
  date_to?: string; // YYYY-MM-DD
  sort_by?: 'id' | 'submitted_at';
  sort_order?: 'asc' | 'desc';
}

export interface ContactListResponse {
  success: boolean;
  data: ContactItem[];
  pagination: {
    page: number;
    page_size: number;
    total: number;
    total_pages: number;
  };
}

export interface ContactDeleteResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export interface ContactBatchDeleteResponse {
  success: boolean;
  deleted_count: number;
  message?: string;
  error?: string;
}

export interface ContactUpdateResponse {
  success: boolean;
  data?: ContactItem;
  message?: string;
  error?: string;
}

export interface ContactExportResponse {
  success: boolean;
  download_url: string;
  filename: string;
  expires_at: string;
  error?: string;
}

// ─── API Functions ─────────────────────────────────────────

/**
 * Get paginated list of contact submissions with filtering and search
 */
export const getContactList = async (params: ContactListParams = {}) => {
  try {
    const queryParams: Record<string, any> = {
      page: params.page || 1,
      page_size: params.page_size || 30,
    };

    // Add optional filters
    if (params.search) queryParams.search = params.search;
    if (params.search_column) queryParams.search_column = params.search_column;
    if (params.status && params.status !== 'all') queryParams.status = params.status;
    if (params.date_from) queryParams.date_from = params.date_from;
    if (params.date_to) queryParams.date_to = params.date_to;
    if (params.sort_by) queryParams.sort_by = params.sort_by;
    if (params.sort_order) queryParams.sort_order = params.sort_order;

    const data = await axiosWrapper<ContactListResponse>(
      axiosInstance.get(API_CONFIG.ENDPOINTS.ADMIN_CONTACT_LIST, { params: queryParams })
    );

    if (data.success) return data;
    
    return {
      success: false,
      error: (data as any).error || "Failed to fetch contact list.",
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
 * Delete a single contact entry by ID
 */
export const deleteContact = async (contactId: number) => {
  try {
    const data = await axiosWrapper<{
      success: boolean;
      data?: { message: string };
      error?: string;
    }>(
      axiosInstance.delete(`${API_CONFIG.ENDPOINTS.ADMIN_CONTACT_DELETE}${contactId}`)
    );

    if (data.success) {
      return {
        success: true,
        message: data.data?.message || "Contact deleted successfully"
      };
    }
    
    return {
      success: false,
      error: (data as any).error || "Failed to delete contact.",
    };
  } catch (error) {
    return handleApiError(error as any);
  }
};

/**
 * Delete multiple contact entries in a batch
 */
export const batchDeleteContact = async (contactIds: number[]) => {
  try {
    const data = await axiosWrapper<ContactBatchDeleteResponse>(
      axiosInstance.post(API_CONFIG.ENDPOINTS.ADMIN_CONTACT_BATCH_DELETE, {
        ids: contactIds,
      })
    );

    if (data.success) return data;
    
    return {
      success: false,
      deleted_count: 0,
      error: (data as any).error || "Failed to delete contact entries.",
    };
  } catch (error) {
    return {
      ...handleApiError(error as any),
      deleted_count: 0,
    };
  }
};

/**
 * Mark contact as open or resolved
 */
export const markContactStatus = async (contactId: number, status: 'open' | 'resolved') => {
  try {
    const data = await axiosWrapper<ContactUpdateResponse>(
      axiosInstance.post(`${API_CONFIG.ENDPOINTS.ADMIN_CONTACT_MARK_STATUS}${contactId}`, {
        status,
      })
    );

    if (data.success) return data;
    
    return {
      success: false,
      error: (data as any).error || "Failed to update contact status.",
    };
  } catch (error) {
    return handleApiError(error as any);
  }
};

/**
 * Export contact data (returns download URL to CSV file)
 */
export const exportContact = async (
  format: 'csv',
  params: ContactListParams = {}
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
    if (params.status && params.status !== 'all') requestBody.status = params.status;
    if (params.date_from) requestBody.date_from = params.date_from;
    if (params.date_to) requestBody.date_to = params.date_to;
    if (params.sort_by) requestBody.sort_by = params.sort_by;
    if (params.sort_order) requestBody.sort_order = params.sort_order;

    const data = await axiosWrapper<ContactExportResponse>(
      axiosInstance.post(API_CONFIG.ENDPOINTS.ADMIN_CONTACT_EXPORT, requestBody)
    );

    if (data.success) return data;
    
    return {
      success: false,
      error: (data as any).error || "Failed to export contact.",
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
ADMIN_CONTACT_LIST: string;
ADMIN_CONTACT_DELETE: string;
ADMIN_CONTACT_BATCH_DELETE: string;
ADMIN_CONTACT_UPDATE: string;
ADMIN_CONTACT_MARK_STATUS: string;
ADMIN_CONTACT_EXPORT: string;
```

Add to the `API_CONFIG` object:

```typescript
// Admin endpoints
ADMIN_CONTACT_LIST: "/admin/contact/",
ADMIN_CONTACT_DELETE: "/admin/contact/delete/",
ADMIN_CONTACT_BATCH_DELETE: "/admin/contact/batch-delete",
ADMIN_CONTACT_UPDATE: "/admin/contact/update/",
ADMIN_CONTACT_MARK_STATUS: "/admin/contact/mark-status/",
ADMIN_CONTACT_EXPORT: "/admin/contact/export",
```

---

### Step 3: Export from API Client Index

**File**: `packages/api-client/src/index.ts`

Add:

```typescript
export * from "./admin/contact";
```

---

### Step 4: Create Contact Data Hook

**File**: `apps/admin/src/hooks/useContact.ts`

```typescript
import { useState, useEffect, useCallback } from 'react'
import { 
  getContactList, 
  deleteContact as apiDeleteContact,
  batchDeleteContact as apiBatchDeleteContact,
  markContactStatus,
  exportContact,
  apiAxiosInstance,
  type ContactItem as ApiContactItem,
  type ContactListParams
} from '@resomix/api-client'
import { message } from 'antd'

export interface ContactItem {
  id: string
  name: string | null
  email: string | null
  subject: string | null
  phone: string | null
  message: string | null
  status: 'open' | 'resolved'
  submitted_at: string
  user_id: string | null
}

// Convert API response to frontend format
const convertApiContact = (apiData: ApiContactItem): ContactItem => ({
  id: String(apiData.id),
  name: apiData.name,
  email: apiData.email,
  subject: apiData.subject,
  phone: apiData.phone,
  message: apiData.message,
  status: apiData.status,
  submitted_at: apiData.submitted_at,
  user_id: apiData.user_id,
})

interface UseContactOptions {
  onError?: (title: string, message: string) => void
  onSuccess?: (title: string, message: string) => void
}

export function useContact(options?: UseContactOptions) {
  const { onError, onSuccess } = options || {}
  const [data, setData] = useState<ContactItem[]>([])
  const [searchText, setSearchText] = useState('')
  const [searchColumn, setSearchColumn] = useState<keyof ContactItem>('message')
  const [dateRange, setDateRange] = useState<[string, string] | null>(null)
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'resolved'>('all')
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

      console.log('Fetching contact with params:', params)

      const result = await getContactList(params)
      
      if (result.success && result.data) {
        setData(result.data.map(convertApiContact))
        setPagination(prev => ({
          ...prev,
          total: result.pagination.total,
        }))
      } else {
        const errorMsg = (result as any).error || 'Failed to fetch contact submissions'
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
    setSearchColumn('message')
    setDateRange(null)
    setStatusFilter('all')
    setSelectedRowKeys([])
    setSortBy(undefined)
    setSortOrder(undefined)
    setPagination(prev => ({ ...prev, current: 1 }))
  }

  const handleStatusFilter = (status: 'all' | 'open' | 'resolved') => {
    setStatusFilter(status)
    setPagination(prev => ({ ...prev, current: 1 }))
  }

  const handleSearch = (value: string, column: keyof ContactItem) => {
    setSearchColumn(column)
    setSearchText(value)
    setPagination(prev => ({ ...prev, current: 1 }))
  }

  const handleSearchColumnChange = (column: keyof ContactItem) => {
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
          const errorMsg = (result as any).error || 'Failed to delete contact'
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
          const errorMsg = (result as any).error || 'Failed to delete contact'
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
        const errorMsg = (result as any).error || 'Failed to update status'
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
```

---

### Step 5: Create Contact Table Component

**File**: `apps/admin/src/components/contact/ContactTable.tsx`

```typescript
import { useState } from 'react'
import { Table, Tag, Dropdown, Button, App, Modal, Input } from 'antd'
import type { TableColumnsType, MenuProps } from 'antd'
import { CheckCircle, XCircle, Trash2, MoreVertical, Eye } from 'lucide-react'
import type { ContactItem } from '@/hooks/useContact.ts'
import { useConfirmDialog } from '@resomix/hooks'

const { TextArea } = Input

interface ContactTableProps {
  data: ContactItem[]
  loading: boolean
  selectedRowKeys: string[]
  pagination: {
    current: number
    pageSize: number
    total: number
  }
  sortBy?: 'id' | 'submitted_at'
  sortOrder?: 'asc' | 'desc'
  onSelectionChange: (keys: string[]) => void
  onDelete: (ids: string[]) => void
  onMarkStatus: (id: string, status: 'open' | 'resolved') => void
  onPageChange: (page: number, pageSize: number) => void
  onSortChange: (sortBy: 'id' | 'submitted_at' | undefined, sortOrder: 'asc' | 'desc' | undefined) => void
}

function ContactTable({
  data,
  loading,
  selectedRowKeys,
  pagination,
  sortBy,
  sortOrder,
  onSelectionChange,
  onDelete,
  onMarkStatus,
  onPageChange,
  onSortChange,
}: ContactTableProps) {
  const { modal } = App.useApp()
  const { confirmDelete } = useConfirmDialog()
  const [viewingContact, setViewingContact] = useState<ContactItem | null>(null)

  const handleDeleteSingle = (record: ContactItem) => {
    confirmDelete({
      title: 'Delete Contact',
      content: (
        <div>
          <p>Are you sure you want to delete this contact submission?</p>
          {record.email && (
            <p className="mt-2 text-sm text-secondary">
              <strong>Email:</strong> {record.email}
            </p>
          )}
          <p className="mt-2 text-sm text-red-600">This action cannot be undone.</p>
        </div>
      ),
      onOk: async () => {
        await onDelete([record.id])
      },
    })
  }

  const handleMarkStatus = (record: ContactItem, newStatus: 'open' | 'resolved') => {
    const action = newStatus === 'resolved' ? 'resolve' : 'reopen'
    const icon = newStatus === 'resolved' ? '✓' : '↻'
    
    modal.confirm({
      title: `${icon} Mark as ${newStatus.charAt(0).toUpperCase() + newStatus.slice(1)}`,
      content: (
        <div>
          <p>Are you sure you want to {action} this contact submission?</p>
          {record.email && (
            <p className="mt-2 text-sm text-secondary">
              <strong>Email:</strong> {record.email}
            </p>
          )}
        </div>
      ),
      okText: 'Confirm',
      cancelText: 'Cancel',
      centered: true,
      onOk: async () => {
        await onMarkStatus(record.id, newStatus)
      },
    })
  }

  const handleViewContact = (record: ContactItem) => {
    setViewingContact(record)
  }

  const handleCloseContactModal = () => {
    setViewingContact(null)
  }

  const handleMarkStatusFromModal = async (status: 'open' | 'resolved') => {
    if (viewingContact) {
      await onMarkStatus(viewingContact.id, status)
      setViewingContact(null)
    }
  }

  const getActionMenu = (record: ContactItem): MenuProps['items'] => [
    {
      key: 'mark-status',
      label: record.status === 'open' ? 'Mark as Resolved' : 'Mark as Open',
      icon: record.status === 'open' ? <CheckCircle size={16} /> : <XCircle size={16} />,
      onClick: () => handleMarkStatus(record, record.status === 'open' ? 'resolved' : 'open'),
    },
    {
      key: 'view-contact',
      label: 'View Details',
      icon: <Eye size={16} />,
      onClick: () => handleViewContact(record),
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

  const columns: TableColumnsType<ContactItem> = [
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
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      width: 200,
      render: (email: string | null) => (
        <span className="text-secondary">
          {email || '-'}
        </span>
      ),
    },
    {
      title: 'Submitted',
      dataIndex: 'submitted_at',
      key: 'submitted_at',
      width: 180,
      sorter: true,
      sortOrder: sortBy === 'submitted_at' ? (sortOrder === 'asc' ? 'ascend' : 'descend') : null,
      render: (submitted_at: string) => (
        <span className="text-secondary text-sm">
          {new Date(submitted_at).toLocaleString()}
        </span>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: 'open' | 'resolved') => (
        <Tag color={status === 'open' ? 'orange' : 'green'}>
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </Tag>
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
        scroll={{ x: 800 }}
      />

      {/* View Contact Modal */}
      <Modal
        title={
          <div className="flex items-center gap-4">
            <span>Contact Details</span>
            {viewingContact && (
              <Tag color={viewingContact.status === 'open' ? 'orange' : 'green'}>
                {viewingContact.status.charAt(0).toUpperCase() + viewingContact.status.slice(1)}
              </Tag>
            )}
          </div>
        }
        open={viewingContact !== null}
        onCancel={handleCloseContactModal}
        centered
        width={600}
        footer={[
          <Button key="close" onClick={handleCloseContactModal}>
            Close
          </Button>,
          viewingContact && (
            <Button
              key="mark-status"
              type="primary"
              icon={viewingContact.status === 'open' ? <CheckCircle size={16} /> : <XCircle size={16} />}
              onClick={() => handleMarkStatusFromModal(viewingContact.status === 'open' ? 'resolved' : 'open')}
            >
              Mark as {viewingContact.status === 'open' ? 'Resolved' : 'Open'}
            </Button>
          ),
        ]}
      >
        {viewingContact && (
          <div className="space-y-4">
            {/* Contact details */}
            <div className="grid grid-cols-2 gap-4 p-4 rounded-lg" style={{ backgroundColor: 'var(--color-background-secondary)' }}>
              <div>
                <p className="text-sm text-secondary">ID</p>
                <p className="font-mono text-sm text-primary">{viewingContact.id}</p>
              </div>
              {viewingContact.name && (
                <div>
                  <p className="text-sm text-secondary">Name</p>
                  <p className="text-primary">{viewingContact.name}</p>
                </div>
              )}
              {viewingContact.email && (
                <div>
                  <p className="text-sm text-secondary">Email</p>
                  <p className="text-primary">{viewingContact.email}</p>
                </div>
              )}
              {viewingContact.phone && (
                <div>
                  <p className="text-sm text-secondary">Phone</p>
                  <p className="text-primary">{viewingContact.phone}</p>
                </div>
              )}
              {viewingContact.subject && (
                <div className="col-span-2">
                  <p className="text-sm text-secondary">Subject</p>
                  <p className="text-primary">{viewingContact.subject}</p>
                </div>
              )}
              {viewingContact.submitted_at && (
                <div>
                  <p className="text-sm text-secondary">Submitted</p>
                  <p className="text-primary text-sm">
                    {new Date(viewingContact.submitted_at).toLocaleString()}
                  </p>
                </div>
              )}
            </div>

            {/* Message */}
            <div>
              <p className="text-sm text-secondary mb-2">Message</p>
              <TextArea
                value={viewingContact.message || 'No message provided'}
                readOnly
                autoSize={{ minRows: 4, maxRows: 12 }}
                className="font-sans"
              />
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}

export default ContactTable
```

---

### Step 6: Create Contact Table Controls Component

**File**: `apps/admin/src/components/contact/ContactTableControls.tsx`

```typescript
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
```

---

### Step 7: Create Contact Page

**File**: `apps/admin/src/pages/ContactPage.tsx`

```typescript
import { App } from 'antd'
import { useContact } from '@/hooks/useContact.ts'
import ContactTableControls from '@/components/contact/ContactTableControls.tsx'
import ContactTable from '@/components/contact/ContactTable.tsx'
import { useStatusModals, useConfirmDialog } from '@resomix/hooks'
import { StatusModal } from '@resomix/ui'

function ContactPage() {
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
    handleStatusFilter,
    handleDelete,
    handleMarkStatus,
    handlePageChange,
    handleExport,
    handleSortChange,
  } = useContact({
    onError: showErrorModal,
    onSuccess: showSuccessModal
  })

  const handleDeleteSelected = () => {
    if (selectedRowKeys.length === 0) return

    confirmDelete({
      title: 'Delete Selected Contact Submissions',
      content: (
        <div>
          <p>Are you sure you want to delete {selectedRowKeys.length} selected contact submission(s)?</p>
          <p className="mt-2 text-sm text-red-600">This action cannot be undone.</p>
        </div>
      ),
      onOk: async () => {
        await handleDelete(selectedRowKeys)
      },
    })
  }

  return (
    <div className="w-full">
      <h1 className="text-2xl md:text-3xl font-bold mb-4 md:mb-6 text-primary">Contact</h1>

      <div className="bg-surface rounded-lg shadow border border-default transition-colors p-3 md:p-6 overflow-hidden">
        {/* Table Controls */}
        <ContactTableControls
          searchText={searchText}
          searchColumn={searchColumn}
          dateRange={dateRange}
          selectedCount={selectedRowKeys.length}
          totalCount={pagination.total}
          exportLoading={exportLoading}
          onSearch={handleSearch}
          onSearchColumnChange={handleSearchColumnChange}
          onDateRangeChange={handleDateRangeChange}
          onStatusFilter={handleStatusFilter}
          onRefresh={handleRefresh}
          onClearFilters={handleClearFilters}
          onExport={handleExport}
          onDeleteSelected={handleDeleteSelected}
        />

        {/* Data Table */}
        <ContactTable
          data={data}
          loading={loading}
          selectedRowKeys={selectedRowKeys}
          pagination={pagination}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSelectionChange={setSelectedRowKeys}
          onDelete={handleDelete}
          onMarkStatus={handleMarkStatus}
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

export default function ContactPageWrapper() {
  return (
    <App>
      <ContactPage />
    </App>
  )
}
```

---

### Step 8: Add Route to Admin App

**File**: `apps/admin/src/App.tsx`

Add the import:

```typescript
import ContactPage from '@/pages/ContactPage'
```

Add the route:

```typescript
{
  path: '/contact',
  element: <ContactPage />,
},
```

---

### Step 9: Add Navigation Link

**File**: `apps/admin/src/components/Sidebar.tsx` (or wherever your navigation is)

Add:

```typescript
{
  key: 'contact',
  icon: <Mail size={20} />,
  label: <Link to="/contact">Contact</Link>,
},
```

---

## 🧪 Testing Checklist

### Backend Testing

- [ ] `GET /admin/contact/` returns paginated list
- [ ] Search works for: message, id, email, name
- [ ] Status filter works: all, open, resolved
- [ ] Date range filter works
- [ ] Sorting works: id (asc/desc), submitted_at (asc/desc)
- [ ] `DELETE /admin/contact/delete/:id` deletes single entry
- [ ] `POST /admin/contact/batch-delete` deletes multiple entries
- [ ] `POST /admin/contact/mark-status/:id` updates status
- [ ] `POST /admin/contact/export` generates CSV with filters

### Frontend Testing

- [ ] Table displays: ID, Email, Submitted At, Status
- [ ] Sorting works on ID and Submitted At columns
- [ ] Row selection works
- [ ] Action dropdown shows: View Details, Mark Status, Delete
- [ ] View Details modal shows all fields
- [ ] Mark status works (Open ↔ Resolved)
- [ ] Delete single entry works with confirmation
- [ ] Delete bulk entries works with confirmation
- [ ] Search works for all columns (message, id, email, name)
- [ ] Search column dropdown changes without reload
- [ ] Status filter triggers API call
- [ ] Date range filter works
- [ ] Total count displays correctly
- [ ] Export CSV works and downloads file
- [ ] Export loading state works
- [ ] Success modals display for: delete, mark status, export
- [ ] Error modals display for API errors
- [ ] Clear filters resets everything
- [ ] Refresh reloads data
- [ ] Pagination works

---

## 📝 Summary

This implementation provides:

✅ **Complete CRUD operations** for contact submissions
✅ **Advanced filtering** (search, status, date range)
✅ **Sorting** (ID, Submitted At)
✅ **Bulk actions** (delete multiple)
✅ **CSV export** with current filters
✅ **Reusable components** (modals, hooks, confirmations)
✅ **Consistent UX** with Feedback page
✅ **Type safety** throughout
✅ **Error handling** with proper modals
✅ **Loading states** for better UX

The Contact page will have the exact same look and feel as the Feedback page, with only the data fields being different!

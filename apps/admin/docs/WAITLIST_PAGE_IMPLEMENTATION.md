# Waitlist Page Implementation Guide

This document provides a comprehensive guide to implementing the Waitlist page in the admin panel, based on the existing Contact page implementation.

---

## 📋 Table of Contents

1. [Waitlist vs Contact Differences](#waitlist-vs-contact-differences)
2. [Step-by-Step Implementation](#step-by-step-implementation)
3. [Testing Checklist](#testing-checklist)

---

## 🔄 Waitlist vs Contact Differences

### Database Schema Comparison

| Field | Contact | Waitlist |
|-------|---------|----------|
| `id` | ✓ | ✓ |
| `user_id` | ✓ | ✗ |
| `name` | ✓ | ✗ |
| `email` | ✓ | ✓ (UNIQUE) |
| `subject` | ✓ | ✗ |
| `phone` | ✓ | ✗ |
| `message` | ✓ | ✗ |
| `status` | 'open' \| 'resolved' | 'pending' \| 'approved' \| 'rejected' |
| `submitted_at` | ✓ | ✗ |
| `created_at` | ✗ | ✓ |
| `updated_at` | ✗ | ✓ |

### UI Differences

**Table Columns:**
- **Contact**: ID, Email, Submitted At, Status
- **Waitlist**: ID, Email, Created At, Status

**View Details Modal:**
- **Contact**: ID, Name, Email, Phone, Subject, Submitted At, Message
- **Waitlist**: ID, Email, Created At, Updated At, Status

**Search Columns:**
- **Contact**: Message, ID, Email, Name
- **Waitlist**: ID, Email

**Status Options:**
- **Contact**: Open, Resolved (2 options)
- **Waitlist**: Pending, Approved, Rejected (3 options)

**Mark Status Action:**
- **Contact**: Toggle between 2 states
- **Waitlist**: Subdropdown showing the 2 other status options

---

## 🚀 Step-by-Step Implementation

### Step 1: Create API Client Types & Functions

**File**: `packages/api-client/src/admin/waitlist.ts`

```typescript
import axiosInstance, { axiosWrapper, handleApiError } from "../utils";
import { API_CONFIG } from "../config";

// ─── Types ─────────────────────────────────────────────────

export interface WaitlistItem {
  id: number;
  email: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string; // ISO datetime string
  updated_at: string; // ISO datetime string
}

export interface WaitlistListParams {
  page?: number;
  page_size?: number;
  search?: string;
  search_column?: 'email' | 'id';
  status?: 'pending' | 'approved' | 'rejected' | 'all';
  date_from?: string; // YYYY-MM-DD
  date_to?: string; // YYYY-MM-DD
  sort_by?: 'id' | 'created_at';
  sort_order?: 'asc' | 'desc';
}

export interface WaitlistListResponse {
  success: boolean;
  data: WaitlistItem[];
  pagination: {
    page: number;
    page_size: number;
    total: number;
    total_pages: number;
  };
}

export interface WaitlistDeleteResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export interface WaitlistBatchDeleteResponse {
  success: boolean;
  deleted_count: number;
  message?: string;
  error?: string;
}

export interface WaitlistUpdateResponse {
  success: boolean;
  data?: WaitlistItem;
  message?: string;
  error?: string;
}

export interface WaitlistExportResponse {
  success: boolean;
  download_url: string;
  filename: string;
  expires_at: string;
  error?: string;
}

// ─── API Functions ─────────────────────────────────────────

/**
 * Get paginated list of waitlist entries with filtering and search
 */
export const getWaitlistList = async (params: WaitlistListParams = {}) => {
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

    const data = await axiosWrapper<WaitlistListResponse>(
      axiosInstance.get(API_CONFIG.ENDPOINTS.ADMIN_WAITLIST_LIST, { params: queryParams })
    );

    if (data.success) return data;
    
    return {
      success: false,
      error: (data as any).error || "Failed to fetch waitlist.",
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
 * Delete a single waitlist entry by ID
 */
export const deleteWaitlist = async (waitlistId: number) => {
  try {
    const data = await axiosWrapper<{
      success: boolean;
      data?: { message: string };
      error?: string;
    }>(
      axiosInstance.delete(`${API_CONFIG.ENDPOINTS.ADMIN_WAITLIST_DELETE}${waitlistId}`)
    );

    if (data.success) {
      return {
        success: true,
        message: data.data?.message || "Waitlist entry deleted successfully"
      };
    }
    
    return {
      success: false,
      error: (data as any).error || "Failed to delete waitlist entry.",
    };
  } catch (error) {
    return handleApiError(error as any);
  }
};

/**
 * Delete multiple waitlist entries in a batch
 */
export const batchDeleteWaitlist = async (waitlistIds: number[]) => {
  try {
    const data = await axiosWrapper<WaitlistBatchDeleteResponse>(
      axiosInstance.post(API_CONFIG.ENDPOINTS.ADMIN_WAITLIST_BATCH_DELETE, {
        ids: waitlistIds,
      })
    );

    if (data.success) return data;
    
    return {
      success: false,
      deleted_count: 0,
      error: (data as any).error || "Failed to delete waitlist entries.",
    };
  } catch (error) {
    return {
      ...handleApiError(error as any),
      deleted_count: 0,
    };
  }
};

/**
 * Update waitlist status
 */
export const updateWaitlistStatus = async (
  waitlistId: number, 
  status: 'pending' | 'approved' | 'rejected'
) => {
  try {
    const data = await axiosWrapper<WaitlistUpdateResponse>(
      axiosInstance.post(`${API_CONFIG.ENDPOINTS.ADMIN_WAITLIST_UPDATE_STATUS}${waitlistId}`, {
        status,
      })
    );

    if (data.success) return data;
    
    return {
      success: false,
      error: (data as any).error || "Failed to update waitlist status.",
    };
  } catch (error) {
    return handleApiError(error as any);
  }
};

/**
 * Export waitlist data (returns download URL to CSV file)
 */
export const exportWaitlist = async (
  format: 'csv',
  params: WaitlistListParams = {}
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

    const data = await axiosWrapper<WaitlistExportResponse>(
      axiosInstance.post(API_CONFIG.ENDPOINTS.ADMIN_WAITLIST_EXPORT, requestBody)
    );

    if (data.success) return data;
    
    return {
      success: false,
      error: (data as any).error || "Failed to export waitlist.",
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
ADMIN_WAITLIST_LIST: string;
ADMIN_WAITLIST_DELETE: string;
ADMIN_WAITLIST_BATCH_DELETE: string;
ADMIN_WAITLIST_UPDATE_STATUS: string;
ADMIN_WAITLIST_EXPORT: string;
```

Add to the `API_CONFIG` object:

```typescript
// Admin - Waitlist endpoints
ADMIN_WAITLIST_LIST: "/admin/waitlist/",
ADMIN_WAITLIST_DELETE: "/admin/waitlist/delete/",
ADMIN_WAITLIST_BATCH_DELETE: "/admin/waitlist/batch-delete",
ADMIN_WAITLIST_UPDATE_STATUS: "/admin/waitlist/update-status/",
ADMIN_WAITLIST_EXPORT: "/admin/waitlist/export",
```

---

### Step 3: Export from API Client Index

**File**: `packages/api-client/src/index.ts`

Add:

```typescript
export * from "./admin/waitlist";
```

---

### Step 4: Create Waitlist Data Hook

**File**: `apps/admin/src/hooks/useWaitlist.ts`

(See implementation in Step 4 of actual code)

---

### Step 5: Create Waitlist Table Component

**File**: `apps/admin/src/components/waitlist/WaitlistTable.tsx`

(See implementation in Step 5 of actual code)

---

### Step 6: Create Waitlist Table Controls Component

**File**: `apps/admin/src/components/waitlist/WaitlistTableControls.tsx`

(See implementation in Step 6 of actual code)

---

### Step 7: Create Waitlist Page

**File**: `apps/admin/src/pages/WaitlistPage.tsx`

(See implementation in Step 7 of actual code)

---

### Step 8: Add Route to Admin App

**File**: `apps/admin/src/App.tsx`

Add the import:

```typescript
import WaitlistPage from '@/pages/WaitlistPage'
```

Add the route:

```typescript
{
  path: '/waitlist',
  element: <WaitlistPage />,
},
```

---

### Step 9: Add Navigation Link

**File**: `apps/admin/src/components/Sidebar.tsx`

Add:

```typescript
{
  key: 'waitlist',
  icon: <Users size={20} />,
  label: <Link to="/waitlist">Waitlist</Link>,
},
```

---

## 🧪 Testing Checklist

### Backend Testing

- [ ] `GET /admin/waitlist/` returns paginated list
- [ ] Search works for: id, email
- [ ] Status filter works: all, pending, approved, rejected
- [ ] Date range filter works
- [ ] Sorting works: id (asc/desc), created_at (asc/desc)
- [ ] `DELETE /admin/waitlist/delete/:id` deletes single entry
- [ ] `POST /admin/waitlist/batch-delete` deletes multiple entries
- [ ] `POST /admin/waitlist/update-status/:id` updates status
- [ ] `POST /admin/waitlist/export` generates CSV with filters

### Frontend Testing

- [ ] Table displays: ID, Email, Created At, Status
- [ ] Sorting works on ID and Created At columns
- [ ] Row selection works
- [ ] Action dropdown shows: Mark as (submenu), View Details, Delete
- [ ] Mark as submenu shows 2 other statuses (not current one)
- [ ] View Details modal shows all fields
- [ ] Update status works (Pending/Approved/Rejected)
- [ ] Delete single entry works with confirmation
- [ ] Delete bulk entries works with confirmation
- [ ] Search works for: id, email
- [ ] Search column dropdown changes without reload
- [ ] Status filter triggers API call (Pending/Approved/Rejected)
- [ ] Date range filter works
- [ ] Total count displays correctly
- [ ] Export CSV works and downloads file
- [ ] Export loading state works
- [ ] Success modals display for: delete, update status, export
- [ ] Error modals display for API errors
- [ ] Clear filters resets everything
- [ ] Refresh reloads data
- [ ] Pagination works

---

## 📝 Summary

This implementation provides:

✅ **Complete CRUD operations** for waitlist entries
✅ **Advanced filtering** (search, status, date range)
✅ **Sorting** (ID, Created At)
✅ **Bulk actions** (delete multiple)
✅ **CSV export** with current filters
✅ **Reusable components** (modals, hooks, confirmations)
✅ **Consistent UX** with Contact and Feedback pages
✅ **Type safety** throughout
✅ **Error handling** with proper modals
✅ **Loading states** for better UX
✅ **Three-status system** (Pending, Approved, Rejected)

The Waitlist page will have the exact same look and feel as the Contact page, with simplified data fields and a three-state status system! 
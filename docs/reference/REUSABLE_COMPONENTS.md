# Reusable Components & Hooks

This document describes the reusable components and hooks created for the admin panel and available across all apps.

## 📦 Packages

All reusable components are located in:
- **`packages/hooks`** - Shared React hooks
- **`packages/ui`** - Shared UI components

---

## 🎯 Hooks

### 1. `useStatusModals`

A hook for managing success and error modal states.

**Location**: `packages/hooks/src/useStatusModals.ts`

**Usage**:
```typescript
import { useStatusModals } from '@resomix/hooks'

function MyPage() {
  const {
    // Error modal
    errorModalVisible,
    errorDetails,
    showErrorModal,
    closeErrorModal,
    
    // Success modal
    successModalVisible,
    successDetails,
    showSuccessModal,
    closeSuccessModal,
  } = useStatusModals()

  // Show error
  const handleError = () => {
    showErrorModal('Error Title', 'Error message here')
  }

  // Show success
  const handleSuccess = () => {
    showSuccessModal('Success Title', 'Success message here')
  }

  return (
    <div>
      {/* Your content */}
      
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
```

**Returns**:
- `errorModalVisible` - Boolean indicating if error modal is visible
- `errorDetails` - Object with `{ title, message }` for error
- `showErrorModal(title, message)` - Function to show error modal
- `closeErrorModal()` - Function to close error modal
- `successModalVisible` - Boolean indicating if success modal is visible
- `successDetails` - Object with `{ title, message }` for success
- `showSuccessModal(title, message)` - Function to show success modal
- `closeSuccessModal()` - Function to close success modal

---

### 2. `useConfirmDialog`

A hook for showing confirmation dialogs with consistent styling.

**Location**: `packages/hooks/src/useConfirmDialog.ts`

**Usage**:
```typescript
import { useConfirmDialog } from '@resomix/hooks'
import { App } from 'antd'

function MyComponent() {
  // Must be inside App.useApp() context
  const { confirmDelete, confirm } = useConfirmDialog()

  const handleDelete = () => {
    confirmDelete({
      title: 'Delete Item',
      content: 'Are you sure you want to delete this item?',
      onOk: async () => {
        // Perform delete operation
        await deleteItem()
      }
    })
  }

  const handleCustomAction = () => {
    confirm({
      title: 'Confirm Action',
      content: 'Are you sure?',
      okText: 'Yes',
      cancelText: 'No',
      okType: 'primary',
      onOk: async () => {
        // Perform action
      }
    })
  }

  return <button onClick={handleDelete}>Delete</button>
}

// Wrap your app with App.useApp()
function App() {
  return (
    <App>
      <MyComponent />
    </App>
  )
}
```

**Methods**:

#### `confirm(options)`
Shows a general confirmation dialog.

Options:
- `title` (string, required) - Dialog title
- `content` (ReactNode, required) - Dialog content
- `okText` (string, optional) - OK button text (default: 'Confirm')
- `cancelText` (string, optional) - Cancel button text (default: 'Cancel')
- `okType` ('primary' | 'danger', optional) - OK button type (default: 'primary')
- `onOk` (function, required) - Callback when OK is clicked
- `onCancel` (function, optional) - Callback when Cancel is clicked

#### `confirmDelete(options)`
Shows a delete confirmation dialog (pre-configured with danger styling).

Options:
- `title` (string, required) - Dialog title
- `content` (ReactNode, required) - Dialog content
- `onOk` (function, required) - Callback when OK is clicked

---

## 🎨 Components

### `StatusModal`

A reusable modal component for displaying success or error messages.

**Location**: `packages/ui/src/Modals/StatusModal.tsx`

**Usage**:
```typescript
import { StatusModal } from '@resomix/ui'

function MyComponent() {
  const [showModal, setShowModal] = useState(false)

  return (
    <>
      <button onClick={() => setShowModal(true)}>Show Success</button>
      
      <StatusModal
        type="success"
        visible={showModal}
        title="Operation Successful"
        message="Your operation completed successfully!"
        onClose={() => setShowModal(false)}
      />
    </>
  )
}
```

**Props**:
- `type` ('success' | 'error', required) - Modal type
- `visible` (boolean, required) - Whether modal is visible
- `title` (string, required) - Modal title
- `message` (string, required) - Modal message (supports multi-line with `\n`)
- `onClose` (function, required) - Callback when modal is closed

**Features**:
- ✓ Green checkmark for success, ⚠️ red icon for error
- Centered modal with 500px width
- Colored button matching the modal type
- Supports multi-line messages with whitespace preservation
- Responsive design

---

## 🔧 Integration with Data Hooks

### Pattern: Adding Error/Success Handlers to Data Hooks

When creating hooks that fetch/mutate data, follow this pattern:

```typescript
interface UseMyDataOptions {
  onError?: (title: string, message: string) => void
  onSuccess?: (title: string, message: string) => void
}

export function useMyData(options?: UseMyDataOptions) {
  const { onError, onSuccess } = options || {}

  const fetchData = async () => {
    try {
      const result = await api.getData()
      
      if (result.success) {
        // Success case
        if (onSuccess) {
          onSuccess('Data Loaded', 'Successfully loaded data')
        } else {
          message.success('Data loaded')  // Fallback
        }
      } else {
        // Error from API
        const errorMsg = result.error || 'Failed to load data'
        if (onError) {
          onError('Load Failed', errorMsg)
        } else {
          message.error(errorMsg)  // Fallback
        }
      }
    } catch (error) {
      // Exception case
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      if (onError) {
        onError('Error', errorMsg)
      } else {
        message.error(errorMsg)  // Fallback
      }
    }
  }

  return {
    fetchData,
    // ... other returns
  }
}
```

### Using the Hook with Modals

```typescript
function MyPage() {
  const { 
    showErrorModal, 
    showSuccessModal,
    errorModalVisible,
    successModalVisible,
    // ... other modal states
  } = useStatusModals()

  const { fetchData } = useMyData({
    onError: showErrorModal,
    onSuccess: showSuccessModal
  })

  return (
    <div>
      {/* Your content */}
      
      {/* Modals */}
      <StatusModal type="error" visible={errorModalVisible} {...} />
      <StatusModal type="success" visible={successModalVisible} {...} />
    </div>
  )
}
```

---

## 📝 Example: Complete Page Implementation

Here's a complete example of a page using all reusable components:

```typescript
import { App } from 'antd'
import { useStatusModals, useConfirmDialog } from '@resomix/hooks'
import { StatusModal } from '@resomix/ui'
import { useMyData } from '@/hooks/useMyData'

function MyPage() {
  // Status modals
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
  
  // Confirmation dialogs
  const { confirmDelete } = useConfirmDialog()
  
  // Data hook with error/success handlers
  const {
    data,
    loading,
    fetchData,
    deleteItem,
  } = useMyData({
    onError: showErrorModal,
    onSuccess: showSuccessModal
  })

  const handleDelete = (id: string) => {
    confirmDelete({
      title: 'Delete Item',
      content: (
        <div>
          <p>Are you sure you want to delete this item?</p>
          <p className="mt-2 text-sm text-red-600">This action cannot be undone.</p>
        </div>
      ),
      onOk: async () => {
        await deleteItem(id)
      }
    })
  }

  return (
    <div>
      <h1>My Page</h1>
      
      {/* Your content here */}
      <button onClick={() => fetchData()}>Load Data</button>
      <button onClick={() => handleDelete('123')}>Delete</button>
      
      {/* Status Modals */}
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

// Wrap with App provider for confirmation dialogs
export default function MyPageWrapper() {
  return (
    <App>
      <MyPage />
    </App>
  )
}
```

---

## ✅ Benefits

1. **Consistency** - All pages use the same modal styling and behavior
2. **Less Code** - No need to rewrite modal state management
3. **Maintainability** - Changes to modals only need to be made in one place
4. **Type Safety** - Full TypeScript support with proper types
5. **Flexibility** - Still allows for fallback to `message.success/error` if needed

---

## 🚀 Next Steps

When creating new admin pages:
1. Import `useStatusModals` and `StatusModal`
2. Pass error/success handlers to your data hooks
3. Use `useConfirmDialog` for all confirmation dialogs
4. Enjoy consistent UX across all pages! 
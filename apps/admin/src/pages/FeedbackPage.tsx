import { useState } from 'react'
import { App, Modal } from 'antd'
import { useFeedback } from '@/hooks/useFeedback.ts'
import FeedbackTableControls from '@/components/feedback/FeedbackTableControls.tsx'
import FeedbackTable from '@/components/feedback/FeedbackTable.tsx'

function FeedbackPage() {
  const { modal } = App.useApp()
  const [errorModalVisible, setErrorModalVisible] = useState(false)
  const [errorDetails, setErrorDetails] = useState<{ title: string; message: string } | null>(null)
  const [successModalVisible, setSuccessModalVisible] = useState(false)
  const [successDetails, setSuccessDetails] = useState<{ title: string; message: string } | null>(null)

  const showErrorModal = (title: string, message: string) => {
    setErrorDetails({ title, message })
    setErrorModalVisible(true)
  }

  const closeErrorModal = () => {
    setErrorModalVisible(false)
    setErrorDetails(null)
  }

  const showSuccessModal = (title: string, message: string) => {
    setSuccessDetails({ title, message })
    setSuccessModalVisible(true)
  }

  const closeSuccessModal = () => {
    setSuccessModalVisible(false)
    setSuccessDetails(null)
  }

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
  } = useFeedback({
    onError: showErrorModal,
    onSuccess: showSuccessModal
  })

  const handleDeleteSelected = () => {
    if (selectedRowKeys.length === 0) return

    modal.confirm({
      title: 'Delete Selected Feedback',
      content: `Are you sure you want to delete ${selectedRowKeys.length} selected feedback item(s)? This action cannot be undone.`,
      okText: 'Delete',
      okType: 'danger',
      okButtonProps: { danger: true },
      cancelText: 'Cancel',
      centered: true,
      onOk: async () => {
        await handleDelete(selectedRowKeys)
      },
    })
  }

  return (
    <div>
      <h1 className="text-2xl md:text-3xl font-bold mb-4 md:mb-6 text-primary">Feedback</h1>

      <div className="bg-surface rounded-lg shadow border border-default transition-colors p-3 md:p-6">
        {/* Table Controls */}
        <FeedbackTableControls
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
        <FeedbackTable
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

      {/* Error Modal */}
      <Modal
        title={
          <div className="flex items-center gap-2">
            <span className="text-red-500">⚠️</span>
            <span>{errorDetails?.title || 'Error'}</span>
          </div>
        }
        open={errorModalVisible}
        onCancel={closeErrorModal}
        footer={[
          <button
            key="close"
            onClick={closeErrorModal}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors"
          >
            Close
          </button>
        ]}
        centered
        width={500}
      >
        <div className="py-4">
          <p className="text-base text-secondary whitespace-pre-wrap">{errorDetails?.message}</p>
        </div>
      </Modal>

      {/* Success Modal */}
      <Modal
        title={
          <div className="flex items-center gap-2">
            <span className="text-green-500">✓</span>
            <span>{successDetails?.title || 'Success'}</span>
          </div>
        }
        open={successModalVisible}
        onCancel={closeSuccessModal}
        footer={[
          <button
            key="close"
            onClick={closeSuccessModal}
            className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded hover:bg-green-700 transition-colors"
          >
            Close
          </button>
        ]}
        centered
        width={500}
      >
        <div className="py-4">
          <p className="text-base text-secondary whitespace-pre-wrap">{successDetails?.message}</p>
        </div>
      </Modal>
    </div>
  )
}

export default FeedbackPage

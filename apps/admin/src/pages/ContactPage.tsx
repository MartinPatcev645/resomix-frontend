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
    <div>
      <h1 className="text-2xl md:text-3xl font-bold mb-4 md:mb-6 text-primary">Contact</h1>

      <div className="bg-surface rounded-lg shadow border border-default transition-colors p-3 md:p-6">
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

export default ContactPage

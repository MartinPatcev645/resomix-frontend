import { App } from 'antd'
import { usePlaylist } from '@/hooks/usePlaylist.ts'
import PlaylistTableControls from '@/components/playlist/PlaylistTableControls.tsx'
import PlaylistTable from '@/components/playlist/PlaylistTable.tsx'
import { useStatusModals, useConfirmDialog } from '@resomix/hooks'
import { StatusModal } from '@resomix/ui'

function PlaylistsPage() {
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
    handleChangeVisibility,
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
    <div className="w-full">
      <h1 className="text-2xl md:text-3xl font-bold mb-4 md:mb-6 text-primary">Playlists</h1>

      <div className="bg-surface rounded-lg shadow border border-default transition-colors p-3 md:p-6 overflow-hidden">
        {/* Table Controls */}
        <PlaylistTableControls
          searchText={searchText}
          searchColumn={searchColumn}
          dateRange={dateRange}
          selectedCount={selectedRowKeys.length}
          totalCount={pagination.total}
          exportLoading={exportLoading}
          data={data}
          selectedRowKeys={selectedRowKeys}
          onSearch={handleSearch}
          onSearchColumnChange={handleSearchColumnChange}
          onDateRangeChange={handleDateRangeChange}
          onVisibilityFilter={handleVisibilityFilter}
          onTypeFilter={handleTypeFilter}
          onRefresh={handleRefresh}
          onClearFilters={handleClearFilters}
          onExport={handleExport}
          onDeleteSelected={handleDeleteSelected}
          onChangeVisibility={handleChangeVisibility}
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
          onChangeVisibility={handleChangeVisibility}
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

export default function PlaylistsPageWrapper() {
  return (
    <App>
      <PlaylistsPage />
    </App>
  )
}

import { App } from 'antd'
import { useFeedback } from '@/hooks/useFeedback.ts'
import FeedbackTableControls from '@/components/feedback/FeedbackTableControls.tsx'
import FeedbackTable from '@/components/feedback/FeedbackTable.tsx'

function FeedbackPage() {
  const { modal } = App.useApp()

  const {
    data,
    loading,
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
    handleDateRangeChange,
    handleStatusFilter,
    handleDelete,
    handleMarkStatus,
    handlePageChange,
    handleExport,
    handleSortChange,
  } = useFeedback()

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
          onSearch={handleSearch}
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
    </div>
  )
}

export default FeedbackPage

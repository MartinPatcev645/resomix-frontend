import { Modal } from 'antd'
import { useFeedback } from '@/hooks/useFeedback.ts'
import FeedbackTableControls from '@/components/feedback/FeedbackTableControls.tsx'
import FeedbackTable from '@/components/feedback/FeedbackTable.tsx'

function FeedbackPage() {
  const {
    data,
    loading,
    searchText,
    searchColumn,
    selectedRowKeys,
    pagination,
    setSelectedRowKeys,
    handleRefresh,
    handleSearch,
    handleDateRangeChange,
    handleDelete,
    handleMarkStatus,
    handlePageChange,
    handleExport,
  } = useFeedback()

  const handleDeleteSelected = () => {
    if (selectedRowKeys.length === 0) return

    Modal.confirm({
      title: 'Delete Selected Feedback',
      content: `Are you sure you want to delete ${selectedRowKeys.length} selected feedback item(s)?`,
      okText: 'Delete',
      okType: 'danger',
      onOk: () => {
        handleDelete(selectedRowKeys)
        setSelectedRowKeys([])
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
          selectedCount={selectedRowKeys.length}
          onSearch={handleSearch}
          onDateRangeChange={handleDateRangeChange}
          onRefresh={handleRefresh}
          onExport={handleExport}
          onDeleteSelected={handleDeleteSelected}
        />

        {/* Data Table */}
        <FeedbackTable
          data={data}
          loading={loading}
          selectedRowKeys={selectedRowKeys}
          pagination={pagination}
          onSelectionChange={setSelectedRowKeys}
          onDelete={handleDelete}
          onMarkStatus={handleMarkStatus}
          onPageChange={handlePageChange}
        />
      </div>
    </div>
  )
}

export default FeedbackPage

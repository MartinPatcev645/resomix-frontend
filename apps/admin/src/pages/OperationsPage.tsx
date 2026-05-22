import { Tabs } from 'antd'
import type { TabsProps } from 'antd'
import OperationTypesTab from '@/components/operations/OperationTypesTab.tsx'
import UserOperationLimitsTab from '@/components/operations/UserOperationLimitsTab.tsx'
import { useOperationTypes } from '@/hooks/useOperationTypes.ts'
import { useStatusModals } from '@resomix/hooks'
import { StatusModal } from '@resomix/ui'

function OperationsPage() {
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

  const { operationTypes, loading, lastUpdated, refresh } = useOperationTypes({
    onError: showErrorModal,
  })

  const tabItems: TabsProps['items'] = [
    {
      key: 'user-operation-limits',
      label: 'User Limits',
      children: (
        <UserOperationLimitsTab
          operationTypes={operationTypes}
          operationTypesLoading={loading}
          onRefreshOperationTypes={refresh}
          onError={showErrorModal}
          onSuccess={showSuccessModal}
        />
      ),
    },
    {
      key: 'operation-types',
      label: 'Operation Types',
      children: (
        <OperationTypesTab
          data={operationTypes}
          loading={loading}
          lastUpdated={lastUpdated}
          onRefresh={refresh}
        />
      ),
    },
  ]

  return (
    <div className="w-full">
      <h1 className="text-2xl md:text-3xl font-bold mb-4 md:mb-6 text-primary">Operations</h1>

      <div className="bg-surface rounded-lg shadow border border-default transition-colors p-3 md:p-6 overflow-hidden">
        <Tabs
          defaultActiveKey="user-operation-limits"
          items={tabItems}
          destroyOnHidden={false}
        />
      </div>

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

export default OperationsPage



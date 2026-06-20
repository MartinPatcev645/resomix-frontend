import { useState, useEffect } from 'react'
import { Tabs, Card, Button, Select, Form, Input, InputNumber, DatePicker, Typography, Modal, Tag } from 'antd'
import type { TabsProps } from 'antd'
import OperationTypesTab from '@/components/operations/OperationTypesTab.tsx'
import UserOperationLimitsTab from '@/components/operations/UserOperationLimitsTab.tsx'
import { useOperationTypes } from '@/hooks/useOperationTypes.ts'
import { useStatusModals, usePartners, useAdminLogs } from '@resomix/hooks'
import { StatusModal } from '@resomix/ui'
import { RotateCw, Database, Ticket } from 'lucide-react'

const { Text } = Typography
const { Option } = Select

function OperationsPage() {
  const [modal, modalContextHolder] = Modal.useModal()
  const [promoForm] = Form.useForm()

  // Rebuild Index loading & partner select state
  const [rebuildLoading, setRebuildLoading] = useState(false)
  const [selectedPartnerIdForRebuild, setSelectedPartnerIdForRebuild] = useState<number | undefined>(undefined)

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

  // Load hooks for rebuild index & promo code
  const { partners, fetchPartners } = usePartners()
  const { rebuildIndex, createPromo } = useAdminLogs()

  useEffect(() => {
    fetchPartners()
  }, [fetchPartners])

  const handleRebuildIndex = () => {
    if (selectedPartnerIdForRebuild === undefined) return
    const partnerToRebuild = partners.find(p => p.id === selectedPartnerIdForRebuild)
    if (!partnerToRebuild) return

    modal.confirm({
      title: 'Rebuild Similarity Search Index',
      content: (
        <div className="mt-2 flex flex-col gap-4">
          <Text>Are you sure you want to rebuild the similarity FAISS index for the partner below?</Text>
          
          <div className="border border-default p-4 rounded-xl bg-background-secondary flex flex-col gap-2">
            <div>
              <Text className="text-secondary text-[10px] uppercase block font-semibold">Display Name</Text>
              <Text strong className="text-primary text-base">{partnerToRebuild.display_name || partnerToRebuild.legal_name}</Text>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mt-1">
              <div>
                <Text className="text-secondary text-[10px] uppercase block font-semibold">Legal Name</Text>
                <Text className="text-sm font-medium">{partnerToRebuild.legal_name || '—'}</Text>
              </div>
              <div>
                <Text className="text-secondary text-[10px] uppercase block font-semibold">Tier</Text>
                <Tag color={
                  partnerToRebuild.tier === 'sandbox' ? 'blue' :
                  partnerToRebuild.tier === 'starter' ? 'cyan' :
                  partnerToRebuild.tier === 'growth' ? 'purple' :
                  partnerToRebuild.tier === 'enterprise' ? 'orange' : 'default'
                } className="rounded-full font-medium uppercase text-[10px] mt-0.5 m-0">
                  {partnerToRebuild.tier}
                </Tag>
              </div>
            </div>

            <div className="mt-1">
              <Text className="text-secondary text-[10px] uppercase block font-semibold">Contact Email</Text>
              <Text className="text-sm font-medium">{partnerToRebuild.contact_email}</Text>
            </div>
          </div>
        </div>
      ),
      okText: 'Rebuild Index',
      okType: 'danger',
      onOk: async () => {
        setRebuildLoading(true)
        try {
          await rebuildIndex(selectedPartnerIdForRebuild)
        } finally {
          setRebuildLoading(false)
        }
      },
    })
  }

  const handleCreatePromo = async (values: any) => {
    const payload = {
      code: values.code,
      discount_type: values.discount_type,
      discount_value: Number(values.discount_value),
      max_uses: values.max_uses ? Number(values.max_uses) : undefined,
      expires_at: values.expires_at ? values.expires_at.format('YYYY-MM-DDTHH:mm:ss') : undefined
    }

    const success = await createPromo(payload)
    if (success) {
      promoForm.resetFields()
    }
  }

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
    {
      key: 'system-actions',
      label: 'System Actions',
      children: (
        <div className="py-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Index Rebuild Card */}
            <Card
              title={<span className="flex items-center gap-2 text-primary font-semibold"><Database size={18} /><span>Rebuild Similarity Search Index</span></span>}
              className="border-default rounded-xl shadow-sm h-full"
            >
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Text className="text-secondary text-xs font-medium uppercase">Select Partner</Text>
                  <Select
                    placeholder="Select a partner to rebuild index..."
                    style={{ width: '100%' }}
                    className="h-10"
                    value={selectedPartnerIdForRebuild}
                    onChange={setSelectedPartnerIdForRebuild}
                  >
                    {partners.map(p => (
                      <Option key={p.id} value={p.id}>{p.display_name}</Option>
                    ))}
                  </Select>
                </div>

                <Button 
                  danger 
                  type="primary" 
                  size="large"
                  onClick={handleRebuildIndex}
                  loading={rebuildLoading}
                  disabled={selectedPartnerIdForRebuild === undefined}
                  className="h-12 w-full font-semibold rounded-lg flex items-center justify-center gap-2 mt-2"
                >
                  <RotateCw size={18} className={rebuildLoading ? "animate-spin" : ""} />
                  Rebuild Similarity Index
                </Button>
              </div>
            </Card>

            {/* Promo Code Card */}
            <Card
              title={<span className="flex items-center gap-2 text-primary font-semibold"><Ticket size={18} /><span>Promo Code Generation</span></span>}
              className="border-default rounded-xl shadow-sm h-full"
            >
              <Form
                form={promoForm}
                layout="vertical"
                onFinish={handleCreatePromo}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Form.Item
                    name="code"
                    label={<Text strong>Code Name</Text>}
                    rules={[{ required: true, message: 'Please enter code (e.g. SUMMER50)' }]}
                  >
                    <Input placeholder="SUMMER50" className="h-11 rounded-lg font-mono uppercase" />
                  </Form.Item>

                  <Form.Item
                    name="discount_type"
                    label={<Text strong>Discount Type</Text>}
                    initialValue="percentage"
                  >
                    <Select className="h-11 rounded-lg">
                      <Option value="percentage">Percentage (%)</Option>
                      <Option value="fixed">Fixed (€)</Option>
                    </Select>
                  </Form.Item>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Form.Item
                    name="discount_value"
                    label={<Text strong>Value</Text>}
                    rules={[{ required: true, message: 'Enter value' }]}
                  >
                    <InputNumber min={1} className="w-full h-11 rounded-lg flex items-center" placeholder="50" />
                  </Form.Item>

                  <Form.Item
                    name="max_uses"
                    label={<Text strong>Max Uses (Opt)</Text>}
                  >
                    <InputNumber min={1} className="w-full h-11 rounded-lg flex items-center" placeholder="100" />
                  </Form.Item>

                  <Form.Item
                    name="expires_at"
                    label={<Text strong>Expiry Date (Opt)</Text>}
                  >
                    <DatePicker className="w-full h-11 rounded-lg" format="YYYY-MM-DD" />
                  </Form.Item>
                </div>

                <Form.Item className="!mb-0 mt-4">
                  <Button type="primary" htmlType="submit" className="h-11 rounded-lg w-full font-semibold">
                    Create Promo Code
                  </Button>
                </Form.Item>
              </Form>
            </Card>
          </div>
        </div>
      ),
    },
  ]

  return (
    <div className="w-full">
      {modalContextHolder}
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

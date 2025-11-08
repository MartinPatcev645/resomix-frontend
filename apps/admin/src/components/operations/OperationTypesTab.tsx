import { Button, Table, Tooltip } from 'antd'
import type { TableColumnsType } from 'antd'
import { RefreshCw } from 'lucide-react'
import type { AdminOperationType } from '@resomix/api-client'

interface OperationTypesTabProps {
  data: AdminOperationType[]
  loading: boolean
  lastUpdated: number | null
  onRefresh: () => Promise<void>
}

const columns: TableColumnsType<AdminOperationType> = [
  {
    title: 'ID',
    dataIndex: 'id',
    key: 'id',
    width: 80,
    render: (value: number) => <span className="font-mono text-sm text-primary">{value}</span>,
  },
  {
    title: 'Code',
    dataIndex: 'code',
    key: 'code',
    width: 200,
    render: (code: string) => (
      <span className="font-medium text-primary uppercase tracking-wide">{code}</span>
    ),
  },
  {
    title: 'Description',
    dataIndex: 'description',
    key: 'description',
    render: (description: string) => (
      <span className="text-secondary leading-relaxed">{description}</span>
    ),
  },
]

function OperationTypesTab({ data, loading, lastUpdated, onRefresh }: OperationTypesTabProps) {
  const handleRefresh = async () => {
    await onRefresh()
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-primary">Operation Types</h2>
          <p className="text-secondary text-sm">
            Reference list of available operations that can be assigned to users.
          </p>
          {lastUpdated && (
            <p className="text-xs text-secondary mt-1">
              Last updated {new Date(lastUpdated).toLocaleString()}
            </p>
          )}
        </div>
        <Tooltip title="Refresh operation types">
          <Button
            type="default"
            icon={<RefreshCw size={16} />}
            onClick={handleRefresh}
            loading={loading}
          >
            Refresh
          </Button>
        </Tooltip>
      </div>

      <Table
        columns={columns}
        dataSource={data}
        rowKey={(record) => record.id}
        loading={loading}
        pagination={false}
        bordered={false}
      />
    </div>
  )
}

export default OperationTypesTab


import { useCallback, useEffect, useState } from 'react'
import { Card, Table, Tag, Button, Space, Typography, Alert, Modal, Input, App, Empty } from 'antd'
import type { TableColumnsType } from 'antd'
import { Trash2, Clock, Mail, RefreshCw } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import {
  getPendingDeletions,
  notifyDeletionDelay,
  type PendingDeletion,
} from '@resomix/api-client'
import DeleteAccountModal from '@/components/DeleteAccountModal.tsx'

const { Text, Paragraph } = Typography
const { TextArea } = Input

/**
 * Accounts waiting to be deleted, oldest first.
 *
 * WHY THIS SCREEN EXISTS AT ALL
 *
 * Nothing deletes on a timer — an admin runs every scrub by hand — and the user is told "within 4
 * weeks" rather than a date. So a request that nobody looks at simply sits there, invisibly, while
 * the one-month clock in Art. 12(3) runs out. This queue is the only thing that surfaces it.
 *
 * `waiting_days`, `approaching` and `overdue` are all computed server-side. Recomputing them here
 * would let two screens disagree about whether something is late, and "late" is the fact that
 * matters.
 */

const fmt = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { dateStyle: 'medium' }) : '—'

function Waiting({ row }: { row: PendingDeletion }) {
  const color = row.overdue ? 'error' : row.approaching ? 'warning' : 'default'
  return (
    <Space size={4}>
      <Tag color={color}>{row.waiting_days} days</Tag>
      {row.overdue && <Text type="danger" className="text-xs font-medium">overdue</Text>}
    </Space>
  )
}

export function PendingDeletionsPanel() {
  const navigate = useNavigate()
  const { message } = App.useApp()
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<PendingDeletion[]>([])
  const [slaDays, setSlaDays] = useState(30)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<PendingDeletion | null>(null)
  const [notifying, setNotifying] = useState<PendingDeletion | null>(null)
  const [reason, setReason] = useState('')
  const [sending, setSending] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await getPendingDeletions()
    setLoading(false)
    if (res.success && 'data' in res && res.data) {
      setRows(res.data.items)
      setSlaDays(res.data.sla_days)
      setError(null)
    } else {
      setError(('error' in res && res.error) || 'Could not load pending deletions.')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const sendNotice = async () => {
    if (!notifying) return
    setSending(true)
    const res = await notifyDeletionDelay(notifying.uuid, reason)
    setSending(false)
    if (res.success) {
      message.success('Notice sent.')
      setNotifying(null)
      setReason('')
    } else {
      message.error(('error' in res && res.error) || 'The notice could not be sent.')
    }
  }

  const overdue = rows.filter((r) => r.overdue).length

  const columns: TableColumnsType<PendingDeletion> = [
    {
      title: 'User',
      key: 'user',
      render: (_, row) => (
        <div className="flex flex-col">
          <a onClick={() => navigate(`/users/${row.uuid}`)}>{row.name || row.email}</a>
          <span className="text-secondary text-xs">{row.email}</span>
        </div>
      ),
    },
    {
      title: 'Requested',
      key: 'requested',
      width: 140,
      render: (_, row) => <span className="text-secondary">{fmt(row.deletion_requested_at)}</span>,
    },
    {
      title: 'Waiting',
      key: 'waiting',
      width: 160,
      render: (_, row) => <Waiting row={row} />,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 230,
      align: 'right',
      render: (_, row) => (
        <Space size={4}>
          {/* Only offered where it is legally meaningful — before the month is up there is
              nothing to extend, and sending one early just confuses the recipient. */}
          {row.overdue && (
            <Button size="small" icon={<Mail size={13} />} onClick={() => setNotifying(row)}>
              Send notice
            </Button>
          )}
          <Button size="small" danger icon={<Trash2 size={13} />} onClick={() => setDeleting(row)}>
            Delete
          </Button>
        </Space>
      ),
    },
  ]

  return (
    <>
      <Card
        title={
          <Space>
            <Clock size={16} />
            <span>Pending deletions</span>
            {rows.length > 0 && <Tag>{rows.length}</Tag>}
          </Space>
        }
        extra={
          <Button size="small" icon={<RefreshCw size={14} />} onClick={() => void load()}>
            Refresh
          </Button>
        }
      >
        {error && <Alert className="mb-3" type="error" showIcon message={error} />}

        {overdue > 0 && (
          <Alert
            className="mb-3"
            type="error"
            showIcon
            message={`${overdue} request${overdue > 1 ? 's are' : ' is'} past ${slaDays} days`}
            description={
              <Paragraph className="!mb-0 text-xs">
                We have one month to action an erasure request. Either complete these now, or send
                each person a notice explaining the delay — that is what keeps a late request from
                becoming a breach.
              </Paragraph>
            }
          />
        )}

        <Table
          columns={columns}
          dataSource={rows}
          rowKey="uuid"
          loading={loading}
          pagination={false}
          size="small"
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="No pending deletions. Nothing is waiting on us."
              />
            ),
          }}
        />
      </Card>

      <DeleteAccountModal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        userUuid={deleting?.uuid || null}
        email={deleting?.email}
        onDeleted={() => void load()}
      />

      <Modal
        title="Tell them it's taking longer"
        open={!!notifying}
        onCancel={() => setNotifying(null)}
        onOk={sendNotice}
        okText="Send notice"
        okButtonProps={{ loading: sending, disabled: !reason.trim() }}
        centered
      >
        <Alert
          className="mb-3"
          type="info"
          showIcon
          message="Why this matters"
          description={
            <span className="text-xs">
              We may take up to three months, but only if the person is told inside the first month
              — <strong>with the actual reason</strong>. A generic sentence does not satisfy that,
              which is why there is no default here.
            </span>
          }
        />
        <TextArea
          rows={4}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. We're working through a backlog of requests and expect to complete yours within the next two weeks."
        />
        <Text className="text-secondary text-xs">
          This appears in the email exactly as written.
        </Text>
      </Modal>
    </>
  )
}

export default PendingDeletionsPanel

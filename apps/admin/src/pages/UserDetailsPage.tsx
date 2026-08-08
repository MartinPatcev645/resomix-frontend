import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Spin, Button, Tag, Descriptions, Card, Space, Typography, Table, Alert, Statistic, Row, Col } from 'antd'
import { ArrowLeft, RefreshCw, ListMusic, Music, ExternalLink } from 'lucide-react'
import { getAdminUserOverview, type AdminUserOverview } from '@resomix/api-client'
import { useStatusModals } from '@resomix/hooks'
import { StatusModal } from '@resomix/ui'

const { Title, Text } = Typography

/**
 * Everything about one user, on one screen.
 *
 * Answers the questions that previously meant three tabs and a SQL client: when were they last
 * here, what are they paying, what have they made, and have they ever been in touch.
 *
 * Two things are shown side by side on purpose:
 *
 *  - **Effective plan vs subscription.** These disagree exactly when something interesting has
 *    happened — a chargeback suspension, or a cancelled subscription still inside its paid period.
 *    That gap is usually why an admin opened this page, so it is called out rather than hidden
 *    behind one merged value.
 *  - **Last activity vs last login.** A session opened in January and used daily since reports
 *    January for one and today for the other. Merging them would answer neither question.
 */

const fmt = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '—'

const fmtDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { dateStyle: 'medium' }) : '—'

const money = (cents: number, currency = 'EUR') =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: currency || 'EUR' }).format((cents || 0) / 100)

/** -1 is the service's "could not read this table", which must not render as a real zero. */
const count = (n: number | undefined) => (n === undefined || n < 0 ? '—' : n)

function UserDetailsPage() {
  const { uuid } = useParams<{ uuid: string }>()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<AdminUserOverview | null>(null)
  const { errorModalVisible, errorDetails, showErrorModal, closeErrorModal } = useStatusModals()

  const fetchOverview = async () => {
    if (!uuid) return
    setLoading(true)
    try {
      const result = await getAdminUserOverview(uuid)
      if (result.success && 'data' in result && result.data) {
        setData(result.data)
      } else {
        showErrorModal(
          'Failed to load user',
          'error' in result ? result.error || 'Could not fetch this user.' : 'Could not fetch this user.'
        )
      }
    } catch (error) {
      showErrorModal('Error', error instanceof Error ? error.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchOverview()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uuid])

  if (loading) {
    return (
      <div className="w-full flex items-center justify-center py-20">
        <Spin size="large" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="w-full">
        <Button icon={<ArrowLeft size={16} />} onClick={() => navigate('/users')} className="mb-4">
          Back to Users
        </Button>
        <div className="bg-surface rounded-lg shadow border border-default p-6 text-center">
          <p className="text-secondary">User not found</p>
        </div>
        <StatusModal
          type="error"
          visible={errorModalVisible}
          onClose={closeErrorModal}
          title={errorDetails?.title || ''}
          message={errorDetails?.message || ''}
        />
      </div>
    )
  }

  const { identity, activity, lifecycle, effective_plan, subscription, counts, support, invoices } = data

  // The mismatch worth surfacing: Stripe still bills them, but they do not have the plan.
  const planMismatch =
    subscription && effective_plan && subscription.plan_code && subscription.plan_code !== effective_plan.code

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <Space>
          <Button icon={<ArrowLeft size={16} />} onClick={() => navigate('/users')}>
            Back to Users
          </Button>
          <Button icon={<RefreshCw size={16} />} onClick={() => void fetchOverview()}>
            Refresh
          </Button>
        </Space>
        <Space size={4} wrap>
          <Tag color={identity.is_active ? 'success' : 'error'} className="rounded-full px-3">
            {identity.is_active ? 'Active' : 'Inactive'}
          </Tag>
          <Tag color={identity.is_email_verified ? 'blue' : 'warning'} className="rounded-full px-3">
            {identity.is_email_verified ? 'Verified' : 'Unverified'}
          </Tag>
          {identity.is_two_factor_enabled && <Tag color="purple" className="rounded-full px-3">2FA</Tag>}
          {effective_plan && (
            <Tag color={effective_plan.code === 'free' ? 'default' : 'gold'} className="rounded-full px-3">
              {effective_plan.name}
            </Tag>
          )}
          {identity.roles.map((r) => (
            <Tag key={r} color="geekblue" className="rounded-full px-3">{r}</Tag>
          ))}
        </Space>
      </div>

      <Title level={3} className="!mb-1">{identity.name || identity.username || identity.email}</Title>
      <Text className="text-secondary">{identity.email}</Text>

      {/* Lifecycle first when it applies — it changes how everything below should be read. */}
      {lifecycle.deletion_requested_at && (
        <Alert
          className="mt-4"
          type="error"
          showIcon
          message="Deletion requested"
          description={
            `Requested ${fmtDate(lifecycle.deletion_requested_at)}. Data is kept until ` +
            `${fmtDate(lifecycle.purge_due_at)}, after which an admin may permanently delete it. ` +
            `Reactivating this account cancels the deletion.`
          }
        />
      )}
      {!identity.is_active && !lifecycle.deletion_requested_at && (
        <Alert
          className="mt-4"
          type="warning"
          showIcon
          message="Account deactivated"
          description={
            `Deactivated ${fmt(lifecycle.deactivated_at)}` +
            (lifecycle.deactivation_reason ? ` — reason: ${lifecycle.deactivation_reason}.` : '.') +
            ' They cannot sign in and every session has been revoked.'
          }
        />
      )}
      {subscription?.access_suspended_at && (
        <Alert
          className="mt-4"
          type="error"
          showIcon
          message="Access suspended"
          description={
            `Suspended ${fmt(subscription.access_suspended_at)} (${subscription.access_suspended_reason || 'unknown'}). ` +
            'Stripe still reports the subscription as live — access returns automatically if a dispute is won.'
          }
        />
      )}
      {planMismatch && (
        <Alert
          className="mt-4"
          type="info"
          showIcon
          message="Plan and subscription disagree"
          description={
            `The subscription is for ${subscription!.plan_name || subscription!.plan_code}, but this user ` +
            `effectively has ${effective_plan!.name}. Usually a cancellation still inside its paid period, ` +
            'or a suspension.'
          }
        />
      )}

      {/* Counts. Playlists and tracks link through to those pages filtered by this user. */}
      <Row gutter={[12, 12]} className="mt-5">
        {[
          { label: 'Playlists', key: 'playlists', icon: <ListMusic size={14} />, to: `/playlists?user=${identity.uuid}` },
          { label: 'Tracks uploaded', key: 'tracks', icon: <Music size={14} />, to: `/tracks?user=${identity.uuid}&partner=${identity.partner_id ?? 1}` },
          { label: 'Analyses', key: 'analyses' },
          { label: 'Ratings given', key: 'track_ratings' },
          { label: 'Favourites', key: 'favourites' },
          { label: 'Active sessions', key: 'active_sessions' },
        ].map((tile) => (
          <Col key={tile.key} xs={12} sm={8} lg={4}>
            <Card size="small" className="h-full">
              <Statistic title={tile.label} value={count(counts[tile.key]) as never} />
              {tile.to && (counts[tile.key] ?? 0) > 0 && (
                <Button
                  type="link"
                  size="small"
                  className="!px-0"
                  icon={<ExternalLink size={12} />}
                  onClick={() => navigate(tile.to!)}
                >
                  View
                </Button>
              )}
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={[16, 16]} className="mt-4">
        <Col xs={24} lg={12}>
          <Card size="small" title="Identity">
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="User ID">{identity.id}</Descriptions.Item>
              <Descriptions.Item label="UUID"><Text copyable className="text-xs font-mono">{identity.uuid}</Text></Descriptions.Item>
              <Descriptions.Item label="Username">{identity.username || '—'}</Descriptions.Item>
              <Descriptions.Item label="Language">{identity.language || '—'}</Descriptions.Item>
              <Descriptions.Item label="Timezone">{identity.timezone || '—'}</Descriptions.Item>
              <Descriptions.Item label="Joined">{fmt(identity.created_at)}</Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card size="small" title="Activity">
            <Descriptions column={1} size="small" bordered>
              {/* Two different questions — see the component docstring. */}
              <Descriptions.Item label="Last activity">{fmt(activity.last_seen_at)}</Descriptions.Item>
              <Descriptions.Item label="Last login">{fmt(activity.last_login)}</Descriptions.Item>
              <Descriptions.Item label="Last IP">
                <Text className="font-mono text-xs">{activity.last_ip || '—'}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Last device">
                <Text className="text-xs">{activity.last_user_agent || '—'}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Active sessions">{count(counts.active_sessions)}</Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card size="small" title="Plan & billing">
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="Effective plan">{effective_plan?.name || '—'}</Descriptions.Item>
              <Descriptions.Item label="Subscription">
                {subscription ? `${subscription.plan_name || subscription.plan_code || '—'} (${subscription.status})` : 'None'}
              </Descriptions.Item>
              {subscription?.cancellation && (
                <Descriptions.Item label="Cancellation">
                  {subscription.cancellation.ended
                    ? `Ended ${fmtDate(subscription.cancellation.effective_at)}`
                    : `Active till ${fmtDate(subscription.cancellation.effective_at)} (cancelled)`}
                  {subscription.cancellation.reason ? ` — ${subscription.cancellation.reason}` : ''}
                </Descriptions.Item>
              )}
              {subscription && !subscription.cancellation && (
                <Descriptions.Item label="Renews">{fmtDate(subscription.current_period_end)}</Descriptions.Item>
              )}
              {subscription?.is_founding && (
                <Descriptions.Item label="Founding rate">
                  Locked until {fmtDate(subscription.founding_lock_ends_at)}
                </Descriptions.Item>
              )}
              <Descriptions.Item label="Total paid">
                {money(counts.total_spend_cents ?? 0, subscription?.currency || 'EUR')}
              </Descriptions.Item>
              {subscription?.stripe_customer_id && (
                <Descriptions.Item label="Stripe customer">
                  <Text copyable className="text-xs font-mono">{subscription.stripe_customer_id}</Text>
                </Descriptions.Item>
              )}
            </Descriptions>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card size="small" title="Support history">
            {!support.latest_contact && !support.latest_feedback ? (
              <Text className="text-secondary">Never been in touch.</Text>
            ) : (
              <Space direction="vertical" size={12} className="w-full">
                {support.latest_contact && (
                  <div>
                    <Space size={6}>
                      <Text strong>Latest contact</Text>
                      <Tag color={support.latest_contact.status === 'resolved' ? 'success' : 'warning'}>
                        {support.latest_contact.status}
                      </Tag>
                      <Text className="text-secondary text-xs">{fmt(support.latest_contact.submitted_at)}</Text>
                    </Space>
                    <div className="text-xs text-secondary mt-1">
                      {support.latest_contact.subject && <strong>{support.latest_contact.subject}: </strong>}
                      {support.latest_contact.excerpt}
                    </div>
                    <Text className="text-secondary text-xs">{count(counts.contacts)} total</Text>
                  </div>
                )}
                {support.latest_feedback && (
                  <div>
                    <Space size={6}>
                      <Text strong>Latest feedback</Text>
                      {support.latest_feedback.category && <Tag>{support.latest_feedback.category}</Tag>}
                      {support.latest_feedback.satisfaction != null && (
                        <Tag color="blue">{support.latest_feedback.satisfaction}/5</Tag>
                      )}
                      <Text className="text-secondary text-xs">{fmt(support.latest_feedback.submitted_at)}</Text>
                    </Space>
                    <div className="text-xs text-secondary mt-1">{support.latest_feedback.excerpt}</div>
                    <Text className="text-secondary text-xs">{count(counts.feedbacks)} total</Text>
                  </div>
                )}
              </Space>
            )}
          </Card>
        </Col>
      </Row>

      <Card size="small" title="Billing history" className="mt-4">
        <Table
          rowKey="stripe_invoice_id"
          size="small"
          pagination={false}
          dataSource={invoices}
          locale={{ emptyText: 'No invoices' }}
          columns={[
            { title: 'Date', dataIndex: 'created_at', render: (v: string) => fmt(v) },
            {
              title: 'Amount',
              dataIndex: 'amount_paid_cents',
              render: (v: number, r) => money(v, r.currency),
            },
            {
              title: 'Status',
              dataIndex: 'status',
              render: (v: string) => <Tag color={v === 'paid' ? 'success' : 'warning'}>{v}</Tag>,
            },
            {
              title: 'Period',
              key: 'period',
              render: (_: unknown, r) => `${fmtDate(r.period_start)} → ${fmtDate(r.period_end)}`,
            },
            {
              title: '',
              key: 'link',
              align: 'right' as const,
              render: (_: unknown, r) =>
                r.hosted_invoice_url ? (
                  <a href={r.hosted_invoice_url} target="_blank" rel="noreferrer">Open</a>
                ) : null,
            },
          ]}
        />
      </Card>

      <StatusModal
        type="error"
        visible={errorModalVisible}
        onClose={closeErrorModal}
        title={errorDetails?.title || ''}
        message={errorDetails?.message || ''}
      />
    </div>
  )
}

export default UserDetailsPage

import { useEffect, useState } from 'react'
import { Drawer, Descriptions, Tag, Space, Typography, Spin, Alert, Divider, Button } from 'antd'
import { Mail, ExternalLink, CheckCircle, RotateCcw } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import {
  getContactDetail,
  getFeedbackDetail,
  type ContactDetail,
  type FeedbackDetail,
  type SubmissionSubmitter,
} from '@resomix/api-client'

const { Text, Paragraph, Title } = Typography

/**
 * Everything we hold about one contact submission or one piece of feedback.
 *
 * ONE drawer for both, because the interesting half — who sent it, what we already replied, where
 * it came from — is identical. Only the submission block differs.
 *
 * The panel leads with the SUBMITTER rather than the message. The message is why the row exists;
 * who wrote it is what decides how to answer. A paying customer three weeks into a subscription is
 * a different conversation from an anonymous form fill, and the table cannot tell them apart.
 */

const fmt = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '—'

/** -1 is the server's "could not read", which must not render as a real zero. */
const count = (n?: number) => (n === undefined || n < 0 ? '—' : n)

function SubmitterPanel({ submitter, onOpenUser }: { submitter: SubmissionSubmitter; onOpenUser: () => void }) {
  // A guest we could not match to any account. Stated plainly rather than shown as an empty
  // account card — an admin should know they are looking at an unverified stranger.
  if (!submitter.matched_account) {
    return (
      <Alert
        type="warning"
        showIcon
        message="Submitted by a guest"
        description="They were not signed in, and no account matches. Everything below is self-reported — treat the name and email as unverified."
      />
    )
  }

  return (
    <>
      {submitter.matched_by_email && (
        <Alert
          className="mb-3"
          type="info"
          showIcon
          message="Matched to an account by email"
          description="They were not signed in when they wrote in. This is the account with the same address — likely the same person, but it is an inference, not a verified session."
        />
      )}
      <Descriptions column={1} size="small" bordered>
        <Descriptions.Item label="Account">
          <Space size={6} wrap>
            <Text strong>{submitter.name || submitter.username || submitter.email}</Text>
            <Tag color={submitter.is_active ? 'success' : 'error'}>
              {submitter.is_active ? 'Active' : 'Inactive'}
            </Tag>
            {submitter.plan && (
              <Tag color={submitter.plan.code === 'free' ? 'default' : 'gold'}>{submitter.plan.name}</Tag>
            )}
            {!submitter.is_email_verified && <Tag color="warning">Unverified email</Tag>}
          </Space>
        </Descriptions.Item>
        <Descriptions.Item label="Email">{submitter.email}</Descriptions.Item>
        <Descriptions.Item label="Joined">{fmt(submitter.created_at)}</Descriptions.Item>
        <Descriptions.Item label="Last activity">{fmt(submitter.last_seen_at)}</Descriptions.Item>
        <Descriptions.Item label="Written to us before">
          {/* A fourth message in a fortnight reads very differently from a first one. */}
          {count(submitter.total_contacts)} contact(s) · {count(submitter.total_feedbacks)} feedback
        </Descriptions.Item>
      </Descriptions>
      <Button className="mt-2" size="small" icon={<ExternalLink size={13} />} onClick={onOpenUser}>
        Open full profile
      </Button>
    </>
  )
}

export interface SubmissionDetailDrawerProps {
  open: boolean
  onClose: () => void
  kind: 'contact' | 'feedback'
  id: number | null
  /** Opens the reply composer for this record. */
  onReply?: () => void
  /** Toggles open/resolved. Carried over from the modal this drawer replaced, so triaging still
   *  happens where the message is read rather than back on the row. */
  onMarkStatus?: (next: 'open' | 'resolved') => void
}

export function SubmissionDetailDrawer({ open, onClose, kind, id, onReply, onMarkStatus }: SubmissionDetailDrawerProps) {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<ContactDetail | FeedbackDetail | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !id) {
      setData(null)
      setError(null)
      return
    }
    let cancelled = false
    setLoading(true)
    const load = kind === 'contact' ? getContactDetail(id) : getFeedbackDetail(id)
    void load.then((res) => {
      // The drawer can be closed or switched before the request lands; without this the previous
      // record would flash into view under the new heading.
      if (cancelled) return
      setLoading(false)
      if (res.success && 'data' in res && res.data) setData(res.data as ContactDetail | FeedbackDetail)
      else setError(('error' in res && res.error) || 'Could not load this submission.')
    })
    return () => {
      cancelled = true
    }
  }, [open, id, kind])

  const contact = kind === 'contact' ? (data as ContactDetail | null) : null
  const feedback = kind === 'feedback' ? (data as FeedbackDetail | null) : null

  // Only ever populated on a partner request — six empty rows on a consumer enquiry is noise.
  const business = contact?.business || {}
  const hasBusiness = Object.values(business).some(Boolean)

  return (
    <Drawer
      title={kind === 'contact' ? `Contact #${id}` : `Feedback #${id}`}
      open={open}
      onClose={onClose}
      width={620}
      extra={
        data ? (
          <Space>
            {onMarkStatus && (
              <Button
                icon={data.status === 'open' ? <CheckCircle size={14} /> : <RotateCcw size={14} />}
                onClick={() => onMarkStatus(data.status === 'open' ? 'resolved' : 'open')}
              >
                Mark {data.status === 'open' ? 'resolved' : 'open'}
              </Button>
            )}
            {onReply && (
              <Button type="primary" icon={<Mail size={14} />} onClick={onReply}>
                Reply
              </Button>
            )}
          </Space>
        ) : null
      }
    >
      {loading ? (
        <div className="flex justify-center py-10">
          <Spin />
        </div>
      ) : error ? (
        <Alert type="error" showIcon message={error} />
      ) : !data ? null : (
        <Space direction="vertical" size={16} className="w-full">
          {/* Who, first — it decides how the message should be read. */}
          <div>
            <Title level={5} className="!mb-2">Submitted by</Title>
            <SubmitterPanel
              submitter={data.submitter}
              onOpenUser={() => data.submitter.uuid && navigate(`/users/${data.submitter.uuid}`)}
            />
          </div>

          <div>
            <Title level={5} className="!mb-2">Submission</Title>
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="Status">
                <Tag color={data.status === 'resolved' ? 'success' : 'warning'}>{data.status}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Received">{fmt(data.submitted_at)}</Descriptions.Item>
              {contact && <Descriptions.Item label="Type"><Tag>{contact.contact_type}</Tag></Descriptions.Item>}
              {contact && <Descriptions.Item label="Name given">{contact.name || '—'}</Descriptions.Item>}
              {contact && <Descriptions.Item label="Email given">{contact.email || '—'}</Descriptions.Item>}
              {contact && <Descriptions.Item label="Phone">{contact.phone || '—'}</Descriptions.Item>}
              {contact && <Descriptions.Item label="Subject">{contact.subject || '—'}</Descriptions.Item>}
              {feedback && <Descriptions.Item label="Category">{feedback.category || '—'}</Descriptions.Item>}
              {feedback && (
                <Descriptions.Item label="Scores">
                  {/* Labelled: two 1–10 numbers side by side are otherwise indistinguishable. */}
                  Satisfaction {feedback.satisfaction ?? '—'}/10 · Recommendation{' '}
                  {feedback.recommendation ?? '—'}/10
                </Descriptions.Item>
              )}
            </Descriptions>
          </div>

          <div>
            <Title level={5} className="!mb-2">Message</Title>
            <Paragraph className="whitespace-pre-wrap bg-surface p-3 rounded border border-default">
              {data.message || <Text className="text-secondary">No message</Text>}
            </Paragraph>
          </div>

          {hasBusiness && (
            <div>
              <Title level={5} className="!mb-2">Partner request</Title>
              <Descriptions column={1} size="small" bordered>
                {Object.entries(business)
                  .filter(([, v]) => v)
                  .map(([k, v]) => (
                    <Descriptions.Item key={k} label={k.replace(/_/g, ' ')}>
                      {v}
                    </Descriptions.Item>
                  ))}
              </Descriptions>
            </div>
          )}

          <div>
            <Title level={5} className="!mb-2">Where it came from</Title>
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="IP address">
                <Text className="font-mono text-xs">{data.request.client_ip || '—'}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Browser">
                <Text className="text-xs">{data.request.user_agent || '—'}</Text>
              </Descriptions.Item>
            </Descriptions>
            {!data.request.client_ip && (
              <Text className="text-secondary text-xs">
                Not recorded — this was submitted before we started capturing it.
              </Text>
            )}
          </div>

          <div>
            <Title level={5} className="!mb-2">
              Replies sent {data.replies.length > 0 && <Tag color="success">{data.replies.length}</Tag>}
            </Title>
            {data.replies.length === 0 ? (
              <Text className="text-secondary">No reply sent yet.</Text>
            ) : (
              data.replies.map((r) => (
                <div key={r.id} className="mb-3">
                  <Space size={6}>
                    <Text strong className="text-xs">{r.subject}</Text>
                    <Tag color={r.status === 'sent' ? 'success' : 'error'}>{r.status}</Tag>
                    <Text className="text-secondary text-xs">{fmt(r.created_at)}</Text>
                  </Space>
                  <Paragraph className="whitespace-pre-wrap text-xs text-secondary mb-0">
                    {r.body}
                  </Paragraph>
                  <Divider className="my-2" />
                </div>
              ))
            )}
          </div>
        </Space>
      )}
    </Drawer>
  )
}

export default SubmissionDetailDrawer

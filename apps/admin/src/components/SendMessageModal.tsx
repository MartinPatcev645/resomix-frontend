import { useEffect, useState } from 'react'
import { Modal, Input, Button, Space, Typography, Alert, Spin, App } from 'antd'
import { Eye, Send, Pencil } from 'lucide-react'
import {
  previewAdminMessage,
  type MessageChannel,
  type MessagePreview,
} from '@resomix/api-client'

const { Text } = Typography

/**
 * Compose → preview → send, shared by contact replies, feedback replies and direct messages.
 *
 * ONE component for all three because they differ only in what the server quotes back. Three
 * copies would drift, and the one that drifted would be the one nobody was looking at.
 *
 * The preview is rendered by the SERVER, through the same function that sends. It is displayed in
 * a **sandboxed iframe** rather than injected into this document: it is a full HTML email with its
 * own styles, and `dangerouslySetInnerHTML` would both leak those styles into the admin app and
 * execute whatever the markup contained.
 *
 * Two frictions, both deliberate:
 *  - you cannot send without previewing first — this email goes to a real customer;
 *  - `can_send` is checked BEFORE composing, so "there is no address for this person" is not
 *    discovered after writing three paragraphs.
 */
export interface SendMessageModalProps {
  open: boolean
  onClose: () => void
  channel: MessageChannel
  /** contacts.id / feedbacks.id being answered. Omit for a direct message. */
  sourceId?: number
  /** Recipient, for a direct message. */
  userUuid?: string
  /** Shown in the header so the admin can see who they are writing to. */
  recipientHint?: string
  onSent?: () => void
  /** Channel-specific send call, supplied by the page that owns the record. */
  send: (body: string, subject?: string) => Promise<{ success: boolean; error?: string; message?: string }>
}

const TITLES: Record<MessageChannel, string> = {
  contact: 'Reply to this message',
  feedback: 'Reply to this feedback',
  direct: 'Send a message',
}

export function SendMessageModal({
  open,
  onClose,
  channel,
  sourceId,
  userUuid,
  recipientHint,
  onSent,
  send,
}: SendMessageModalProps) {
  const { message } = App.useApp()
  const [body, setBody] = useState('')
  const [subject, setSubject] = useState('')
  const [preview, setPreview] = useState<MessagePreview | null>(null)
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // A fresh dialog every time: a half-written reply to the PREVIOUS customer reappearing under a
  // new name is the kind of mistake that gets sent.
  useEffect(() => {
    if (!open) {
      setBody('')
      setSubject('')
      setPreview(null)
      setError(null)
    }
  }, [open])

  const doPreview = async () => {
    if (!body.trim()) {
      setError('Write something first.')
      return
    }
    setLoading(true)
    setError(null)
    const res = await previewAdminMessage({
      channel,
      body,
      subject: subject.trim() || undefined,
      source_id: sourceId,
      user_uuid: userUuid,
    })
    setLoading(false)
    if (res.success && 'data' in res && res.data) {
      setPreview(res.data)
      if (!res.data.can_send) {
        setError('There is no email address on file for this person, so this cannot be sent.')
      }
    } else {
      setError(('error' in res && res.error) || 'Could not render the preview.')
    }
  }

  const doSend = async () => {
    setSending(true)
    setError(null)
    const res = await send(body, subject.trim() || undefined)
    setSending(false)
    if (res.success) {
      message.success(res.message || 'Message sent')
      onSent?.()
      onClose()
    } else {
      setError(res.error || 'Could not send the message.')
    }
  }

  return (
    <Modal
      title={TITLES[channel]}
      open={open}
      onCancel={onClose}
      width={720}
      destroyOnClose
      footer={
        <Space>
          <Button onClick={onClose}>Discard</Button>
          {preview ? (
            <>
              <Button icon={<Pencil size={14} />} onClick={() => setPreview(null)}>
                Edit
              </Button>
              <Button
                type="primary"
                icon={<Send size={14} />}
                loading={sending}
                disabled={!preview.can_send}
                onClick={doSend}
              >
                Send
              </Button>
            </>
          ) : (
            <Button type="primary" icon={<Eye size={14} />} loading={loading} onClick={doPreview}>
              Preview
            </Button>
          )}
        </Space>
      }
    >
      {error && <Alert type="error" showIcon className="mb-3" message={error} />}

      {preview ? (
        <div>
          <Space direction="vertical" size={4} className="mb-3 w-full">
            <Text className="text-secondary text-xs">
              To: <strong>{preview.recipient_email || '—'}</strong>
            </Text>
            <Text className="text-secondary text-xs">
              Subject: <strong>{preview.subject}</strong>
            </Text>
          </Space>
          {/*
            Sandboxed: this is a complete HTML document with its own <style>. Injecting it into the
            admin app would leak those styles across the page and run any script it contained.
          */}
          <iframe
            title="Email preview"
            sandbox=""
            srcDoc={preview.html}
            className="w-full rounded border border-default"
            style={{ height: 460, background: '#fff' }}
          />
        </div>
      ) : loading ? (
        <div className="flex justify-center py-10">
          <Spin />
        </div>
      ) : (
        <Space direction="vertical" size={12} className="w-full">
          {recipientHint && (
            <Text className="text-secondary">
              This goes to <strong>{recipientHint}</strong>.
              {channel !== 'direct' && ' Their original message is quoted underneath your reply.'}
            </Text>
          )}
          <div>
            <Text strong className="block mb-1">
              Subject <Text className="text-secondary text-xs">(optional)</Text>
            </Text>
            <Input
              value={subject}
              maxLength={200}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Leave blank to use the default for this kind of message"
            />
          </div>
          <div>
            <Text strong className="block mb-1">Message</Text>
            <Input.TextArea
              rows={9}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your reply. Blank lines become paragraphs."
            />
          </div>
        </Space>
      )}
    </Modal>
  )
}

export default SendMessageModal

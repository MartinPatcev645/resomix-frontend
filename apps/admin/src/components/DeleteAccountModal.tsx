import { useEffect, useState } from 'react'
import { Modal, Alert, Spin, Typography, Tag, Space, Input, Descriptions, App } from 'antd'
import { scrubUser, type ScrubManifest } from '@resomix/api-client'

const { Text, Paragraph } = Typography

/**
 * Confirming an account deletion.
 *
 * THE MANIFEST IS THE POINT. This opens by asking the server what the scrub *would* do (a dry run
 * that writes nothing) and shows exactly that. The admin approves the operation's own account of
 * itself rather than a sentence in this file that could drift from what the service actually does
 * — and the service's table lists change more often than UI copy gets revisited.
 *
 * It also has to be honest about what SURVIVES. Deletion here removes the person, not the account:
 * playlists, activity, support history and invoices all stay, joined to an anonymous user id. An
 * admin who believes they are erasing everything will tell a customer something untrue.
 */

const COUNT_LABELS: Record<string, string> = {
  user_sessions: 'sign-in sessions',
  user_tokens: 'reset / verification tokens',
  user_auth_providers: 'Google links',
  user_service_connections: 'Apple / Spotify links',
  consumption_events: 'playback events',
  audio_files: 'uploaded files',
  billing_invoices: 'invoices',
  subscription_events: 'subscription events',
  track_analysis_results: 'analyses',
  user_playlist_engagements: 'playlist engagements',
  user_track_engagements: 'track engagements',
}

const label = (table: string) => COUNT_LABELS[table] || table.replace(/_/g, ' ')

function CountList({ counts, empty }: { counts: Record<string, number>; empty: string }) {
  const entries = Object.entries(counts || {})
  if (!entries.length) return <Text className="text-secondary text-xs">{empty}</Text>
  return (
    <Space size={[6, 6]} wrap>
      {entries.map(([table, n]) => (
        <Tag key={table}>
          {n} {label(table)}
        </Tag>
      ))}
    </Space>
  )
}

export interface DeleteAccountModalProps {
  open: boolean
  onClose: () => void
  userUuid: string | null
  email?: string | null
  /** Called after a successful scrub so the caller can refresh. */
  onDeleted?: () => void
}

export function DeleteAccountModal({ open, onClose, userUuid, email, onDeleted }: DeleteAccountModalProps) {
  const { message } = App.useApp()
  const [loading, setLoading] = useState(false)
  const [running, setRunning] = useState(false)
  const [manifest, setManifest] = useState<ScrubManifest | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [typed, setTyped] = useState('')

  useEffect(() => {
    if (!open || !userUuid) {
      setManifest(null)
      setError(null)
      setTyped('')
      return
    }
    let cancelled = false
    setLoading(true)
    // dryRun defaults to true; passed explicitly because this call is the whole safety mechanism
    // and a reader should not have to check the signature to be sure.
    void scrubUser(userUuid, true).then((res) => {
      if (cancelled) return
      setLoading(false)
      if (res.success && 'data' in res && res.data) setManifest(res.data as ScrubManifest)
      else setError(('error' in res && res.error) || 'Could not preview this deletion.')
    })
    return () => {
      cancelled = true
    }
  }, [open, userUuid])

  const confirm = async () => {
    if (!userUuid) return
    setRunning(true)
    const res = await scrubUser(userUuid, false)
    setRunning(false)
    if (res.success) {
      message.success('Account deleted. The user has been emailed.')
      onDeleted?.()
      onClose()
    } else {
      // Includes the 409 when someone else already actioned it — worth showing verbatim rather
      // than flattening to "something went wrong".
      setError(('error' in res && res.error) || 'The deletion failed.')
    }
  }

  // Typing the address is the deliberateness gate. A single click is too cheap for an operation
  // with no undo, and the address is on screen above so it costs a reader nothing honest.
  const canConfirm = !!manifest && !manifest.already_scrubbed && typed.trim() === (email || '').trim()

  return (
    <Modal
      title="Delete this account?"
      open={open}
      onCancel={onClose}
      centered
      width={640}
      okText="Delete account"
      okButtonProps={{ danger: true, disabled: !canConfirm, loading: running }}
      onOk={confirm}
    >
      {loading ? (
        <div className="flex justify-center py-10">
          <Spin />
        </div>
      ) : error && !manifest ? (
        <Alert type="error" showIcon message={error} />
      ) : !manifest ? null : manifest.already_scrubbed ? (
        <Alert
          type="info"
          showIcon
          message="Already deleted"
          description="This account's personal details were removed previously. There is nothing left to do."
        />
      ) : (
        <Space direction="vertical" size={14} className="w-full">
          <Alert
            type="warning"
            showIcon
            message="This removes the person, not the account"
            description={
              <>
                <Paragraph className="!mb-1">
                  <Text strong>{email}</Text>'s name, email, password and profile picture will be
                  cleared, and their Google, Apple Music and Spotify links disconnected.
                </Paragraph>
                <Paragraph className="!mb-0 text-xs">
                  Their playlists, activity, support history and invoices are <Text strong>kept</Text>,
                  joined to an anonymous user id. <Text strong>This cannot be undone</Text> — until
                  you confirm, the account can still be restored in full.
                </Paragraph>
              </>
            }
          />

          {error && <Alert type="error" showIcon message={error} />}

          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="Deleted outright">
              <CountList counts={manifest.deleted} empty="Nothing to delete." />
            </Descriptions.Item>
            <Descriptions.Item label="Identifiers cleared">
              <CountList counts={manifest.scrubbed} empty="Nothing to clear." />
            </Descriptions.Item>
            <Descriptions.Item label="Kept, joined to the anonymous id">
              <CountList counts={manifest.kept} empty="No records." />
            </Descriptions.Item>
            {manifest.playlists_made_private > 0 && (
              <Descriptions.Item label="Public playlists">
                {manifest.playlists_made_private} will be made private
              </Descriptions.Item>
            )}
            {manifest.media_assets_queued > 0 && (
              <Descriptions.Item label="Uploaded media">
                {manifest.media_assets_queued} file(s) queued for removal
              </Descriptions.Item>
            )}
          </Descriptions>

          {manifest.warnings.length > 0 && (
            // Not cosmetic: each of these is a place the scrub could not reach, so those rows keep
            // their personal data. An admin must see it before telling anyone the request is done.
            <Alert
              type="error"
              showIcon
              message="Some data cannot be reached"
              description={
                <ul className="mb-0 pl-4 text-xs">
                  {manifest.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              }
            />
          )}

          <div>
            <Text className="text-xs text-secondary">
              Type <Text code>{email}</Text> to confirm.
            </Text>
            <Input
              className="mt-1"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={email || ''}
              autoComplete="off"
            />
          </div>
        </Space>
      )}
    </Modal>
  )
}

export default DeleteAccountModal

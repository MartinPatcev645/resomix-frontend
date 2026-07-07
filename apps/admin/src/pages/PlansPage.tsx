import { useState } from 'react'
import {
  App,
  Button,
  Card,
  Descriptions,
  Empty,
  Input,
  InputNumber,
  Spin,
  Switch,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import type { TableColumnsType } from 'antd'
import { RotateCw, Search, Layers, Info } from 'lucide-react'
import { usePlans } from '@/hooks/usePlans.ts'
import {
  setPlanEntitlement,
  updateAdminPlan,
  getUserEffectivePlan,
  type AdminPlan,
  type AdminFeature,
  type PlanEntitlementValue,
  type AdminUserEffectivePlan,
} from '@resomix/api-client'

const { Title, Text } = Typography

// ── One editable entitlement value, typed to the feature ───────────────────
function EntitlementCell({
  plan,
  feature,
  onSaved,
}: {
  plan: AdminPlan
  feature: AdminFeature
  onSaved: (value: PlanEntitlementValue) => void
}) {
  const { message } = App.useApp()
  const current = plan.entitlements?.[feature.key] ?? feature.default_value
  const [draft, setDraft] = useState<PlanEntitlementValue>(current)
  const [saving, setSaving] = useState(false)

  // Keep the draft in sync if the underlying plan changes (e.g. after a refresh).
  const currentKey = String(current)
  const [seen, setSeen] = useState(currentKey)
  if (seen !== currentKey) {
    setSeen(currentKey)
    setDraft(current)
  }

  const save = async (next: PlanEntitlementValue) => {
    if (String(next) === String(current)) return
    setSaving(true)
    const res = await setPlanEntitlement(plan.code, feature.key, next)
    setSaving(false)
    if (res.success) {
      const saved = res.data?.value ?? next
      message.success(`${plan.name} · ${feature.name} updated`)
      onSaved(saved)
    } else {
      message.error(res.error || 'Could not save value')
      setDraft(current) // revert
    }
  }

  if (feature.value_type === 'bool') {
    return (
      <Switch
        checked={Boolean(draft)}
        loading={saving}
        onChange={(checked) => {
          setDraft(checked)
          void save(checked)
        }}
      />
    )
  }

  if (feature.value_type === 'int') {
    return (
      <InputNumber
        value={draft as number}
        min={0}
        step={1}
        disabled={saving}
        style={{ width: 96 }}
        onChange={(v) => setDraft(v ?? 0)}
        onBlur={() => void save(draft)}
        onPressEnter={() => void save(draft)}
      />
    )
  }

  // enum / csv / string
  return (
    <Input
      value={String(draft ?? '')}
      disabled={saving}
      style={{ width: 140 }}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => void save(draft)}
      onPressEnter={() => void save(draft)}
    />
  )
}

// ── Column header for one plan: name + active/default toggles ──────────────
function PlanHeader({
  plan,
  onChanged,
}: {
  plan: AdminPlan
  onChanged: () => void | Promise<void>
}) {
  const { message } = App.useApp()
  const [busy, setBusy] = useState(false)

  const patch = async (body: { is_active?: boolean; is_default?: boolean }) => {
    setBusy(true)
    const res = await updateAdminPlan(plan.code, body)
    setBusy(false)
    if (res.success) {
      message.success(`${plan.name} updated`)
      await onChanged()
    } else {
      message.error(res.error || 'Could not update plan')
    }
  }

  return (
    <div className="flex flex-col gap-1.5 min-w-[120px]">
      <div className="flex items-center gap-2">
        <span className="font-semibold">{plan.name}</span>
        {plan.is_default && (
          <Tooltip title="Default plan for new / unassigned users">
            <Tag color="gold" className="!m-0">default</Tag>
          </Tooltip>
        )}
      </div>
      <Text type="secondary" className="!text-xs font-mono">{plan.code}</Text>
      <div className="flex items-center gap-3 flex-wrap">
        <Tooltip title={plan.is_active ? 'Active — visible/usable' : 'Inactive draft'}>
          <span className="flex items-center gap-1.5 text-xs">
            <Switch
              size="small"
              checked={plan.is_active}
              loading={busy}
              onChange={(c) => void patch({ is_active: c })}
            />
            active
          </span>
        </Tooltip>
        {!plan.is_default && (
          <Tooltip title="Make this the default plan for new users">
            <Button size="small" type="link" className="!px-0 !text-xs" loading={busy}
              onClick={() => void patch({ is_default: true })}>
              set default
            </Button>
          </Tooltip>
        )}
      </div>
    </div>
  )
}

// ── User effective-plan lookup ─────────────────────────────────────────────
function UserLookup() {
  const { message } = App.useApp()
  const [uuid, setUuid] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<AdminUserEffectivePlan | null>(null)

  const lookup = async () => {
    const id = uuid.trim()
    if (!id) return
    setLoading(true)
    setResult(null)
    const res = await getUserEffectivePlan(id)
    setLoading(false)
    if (res.success && res.data) {
      setResult(res.data)
    } else {
      message.error(res.error || 'User not found')
    }
  }

  return (
    <Card
      className="!border-default"
      title={<span className="flex items-center gap-2"><Search size={16} /> Inspect a user's plan</span>}
    >
      <div className="flex gap-2 mb-4 max-w-xl">
        <Input
          placeholder="User UUID"
          value={uuid}
          onChange={(e) => setUuid(e.target.value)}
          onPressEnter={() => void lookup()}
          allowClear
        />
        <Button type="primary" icon={<Search size={16} />} loading={loading} onClick={() => void lookup()}>
          Look up
        </Button>
      </div>

      {loading && <div className="py-6 flex justify-center"><Spin /></div>}

      {result && (
        <div className="space-y-4">
          <Descriptions size="small" column={1} bordered>
            <Descriptions.Item label="Plan">
              <Tag color="blue">{result.plan_name || result.plan_code}</Tag>
              <Text type="secondary" className="font-mono !text-xs">{result.plan_code}</Text>
            </Descriptions.Item>
            {result.user_email && (
              <Descriptions.Item label="Email">{result.user_email}</Descriptions.Item>
            )}
          </Descriptions>

          <div>
            <Text strong className="block mb-2">Effective entitlements</Text>
            <div className="flex flex-wrap gap-2">
              {Object.entries(result.entitlements || {}).map(([k, v]) => (
                <Tag key={k} className="!m-0">
                  {k}: <strong>{String(v)}</strong>
                </Tag>
              ))}
            </div>
          </div>

          {result.overrides && Object.keys(result.overrides).length > 0 && (
            <div>
              <Text strong className="block mb-2">Per-user overrides</Text>
              <div className="flex flex-wrap gap-2">
                {Object.entries(result.overrides).map(([k, v]) => (
                  <Tag key={k} color="purple" className="!m-0">
                    {k}: <strong>{String(v)}</strong>
                  </Tag>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

// ── Page ────────────────────────────────────────────────────────────────────
interface FeatureRow {
  key: string
  feature: AdminFeature
}

export default function PlansPage() {
  const { plans, features, loading, error, refresh, patchPlan } = usePlans()

  const columns: TableColumnsType<FeatureRow> = [
    {
      title: 'Feature',
      key: 'feature',
      fixed: 'left',
      width: 280,
      render: (_, { feature }) => (
        <div className="flex flex-col gap-0.5">
          <span className="font-medium">{feature.name}</span>
          <span className="font-mono text-xs text-gray-500">{feature.key}</span>
          <div className="flex items-center gap-1.5 mt-0.5">
            <Tag className="!m-0 !text-[11px]" color="default">{feature.value_type}</Tag>
            {feature.window && <Tag className="!m-0 !text-[11px]" color="geekblue">{feature.window}</Tag>}
          </div>
          {feature.description && (
            <Text type="secondary" className="!text-xs mt-0.5">{feature.description}</Text>
          )}
        </div>
      ),
    },
    ...plans.map((plan) => ({
      title: <PlanHeader plan={plan} onChanged={refresh} />,
      key: plan.code,
      align: 'center' as const,
      render: (_: unknown, { feature }: FeatureRow) => (
        <EntitlementCell
          plan={plan}
          feature={feature}
          onSaved={(value) =>
            patchPlan({ ...plan, entitlements: { ...plan.entitlements, [feature.key]: value } })
          }
        />
      ),
    })),
  ]

  const rows: FeatureRow[] = features.map((f) => ({ key: f.key, feature: f }))

  return (
    <div className="w-full max-w-[1400px] mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-6 gap-4">
        <div>
          <Title level={2} className="!mb-1 !text-primary flex items-center gap-3">
            <Layers size={26} /> Plans &amp; Entitlements
          </Title>
          <Text type="secondary">
            Edit the limits each membership tier gets. Changes take effect immediately.
          </Text>
        </div>
        <Button icon={<RotateCw size={16} />} onClick={() => void refresh()} loading={loading}>
          Refresh
        </Button>
      </div>

      <div className="flex items-center gap-2 mb-4 text-xs text-gray-500">
        <Info size={14} />
        <span>
          Toggle booleans instantly; for numbers/text, edit and press Enter or click away to save.
          Guest / Free are usually the free tiers; Basic / Pro are paid.
        </span>
      </div>

      {error && !loading ? (
        <Card className="!border-default">
          <Empty description={error}>
            <Button type="primary" onClick={() => void refresh()}>Try again</Button>
          </Empty>
        </Card>
      ) : (
        <div className="bg-surface rounded-xl shadow-md border border-default overflow-hidden mb-6">
          <Table<FeatureRow>
            columns={columns}
            dataSource={rows}
            loading={loading}
            pagination={false}
            size="middle"
            scroll={{ x: 'max-content' }}
            rowKey="key"
          />
        </div>
      )}

      <UserLookup />
    </div>
  )
}

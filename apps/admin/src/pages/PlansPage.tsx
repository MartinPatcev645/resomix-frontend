import { useMemo, useState } from 'react'
import {
  App,
  Button,
  Card,
  Collapse,
  Descriptions,
  Empty,
  Input,
  InputNumber,
  Popconfirm,
  Select,
  Space,
  Spin,
  Switch,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import type { TableColumnsType } from 'antd'
import { RotateCw, Search, Layers, Info, Save, Undo2, CreditCard, Plus, Trash2 } from 'lucide-react'
import { usePlans } from '@/hooks/usePlans.ts'
import {
  setPlanEntitlement,
  updateAdminPlan,
  getUserEffectivePlan,
  addPlanPrice,
  setPlanPriceActive,
  deletePlanPrice,
  type AdminPlan,
  type AdminPlanPrice,
  type AdminFeature,
  type PlanEntitlementValue,
  type AdminUserEffectivePlan,
} from '@resomix/api-client'

const { Title, Text } = Typography

// Allowed values for enum/csv features (backend-validated). Keeps admins from typos that would be
// rejected server-side. If a feature's set grows, add it here.
const ENUM_OPTIONS: Record<string, string[]> = {
  export_scope: ['none', 'first_n', 'full'],
  default_playlist_visibility: ['public', 'private'],
}
const CSV_OPTIONS: Record<string, string[]> = {
  // 'txt' is the server-built file download; 'embed' is the Pro embed widget. 'apple_music' is an
  // accepted alias of 'apple' server-side — only one spelling is offered here so the stored CSV
  // stays consistent.
  export_targets: ['txt', 'apple', 'embed', 'spotify', 'tidal', 'serato', 'rekordbox'],
}

// ── One editable entitlement value (controlled by the parent's pending-edits state) ──────────
function EntitlementCell({
  feature,
  value,
  dirty,
  disabled,
  onChange,
}: {
  feature: AdminFeature
  value: PlanEntitlementValue
  dirty: boolean
  disabled: boolean
  onChange: (value: PlanEntitlementValue) => void
}) {
  const ring = dirty ? { boxShadow: '0 0 0 2px var(--ant-color-warning)' } : undefined

  if (feature.value_type === 'bool') {
    return <Switch checked={Boolean(value)} disabled={disabled} onChange={onChange} style={ring} />
  }

  if (feature.value_type === 'int') {
    return (
      <InputNumber
        value={value as number}
        min={0}
        step={1}
        disabled={disabled}
        style={{ width: 96, ...ring }}
        onChange={(v) => onChange(v ?? 0)}
      />
    )
  }

  if (feature.value_type === 'enum') {
    const opts = ENUM_OPTIONS[feature.key] ?? []
    return (
      <Select
        value={String(value ?? '')}
        disabled={disabled}
        style={{ width: 130, ...ring }}
        onChange={(v) => onChange(v)}
        options={opts.map((o) => ({ value: o, label: o }))}
      />
    )
  }

  if (feature.value_type === 'csv') {
    const opts = CSV_OPTIONS[feature.key] ?? []
    const arr = String(value ?? '').split(',').map((s) => s.trim()).filter(Boolean)
    // The selected values are rendered BELOW the control, two per row — not as tags inside the
    // bar. Antd grows a multi-select horizontally for every tag, so `export_targets` (up to seven
    // values) stretched its column far wider than any other and pushed the whole table sideways.
    // `maxTagCount={0}` keeps the bar a fixed width; the summary tells you how many are set.
    return (
      <div className="flex flex-col items-stretch gap-1.5" style={{ width: 168 }}>
        <Select
          mode="multiple"
          value={arr}
          disabled={disabled}
          placeholder="none"
          style={{ width: '100%', ...ring }}
          maxTagCount={0}
          maxTagPlaceholder={() => (arr.length ? `${arr.length} selected` : 'none')}
          onChange={(vals: string[]) => onChange(vals.join(','))}
          options={opts.map((o) => ({ value: o, label: o }))}
        />
        {arr.length > 0 && (
          <div className="grid grid-cols-2 gap-1">
            {arr.map((v) => (
              <Tag key={v} className="!m-0 !text-[11px] !px-1.5 truncate" title={v}>{v}</Tag>
            ))}
          </div>
        )}
      </div>
    )
  }

  // fallback: free text
  return (
    <Input
      value={String(value ?? '')}
      disabled={disabled}
      style={{ width: 140, ...ring }}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

// ── Column header for one plan: name + active/default controls ───────────────────────────────
function PlanHeader({ plan, onChanged }: { plan: AdminPlan; onChanged: () => void | Promise<void> }) {
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

  // Two lines, not three stacked blocks. The header repeats for every plan column, so each extra
  // line costs vertical space across the whole table — and "active" as a written word next to its
  // own switch was saying the same thing twice. The switch's state IS the label; the tooltip
  // carries the meaning, and `set default` collapses into the same row.
  return (
    <div className="flex flex-col gap-1 min-w-[132px] text-left">
      <div className="flex items-center gap-2">
        <Tooltip title={plan.is_active ? 'Active — on sale and assignable' : 'Inactive — hidden from checkout'}>
          <Switch
            size="small"
            checked={plan.is_active}
            loading={busy}
            onChange={(c) => void patch({ is_active: c })}
            aria-label={`${plan.name} active`}
          />
        </Tooltip>
        <span className="font-semibold leading-none">{plan.name}</span>
        {plan.is_default && (
          <Tooltip title="Assigned to new registrations">
            <Tag color="gold" className="!m-0 !text-[10px] !px-1 !leading-4">default</Tag>
          </Tooltip>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Text type="secondary" className="!text-[11px] font-mono">{plan.code}</Text>
        {!plan.is_default && plan.is_assignable && (
          <Tooltip title="Make this the default plan for new registrations">
            <Button
              size="small"
              type="link"
              className="!px-0 !h-auto !text-[11px]"
              loading={busy}
              onClick={() => void patch({ is_default: true })}
            >
              set default
            </Button>
          </Tooltip>
        )}
      </div>
    </div>
  )
}

// ── User effective-plan lookup (by UUID, email, or username) ─────────────────────────────────
function UserLookup() {
  const { message } = App.useApp()
  const [ident, setIdent] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<AdminUserEffectivePlan | null>(null)

  const lookup = async () => {
    const id = ident.trim()
    if (!id) return
    setLoading(true)
    setResult(null)
    const res = await getUserEffectivePlan(id)
    setLoading(false)
    if (res.success && res.data) setResult(res.data)
    else message.error(res.error || 'User not found')
  }

  return (
    <Card className="!border-default" title={<span className="flex items-center gap-2"><Search size={16} /> Inspect a user's plan</span>}>
      <div className="flex gap-2 mb-4 max-w-xl">
        <Input
          placeholder="User UUID, email, or username"
          value={ident}
          onChange={(e) => setIdent(e.target.value)}
          onPressEnter={() => void lookup()}
          allowClear
        />
        <Button type="primary" icon={<Search size={16} />} loading={loading} onClick={() => void lookup()}>Look up</Button>
      </div>

      {loading && <div className="py-6 flex justify-center"><Spin /></div>}

      {result && (
        <div className="space-y-4">
          <Descriptions size="small" column={1} bordered>
            <Descriptions.Item label="Plan">
              <Tag color="blue">{result.plan?.name || result.plan?.code}</Tag>
              <Text type="secondary" className="font-mono !text-xs">{result.plan?.code}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="User"><Text className="font-mono !text-xs">{result.user_uuid}</Text></Descriptions.Item>
          </Descriptions>
          <div>
            <Text strong className="block mb-2">Effective entitlements</Text>
            <div className="flex flex-wrap gap-2">
              {Object.entries(result.entitlements || {}).map(([k, v]) => (
                <Tag key={k} className="!m-0">{k}: <strong>{String(v)}</strong></Tag>
              ))}
            </div>
          </div>
          {result.overrides && result.overrides.length > 0 && (
            <div>
              <Text strong className="block mb-2">Per-user overrides</Text>
              <div className="flex flex-wrap gap-2">
                {result.overrides.map((o) => (
                  <Tag key={o.feature} color="purple" className="!m-0">
                    {o.feature}: <strong>{String(o.value)}</strong>{o.reason ? ` (${o.reason})` : ''}
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

// ── Stripe price management for one plan (data-driven price mapping) ─────────────────────────
// Which offer a price belongs to. `founding` is sold while the beta window is open; `list` is the
// standing price a founding subscription's schedule later rolls onto. BOTH can exist for the same
// plan/interval/currency, which is why this is part of the upsert key — attaching a founding price
// as "list" would silently overwrite the list row the schedule depends on.
const PRICE_KIND_OPTIONS = [
  { value: 'list', label: 'List price' },
  { value: 'founding', label: 'Founding price' },
]

const INTERVAL_OPTIONS = [
  { value: 'month', label: 'Monthly' },
  { value: 'year', label: 'Yearly' },
]

function formatAmount(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format((cents ?? 0) / 100)
  } catch {
    return `${((cents ?? 0) / 100).toFixed(2)} ${currency}`
  }
}

function PlanPriceEditor({
  plan,
  onChanged,
}: {
  plan: AdminPlan
  onChanged: () => void | Promise<void>
}) {
  const { message } = App.useApp()
  const [priceId, setPriceId] = useState('')
  const [intervalSel, setIntervalSel] = useState('month')
  // Defaults to 'list' to match the server default, so an untouched form behaves exactly as it did
  // before this field existed.
  const [kindSel, setKindSel] = useState('list')
  const [adding, setAdding] = useState(false)
  const [busyId, setBusyId] = useState<number | null>(null)

  const prices = plan.prices ?? []

  const add = async () => {
    const id = priceId.trim()
    if (!id) {
      message.warning('Paste a Stripe price ID first')
      return
    }
    setAdding(true)
    const res = await addPlanPrice(plan.code, id, intervalSel, kindSel)
    setAdding(false)
    if (res.success) {
      message.success('Price attached')
      setPriceId('')
      await onChanged()
    } else {
      message.error(res.error || 'Could not attach price')
    }
  }

  const toggle = async (row: AdminPlanPrice, active: boolean) => {
    setBusyId(row.id)
    const res = await setPlanPriceActive(plan.code, row.id, active)
    setBusyId(null)
    if (res.success) {
      message.success(active ? 'Price is now offered' : 'Price hidden')
      await onChanged()
    } else {
      message.error(res.error || 'Could not update price')
    }
  }

  const remove = async (row: AdminPlanPrice) => {
    setBusyId(row.id)
    const res = await deletePlanPrice(plan.code, row.id)
    setBusyId(null)
    if (res.success) {
      message.success('Price removed')
      await onChanged()
    } else {
      message.error(res.error || 'Could not remove price')
    }
  }

  const columns: TableColumnsType<AdminPlanPrice> = [
    {
      title: 'Amount',
      key: 'amount',
      render: (_, r) => <span className="font-medium">{formatAmount(r.unit_amount_cents, r.currency)}</span>,
    },
    {
      title: 'Interval',
      dataIndex: 'interval',
      key: 'interval',
      render: (v: string) => <Tag className="!m-0">{v}</Tag>,
    },
    {
      // Without this a plan holding a founding AND a list price shows two near-identical rows with
      // no way to tell which is which.
      title: 'Offer',
      dataIndex: 'price_kind',
      key: 'price_kind',
      render: (v: string) => (
        <Tag color={v === 'founding' ? 'gold' : undefined} className="!m-0">{v ?? 'list'}</Tag>
      ),
    },
    { title: 'Currency', dataIndex: 'currency', key: 'currency' },
    {
      title: 'Stripe price ID',
      dataIndex: 'stripe_price_id',
      key: 'stripe_price_id',
      render: (v: string) => (
        <Text copyable={{ text: v }} className="font-mono !text-xs">
          {v}
        </Text>
      ),
    },
    {
      title: 'Offered',
      key: 'is_active',
      align: 'center',
      render: (_, r) => (
        <Switch size="small" checked={r.is_active} loading={busyId === r.id} onChange={(c) => void toggle(r, c)} />
      ),
    },
    {
      title: '',
      key: 'actions',
      align: 'right',
      render: (_, r) => (
        <Popconfirm
          title="Remove this price?"
          description="Existing subscriptions are unaffected — this only stops offering it."
          okText="Remove"
          okButtonProps={{ danger: true }}
          onConfirm={() => void remove(r)}
        >
          <Button size="small" type="text" danger icon={<Trash2 size={14} />} loading={busyId === r.id} />
        </Popconfirm>
      ),
    },
  ]

  return (
    <div className="space-y-3">
      {prices.length > 0 ? (
        <Table<AdminPlanPrice>
          columns={columns}
          dataSource={prices}
          rowKey="id"
          size="small"
          pagination={false}
        />
      ) : (
        <Text type="secondary" className="!text-xs">
          No Stripe prices attached yet — paste a Price ID below to enable checkout for this plan.
        </Text>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Stripe price ID (price_…)"
          value={priceId}
          onChange={(e) => setPriceId(e.target.value)}
          onPressEnter={() => void add()}
          style={{ maxWidth: 300 }}
          allowClear
        />
        <Select value={intervalSel} onChange={setIntervalSel} options={INTERVAL_OPTIONS} style={{ width: 120 }} />
        <Select value={kindSel} onChange={setKindSel} options={PRICE_KIND_OPTIONS} style={{ width: 145 }} />
        <Button type="primary" icon={<Plus size={16} />} loading={adding} onClick={() => void add()}>
          Add price
        </Button>
      </div>
    </div>
  )
}

// ── Stripe pricing card: one collapse panel per purchasable plan ─────────────────────────────
function PlanPricing({
  plans,
  onChanged,
}: {
  plans: AdminPlan[]
  onChanged: () => void | Promise<void>
}) {
  // Prices only apply to purchasable tiers — guests and the free tier never carry a Stripe price.
  const priced = plans.filter((p) => !['guest', 'free'].includes(p.code))
  if (priced.length === 0) return null

  const defaultActive = priced.filter((p) => (p.prices ?? []).length > 0).map((p) => p.code)

  return (
    <Card
      className="!border-default mb-6"
      title={
        <span className="flex items-center gap-2">
          <CreditCard size={16} /> Stripe pricing
        </span>
      }
    >
      <div className="flex items-start gap-2 mb-4 text-xs text-gray-500">
        <Info size={14} className="mt-0.5 shrink-0" />
        <span>
          Attach a Stripe <strong>Price ID</strong> to a plan — the amount, currency and product are pulled from
          Stripe automatically. Checkout offers the active price matching the buyer's currency. Toggle{' '}
          <strong>Offered</strong> to show or hide a price without deleting it. A plan needs at least one active
          price before it can be purchased.
        </span>
      </div>
      <Collapse
        defaultActiveKey={defaultActive}
        items={priced.map((p) => {
          const activeCount = (p.prices ?? []).filter((pr) => pr.is_active).length
          return {
            key: p.code,
            label: (
              <span className="flex items-center gap-2">
                <span className="font-medium">{p.name}</span>
                <Text type="secondary" className="font-mono !text-xs">
                  {p.code}
                </Text>
                {activeCount > 0 ? (
                  <Tag color="green" className="!m-0">
                    {activeCount} active price{activeCount > 1 ? 's' : ''}
                  </Tag>
                ) : (
                  <Tag className="!m-0">no active price</Tag>
                )}
              </span>
            ),
            children: <PlanPriceEditor plan={p} onChanged={onChanged} />,
          }
        })}
      />
    </Card>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────────────────────
interface FeatureRow {
  key: string
  feature: AdminFeature
}
type Edits = Record<string, Record<string, PlanEntitlementValue>>

export default function PlansPage() {
  const { plans, features, loading, error, refresh } = usePlans()
  const { message } = App.useApp()
  const [edits, setEdits] = useState<Edits>({})
  const [saving, setSaving] = useState(false)

  const dirtyCount = useMemo(
    () => Object.values(edits).reduce((n, m) => n + Object.keys(m).length, 0),
    [edits],
  )

  const savedValue = (plan: AdminPlan, key: string): PlanEntitlementValue =>
    plan.entitlements?.[key] ?? (features.find((f) => f.key === key)?.default_value ?? '')

  const effectiveValue = (plan: AdminPlan, key: string): PlanEntitlementValue =>
    edits[plan.code]?.[key] ?? savedValue(plan, key)

  // Record a pending edit; if it matches the saved value again, drop it (so it's no longer "dirty").
  const setCell = (plan: AdminPlan, feature: AdminFeature, value: PlanEntitlementValue) => {
    const saved = savedValue(plan, feature.key)
    setEdits((prev) => {
      const planEdits = { ...(prev[plan.code] || {}) }
      if (String(value) === String(saved)) delete planEdits[feature.key]
      else planEdits[feature.key] = value
      const next = { ...prev, [plan.code]: planEdits }
      if (Object.keys(planEdits).length === 0) delete next[plan.code]
      return next
    })
  }

  const revert = () => setEdits({})

  const save = async () => {
    setSaving(true)
    const ops: { plan: string; feature: string; value: PlanEntitlementValue }[] = []
    for (const [planCode, m] of Object.entries(edits))
      for (const [featureKey, value] of Object.entries(m)) ops.push({ plan: planCode, feature: featureKey, value })

    const results = await Promise.all(ops.map((o) => setPlanEntitlement(o.plan, o.feature, o.value)))
    setSaving(false)
    const failed = results.filter((r) => !r.success).length
    if (failed) message.error(`${failed} of ${ops.length} change(s) failed to save`)
    else message.success(`Saved ${ops.length} change(s)`)
    setEdits({})
    await refresh()
  }

  const columns: TableColumnsType<FeatureRow> = [
    {
      title: 'Feature',
      key: 'feature',
      fixed: 'left',
      width: 280,
      render: (_, { feature }) => (
        // The description used to print under every row, which made each row 4-5 lines tall and
        // turned a 15-row table into a wall of prose. It is reference material — needed when you
        // are unsure what a key means, not while scanning values — so it lives behind the (i).
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-1.5">
            <span className="font-medium">{feature.name}</span>
            {feature.description && (
              <Tooltip title={feature.description} styles={{ root: { maxWidth: 340 } }}>
                <Info size={13} className="shrink-0 text-gray-400 cursor-help" aria-label={`About ${feature.name}`} />
              </Tooltip>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-xs text-gray-500 truncate" title={feature.key}>{feature.key}</span>
            <Tag className="!m-0 !text-[10px] !px-1 !leading-4" color="default">{feature.value_type}</Tag>
            {feature.window && <Tag className="!m-0 !text-[10px] !px-1 !leading-4" color="geekblue">{feature.window}</Tag>}
          </div>
        </div>
      ),
    },
    ...plans.map((plan) => ({
      title: <PlanHeader plan={plan} onChanged={refresh} />,
      key: plan.code,
      align: 'center' as const,
      render: (_: unknown, { feature }: FeatureRow) => {
        const dirty = edits[plan.code]?.[feature.key] !== undefined
        return (
          <EntitlementCell
            feature={feature}
            value={effectiveValue(plan, feature.key)}
            dirty={dirty}
            disabled={saving}
            onChange={(value) => setCell(plan, feature, value)}
          />
        )
      },
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
          <Text type="secondary">Edit the limits each membership tier gets, then Save. Nothing is sent until you click Save.</Text>
        </div>
        <Space>
          <Button icon={<RotateCw size={16} />} onClick={() => void refresh()} loading={loading} disabled={dirtyCount > 0}>
            Refresh
          </Button>
          <Button icon={<Undo2 size={16} />} onClick={revert} disabled={dirtyCount === 0 || saving}>
            Revert
          </Button>
          <Button type="primary" icon={<Save size={16} />} onClick={() => void save()} loading={saving} disabled={dirtyCount === 0}>
            Save{dirtyCount ? ` (${dirtyCount})` : ''}
          </Button>
        </Space>
      </div>

      <div className="flex items-center gap-2 mb-4 text-xs text-gray-500">
        <Info size={14} />
        <span>
          Edits are highlighted and staged locally — click <strong>Save</strong> to push all of them, or{' '}
          <strong>Revert</strong> to discard. Refresh is disabled while you have unsaved changes.
        </span>
      </div>

      {error && !loading ? (
        <Card className="!border-default">
          <Empty description={error}><Button type="primary" onClick={() => void refresh()}>Try again</Button></Empty>
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

      <PlanPricing plans={plans} onChanged={refresh} />

      <UserLookup />
    </div>
  )
}

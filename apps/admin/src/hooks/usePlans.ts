import { useCallback, useEffect, useState } from 'react'
import {
  getAdminPlans,
  getAdminFeatures,
  type AdminPlan,
  type AdminFeature,
} from '@resomix/api-client'

interface UsePlansResult {
  plans: AdminPlan[]
  features: AdminFeature[]
  loading: boolean
  error: string | null
  lastUpdated: number | null
  refresh: () => Promise<void>
  /** Replace one plan in local state (after an edit) without a full refetch. */
  patchPlan: (plan: AdminPlan) => void
}

/**
 * Loads the frontend plans + the feature catalog for the admin plan editor.
 * Both come from the 7.1 admin API (`/admin/plans`, `/admin/features`).
 */
export function usePlans(): UsePlansResult {
  const [plans, setPlans] = useState<AdminPlan[]>([])
  const [features, setFeatures] = useState<AdminFeature[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<number | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [plansRes, featuresRes] = await Promise.all([getAdminPlans(), getAdminFeatures()])
      if (plansRes.success && plansRes.data) {
        setPlans(plansRes.data)
      } else {
        setError(plansRes.error || 'Failed to load plans.')
      }
      if (featuresRes.success && featuresRes.data) {
        setFeatures(featuresRes.data)
      } else if (!plansRes.error) {
        setError(featuresRes.error || 'Failed to load features.')
      }
      setLastUpdated(Date.now())
    } finally {
      setLoading(false)
    }
  }, [])

  const patchPlan = useCallback((plan: AdminPlan) => {
    setPlans((prev) => prev.map((p) => (p.code === plan.code ? plan : p)))
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { plans, features, loading, error, lastUpdated, refresh, patchPlan }
}

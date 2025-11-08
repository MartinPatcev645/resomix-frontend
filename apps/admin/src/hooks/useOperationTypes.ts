import { useCallback, useEffect, useRef, useState } from 'react'
import { getOperationTypes, type AdminOperationType } from '@resomix/api-client'
import { message } from 'antd'

interface UseOperationTypesOptions {
  onError?: (title: string, message: string) => void
}

interface UseOperationTypesResult {
  operationTypes: AdminOperationType[]
  loading: boolean
  total: number
  lastUpdated: number | null
  refresh: () => Promise<void>
}

export function useOperationTypes(options?: UseOperationTypesOptions): UseOperationTypesResult {
  const { onError } = options || {}
  const onErrorRef = useRef(onError)
  const [operationTypes, setOperationTypes] = useState<AdminOperationType[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [lastUpdated, setLastUpdated] = useState<number | null>(null)

  useEffect(() => {
    onErrorRef.current = onError
  }, [onError])

  const fetchOperationTypes = useCallback(async () => {
    setLoading(true)
    try {
      const result = await getOperationTypes()

      if (result.success && result.data) {
        setOperationTypes(result.data)
        setTotal(result.total ?? result.data.length)
        setLastUpdated(Date.now())
      } else {
        const errorMsg = result.error || 'Failed to load operation types'
        if (onErrorRef.current) {
          onErrorRef.current('Operation Types Error', errorMsg)
        } else {
          message.error(errorMsg)
        }
        setOperationTypes([])
        setTotal(0)
      }
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : 'Failed to load operation types'
      if (onErrorRef.current) {
        onErrorRef.current('Operation Types Error', errorMsg)
      } else {
        message.error(errorMsg)
      }
      setOperationTypes([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchOperationTypes()
  }, [fetchOperationTypes])

  return {
    operationTypes,
    loading,
    total,
    lastUpdated,
    refresh: fetchOperationTypes,
  }
}



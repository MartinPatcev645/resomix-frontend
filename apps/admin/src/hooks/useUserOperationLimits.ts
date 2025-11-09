import { useCallback, useEffect, useRef, useState } from 'react'
import { message } from 'antd'
import {
  deleteUserOperationLimit,
  getUserOperationLimit,
  getUserOperationLimits,
  upsertUserOperationLimit,
  type AdminUserOperationLimit,
  type AdminUserOperationLimitListParams,
  type AdminUserOperationLimitUpsertRequest,
} from '@resomix/api-client'

interface UseUserOperationLimitsOptions {
  onError?: (title: string, message: string) => void
  onSuccess?: (title: string, message: string) => void
}

interface UseUserOperationLimitsResult {
  data: AdminUserOperationLimit[]
  loading: boolean
  pagination: {
    current: number
    pageSize: number
    total: number
    totalPages: number
  }
  search: string
  operationCode: string | undefined
  refresh: () => Promise<void>
  setPage: (page: number, pageSize?: number) => void
  setSearch: (value: string) => void
  setOperationCode: (code?: string) => void
  clearFilters: () => void
  upsertLimit: (
    payload: AdminUserOperationLimitUpsertRequest,
    options?: { force?: boolean }
  ) => Promise<{
    ok: boolean
    conflict?: AdminUserOperationLimit
    error?: string
  }>
  deleteLimit: (userIdentifier: string, operationCode: string) => Promise<boolean>
  loadLimit: (
    userIdentifier: string,
    operationCode: string
  ) => Promise<AdminUserOperationLimit | null>
}

export function useUserOperationLimits(
  options?: UseUserOperationLimitsOptions
): UseUserOperationLimitsResult {
  const { onError, onSuccess } = options || {}
  const onErrorRef = useRef(onError)
  const onSuccessRef = useRef(onSuccess)

  const [data, setData] = useState<AdminUserOperationLimit[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPageState] = useState(1)
  const [pageSize, setPageSizeState] = useState(30)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [search, setSearchState] = useState('')
  const [operationCode, setOperationCodeState] = useState<string | undefined>(undefined)

  useEffect(() => {
    onErrorRef.current = onError
  }, [onError])

  useEffect(() => {
    onSuccessRef.current = onSuccess
  }, [onSuccess])

  const notifyError = useCallback((title: string, description: string) => {
    if (onErrorRef.current) {
      onErrorRef.current(title, description)
    } else {
      message.error(description)
    }
  }, [])

  const notifySuccess = useCallback((title: string, description: string) => {
    if (onSuccessRef.current) {
      onSuccessRef.current(title, description)
    } else {
      message.success(description)
    }
  }, [])

  const buildParams = useCallback((): AdminUserOperationLimitListParams => {
    const params: AdminUserOperationLimitListParams = {
      page,
      page_size: pageSize,
    }

    if (search.trim()) {
      params.search = search.trim()
    }

    if (operationCode) {
      params.operation_code = operationCode
    }

    return params
  }, [page, pageSize, search, operationCode])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = buildParams()
      const result = await getUserOperationLimits(params)

      if (result.success && result.data && result.pagination) {
        setData(result.data)
        setTotal(result.pagination.total)
        setTotalPages(result.pagination.total_pages)
      } else {
        const errorMsg = result.error || 'Failed to load user operation limits'
        notifyError('Operation Limits Error', errorMsg)
        setData([])
        setTotal(0)
        setTotalPages(0)
      }
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : 'Failed to load user operation limits'
      notifyError('Operation Limits Error', errorMsg)
      setData([])
      setTotal(0)
      setTotalPages(0)
    } finally {
      setLoading(false)
    }
  }, [buildParams, notifyError])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const refresh = useCallback(async () => {
    await fetchData()
  }, [fetchData])

  const setPage = (newPage: number, newPageSize?: number) => {
    setPageState(newPage)
    if (newPageSize && newPageSize !== pageSize) {
      setPageSizeState(newPageSize)
    }
  }

  const setSearch = (value: string) => {
    setSearchState(value)
    setPageState(1)
  }

  const setOperationCode = (code?: string) => {
    setOperationCodeState(code || undefined)
    setPageState(1)
  }

  const clearFilters = () => {
    setSearchState('')
    setOperationCodeState(undefined)
    setPageState(1)
    setPageSizeState(30)
  }

  const upsertLimit = async (
    payload: AdminUserOperationLimitUpsertRequest,
    options?: { force?: boolean }
  ) => {
    const result = await upsertUserOperationLimit(payload, options)

    if (result.success) {
      notifySuccess(
        'Operation Limit Saved',
        `Successfully saved limit for ${payload.operation_code}.`
      )
      await fetchData()
      return { ok: true as const }
    }

    const conflictData = result.data
    const errorMsg = result.error || 'Failed to save operation limit'

    if (conflictData) {
      return {
        ok: false as const,
        conflict: conflictData,
        error: errorMsg,
      }
    }

    notifyError('Save Failed', errorMsg)
    return {
      ok: false as const,
      error: errorMsg,
    }
  }

  const deleteLimit = async (userIdentifier: string, code: string) => {
    const result = await deleteUserOperationLimit(userIdentifier, code)

    if (result.success) {
      notifySuccess('Operation Limit Deleted', 'The user operation limit was deleted successfully.')
      await fetchData()
      return true
    }

    const errorMsg = result.error || 'Failed to delete operation limit'
    notifyError('Delete Failed', errorMsg)
    return false
  }

  const loadLimit = async (userIdentifier: string, code: string) => {
    const result = await getUserOperationLimit(userIdentifier, code)

    if (result.success && result.data) {
      return result.data
    }

    const errorMsg = result.error || 'Failed to load operation limit'
    notifyError('Load Failed', errorMsg)
    return null
  }

  return {
    data,
    loading,
    pagination: {
      current: page,
      pageSize,
      total,
      totalPages,
    },
    search,
    operationCode,
    refresh,
    setPage,
    setSearch,
    setOperationCode,
    clearFilters,
    upsertLimit,
    deleteLimit,
    loadLimit,
  }
}



import { useCallback, useEffect, useRef, useState } from 'react'
import { message } from 'antd'
import {
  createSpotifyApp,
  deleteSpotifyApp,
  getSpotifyApp,
  getSpotifyApps,
  updateSpotifyApp,
  type AdminSpotifyApp,
  type AdminSpotifyAppCreateRequest,
  type AdminSpotifyAppDeleteParams,
  type AdminSpotifyAppListParams,
  type AdminSpotifyAppUpdateRequest,
} from '@resomix/api-client'

interface UseSpotifyAppsOptions {
  onError?: (title: string, message: string) => void
  onSuccess?: (title: string, message: string) => void
}

interface UseSpotifyAppsResult {
  apps: AdminSpotifyApp[]
  loading: boolean
  pagination: {
    current: number
    pageSize: number
    total: number
    count: number
  }
  isActive: boolean | undefined
  search: string
  lastUpdated: number | null
  refresh: () => Promise<void>
  setPage: (page: number, pageSize?: number) => void
  setIsActive: (value?: boolean) => void
  setSearch: (value: string) => void
  clearFilters: () => void
  createApp: (payload: AdminSpotifyAppCreateRequest) => Promise<boolean>
  updateApp: (appId: number, payload: AdminSpotifyAppUpdateRequest) => Promise<boolean>
  deleteApp: (appId: number, params?: AdminSpotifyAppDeleteParams) => Promise<boolean>
  loadApp: (appId: number, includeSecret?: boolean) => Promise<AdminSpotifyApp | null>
}

export function useSpotifyApps(options?: UseSpotifyAppsOptions): UseSpotifyAppsResult {
  const { onError, onSuccess } = options || {}
  const onErrorRef = useRef(onError)
  const onSuccessRef = useRef(onSuccess)

  const [apps, setApps] = useState<AdminSpotifyApp[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPageState] = useState(1)
  const [pageSize, setPageSizeState] = useState(100)
  const [total, setTotal] = useState(0)
  const [count, setCount] = useState(0)
  const [isActive, setIsActiveState] = useState<boolean | undefined>(undefined)
  const [search, setSearchState] = useState('')
  const [lastUpdated, setLastUpdated] = useState<number | null>(null)

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

  const buildParams = useCallback((): AdminSpotifyAppListParams => {
    const params: AdminSpotifyAppListParams = {
      page,
      page_size: pageSize,
    }

    if (isActive !== undefined) {
      params.is_active = isActive
    }

    if (search.trim()) {
      params.search = search.trim()
    }

    return params
  }, [page, pageSize, isActive, search])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = buildParams()
      const result = await getSpotifyApps(params)

      if (result.success && result.data && result.pagination) {
        setApps(result.data)
        setTotal(result.pagination.total)
        setCount(result.pagination.count)
        setLastUpdated(Date.now())
      } else {
        const errorMsg = result.error || 'Failed to load Spotify apps'
        notifyError('Spotify Apps Error', errorMsg)
        setApps([])
        setTotal(0)
        setCount(0)
      }
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : 'Failed to load Spotify apps'
      notifyError('Spotify Apps Error', errorMsg)
      setApps([])
      setTotal(0)
      setCount(0)
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

  const setIsActive = (value?: boolean) => {
    setIsActiveState(value)
    setPageState(1)
  }

  const setSearch = (value: string) => {
    setSearchState(value)
    setPageState(1)
  }

  const clearFilters = () => {
    setSearchState('')
    setIsActiveState(undefined)
    setPageState(1)
    setPageSizeState(100)
  }

  const createApp = async (payload: AdminSpotifyAppCreateRequest) => {
    const result = await createSpotifyApp(payload)

    if (result.success) {
      notifySuccess('Spotify App Created', `Successfully created app "${payload.name}".`)
      await fetchData()
      return true
    }

    const errorMsg = result.error || 'Failed to create Spotify app'
    notifyError('Create Failed', errorMsg)
    return false
  }

  const updateApp = async (appId: number, payload: AdminSpotifyAppUpdateRequest) => {
    const result = await updateSpotifyApp(appId, payload)

    if (result.success) {
      notifySuccess('Spotify App Updated', 'The Spotify app was updated successfully.')
      await fetchData()
      return true
    }

    const errorMsg = result.error || 'Failed to update Spotify app'
    notifyError('Update Failed', errorMsg)
    return false
  }

  const deleteApp = async (appId: number, params?: AdminSpotifyAppDeleteParams) => {
    const result = await deleteSpotifyApp(appId, params)

    if (result.success) {
      notifySuccess('Spotify App Deleted', 'The Spotify app was deleted successfully.')
      await fetchData()
      return true
    }

    const errorMsg = result.error || 'Failed to delete Spotify app'
    notifyError('Delete Failed', errorMsg)
    return false
  }

  const loadApp = async (appId: number, includeSecret: boolean = true) => {
    const result = await getSpotifyApp(appId, includeSecret)

    if (result.success && result.data) {
      return result.data
    }

    const errorMsg = result.error || 'Failed to load Spotify app'
    notifyError('Load Failed', errorMsg)
    return null
  }

  return {
    apps,
    loading,
    pagination: {
      current: page,
      pageSize,
      total,
      count,
    },
    isActive,
    search,
    lastUpdated,
    refresh,
    setPage,
    setIsActive,
    setSearch,
    clearFilters,
    createApp,
    updateApp,
    deleteApp,
    loadApp,
  }
}


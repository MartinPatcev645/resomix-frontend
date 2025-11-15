import { useCallback, useEffect, useRef, useState } from 'react'
import { message } from 'antd'
import {
  deleteSpotifyAppUser,
  getSpotifyAppUser,
  getSpotifyAppUsers,
  upsertSpotifyAppUser,
  type AdminSpotifyAppUser,
  type AdminSpotifyAppUserListParams,
  type AdminSpotifyAppUserUpsertRequest,
} from '@resomix/api-client'

interface UseSpotifyAppUsersOptions {
  onError?: (title: string, message: string) => void
  onSuccess?: (title: string, message: string) => void
}

interface UseSpotifyAppUsersResult {
  data: AdminSpotifyAppUser[]
  loading: boolean
  pagination: {
    current: number
    pageSize: number
    total: number
    count: number
  }
  search: string
  spotifyAppId: number | undefined
  refresh: () => Promise<void>
  setPage: (page: number, pageSize?: number) => void
  setSearch: (value: string) => void
  setSpotifyAppId: (id?: number) => void
  clearFilters: () => void
  upsertUser: (payload: AdminSpotifyAppUserUpsertRequest) => Promise<boolean>
  deleteUser: (userIdentifier: string) => Promise<boolean>
  loadUser: (userIdentifier: string) => Promise<AdminSpotifyAppUser | null>
}

export function useSpotifyAppUsers(
  options?: UseSpotifyAppUsersOptions
): UseSpotifyAppUsersResult {
  const { onError, onSuccess } = options || {}
  const onErrorRef = useRef(onError)
  const onSuccessRef = useRef(onSuccess)

  const [data, setData] = useState<AdminSpotifyAppUser[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPageState] = useState(1)
  const [pageSize, setPageSizeState] = useState(30)
  const [total, setTotal] = useState(0)
  const [count, setCount] = useState(0)
  const [search, setSearchState] = useState('')
  const [spotifyAppId, setSpotifyAppIdState] = useState<number | undefined>(undefined)

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

  const buildParams = useCallback((): AdminSpotifyAppUserListParams => {
    const params: AdminSpotifyAppUserListParams = {
      page,
      page_size: pageSize,
    }

    if (search.trim()) {
      params.search = search.trim()
    }

    if (spotifyAppId) {
      params.spotify_app_id = spotifyAppId
    }

    return params
  }, [page, pageSize, search, spotifyAppId])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = buildParams()
      const result = await getSpotifyAppUsers(params)

      if (result.success && result.data && result.pagination) {
        setData(result.data)
        setTotal(result.pagination.total)
        setCount(result.pagination.count)
      } else {
        const errorMsg = result.error || 'Failed to load Spotify app users'
        notifyError('Spotify App Users Error', errorMsg)
        setData([])
        setTotal(0)
        setCount(0)
      }
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : 'Failed to load Spotify app users'
      notifyError('Spotify App Users Error', errorMsg)
      setData([])
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

  const setSearch = (value: string) => {
    setSearchState(value)
    setPageState(1)
  }

  const setSpotifyAppId = (id?: number) => {
    setSpotifyAppIdState(id)
    setPageState(1)
  }

  const clearFilters = () => {
    setSearchState('')
    setSpotifyAppIdState(undefined)
    setPageState(1)
    setPageSizeState(30)
  }

  const upsertUser = async (payload: AdminSpotifyAppUserUpsertRequest) => {
    const result = await upsertSpotifyAppUser(payload)

    if (result.success) {
      notifySuccess(
        'User Association Saved',
        `Successfully associated user with Spotify app.`
      )
      await fetchData()
      return true
    }

    const errorMsg = result.error || 'Failed to save user association'
    notifyError('Save Failed', errorMsg)
    return false
  }

  const deleteUser = async (userIdentifier: string) => {
    const result = await deleteSpotifyAppUser(userIdentifier)

    if (result.success) {
      notifySuccess(
        'User Association Deleted',
        'The user association was deleted successfully.'
      )
      await fetchData()
      return true
    }

    const errorMsg = result.error || 'Failed to delete user association'
    notifyError('Delete Failed', errorMsg)
    return false
  }

  const loadUser = async (userIdentifier: string) => {
    const result = await getSpotifyAppUser(userIdentifier)

    if (result.success && result.data) {
      return result.data
    }

    const errorMsg = result.error || 'Failed to load user association'
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
      count,
    },
    search,
    spotifyAppId,
    refresh,
    setPage,
    setSearch,
    setSpotifyAppId,
    clearFilters,
    upsertUser,
    deleteUser,
    loadUser,
  }
}


import { useState, useEffect, useCallback } from 'react';
import {
  listAdminTracks,
  setTrackLive,
  stopTrack,
  type AdminTrack,
  type ListTracksParams
} from '@resomix/api-client';
import { message } from 'antd';

export function useAdminTracks() {
  const [tracks, setTracks] = useState<AdminTrack[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0,
  });

  // Filters
  const [partnerFilter, setPartnerFilter] = useState<number | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<boolean | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedQuery, setDebouncedQuery] = useState<string>('');

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reset page to 1 when filters or queries change
  useEffect(() => {
    setPagination(prev => ({ ...prev, current: 1 }));
  }, [partnerFilter, statusFilter, debouncedQuery]);

  const fetchTracks = useCallback(async () => {
    setLoading(true);
    try {
      const params: ListTracksParams = {
        page: pagination.current,
        page_size: pagination.pageSize,
        partner_id: partnerFilter,
        is_active: statusFilter,
      };

      // Since backend doesn't search natively in listAdminTracks, we can optionally send it or filter client-side, but let's query as-is
      if (debouncedQuery) {
        (params as any).q = debouncedQuery;
      }

      const result = await listAdminTracks(params);
      if (result && result.tracks) {
        setTracks(result.tracks);
        setPagination(prev => ({
          ...prev,
          total: (result as any).pagination?.total || result.tracks.length,
        }));
      }
    } catch {
      message.error('Failed to load tracks');
    } finally {
      setLoading(false);
    }
  }, [pagination.current, pagination.pageSize, partnerFilter, statusFilter, debouncedQuery]);

  const activateTrack = async (trackId: number) => {
    try {
      const result = await setTrackLive(trackId);
      if (result && (result.status === 'success' || result.status === 'partial')) {
        message.success('Track is now live in search index');
        fetchTracks();
        return true;
      }
      message.error('Failed to activate track. Embeddings might be missing.');
      return false;
    } catch {
      message.error('Failed to set track live');
      return false;
    }
  };

  const deactivateTrack = async (trackId: number, deleteEmbeddingFile = false) => {
    try {
      const result = await stopTrack(trackId, deleteEmbeddingFile);
      if (result && result.status === 'success') {
        message.success('Track stopped and removed from search index');
        fetchTracks();
        return true;
      }
      message.error('Failed to stop track');
      return false;
    } catch {
      message.error('Failed to stop track');
      return false;
    }
  };

  const handlePageChange = (page: number, pageSize: number) => {
    setPagination(prev => ({ ...prev, current: page, pageSize }));
  };

  useEffect(() => {
    fetchTracks();
  }, [fetchTracks]);

  return {
    tracks,
    loading,
    pagination,
    partnerFilter,
    setPartnerFilter,
    statusFilter,
    setStatusFilter,
    searchQuery,
    setSearchQuery,
    fetchTracks,
    activateTrack,
    deactivateTrack,
    handlePageChange,
  };
}

import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  listPartners, 
  createPartner as apiCreatePartner, 
  listApiKeys, 
  issueApiKey as apiIssueApiKey,
  revokeApiKey as apiRevokeApiKey,
  rotateApiKey as apiRotateApiKey,
  updatePartner as apiUpdatePartner,
  deletePartner as apiDeletePartner,
  type Partner,
  type PartnerApiKey,
  type PartnerCreateRequest,
  type ApiKeyIssueRequest,
  type PartnerListParams
} from '@resomix/api-client';
import { message } from 'antd';

interface UsePartnersOptions {
  onError?: (title: string, message: string) => void;
  onSuccess?: (title: string, message: string) => void;
}

export function usePartners(options?: UsePartnersOptions) {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 30,
    total: 0,
  });

  // Partner Filters
  const [tierFilter, setTierFilter] = useState<string | undefined>(undefined);
  const [activeFilter, setActiveFilter] = useState<boolean | undefined>(undefined);

  // API Key State (for a selected partner)
  const [apiKeys, setApiKeys] = useState<PartnerApiKey[]>([]);
  const [keysLoading, setKeysLoading] = useState(false);
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);

  const fetchPartners = useCallback(async () => {
    setLoading(true);
    try {
      const params: PartnerListParams = {
        page: pagination.current,
        page_size: pagination.pageSize,
        tier: tierFilter,
        is_active: activeFilter,
      };

      const result = await listPartners(params);
      
      if (result.success) {
        setPartners(result.data);
        // Only update total if it actually changed to avoid unnecessary re-renders
        if (result.pagination.total !== pagination.total) {
          setPagination(prev => ({
            ...prev,
            total: result.pagination.total,
          }));
        }
      } else {
        const errorMsg = (result as { error?: string }).error || 'Failed to fetch partners';
        if (optionsRef.current?.onError) optionsRef.current.onError('Load Failed', errorMsg);
        else message.error(errorMsg);
      }
    } catch (_error) {
      const errorMsg = _error instanceof Error ? _error.message : 'An error occurred';
      if (optionsRef.current?.onError) optionsRef.current.onError('Error', errorMsg);
      else message.error(errorMsg);
    } finally {
      setLoading(false);
    }
  }, [pagination.current, pagination.pageSize, pagination.total, tierFilter, activeFilter]);

  useEffect(() => {
    fetchPartners();
  }, [fetchPartners]);

  const fetchApiKeys = async (partnerId: number) => {
    setKeysLoading(true);
    try {
      const result = await listApiKeys(partnerId);
      if (result.success) {
        setApiKeys(result.data);
      } else {
        message.error('Failed to fetch API keys');
      }
    } catch {
      message.error('Error fetching API keys');
    } finally {
      setKeysLoading(false);
    }
  };

  const updatePartner = async (id: number, data: Partial<PartnerCreateRequest>) => {
    try {
      const result = await apiUpdatePartner(id, data);
      if (result.success) {
        if (optionsRef.current?.onSuccess) optionsRef.current.onSuccess('Partner Updated', 'The partner information has been updated.');
        else message.success('Partner updated');
        fetchPartners();
        return true;
      } else {
        const errorMsg = result.error || 'Failed to update partner';
        if (optionsRef.current?.onError) optionsRef.current.onError('Update Failed', errorMsg);
        else message.error(errorMsg);
        return false;
      }
    } catch {
      message.error('Error updating partner');
      return false;
    }
  };

  const deletePartner = async (id: number) => {
    try {
      const result = await apiDeletePartner(id);
      if (result.success) {
        if (optionsRef.current?.onSuccess) optionsRef.current.onSuccess('Partner Deleted', 'The partner has been removed.');
        else message.success('Partner deleted');
        fetchPartners();
        return true;
      } else {
        if (optionsRef.current?.onError) optionsRef.current.onError('Delete Failed', 'Failed to delete partner');
        else message.error('Failed to delete partner');
        return false;
      }
    } catch {
      message.error('Error deleting partner');
      return false;
    }
  };

  const createPartner = async (data: PartnerCreateRequest) => {
    try {
      const result = await apiCreatePartner(data);
      if (result.success) {
        if (optionsRef.current?.onSuccess) optionsRef.current.onSuccess('Partner Created', `Successfully created ${data.display_name}`);
        else message.success('Partner created successfully');
        fetchPartners();
        return true;
      } else {
        const errorMsg = result.error || 'Failed to create partner';
        if (optionsRef.current?.onError) optionsRef.current.onError('Creation Failed', errorMsg);
        else message.error(errorMsg);
        return false;
      }
    } catch {
      message.error('Error creating partner');
      return false;
    }
  };

  const issueApiKey = async (data: ApiKeyIssueRequest) => {
    try {
      const result = await apiIssueApiKey(data);
      if (result.success) {
        if (optionsRef.current?.onSuccess) optionsRef.current.onSuccess('API Key Issued', 'The new API key has been generated.');
        else message.success('API key issued');
        if (selectedPartner) fetchApiKeys(selectedPartner.id);
        return result.data;
      } else {
        message.error('Failed to issue API key');
        return null;
      }
    } catch {
      message.error('Error issuing API key');
      return null;
    }
  };

  const revokeKey = async (id: number, reason: string) => {
    try {
      const result = await apiRevokeApiKey({ api_key_id: id, reason });
      if (result.success) {
        if (optionsRef.current?.onSuccess) optionsRef.current.onSuccess('API Key Revoked', 'The key has been invalidated.');
        else message.success('API key revoked');
        if (selectedPartner) fetchApiKeys(selectedPartner.id);
        return true;
      } else {
        if (optionsRef.current?.onError) optionsRef.current.onError('Revocation Failed', 'Failed to revoke API key');
        else message.error('Failed to revoke API key');
        return false;
      }
    } catch {
      message.error('Error revoking API key');
      return false;
    }
  };

  const rotateKey = async (id: number, label?: string) => {
    try {
      const result = await apiRotateApiKey({ api_key_id: id, label });
      if (result.success) {
        if (optionsRef.current?.onSuccess) optionsRef.current.onSuccess('API Key Rotated', 'Old key revoked, new key issued.');
        else message.success('API key rotated');
        if (selectedPartner) fetchApiKeys(selectedPartner.id);
        return result.data;
      } else {
        message.error('Failed to rotate API key');
        return null;
      }
    } catch {
      message.error('Error rotating API key');
      return null;
    }
  };

  const handlePageChange = (page: number, pageSize: number) => {
    setPagination(prev => ({ ...prev, current: page, pageSize }));
  };

  return {
    partners,
    loading,
    pagination,
    tierFilter,
    activeFilter,
    setTierFilter,
    setActiveFilter,
    selectedPartner,
    setSelectedPartner,
    apiKeys,
    keysLoading,
    fetchPartners,
    fetchApiKeys,
    createPartner,
    issueApiKey,
    revokeKey,
    rotateKey,
    updatePartner,
    deletePartner,
    handlePageChange,
  };
}

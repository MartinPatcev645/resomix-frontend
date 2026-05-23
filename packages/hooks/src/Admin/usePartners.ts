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
  getPartnerDetail as apiGetPartnerDetail,
  provisionSftpPartner as apiProvisionSftp,
  getSftpStatus as apiGetSftpStatus,
  retrySftpProvisioning as apiRetrySftp,
  getPartnerWebhooks,
  createPartnerWebhook,
  updatePartnerWebhook,
  listFailedWebhookLogs,
  retryWebhookDelivery,
  createStripeCheckoutSession,
  type Partner,
  type PartnerApiKey,
  type PartnerCreateRequest,
  type ApiKeyIssueRequest,
  type PartnerListParams,
  type SftpProvisionRequest,
  type SftpProvisionResponse,
  type SftpStatusResponse,
  type WebhookConfig,
  type WebhookDeliveryLog
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

  // Webhooks & Logs State
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([]);
  const [failedLogs, setFailedLogs] = useState<WebhookDeliveryLog[]>([]);
  const [webhooksLoading, setWebhooksLoading] = useState(false);
  const [logsLoading, setLogsLoading] = useState(false);

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

  const getPartnerDetail = async (partnerId: number) => {
    try {
      const result = await apiGetPartnerDetail(partnerId);
      return result;
    } catch {
      message.error('Error fetching partner details');
      return null;
    }
  };

  const provisionSftp = async (payload: SftpProvisionRequest): Promise<SftpProvisionResponse | null> => {
    try {
      const result = await apiProvisionSftp(payload);
      if (result.success) {
        if (optionsRef.current?.onSuccess) optionsRef.current.onSuccess('SFTP Provisioned', 'SFTP access has been provisioned for the partner.');
        else message.success('SFTP provisioned successfully');
        return result;
      } else {
        const errorMsg = result.error || 'Failed to provision SFTP';
        if (optionsRef.current?.onError) optionsRef.current.onError('Provisioning Failed', errorMsg);
        else message.error(errorMsg);
        return null;
      }
    } catch {
      message.error('Error provisioning SFTP');
      return null;
    }
  };

  const getSftpStatus = async (partnerId: number): Promise<SftpStatusResponse | null> => {
    try {
      const result = await apiGetSftpStatus(partnerId);
      return result;
    } catch {
      message.error('Error fetching SFTP status');
      return null;
    }
  };

  const retrySftp = async (partnerId: number): Promise<SftpProvisionResponse | null> => {
    try {
      const result = await apiRetrySftp(partnerId);
      if (result.success) {
        if (optionsRef.current?.onSuccess) optionsRef.current.onSuccess('SFTP Retry Queued', 'SFTP provisioning retry has been initiated.');
        else message.success('SFTP retry initiated');
        return result;
      } else {
        const errorMsg = result.error || 'Failed to retry SFTP provisioning';
        if (optionsRef.current?.onError) optionsRef.current.onError('Retry Failed', errorMsg);
        else message.error(errorMsg);
        return null;
      }
    } catch {
      message.error('Error retrying SFTP provisioning');
      return null;
    }
  };

  const fetchPartnerWebhooks = async (partnerId: number) => {
    setWebhooksLoading(true);
    try {
      const result = await getPartnerWebhooks(partnerId);
      if (result.success) {
        setWebhooks(result.data);
      } else {
        message.error(result.error || 'Failed to fetch webhooks');
      }
    } catch {
      message.error('Error fetching webhooks');
    } finally {
      setWebhooksLoading(false);
    }
  };

  const saveWebhookConfig = async (webhookId: number | null, payload: WebhookConfig) => {
    setWebhooksLoading(true);
    try {
      if (webhookId) {
        const result = await updatePartnerWebhook(webhookId, payload);
        if (result.success) {
          message.success('Webhook configuration updated successfully');
          fetchPartnerWebhooks(payload.partner_id);
          return true;
        }
      } else {
        const result = await createPartnerWebhook(payload);
        if (result.success) {
          message.success('Webhook configured successfully');
          fetchPartnerWebhooks(payload.partner_id);
          return result;
        }
      }
    } catch {
      message.error('Error saving webhook configuration');
    } finally {
      setWebhooksLoading(false);
    }
    return false;
  };

  const fetchFailedWebhookLogs = async () => {
    setLogsLoading(true);
    try {
      const result = await listFailedWebhookLogs();
      if (result.success) {
        setFailedLogs(result.data);
      } else {
        message.error(result.error || 'Failed to fetch failed webhook logs');
      }
    } catch {
      message.error('Error fetching failed webhook logs');
    } finally {
      setLogsLoading(false);
    }
  };

  const retryWebhook = async (logId: number) => {
    setLogsLoading(true);
    try {
      const result = await retryWebhookDelivery(logId);
      if (result.success) {
        message.success(result.message || 'Webhook retry triggered successfully');
        fetchFailedWebhookLogs();
        return true;
      } else {
        message.error(result.error || 'Failed to retry webhook delivery');
      }
    } catch {
      message.error('Error retrying webhook delivery');
    } finally {
      setLogsLoading(false);
    }
    return false;
  };

  const initiateB2bCheckout = async (partnerId: number, values: { tier: string; billing_cycle: string; po_number?: string }) => {
    try {
      const result = await createStripeCheckoutSession(partnerId, values);
      if (result.success && result.checkout_url) {
        message.success('Stripe B2B Checkout URL generated successfully!');
        window.open(result.checkout_url, '_blank');
        return result.checkout_url;
      } else {
        message.error(result.error || 'Failed to generate Stripe Checkout URL');
      }
    } catch {
      message.error('Error initiating Stripe Checkout Session');
    }
    return null;
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
    webhooks,
    failedLogs,
    webhooksLoading,
    logsLoading,
    fetchPartners,
    fetchApiKeys,
    createPartner,
    issueApiKey,
    revokeKey,
    rotateKey,
    updatePartner,
    deletePartner,
    getPartnerDetail,
    provisionSftp,
    getSftpStatus,
    retrySftp,
    fetchPartnerWebhooks,
    saveWebhookConfig,
    fetchFailedWebhookLogs,
    retryWebhook,
    initiateB2bCheckout,
    handlePageChange,
  };
}

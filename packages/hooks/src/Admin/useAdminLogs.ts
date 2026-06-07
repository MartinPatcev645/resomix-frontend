import { useState, useEffect, useCallback } from 'react';
import {
  listFailedWebhookLogs,
  retryWebhookDelivery,
  rebuildSimilarityIndex,
  createPromoCode,
  type WebhookDeliveryLog,
  type PromoCreateRequest
} from '@resomix/api-client';
import { message } from 'antd';

export function useAdminLogs() {
  const [webhookLogs, setWebhookLogs] = useState<WebhookDeliveryLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  const fetchWebhookLogs = useCallback(async (partnerId?: number) => {
    setLogsLoading(true);
    try {
      const result = await listFailedWebhookLogs(partnerId);
      if (result && result.success) {
        setWebhookLogs(result.data);
      }
    } catch {
      message.error('Failed to load failed webhook delivery logs');
    } finally {
      setLogsLoading(false);
    }
  }, []);

  const retryWebhook = async (logId: number) => {
    try {
      const result = await retryWebhookDelivery(logId);
      if (result && result.success) {
        message.success(result.message || 'Webhook delivery retry triggered');
        fetchWebhookLogs();
        return true;
      }
      message.error(result.error || 'Failed to retry webhook delivery');
      return false;
    } catch {
      message.error('Failed to retry webhook delivery');
      return false;
    }
  };

  const rebuildIndex = async () => {
    try {
      const result = await rebuildSimilarityIndex();
      if (result && result.success) {
        message.success('FAISS similarity search index rebuild started successfully');
        return true;
      }
      message.error('Failed to rebuild similarity index');
      return false;
    } catch {
      message.error('Error rebuilding similarity index');
      return false;
    }
  };

  const createPromo = async (data: PromoCreateRequest) => {
    try {
      const result = await createPromoCode(data);
      if (result && result.success) {
        message.success('Promo code created successfully');
        return true;
      }
      message.error('Failed to create promo code');
      return false;
    } catch {
      message.error('Error creating promo code');
      return false;
    }
  };

  useEffect(() => {
    fetchWebhookLogs();
  }, [fetchWebhookLogs]);

  return {
    webhookLogs,
    logsLoading,
    fetchWebhookLogs,
    retryWebhook,
    rebuildIndex,
    createPromo,
  };
}

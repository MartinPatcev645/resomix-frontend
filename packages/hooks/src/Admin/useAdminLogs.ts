import { useState, useEffect, useCallback } from 'react';
import {
  listFailedWebhookLogs,
  retryWebhookDelivery,
  rebuildSimilarityIndex,
  createPromoCode,
  getSystemLogs,
  getSystemLogDetail,
  getSystemLogsStats,
  getSystemLogsOverview,
  getOperationLogs,
  getOperationLogDetail,
  type WebhookDeliveryLog,
  type PromoCreateRequest,
  type SystemLog,
  type SystemLogsStats,
  type SystemOverviewStats,
  type OperationLog,
  type ListSystemLogsParams,
  type ListOperationLogsParams,
  type PaginationEnvelope
} from '@resomix/api-client';
import { message } from 'antd';

export function useAdminLogs() {
  const [webhookLogs, setWebhookLogs] = useState<WebhookDeliveryLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  // System Logs State
  const [systemLogs, setSystemLogs] = useState<SystemLog[]>([]);
  const [systemLogsLoading, setSystemLogsLoading] = useState(false);
  const [systemLogsPagination, setSystemLogsPagination] = useState<PaginationEnvelope | null>(null);
  const [systemLogsStats, setSystemLogsStats] = useState<SystemLogsStats | null>(null);
  const [selectedSystemLog, setSelectedSystemLog] = useState<SystemLog | null>(null);
  const [systemLogDetailLoading, setSystemLogDetailLoading] = useState(false);

  // System Overview State
  const [systemOverview, setSystemOverview] = useState<SystemOverviewStats | null>(null);
  const [systemOverviewLoading, setSystemOverviewLoading] = useState(false);

  // Operation Logs State
  const [operationLogs, setOperationLogs] = useState<OperationLog[]>([]);
  const [operationLogsLoading, setOperationLogsLoading] = useState(false);
  const [operationLogsPagination, setOperationLogsPagination] = useState<PaginationEnvelope | null>(null);
  const [selectedOperationLog, setSelectedOperationLog] = useState<OperationLog | null>(null);
  const [operationLogDetailLoading, setOperationLogDetailLoading] = useState(false);

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

  const rebuildIndex = async (partnerId: number) => {
    try {
      const result = await rebuildSimilarityIndex(partnerId);
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

  // Fetch System Logs
  const fetchSystemLogs = useCallback(async (params: ListSystemLogsParams) => {
    setSystemLogsLoading(true);
    try {
      const result = await getSystemLogs(params);
      if (result && result.success) {
        setSystemLogs(result.data);
        setSystemLogsPagination(result.pagination);
      } else {
        message.error(result.error || 'Failed to load system logs');
      }
    } catch {
      message.error('Failed to load system logs');
    } finally {
      setSystemLogsLoading(false);
    }
  }, []);

  // Fetch System Log Detail
  const fetchSystemLogDetail = useCallback(async (logId: number) => {
    setSystemLogDetailLoading(true);
    try {
      const result = await getSystemLogDetail(logId);
      if (result && result.success) {
        setSelectedSystemLog(result.data);
        return result.data;
      } else {
        message.error(result.error || 'Failed to load system log details');
        return null;
      }
    } catch {
      message.error('Failed to load system log details');
      return null;
    } finally {
      setSystemLogDetailLoading(false);
    }
  }, []);

  // Fetch System Logs Stats
  const fetchSystemLogsStats = useCallback(async (hours = 24) => {
    try {
      const result = await getSystemLogsStats(hours);
      if (result && result.success) {
        setSystemLogsStats(result.data);
      }
    } catch {
      console.error('Failed to load system logs stats');
    }
  }, []);

  // Fetch System Logs Overview
  const fetchSystemLogsOverview = useCallback(async (hours = 24) => {
    setSystemOverviewLoading(true);
    try {
      const result = await getSystemLogsOverview(hours);
      if (result && result.success) {
        setSystemOverview(result.data);
      } else {
        message.error(result.error || 'Failed to load system logs overview');
      }
    } catch {
      message.error('Failed to load system logs overview');
    } finally {
      setSystemOverviewLoading(false);
    }
  }, []);

  // Fetch Operation Logs
  const fetchOperationLogs = useCallback(async (params: ListOperationLogsParams) => {
    setOperationLogsLoading(true);
    try {
      const result = await getOperationLogs(params);
      if (result && result.success) {
        setOperationLogs(result.data);
        setOperationLogsPagination(result.pagination);
      } else {
        message.error(result.error || 'Failed to load operation logs');
      }
    } catch {
      message.error('Failed to load operation logs');
    } finally {
      setOperationLogsLoading(false);
    }
  }, []);

  // Fetch Operation Log Detail
  const fetchOperationLogDetail = useCallback(async (logId: number) => {
    setOperationLogDetailLoading(true);
    try {
      const result = await getOperationLogDetail(logId);
      if (result && result.success) {
        setSelectedOperationLog(result.data);
        return result.data;
      } else {
        message.error(result.error || 'Failed to load operation log details');
        return null;
      }
    } catch {
      message.error('Failed to load operation log details');
      return null;
    } finally {
      setOperationLogDetailLoading(false);
    }
  }, []);

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

    // System Logs
    systemLogs,
    systemLogsLoading,
    systemLogsPagination,
    systemLogsStats,
    systemOverview,
    systemOverviewLoading,
    selectedSystemLog,
    setSelectedSystemLog,
    systemLogDetailLoading,
    fetchSystemLogs,
    fetchSystemLogDetail,
    fetchSystemLogsStats,
    fetchSystemLogsOverview,

    // Operation Logs
    operationLogs,
    operationLogsLoading,
    operationLogsPagination,
    selectedOperationLog,
    setSelectedOperationLog,
    operationLogDetailLoading,
    fetchOperationLogs,
    fetchOperationLogDetail,
  };
}

import { useEffect, useState } from 'react';
import { 
  Table, 
  Button, 
  Tag, 
  Space, 
  Modal, 
  Select, 
  Input, 
  Card,
  Checkbox,
  Typography,
  Badge,
  Alert,
  Pagination,
  Descriptions
} from 'antd';
import { 
  Search, 
  RotateCw, 
  Play, 
  Ban, 
  Music,
  ArrowLeft,
  ArrowRight,
  Building2,
  Mail,
  Eye
} from 'lucide-react';
import { useAdminTracks, usePartners } from '@resomix/hooks';

const { Title, Text } = Typography;
const { Option } = Select;

function TracksPage() {
  const [modal, modalContextHolder] = Modal.useModal();
  const [partnerSearchQuery, setPartnerSearchQuery] = useState('');
  const [viewingTrack, setViewingTrack] = useState<any | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // Load hooks
  const {
    tracks,
    loading,
    pagination,
    partnerFilter,
    setPartnerFilter,
    statusFilter,
    setStatusFilter,
    sourceFilter,
    setSourceFilter,
    searchQuery,
    setSearchQuery,
    fetchTracks,
    activateTrack,
    deactivateTrack,
    deactivateTracksBatch,
    handlePageChange,
  } = useAdminTracks();

  // Reset selection on filter or page change
  useEffect(() => {
    setSelectedRowKeys([]);
  }, [partnerFilter, statusFilter, sourceFilter, searchQuery, pagination.current]);

  // Load partners hook to populate filters
  const { 
    partners, 
    fetchPartners,
    loading: partnersLoading,
    pagination: partnersPagination,
    handlePageChange: handlePartnersPageChange
  } = usePartners();

  useEffect(() => {
    fetchPartners();
  }, [fetchPartners]);

  const handleSetLive = (track: any) => {
    modal.confirm({
      title: 'Set Track Live',
      content: (
        <div className="mt-2 flex flex-col gap-2">
          <Text>Are you sure you want to make <Text strong>{track.title}</Text> by <Text strong>{track.display_artist}</Text> live?</Text>
          <Alert 
            type="info" 
            showIcon 
            message="This will insert pre-generated embeddings into both MAEST & Discogs similarity search indices." 
            className="rounded-xl mt-2"
          />
        </div>
      ),
      okText: 'Set Live',
      okType: 'primary',
      onOk: () => activateTrack(track.id),
    });
  };

  const handleStopTrack = (track: any) => {
    let shouldDelete = false;
    modal.confirm({
      title: 'Stop / Deactivate Track',
      content: (
        <div className="mt-4 flex flex-col gap-4">
          <Text>Are you sure you want to deactivate <Text strong>{track.title}</Text>? This will remove it from all search indices immediately.</Text>
          
          <div className="border border-default p-4 rounded-xl bg-background-secondary mt-2">
            <Checkbox onChange={(e) => { shouldDelete = e.target.checked; }}>
              <span className="font-semibold text-red-500">Delete physical embedding files (.npy)</span>
              <Text className="text-secondary block text-xs mt-1">This will free up disk space on the media server but requires re-generation of embeddings if you want to set the track live again.</Text>
            </Checkbox>
          </div>
        </div>
      ),
      okText: 'Deactivate',
      okType: 'danger',
      onOk: () => deactivateTrack(track.id, shouldDelete),
    });
  };

  const handleBulkStop = () => {
    if (selectedRowKeys.length === 0) return;
    modal.confirm({
      title: 'Stop / Deactivate Selected Tracks',
      content: (
        <div className="mt-2 flex flex-col gap-2">
          <Text>Are you sure you want to deactivate <Text strong>{selectedRowKeys.length}</Text> selected tracks? This will remove them from all search indices immediately in a single batch operation.</Text>
          <Alert 
            type="warning" 
            showIcon 
            message="This action deactivates the tracks but does NOT delete their physical embedding files on the media server." 
            className="rounded-xl mt-2"
          />
        </div>
      ),
      okText: 'Deactivate All',
      okType: 'danger',
      onOk: async () => {
        const ids = selectedRowKeys.map(k => typeof k === 'string' ? parseInt(k, 10) : Number(k));
        const success = await deactivateTracksBatch(ids);
        if (success) {
          setSelectedRowKeys([]);
        }
      },
    });
  };

  const getPartnerName = (partnerId: number) => {
    const partner = partners.find(p => p.id === partnerId);
    return partner ? partner.display_name : `Partner #${partnerId}`;
  };



  const columns = [
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
      render: (text: string) => <Text strong className="text-primary">{text || '—'}</Text>
    },
    {
      title: 'UUID',
      dataIndex: 'uuid',
      key: 'uuid',
      render: (text: string) => <span className="font-mono text-xs">{text || '—'}</span>
    },
    {
      title: 'ISRC',
      dataIndex: 'isrc',
      key: 'isrc',
      render: (text: string) => text ? <span className="font-mono text-xs">{text}</span> : <Text className="text-secondary">—</Text>
    },
    {
      title: 'Ingestion Source',
      dataIndex: 'ingestion_source',
      key: 'ingestion_source',
      render: (text: string) => {
        let label = text || '—';
        let color = 'default';
        if (text === 'csv') {
          label = 'Catalog (CSV)';
          color = 'blue';
        } else if (text === 'cc_by') {
          label = 'Sandbox (CC-BY)';
          color = 'orange';
        } else if (text === 'user_upload') {
          label = 'Uploads';
          color = 'purple';
        }
        return <Tag color={color} className="rounded-full px-2.5 font-medium">{label}</Tag>;
      }
    },
    {
      title: 'Created Date',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (text: string) => text ? <span className="text-xs text-secondary">{new Date(text).toLocaleString()}</span> : <Text className="text-secondary">—</Text>
    },
    {
      title: 'Actions',
      key: 'actions',
      align: 'right' as const,
      render: (_: any, record: any) => (
        <Space>
          <Button 
            icon={<Eye size={14} />} 
            onClick={() => setViewingTrack(record)}
            className="flex items-center gap-1.5"
          >
            View Track
          </Button>
          {record.is_active ? (
            <Button 
              danger
              icon={<Ban size={14} />} 
              onClick={() => handleStopTrack(record)}
              className="flex items-center gap-1.5"
            >
              Stop
            </Button>
          ) : (
            <Button 
              type="primary"
              icon={<Play size={14} />} 
              onClick={() => handleSetLive(record)}
              className="flex items-center gap-1.5"
            >
              Set Live
            </Button>
          )}
        </Space>
      )
    }
  ];

  const selectedPartnerObj = partners.find(p => p.id === partnerFilter);

  const filteredPartners = partners.filter(p => 
    (p.display_name || '').toLowerCase().includes(partnerSearchQuery.toLowerCase()) ||
    (p.legal_name || '').toLowerCase().includes(partnerSearchQuery.toLowerCase()) ||
    (p.contact_email || '').toLowerCase().includes(partnerSearchQuery.toLowerCase())
  );

  if (partnerFilter === undefined) {
    return (
      <div className="w-full max-w-[1400px] mx-auto px-4 py-8">
        {modalContextHolder}
        <div className="mb-8">
          <Title level={2} className="!mb-1 !text-primary">Tracks Control</Title>
          <Text className="text-secondary text-base">Select a partner to manage and activate their tracks.</Text>
        </div>

        <div className="mb-6 flex justify-between items-center wrap gap-4">
          <Input
            placeholder="Search partners by name, legal name, or email..."
            prefix={<Search size={16} className="text-secondary" />}
            className="h-11 w-full max-w-[400px] rounded-xl border-default bg-surface"
            value={partnerSearchQuery}
            onChange={(e) => setPartnerSearchQuery(e.target.value)}
            allowClear
          />
          <Button 
            icon={<RotateCw size={14} />} 
            onClick={fetchPartners}
            loading={partnersLoading}
            className="h-11 flex items-center gap-1 rounded-xl"
          >
            Refresh Partners
          </Button>
        </div>

        {partnersLoading ? (
          <div className="flex justify-center items-center h-[300px]">
            <RotateCw className="animate-spin text-primary" size={32} />
          </div>
        ) : filteredPartners.length === 0 ? (
          <Card className="text-center py-12 bg-surface border-default rounded-2xl shadow-sm">
            <div className="flex flex-col items-center justify-center gap-3">
              <Building2 className="text-secondary" size={48} />
              <Title level={4} className="!mb-1 text-primary">No Partners Found</Title>
              <Text className="text-secondary">Try searching with a different name or add a partner.</Text>
            </div>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredPartners.map((partner) => {
                // Get tier color mapping
                let tierColor = 'default';
                switch (partner.tier) {
                  case 'sandbox':
                    tierColor = 'blue';
                    break;
                  case 'starter':
                    tierColor = 'cyan';
                    break;
                  case 'growth':
                    tierColor = 'purple';
                    break;
                  case 'enterprise':
                    tierColor = 'orange';
                    break;
                }

                return (
                  <Card 
                    key={partner.id}
                    className="bg-surface border-default rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 border hover:border-primary/30"
                    styles={{ body: { padding: '24px', height: '100%' } }}
                  >
                    <div className="flex flex-col justify-between h-full min-h-[140px]">
                      <div>
                        <div className="flex justify-between items-start gap-2 mb-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                              <Building2 size={20} />
                            </div>
                            <div className="flex flex-col min-w-0">
                              <Title level={4} className="!mb-0 !text-primary text-base font-bold truncate max-w-[180px]" title={partner.display_name}>
                                {partner.display_name || partner.legal_name}
                              </Title>
                              <span className="text-xs text-secondary truncate max-w-[180px]" title={partner.legal_name}>
                                {partner.legal_name}
                              </span>
                            </div>
                          </div>
                          <Tag color={partner.is_active ? 'success' : 'default'} className="rounded-full px-2.5 m-0 font-medium">
                            {partner.is_active ? 'Active' : 'Inactive'}
                          </Tag>
                        </div>

                        <div className="flex flex-col gap-2 mb-6">
                          <div className="flex items-center gap-2 text-secondary text-xs">
                            <Mail size={14} className="shrink-0" />
                            <span className="truncate" title={partner.contact_email}>{partner.contact_email}</span>
                          </div>
                          <div className="mt-1">
                            <Tag color={tierColor} className="rounded-full px-2.5 font-medium uppercase text-[10px]">
                              {partner.tier}
                            </Tag>
                          </div>
                        </div>
                      </div>

                      <Button 
                        type="primary" 
                        icon={<ArrowRight size={16} />}
                        className="w-full flex items-center justify-center gap-1.5 h-10 rounded-xl font-medium"
                        onClick={() => setPartnerFilter(partner.id)}
                      >
                        Show Tracks
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>

            {partnersPagination.total > 0 && (
              <div className="flex justify-end mt-8 bg-surface border border-default p-4 rounded-xl shadow-sm">
                <Pagination
                  current={partnersPagination.current}
                  pageSize={partnersPagination.pageSize}
                  total={partnersPagination.total}
                  onChange={handlePartnersPageChange}
                  showSizeChanger
                  showTotal={(total) => `Total ${total} partners`}
                />
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="w-full max-w-[1400px] mx-auto px-4 py-8">
      {modalContextHolder}
      <div className="mb-6">
        <Button 
          type="link" 
          onClick={() => setPartnerFilter(undefined)}
          className="flex items-center gap-1.5 text-secondary hover:text-primary mb-2 pl-0"
        >
          <ArrowLeft size={16} /> Back to Partners
        </Button>
        <Title level={2} className="!mb-1 !text-primary">
          Tracks Control: <span className="text-secondary font-medium">{selectedPartnerObj?.display_name || `Partner #${partnerFilter}`}</span>
        </Title>
        <Text className="text-secondary text-base">Activate partner tracks to make them searchable, or remove them from indexing engines.</Text>
      </div>

      <Card className="mb-6 bg-surface border-default shadow-sm rounded-xl overflow-hidden">
        <Space wrap size={16} className="w-full justify-between flex-row md:items-end">
          <Space wrap size={16}>
            <div className="flex flex-col gap-1.5">
              <Text className="text-secondary text-xs font-medium uppercase">Search tracks</Text>
              <Input
                placeholder="Search Title, ISRC, UUID..."
                prefix={<Search size={14} className="text-secondary" />}
                className="h-10 w-[240px]"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                allowClear
              />
            </div>
            
            <div className="flex flex-col gap-1.5">
              <Text className="text-secondary text-xs font-medium uppercase">Filter Partner</Text>
              <Select
                placeholder="Select Partner"
                allowClear
                style={{ width: 200 }}
                className="h-10"
                value={partnerFilter}
                onChange={setPartnerFilter}
              >
                {partners.map(p => (
                  <Option key={p.id} value={p.id}>{p.display_name}</Option>
                ))}
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Text className="text-secondary text-xs font-medium uppercase">Source</Text>
              <Select
                placeholder="All Sources"
                allowClear
                style={{ width: 160 }}
                className="h-10"
                value={sourceFilter}
                onChange={setSourceFilter}
              >
                <Option value="csv">Catalog (CSV)</Option>
                <Option value="cc_by">Sandbox (CC-BY)</Option>
                <Option value="user_upload">Uploads</Option>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Text className="text-secondary text-xs font-medium uppercase">Status</Text>
              <Select
                placeholder="All status"
                allowClear
                style={{ width: 140 }}
                className="h-10"
                value={statusFilter}
                onChange={setStatusFilter}
              >
                <Option value={true}>Live / Active</Option>
                <Option value={false}>Stopped / Inactive</Option>
              </Select>
            </div>
          </Space>

          <Space wrap>
            {selectedRowKeys.length > 0 && (
              <Button 
                danger
                type="primary"
                icon={<Ban size={14} />}
                onClick={handleBulkStop}
                className="h-10 flex items-center gap-1.5 font-medium animate-fade-in"
              >
                Stop Selected ({selectedRowKeys.length})
              </Button>
            )}
            <Button 
              icon={<RotateCw size={14} />} 
              onClick={fetchTracks}
              className="h-10 flex items-center gap-1"
            >
              Refresh
            </Button>
          </Space>
        </Space>
      </Card>

      <div className="bg-surface border border-default rounded-xl overflow-hidden shadow-sm">
        <Table
          rowSelection={{
            selectedRowKeys,
            onChange: (keys) => setSelectedRowKeys(keys),
          }}
          columns={columns}
          dataSource={tracks}
          rowKey="id"
          loading={loading}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            onChange: handlePageChange,
            showSizeChanger: true
          }}
        />
      </div>

      <Modal
        title={<span className="flex items-center gap-2 text-primary font-semibold"><Music size={18} /><span>Track Details</span></span>}
        open={!!viewingTrack}
        onCancel={() => setViewingTrack(null)}
        footer={[
          <Button key="close" onClick={() => setViewingTrack(null)}>
            Close
          </Button>
        ]}
        width={700}
        className="rounded-2xl overflow-hidden"
      >
        {viewingTrack && (
          <div className="py-2 flex flex-col gap-4">
            <Descriptions bordered column={2} size="small" className="rounded-xl overflow-hidden border-default bg-surface">
              <Descriptions.Item label="Track ID" span={1}>{viewingTrack.id}</Descriptions.Item>
              <Descriptions.Item label="UUID" span={1}><span className="font-mono text-xs">{viewingTrack.uuid}</span></Descriptions.Item>
              
              <Descriptions.Item label="Title" span={2}><Text strong>{viewingTrack.title}</Text></Descriptions.Item>
              <Descriptions.Item label="Artist" span={2}>{viewingTrack.display_artist || <Text type="secondary" italic>None</Text>}</Descriptions.Item>
              
              <Descriptions.Item label="ISRC" span={1}>{viewingTrack.isrc ? <span className="font-mono">{viewingTrack.isrc}</span> : '—'}</Descriptions.Item>
              <Descriptions.Item label="Type" span={1}><Tag>{viewingTrack.type || '—'}</Tag></Descriptions.Item>
              
              <Descriptions.Item label="Duration" span={1}>
                {viewingTrack.duration_seconds ? `${Math.floor(viewingTrack.duration_seconds / 60)}m ${Math.floor(viewingTrack.duration_seconds % 60)}s (${viewingTrack.duration_seconds}s)` : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="BPM" span={1}>{viewingTrack.bpm || '—'}</Descriptions.Item>
              
              <Descriptions.Item label="Musical Key" span={1}>{viewingTrack.musical_key || '—'}</Descriptions.Item>
              <Descriptions.Item label="Ingestion Source" span={1}>
                <Tag color={
                  viewingTrack.ingestion_source === 'csv' ? 'blue' :
                  viewingTrack.ingestion_source === 'cc_by' ? 'orange' :
                  viewingTrack.ingestion_source === 'user_upload' ? 'purple' : 'default'
                }>
                  {viewingTrack.ingestion_source || '—'}
                </Tag>
              </Descriptions.Item>
              
              <Descriptions.Item label="Search Status" span={1}>
                <Tag color={viewingTrack.is_active ? 'success' : 'default'}>
                  {viewingTrack.is_active ? 'LIVE / ACTIVE' : 'STOPPED / INACTIVE'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Partner" span={1}>{getPartnerName(viewingTrack.partner_id)}</Descriptions.Item>
              
              <Descriptions.Item label="Created At" span={1}>
                {viewingTrack.created_at ? new Date(viewingTrack.created_at).toLocaleString() : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Updated At" span={1}>
                {viewingTrack.updated_at ? new Date(viewingTrack.updated_at).toLocaleString() : '—'}
              </Descriptions.Item>
            </Descriptions>

            {viewingTrack.processing && (
              <div className="mt-2">
                <Title level={5} className="!mb-2 !text-primary">Processing Status</Title>
                <Descriptions bordered column={2} size="small" className="rounded-xl overflow-hidden border-default bg-surface">
                  <Descriptions.Item label="Transcode" span={1}>
                    <Badge status={
                      viewingTrack.processing.transcode_status === 'completed' ? 'success' : 
                      viewingTrack.processing.transcode_status === 'failed' ? 'error' : 'processing'
                    } text={viewingTrack.processing.transcode_status || 'pending'} />
                  </Descriptions.Item>
                  <Descriptions.Item label="Embeddings" span={1}>
                    <Badge status={
                      viewingTrack.processing.embedding_status === 'completed' ? 'success' : 
                      viewingTrack.processing.embedding_status === 'failed' ? 'error' : 'processing'
                    } text={viewingTrack.processing.embedding_status || 'pending'} />
                  </Descriptions.Item>
                  <Descriptions.Item label="Peaks" span={1}>
                    <Badge status={
                      viewingTrack.processing.peaks_status === 'completed' ? 'success' : 
                      viewingTrack.processing.peaks_status === 'failed' ? 'error' : 'processing'
                    } text={viewingTrack.processing.peaks_status || 'pending'} />
                  </Descriptions.Item>
                  <Descriptions.Item label="Segments" span={1}>
                    <Badge status={
                      viewingTrack.processing.segments_status === 'completed' ? 'success' : 
                      viewingTrack.processing.segments_status === 'failed' ? 'error' : 'processing'
                    } text={viewingTrack.processing.segments_status || 'pending'} />
                  </Descriptions.Item>
                  <Descriptions.Item label="FAISS Indexed" span={1}>
                    <Badge status={viewingTrack.processing.faiss_indexed ? 'success' : 'default'} text={viewingTrack.processing.faiss_indexed ? 'YES' : 'NO'} />
                  </Descriptions.Item>
                  {viewingTrack.processing.audio_filename && (
                    <Descriptions.Item label="Audio File" span={1}>
                      <span className="font-mono text-xs">{viewingTrack.processing.audio_filename}</span>
                    </Descriptions.Item>
                  )}
                  {viewingTrack.processing.sftp_env && (
                    <Descriptions.Item label="SFTP Env" span={1}>
                      <Tag color={viewingTrack.processing.sftp_env === 'live' ? 'success' : 'blue'}>{viewingTrack.processing.sftp_env.toUpperCase()}</Tag>
                    </Descriptions.Item>
                  )}
                </Descriptions>

                {/* Completion timestamps */}
                {(viewingTrack.processing.transcode_completed_at || viewingTrack.processing.embedding_completed_at || viewingTrack.processing.peaks_completed_at || viewingTrack.processing.segments_completed_at || viewingTrack.processing.faiss_indexed_at) && (
                  <div className="mt-3">
                    <Text className="text-secondary text-xs font-semibold uppercase block mb-1.5">Completion Timestamps</Text>
                    <Descriptions bordered column={2} size="small" className="rounded-xl overflow-hidden border-default bg-surface">
                      {viewingTrack.processing.transcode_completed_at && (
                        <Descriptions.Item label="Transcode" span={1}>
                          <span className="text-xs">{new Date(viewingTrack.processing.transcode_completed_at).toLocaleString()}</span>
                        </Descriptions.Item>
                      )}
                      {viewingTrack.processing.embedding_completed_at && (
                        <Descriptions.Item label="Embeddings" span={1}>
                          <span className="text-xs">{new Date(viewingTrack.processing.embedding_completed_at).toLocaleString()}</span>
                        </Descriptions.Item>
                      )}
                      {viewingTrack.processing.peaks_completed_at && (
                        <Descriptions.Item label="Peaks" span={1}>
                          <span className="text-xs">{new Date(viewingTrack.processing.peaks_completed_at).toLocaleString()}</span>
                        </Descriptions.Item>
                      )}
                      {viewingTrack.processing.segments_completed_at && (
                        <Descriptions.Item label="Segments" span={1}>
                          <span className="text-xs">{new Date(viewingTrack.processing.segments_completed_at).toLocaleString()}</span>
                        </Descriptions.Item>
                      )}
                      {viewingTrack.processing.faiss_indexed_at && (
                        <Descriptions.Item label="FAISS Indexed" span={1}>
                          <span className="text-xs">{new Date(viewingTrack.processing.faiss_indexed_at).toLocaleString()}</span>
                        </Descriptions.Item>
                      )}
                    </Descriptions>
                  </div>
                )}

                {/* Error details */}
                {(viewingTrack.processing.transcode_error || viewingTrack.processing.embedding_error || viewingTrack.processing.peaks_error || viewingTrack.processing.segments_error) && (
                  <Alert
                    type="error"
                    showIcon
                    className="rounded-xl mt-3"
                    message="Processing Errors"
                    description={
                      <div className="flex flex-col gap-1 mt-1">
                        {viewingTrack.processing.transcode_error && (
                          <Text type="danger" className="text-xs"><strong>Transcode:</strong> {viewingTrack.processing.transcode_error}</Text>
                        )}
                        {viewingTrack.processing.embedding_error && (
                          <Text type="danger" className="text-xs"><strong>Embedding:</strong> {viewingTrack.processing.embedding_error}</Text>
                        )}
                        {viewingTrack.processing.peaks_error && (
                          <Text type="danger" className="text-xs"><strong>Peaks:</strong> {viewingTrack.processing.peaks_error}</Text>
                        )}
                        {viewingTrack.processing.segments_error && (
                          <Text type="danger" className="text-xs"><strong>Segments:</strong> {viewingTrack.processing.segments_error}</Text>
                        )}
                      </div>
                    }
                  />
                )}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

export default TracksPage;

import { useEffect } from 'react';
import { 
  Table, 
  Button, 
  Tag, 
  Space, 
  Modal, 
  Select, 
  Input, 
  Tooltip, 
  Card,
  Checkbox,
  Typography,
  Badge,
  Alert
} from 'antd';
import { 
  Search, 
  RotateCw, 
  Play, 
  Ban, 
  Music
} from 'lucide-react';
import { useAdminTracks, usePartners } from '@resomix/hooks';

const { Title, Text } = Typography;
const { Option } = Select;

function TracksPage() {
  const [modal, modalContextHolder] = Modal.useModal();

  // Load hooks
  const {
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
  } = useAdminTracks();

  // Load partners hook to populate filters
  const { partners, fetchPartners } = usePartners();

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

  const getPartnerName = (partnerId: number) => {
    const partner = partners.find(p => p.id === partnerId);
    return partner ? partner.display_name : `Partner #${partnerId}`;
  };

  // Status visual dot renderer
  const renderStatusDot = (label: string, status: string | boolean) => {
    let color: "success" | "error" | "processing" | "warning" | "default" = "default";
    let iconLabel = "";

    if (typeof status === 'boolean') {
      color = status ? "success" : "default";
      iconLabel = status ? "indexed" : "pending";
    } else {
      switch (status) {
        case 'completed':
        case 'success':
          color = "success";
          iconLabel = "done";
          break;
        case 'failed':
          color = "error";
          iconLabel = "failed";
          break;
        case 'running':
        case 'processing':
          color = "processing";
          iconLabel = "processing";
          break;
        default:
          color = "default";
          iconLabel = "pending";
      }
    }

    return (
      <Tooltip title={`${label}: ${iconLabel.toUpperCase()}`}>
        <div className="flex items-center gap-1">
          <Badge status={color} />
          <span className="text-[10px] text-secondary">{label}</span>
        </div>
      </Tooltip>
    );
  };

  const columns = [
    {
      title: 'Track Details',
      key: 'track_details',
      render: (_: any, record: any) => (
        <Space size={12}>
          <div className="w-9 h-9 rounded bg-primary/10 text-primary flex items-center justify-center">
            <Music size={16} />
          </div>
          <div className="flex flex-col">
            <Text strong className="text-primary">{record.title}</Text>
            <Text className="text-secondary text-xs">{record.display_artist}</Text>
          </div>
        </Space>
      )
    },
    {
      title: 'ISRC',
      dataIndex: 'isrc',
      key: 'isrc',
      render: (text: string) => text ? <span className="font-mono text-xs">{text}</span> : <Text className="text-secondary">—</Text>
    },
    {
      title: 'Partner',
      dataIndex: 'partner_id',
      key: 'partner_id',
      render: (partnerId: number) => <Text className="text-secondary text-xs">{getPartnerName(partnerId)}</Text>
    },
    {
      title: 'Search Status',
      dataIndex: 'is_active',
      key: 'is_active',
      render: (active: boolean) => (
        <Tag color={active ? 'success' : 'default'} className="rounded-full px-3">
          {active ? 'LIVE' : 'STOPPED'}
        </Tag>
      )
    },
    {
      title: 'Processing Matrix',
      key: 'processing',
      render: (_: any, record: any) => {
        const proc = record.processing;
        if (!proc) return <Text className="text-secondary text-xs italic">No processing status</Text>;
        
        return (
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 max-w-[200px]">
            {renderStatusDot('Embed', proc.embedding_status)}
            {renderStatusDot('Peaks', proc.peaks_status)}
            {renderStatusDot('Segments', proc.segments_status)}
            {renderStatusDot('FAISS', proc.faiss_indexed)}
          </div>
        );
      }
    },
    {
      title: 'Actions',
      key: 'actions',
      align: 'right' as const,
      render: (_: any, record: any) => (
        <Space>
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

  return (
    <div className="w-full max-w-[1400px] mx-auto px-4 py-8">
      {modalContextHolder}
      <div className="mb-6">
        <Title level={2} className="!mb-1 !text-primary">Tracks Control</Title>
        <Text className="text-secondary text-base">Activate partner tracks to make them searchable, or remove them from indexing engines.</Text>
      </div>

      <Card className="mb-6 bg-surface border-default shadow-sm rounded-xl overflow-hidden">
        <Space wrap size={16} className="w-full justify-between flex-row md:items-end">
          <Space wrap size={16}>
            <div className="flex flex-col gap-1.5">
              <Text className="text-secondary text-xs font-medium uppercase">Search tracks</Text>
              <Input
                placeholder="Search Title, Artist..."
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
                placeholder="All Partners"
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

          <Button 
            icon={<RotateCw size={14} />} 
            onClick={fetchTracks}
            className="h-10 flex items-center gap-1"
          >
            Refresh
          </Button>
        </Space>
      </Card>

      <div className="bg-surface border border-default rounded-xl overflow-hidden shadow-sm">
        <Table
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
    </div>
  );
}

export default TracksPage;

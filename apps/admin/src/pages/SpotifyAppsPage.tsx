import { Tabs } from 'antd'
import type { TabsProps } from 'antd'
import SpotifyAppsTab from '@/components/spotify/SpotifyAppsTab.tsx'
import SpotifyAppUsersTab from '@/components/spotify/SpotifyAppUsersTab.tsx'
import { useStatusModals } from '@resomix/hooks'
import { StatusModal } from '@resomix/ui'

function SpotifyAppsPage() {
  const {
    errorModalVisible,
    errorDetails,
    showErrorModal,
    closeErrorModal,
    successModalVisible,
    successDetails,
    showSuccessModal,
    closeSuccessModal,
  } = useStatusModals()

  const tabItems: TabsProps['items'] = [
    {
      key: 'user-associations',
      label: 'User Associations',
      children: (
        <SpotifyAppUsersTab
          onError={showErrorModal}
          onSuccess={showSuccessModal}
        />
      ),
    },
    {
      key: 'spotify-apps',
      label: 'Spotify Apps',
      children: (
        <SpotifyAppsTab
          onError={showErrorModal}
          onSuccess={showSuccessModal}
        />
      ),
    },
  ]

  return (
    <div className="w-full">
      <h1 className="text-2xl md:text-3xl font-bold mb-4 md:mb-6 text-primary">
        Spotify Apps
      </h1>

      <div className="bg-surface rounded-lg shadow border border-default transition-colors p-3 md:p-6 overflow-hidden">
        <Tabs
          defaultActiveKey="user-associations"
          items={tabItems}
          destroyInactiveTabPane={false}
        />
      </div>

      <StatusModal
        type="error"
        visible={errorModalVisible}
        title={errorDetails?.title || 'Error'}
        message={errorDetails?.message || ''}
        onClose={closeErrorModal}
      />
      <StatusModal
        type="success"
        visible={successModalVisible}
        title={successDetails?.title || 'Success'}
        message={successDetails?.message || ''}
        onClose={closeSuccessModal}
      />
    </div>
  )
}

export default SpotifyAppsPage


import { App } from 'antd'

interface ConfirmOptions {
  title: string
  content: React.ReactNode
  okText?: string
  cancelText?: string
  okType?: 'primary' | 'danger'
  onOk: () => Promise<void> | void
  onCancel?: () => void
}

export function useConfirmDialog() {
  const { modal } = App.useApp()

  const confirm = (options: ConfirmOptions) => {
    modal.confirm({
      title: options.title,
      content: options.content,
      okText: options.okText || 'Confirm',
      cancelText: options.cancelText || 'Cancel',
      okType: options.okType || 'primary',
      okButtonProps: options.okType === 'danger' ? { danger: true } : undefined,
      centered: true,
      onOk: options.onOk,
      onCancel: options.onCancel,
    })
  }

  const confirmDelete = (options: {
    title: string
    content: React.ReactNode
    onOk: () => Promise<void> | void
  }) => {
    confirm({
      ...options,
      okText: 'Delete',
      okType: 'danger',
    })
  }

  return {
    confirm,
    confirmDelete,
  }
} 
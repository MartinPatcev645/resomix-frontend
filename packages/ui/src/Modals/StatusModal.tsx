import { Modal, Button } from 'antd'
import { CheckCircle, AlertTriangle } from 'lucide-react'

interface StatusModalProps {
  type: 'success' | 'error'
  visible: boolean
  title: string
  message: string
  onClose: () => void
}

export function StatusModal({ type, visible, title, message, onClose }: StatusModalProps) {
  const isSuccess = type === 'success'
  const ModalComponent = Modal as any
  const ButtonComponent = Button as any
  const CheckCircleIcon = CheckCircle as any
  const AlertTriangleIcon = AlertTriangle as any
  
  return (
    <ModalComponent
      title={
        <div className="flex items-center gap-2">
          {isSuccess ? (
            <CheckCircleIcon className="text-green-500" size={20} />
          ) : (
            <AlertTriangleIcon className="text-red-500" size={20} />
          )}
          <span>{title}</span>
        </div>
      }
      open={visible}
      onCancel={onClose}
      closable={true}
      maskClosable={false}
      footer={
        <ButtonComponent
          type="primary"
          onClick={onClose}
          className={isSuccess ? 'bg-green-600 hover:bg-green-700' : ''}
        >
          Close
        </ButtonComponent>
      }
      centered
      width={500}
    >
      <div className="py-4">
        <p className="text-base text-secondary whitespace-pre-wrap">{message}</p>
      </div>
    </ModalComponent>
  )
} 
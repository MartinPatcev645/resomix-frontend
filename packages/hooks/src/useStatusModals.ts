import { useState, useCallback } from 'react'

interface StatusDetails {
  title: string
  message: string
}

export function useStatusModals() {
  const [errorModalVisible, setErrorModalVisible] = useState(false)
  const [errorDetails, setErrorDetails] = useState<StatusDetails | null>(null)
  const [successModalVisible, setSuccessModalVisible] = useState(false)
  const [successDetails, setSuccessDetails] = useState<StatusDetails | null>(null)

  const showErrorModal = useCallback((title: string, message: string) => {
    setErrorDetails({ title, message })
    setErrorModalVisible(true)
  }, [])

  const closeErrorModal = useCallback(() => {
    setErrorModalVisible(false)
    setErrorDetails(null)
  }, [])

  const showSuccessModal = useCallback((title: string, message: string) => {
    setSuccessDetails({ title, message })
    setSuccessModalVisible(true)
  }, [])

  const closeSuccessModal = useCallback(() => {
    setSuccessModalVisible(false)
    setSuccessDetails(null)
  }, [])

  return {
    // Error modal
    errorModalVisible,
    errorDetails,
    showErrorModal,
    closeErrorModal,
    
    // Success modal
    successModalVisible,
    successDetails,
    showSuccessModal,
    closeSuccessModal,
  }
} 
import { create } from 'zustand'

interface FeedbackStore {
  showFeedback: boolean
  showFeedbackForm: () => void
  hideFeedbackForm: () => void
}

export const useFeedbackStore = create<FeedbackStore>((set) => ({
  showFeedback: false,
  showFeedbackForm: () => set({ showFeedback: true }),
  hideFeedbackForm: () => set({ showFeedback: false }),
}))

export default useFeedbackStore

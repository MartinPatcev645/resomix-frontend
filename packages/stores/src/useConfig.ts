import { create } from 'zustand'

interface ConfigStore {
  version: string
}

/**
 * Global configuration store.
 * Currently exposes only a readonly `version` string that can be used throughout the app.
 * Additional configuration values can be added here later.
 */
export const useConfig = create<ConfigStore>(() => ({
  version: 'alpha-0.8.2',
}))

export default useConfig

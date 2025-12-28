import { create } from 'zustand'

interface ConfigStore {
  version: string
  ccLicenseUrl: string
}

/**
 * Global configuration store.
 * Currently exposes only a readonly `version` string that can be used throughout the app.
 * Additional configuration values can be added here later.
 */
export const useConfig = create<ConfigStore>(() => ({
  version: 'open-0.10.2',
  ccLicenseUrl: 'https://creativecommons.org/licenses/by-nc-sa/3.0/',
}))

export default useConfig

import ElectronStore from 'electron-store'

export type PrivacySettings = {
  shareAnalytics: boolean
}

// Bundler may expose ESM default as .default when externalized
const StoreConstructor =
  typeof ElectronStore === 'function'
    ? ElectronStore
    : (ElectronStore as { default: typeof ElectronStore }).default

export const privacyStore = new StoreConstructor<PrivacySettings>({
  name: 'locus-privacy',
  defaults: {
    shareAnalytics: true
  }
})

export type AppEnvironment = 'mock' | 'development' | 'production'

export const env = {
  mode: 'mock' as AppEnvironment,
  apiBaseUrl: '',
  requestTimeout: 10000,
}

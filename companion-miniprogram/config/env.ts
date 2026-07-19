export type ApiMode = 'mock' | 'remote'

export const ENV = {
  mode: 'mock' as ApiMode,
  baseUrl: '',
  timeoutMs: 8000,
  mockDelayMs: 220,
} as const

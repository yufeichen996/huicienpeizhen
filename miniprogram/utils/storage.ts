import { STORAGE_SCHEMA_VERSION, type StorageKey } from './storage-keys'

const STORAGE_PREFIX = 'huicien:'
interface StorageEnvelope<T> { version: number; data: T }
const isEnvelope = <T>(value: unknown): value is StorageEnvelope<T> => Boolean(value && typeof value === 'object' && 'version' in value && 'data' in value)
const matchesFallback = (value: unknown, fallback: unknown) => {
  if (fallback === null || fallback === undefined) return true
  if (Array.isArray(fallback)) return Array.isArray(value)
  if (typeof fallback === 'object') return Boolean(value && typeof value === 'object' && !Array.isArray(value))
  return typeof value === typeof fallback
}

export const storage = {
  get<T>(key: StorageKey, fallback: T): T {
    try {
      const raw = wx.getStorageSync(`${STORAGE_PREFIX}${key}`) as unknown
      if (raw === undefined || raw === null || raw === '') return fallback
      const value = isEnvelope<T>(raw) ? raw.data : raw
      return matchesFallback(value, fallback) ? value as T : fallback
    } catch {
      return fallback
    }
  },

  set<T>(key: StorageKey, value: T): void {
    const envelope: StorageEnvelope<T> = { version: STORAGE_SCHEMA_VERSION, data: value }
    wx.setStorageSync(`${STORAGE_PREFIX}${key}`, envelope)
  },

  remove(key: StorageKey): void {
    wx.removeStorageSync(`${STORAGE_PREFIX}${key}`)
  },
}

export const STORAGE_SCHEMA_VERSION = 1

export const StorageKeys = {
  bookingDraft: 'booking:draft',
  orders: 'booking:orders',
  ordersSeeded: 'booking:orders:seeded',
  orderSequence: 'booking:sequence',
  requestedOrderFilter: 'orders:requested-filter',
  userProfile: 'user:profile',
  userSensitiveCache: 'user:sensitive-cache',
  patients: 'patients:list',
  patientsSeeded: 'patients:seeded',
  favorites: 'profile:favorites',
  coupons: 'profile:coupons',
  addresses: 'profile:addresses',
  searchHistory: 'search:history',
  feedbackRecords: 'feedback:records',
  subscriptionPreferences: 'notifications:subscriptions',
} as const

export type StorageKey = typeof StorageKeys[keyof typeof StorageKeys]

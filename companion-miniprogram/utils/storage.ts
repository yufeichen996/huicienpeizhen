const PREFIX = 'huicien-companion:'

export const StorageKeys = {
  session: 'session',
  mockTask: 'mock:task',
  mockTasks: 'mock:tasks',
  mockMilestones: 'mock:milestones',
  mockExceptions: 'mock:exceptions',
  mockSummary: 'mock:summary',
  mockMessages: 'mock:messages',
  mockSchedule: 'mock:schedule',
  mockExpenses: 'mock:expenses',
  mockTrainingProgress: 'mock:training-progress',
  mockGrabOrders: 'mock:grab-orders',
  mockApplication: 'mock:application',
  mockApprovedPublicProfile: 'mock:approved-public-profile',
  availability: 'availability',
  subscriptionPreferences: 'notifications:subscriptions',
} as const

export const storage = {
  get<T>(key: string, fallback: T): T {
    try {
      const value = wx.getStorageSync(`${PREFIX}${key}`) as T | undefined
      return value === undefined || value === null || value === '' ? fallback : value
    } catch {
      return fallback
    }
  },

  set<T>(key: string, value: T): void {
    wx.setStorageSync(`${PREFIX}${key}`, value)
  },

  remove(key: string): void {
    wx.removeStorageSync(`${PREFIX}${key}`)
  },
}

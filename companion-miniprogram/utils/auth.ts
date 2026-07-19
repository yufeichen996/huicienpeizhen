import type { CompanionSession } from '../types/domain'
import { StorageKeys, storage } from './storage'

export function getSession(): CompanionSession | null {
  return storage.get<CompanionSession | null>(StorageKeys.session, null)
}

export function saveSession(session: CompanionSession): void {
  storage.set(StorageKeys.session, session)
}

export function clearSession(): void {
  storage.remove(StorageKeys.session)
  storage.remove(StorageKeys.mockTask)
  storage.remove(StorageKeys.mockTasks)
  storage.remove(StorageKeys.mockMilestones)
  storage.remove(StorageKeys.mockExceptions)
  storage.remove(StorageKeys.mockSummary)
  storage.remove(StorageKeys.mockMessages)
  storage.remove(StorageKeys.mockSchedule)
  storage.remove(StorageKeys.mockExpenses)
  storage.remove(StorageKeys.mockTrainingProgress)
  storage.remove(StorageKeys.mockGrabOrders)
  storage.remove(StorageKeys.availability)
}

export function getSessionEntry(session: CompanionSession): string {
  return session.profile.accountStatus === 'APPROVED'
    ? '/pages/workbench/index'
    : '/pages/review-status/index'
}

export function guardApproved(): boolean {
  const session = getSession()
  if (!session) {
    wx.reLaunch({ url: '/pages/login/index' })
    return false
  }
  if (session.profile.accountStatus !== 'APPROVED') {
    wx.reLaunch({ url: '/pages/review-status/index' })
    return false
  }
  return true
}

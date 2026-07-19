import { COMPANION_SUBSCRIPTION_TEMPLATES } from '../config/subscribe-templates'
import { ENV } from '../config/env'
import type {
  CompanionSubscriptionKey,
  SubscriptionDecision,
  SubscriptionItemView,
  SubscriptionPreference,
} from '../types/subscription'
import { StorageKeys, storage } from '../utils/storage'

type PreferenceMap = Partial<Record<CompanionSubscriptionKey, SubscriptionPreference>>

const getPreferences = (): PreferenceMap =>
  storage.get<PreferenceMap>(StorageKeys.subscriptionPreferences, {})

const savePreferences = (preferences: PreferenceMap) => {
  storage.set(StorageKeys.subscriptionPreferences, preferences)
}

const decisionFromWechat = (value: string | undefined): SubscriptionDecision => {
  if (value === 'accept' || value === 'acceptWithAudio' || value === 'acceptWithAlert') return 'ACCEPTED'
  if (value === 'reject') return 'REJECTED'
  if (value === 'ban') return 'BANNED'
  return 'UNKNOWN'
}

const showMockPrompt = (titles: string[]) => new Promise<boolean>((resolve) => {
  wx.showModal({
    title: '开启工作通知',
    content: `当前为 Mock 演示环境。\n同意后将模拟订阅：${titles.join('、')}。\n拒绝不会影响登录、接单或服务操作。`,
    confirmText: '同意订阅',
    cancelText: '暂不开启',
    success: ({ confirm }) => resolve(confirm),
    fail: () => resolve(false),
  })
})

const requestNative = (templateIds: string[]) => new Promise<Record<string, string>>((resolve, reject) => {
  const requestSubscribeMessage = wx.requestSubscribeMessage as unknown as (options: {
    tmplIds: string[]
    success(result: Record<string, string>): void
    fail(error: { errMsg?: string }): void
  }) => void
  requestSubscribeMessage({
    tmplIds: templateIds.slice(0, 5),
    success: resolve,
    fail: (error) => reject(new Error(error.errMsg || '订阅授权未完成')),
  })
})

const syncNativeSettings = () => new Promise<Record<string, string>>((resolve) => {
  const getSetting = wx.getSetting as unknown as (options: {
    withSubscriptions: boolean
    success(result: {
      subscriptionsSetting?: {
        itemSettings?: Record<string, string>
      }
    }): void
    fail(): void
  }) => void
  getSetting({
    withSubscriptions: true,
    success: (result) => resolve(result.subscriptionsSetting?.itemSettings || {}),
    fail: () => resolve({}),
  })
})

const toView = (
  template: typeof COMPANION_SUBSCRIPTION_TEMPLATES[number],
  preferences: PreferenceMap,
): SubscriptionItemView => {
  const preference = preferences[template.key]
  const mock = preference?.source === 'MOCK'
  const status = preference?.status || 'UNKNOWN'
  const available = Boolean(template.templateId) || ENV.mode === 'mock'
  const statusText = status === 'ACCEPTED'
    ? mock ? '最近已同意 · Mock' : '最近已同意'
    : status === 'REJECTED'
      ? '最近已拒绝'
      : status === 'BANNED'
        ? '微信已禁用'
        : available
          ? '尚未授权'
          : '待配置模板'
  return {
    ...template,
    status,
    statusText,
    actionText: status === 'ACCEPTED' ? '再次授权' : '开启',
    available,
    mock,
  }
}

export const companionSubscriptionService = {
  list(): SubscriptionItemView[] {
    const preferences = getPreferences()
    return COMPANION_SUBSCRIPTION_TEMPLATES.map((template) => toView(template, preferences))
  },

  async syncFromWechat(): Promise<SubscriptionItemView[]> {
    const configured = COMPANION_SUBSCRIPTION_TEMPLATES.filter((template) => template.templateId)
    if (!configured.length) return this.list()
    const itemSettings = await syncNativeSettings()
    const preferences = getPreferences()
    const updatedAt = new Date().toISOString()
    configured.forEach((template) => {
      const value = itemSettings[template.templateId]
      if (!value) return
      preferences[template.key] = {
        status: decisionFromWechat(value),
        source: 'WECHAT',
        updatedAt,
      }
    })
    savePreferences(preferences)
    return this.list()
  },

  async request(keys: CompanionSubscriptionKey[]): Promise<SubscriptionItemView[]> {
    const templates = COMPANION_SUBSCRIPTION_TEMPLATES
      .filter((template) => keys.includes(template.key))
      .slice(0, 5)
    if (!templates.length) return this.list()

    const configured = templates.filter((template) => template.templateId)
    const preferences = getPreferences()
    const updatedAt = new Date().toISOString()

    if (!configured.length) {
      if (ENV.mode !== 'mock') {
        wx.showToast({ title: '订阅消息模板尚未配置', icon: 'none' })
        return this.list()
      }
      const accepted = await showMockPrompt(templates.map((template) => template.title))
      templates.forEach((template) => {
        preferences[template.key] = {
          status: accepted ? 'ACCEPTED' : 'REJECTED',
          source: 'MOCK',
          updatedAt,
        }
      })
      savePreferences(preferences)
      return this.list()
    }

    try {
      const result = await requestNative(configured.map((template) => template.templateId))
      configured.forEach((template) => {
        preferences[template.key] = {
          status: decisionFromWechat(result[template.templateId]),
          source: 'WECHAT',
          updatedAt,
        }
      })
      savePreferences(preferences)
    } catch (error) {
      wx.showToast({
        title: error instanceof Error ? error.message : '订阅授权未完成',
        icon: 'none',
      })
    }
    return this.list()
  },
}

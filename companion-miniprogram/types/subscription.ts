export type CompanionSubscriptionKey =
  | 'NEW_TASK'
  | 'TASK_UPDATE'
  | 'SERVICE_REMINDER'

export type SubscriptionDecision = 'UNKNOWN' | 'ACCEPTED' | 'REJECTED' | 'BANNED'
export type SubscriptionSource = 'WECHAT' | 'MOCK'

export interface CompanionSubscriptionTemplate {
  key: CompanionSubscriptionKey
  templateId: string
  title: string
  description: string
}

export interface SubscriptionPreference {
  status: SubscriptionDecision
  source: SubscriptionSource
  updatedAt: string
}

export interface SubscriptionItemView extends CompanionSubscriptionTemplate {
  status: SubscriptionDecision
  statusText: string
  actionText: string
  available: boolean
  mock: boolean
}

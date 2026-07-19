export type ClientSubscriptionKey =
  | 'ORDER_PROGRESS'
  | 'COMPANION_MATCHED'
  | 'SERVICE_REMINDER'

export type SubscriptionDecision = 'UNKNOWN' | 'ACCEPTED' | 'REJECTED' | 'BANNED'
export type SubscriptionSource = 'WECHAT' | 'MOCK'

export interface ClientSubscriptionTemplate {
  key: ClientSubscriptionKey
  templateId: string
  title: string
  description: string
}

export interface SubscriptionPreference {
  status: SubscriptionDecision
  source: SubscriptionSource
  updatedAt: string
}

export interface SubscriptionItemView extends ClientSubscriptionTemplate {
  status: SubscriptionDecision
  statusText: string
  actionText: string
  available: boolean
  mock: boolean
}

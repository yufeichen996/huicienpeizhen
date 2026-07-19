export type ServiceId = 'appointment' | 'companion' | 'medicine' | 'report'

export interface ServiceItem {
  id: ServiceId
  name: string
  icon: string
  color: 'blue' | 'purple' | 'green' | 'orange'
  description: string
  implemented: boolean
}

export interface Companion {
  id: string
  name: string
  avatar: string
  rating: number
  serviceCount: number
  responseTime: string
  tags: string[]
  priceFrom: number
  bio: string
}

export interface Hospital {
  id: string
  name: string
  shortName: string
  icon: string
}

export type OrderStatus = 'pending' | 'active' | 'completed'

export interface Order {
  id: string
  orderNo: string
  status: OrderStatus
  companionId?: string
  hospitalId?: string
}

export interface UserProfile {
  id: string
  displayName: string
  phoneMasked: string
}

export interface BookingDraft {
  serviceId?: ServiceId
  companionId?: string
  hospitalId?: string
}

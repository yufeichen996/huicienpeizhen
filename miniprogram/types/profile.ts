export type FavoriteType = 'companion' | 'hospital' | 'service'
export interface FavoriteItem { id: string; targetId: string; type: FavoriteType; title: string; subtitle: string; image?: string; createdAt: string }
export type CouponStatus = 'available' | 'used' | 'expired'
export interface Coupon { id: string; amount: number; threshold: number; serviceId?: string; serviceName: string; validUntil: string; status: CouponStatus }
export interface Address { id: string; contactName: string; phone: string; phoneMasked: string; city: string; district: string; detail: string; doorplate?: string; isDefault: boolean }

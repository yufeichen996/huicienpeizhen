export type MembershipLevel = 'normal' | 'vip'
export type UserGender = 'male' | 'female' | 'unknown'
export interface UserProfile { id: string; nickname: string; avatar: string; phoneMasked: string; membershipLevel: MembershipLevel; membershipName?: string; couponCount: number; favoriteCount: number; patientCount: number; gender?: UserGender; city?: string; isLoggedIn: boolean; createdAt: string }

import type { BookingDraft, BookingServiceId, CompanionMode } from './booking'

export type OrderStatus = 'PENDING_PAYMENT' | 'PENDING_CONFIRMATION' | 'PENDING_ASSIGNMENT' | 'PENDING_SERVICE' | 'IN_SERVICE' | 'PENDING_REVIEW' | 'COMPLETED' | 'CANCELLED' | 'REFUNDING' | 'REFUNDED'
export type PaymentStatus = 'UNPAID' | 'PAID' | 'REFUNDING' | 'REFUNDED'
export type OrderFilter = 'ALL' | 'PENDING' | 'UPCOMING' | 'ACTIVE' | 'FINISHED' | 'PAYMENT' | 'SERVICE' | 'REVIEW'
export type OrderAction = 'CANCEL' | 'PAY' | 'CONTACT_SERVICE' | 'CONTACT_COMPANION' | 'DETAIL' | 'REBOOK' | 'REVIEW' | 'VIEW_REVIEW' | 'REFUND_PROGRESS' | 'DELETE'
export interface OrderTimelineItem { id: string; title: string; description?: string; time?: string; state: 'done' | 'current' | 'future' }
export interface OrderReview { overall: number; attitude: number; professional: number; punctuality: number; tags: string[]; content: string; anonymous: boolean; createdAt: string }
export interface Order {
  id: string; orderNo: string; status: OrderStatus; statusText: string
  serviceId: BookingServiceId; serviceName: string; serviceDescription?: string; serviceDuration?: number
  hospitalId: string; hospitalName: string; departmentName: string; bookingDate: string; bookingTime: string
  patientId: string; patientName: string; patientPhone: string
  companionMode: CompanionMode; companionId?: string; companionName?: string; companionAvatar?: string; companionRating?: number; companionServiceCount?: number; companionPhoneMasked?: string
  specialNeeds: string[]; remark?: string
  couponId?: string
  serviceFee: number; companionFee: number; discountAmount: number; totalAmount: number; paidAmount: number; paymentStatus: PaymentStatus
  createdAt: string; paidAt?: string; confirmedAt?: string; serviceStartedAt?: string; completedAt?: string; cancelledAt?: string
  cancelReason?: string; review?: OrderReview; timeline: OrderTimelineItem[]; source: 'MINIPROGRAM'; paymentMethod?: string
}
export interface LegacyBookingOrder { id: string; orderNo: string; status: 'pending-match' | 'pending-confirm'; createdAt: number; draft: BookingDraft }
export interface OrderActionItem { type: OrderAction; text: string; style: 'primary' | 'secondary' | 'danger' }

import { companions } from '../mocks/companions'
import { mockOrders } from '../mocks/orders'
import type { BookingDraft } from '../types/booking'
import type { LegacyBookingOrder, Order, OrderReview, OrderStatus } from '../types/order'
import { createOrderNumber } from '../utils/order-number'
import { storage } from '../utils/storage'
import { StorageKeys } from '../utils/storage-keys'
import { ORDER_STATUS_CONFIG, buildOrderTimeline } from '../utils/order-status'

const clone = (order: Order): Order => ({ ...order, specialNeeds: [...order.specialNeeds], timeline: order.timeline.map((item) => ({ ...item })), review: order.review ? { ...order.review, tags: [...order.review.tags] } : undefined })

function fromLegacy(legacy: LegacyBookingOrder): Order {
  const d = legacy.draft; const companion = companions.find((item) => item.id === d.companionId)
  const status: OrderStatus = legacy.status === 'pending-match' ? 'PENDING_ASSIGNMENT' : 'PENDING_CONFIRMATION'
  const createdAt = new Date(legacy.createdAt).toISOString()
  const order: Order = {
    id: legacy.id, orderNo: legacy.orderNo, status, statusText: ORDER_STATUS_CONFIG[status].text,
    serviceId: d.serviceId || 'full', serviceName: d.serviceName || '陪诊服务', serviceDuration: d.duration,
    hospitalId: d.hospitalId || '', hospitalName: d.hospitalName || '', departmentName: d.departmentName || '', bookingDate: d.bookingDate || '', bookingTime: d.bookingTime || '',
    patientId: d.patientId || '', patientName: d.patientName || '', patientPhone: d.patientPhone || '', companionMode: d.companionMode,
    companionId: d.companionId, companionName: d.companionName, companionAvatar: companion?.avatar, companionRating: companion?.rating, companionServiceCount: companion?.serviceCount, companionPhoneMasked: companion ? '平台隐私通话' : undefined,
    specialNeeds: [...d.specialNeeds], remark: d.remark, couponId: d.couponId, serviceFee: d.serviceFee, companionFee: d.companionFee, discountAmount: d.discountAmount, totalAmount: d.totalAmount, paidAmount: d.totalAmount,
    paymentStatus: 'PAID', createdAt, paidAt: createdAt, timeline: [], source: 'MINIPROGRAM', paymentMethod: '微信支付（模拟）',
  }
  order.timeline = buildOrderTimeline(order); return order
}

class OrderStore {
  private orders: Order[] = []; private ready = false
  hydrate() {
    if (this.ready) return
    const saved = storage.get<Array<Order | LegacyBookingOrder>>(StorageKeys.orders, []).filter((item) => Boolean(item && typeof item === 'object' && 'id' in item))
    const seeded = storage.get(StorageKeys.ordersSeeded, false)
    this.orders = saved.length ? saved.map((item) => 'draft' in item ? fromLegacy(item) : this.normalize(item)).filter((item) => Boolean(item.id && item.orderNo)) : seeded ? [] : mockOrders.map(clone)
    this.ready = true; storage.set(StorageKeys.ordersSeeded, true); this.persist()
  }
  list() { this.hydrate(); return this.orders.map(clone) }
  get(id: string) { this.hydrate(); const order = this.orders.find((item) => item.id === id); return order ? clone(order) : undefined }
  createFromDraft(d: BookingDraft) {
    this.hydrate(); const orderNo = createOrderNumber(); const now = new Date().toISOString(); const companion = companions.find((item) => item.id === d.companionId)
    const status: OrderStatus = d.companionMode === 'platform' ? 'PENDING_ASSIGNMENT' : 'PENDING_CONFIRMATION'
    const order: Order = { id: orderNo, orderNo, status, statusText: ORDER_STATUS_CONFIG[status].text, serviceId: d.serviceId || 'full', serviceName: d.serviceName || '陪诊服务', serviceDuration: d.duration, hospitalId: d.hospitalId || '', hospitalName: d.hospitalName || '', departmentName: d.departmentName || '', bookingDate: d.bookingDate || '', bookingTime: d.bookingTime || '', patientId: d.patientId || '', patientName: d.patientName || '', patientPhone: d.patientPhone || '', companionMode: d.companionMode, companionId: d.companionId, companionName: d.companionName, companionAvatar: companion?.avatar, companionRating: companion?.rating, companionServiceCount: companion?.serviceCount, companionPhoneMasked: companion ? '平台隐私通话' : undefined, specialNeeds: [...d.specialNeeds], remark: d.remark, couponId: d.couponId, serviceFee: d.serviceFee, companionFee: d.companionFee, discountAmount: d.discountAmount, totalAmount: d.totalAmount, paidAmount: d.totalAmount, paymentStatus: 'PAID', createdAt: now, paidAt: now, timeline: [], source: 'MINIPROGRAM', paymentMethod: '微信支付（模拟）' }
    order.timeline = buildOrderTimeline(order); this.orders.unshift(order); this.persist(); return clone(order)
  }
  patch(id: string, patch: Partial<Order>) { this.hydrate(); const index = this.orders.findIndex((item) => item.id === id); if (index < 0) return undefined; const order = { ...this.orders[index], ...patch }; order.statusText = ORDER_STATUS_CONFIG[order.status].text; order.timeline = buildOrderTimeline(order); this.orders[index] = order; this.persist(); return clone(order) }
  review(id: string, review: OrderReview) { return this.patch(id, { review, status: 'COMPLETED', completedAt: this.get(id)?.completedAt || new Date().toISOString() }) }
  remove(id: string) { this.hydrate(); this.orders = this.orders.filter((item) => item.id !== id); this.persist() }
  private normalize(order: Order) { const normalized = { ...order, statusText: ORDER_STATUS_CONFIG[order.status].text, specialNeeds: order.specialNeeds || [], timeline: order.timeline || [] }; normalized.timeline = buildOrderTimeline(normalized); return normalized }
  private persist() { storage.set(StorageKeys.orders, this.orders) }
}
export const orderStore = new OrderStore()

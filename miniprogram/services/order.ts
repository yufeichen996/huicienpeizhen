import { bookingServices } from '../mocks/booking'
import { bookingStore } from '../stores/booking'
import { orderStore } from '../stores/order'
import type { BookingDraft } from '../types/booking'
import type { OrderReview } from '../types/order'

export const orderService = {
  initialize: () => orderStore.hydrate(),
  listOrders: () => orderStore.list(),
  getOrder: (id: string) => orderStore.get(id),
  createFromBookingDraft: (draft: BookingDraft) => orderStore.createFromDraft(draft),
  cancel(id: string, reason: string) { const order = orderStore.get(id); if (!order || !['PENDING_PAYMENT', 'PENDING_SERVICE'].includes(order.status)) return undefined; return orderStore.patch(id, { status: 'CANCELLED', cancelledAt: new Date().toISOString(), cancelReason: reason }) },
  pay(id: string) { const order = orderStore.get(id); if (!order || order.status !== 'PENDING_PAYMENT' || order.paymentStatus === 'PAID') return undefined; const status = order.companionMode === 'platform' ? 'PENDING_ASSIGNMENT' : 'PENDING_CONFIRMATION'; const now = new Date().toISOString(); return orderStore.patch(id, { status, paymentStatus: 'PAID', paidAmount: order.totalAmount, paidAt: now, paymentMethod: '微信支付（模拟）' }) },
  submitReview(id: string, review: Omit<OrderReview, 'createdAt'>) { const order = orderStore.get(id); if (!order || order.status !== 'PENDING_REVIEW' || order.review) return undefined; return orderStore.review(id, { ...review, createdAt: new Date().toISOString() }) },
  deleteOrder(id: string) { const order = orderStore.get(id); if (order?.status === 'CANCELLED') orderStore.remove(id) },
  prepareRebook(id: string) { const order = orderStore.get(id); if (!order) return false; const service = bookingServices.find((item) => item.id === order.serviceId); bookingStore.clear(); if (service) bookingStore.selectService(service); bookingStore.update({ hospitalId: order.hospitalId, hospitalName: order.hospitalName, departmentName: order.departmentName, progressStep: 1 }); return true },
}

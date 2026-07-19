import type { Order, OrderStatus, PaymentStatus } from '../types/order'
import { ORDER_STATUS_CONFIG, buildOrderTimeline } from '../utils/order-status'

const seed = (index: number, status: OrderStatus, overrides: Partial<Order> = {}): Order => {
  const paid = status !== 'PENDING_PAYMENT' && status !== 'CANCELLED'
  const complete = ['PENDING_REVIEW', 'COMPLETED'].includes(status)
  const platform = status === 'PENDING_ASSIGNMENT' || (status === 'PENDING_PAYMENT' && index % 2 === 1)
  const base: Order = {
    id: `mock-order-${index}`, orderNo: `SH202607${`${index + 4}`.padStart(2, '0')}${`${index}`.padStart(3, '0')}`,
    status, statusText: ORDER_STATUS_CONFIG[status].text,
    serviceId: index % 2 ? 'exam' : 'full', serviceName: index % 2 ? '检查陪同' : '全程陪诊', serviceDescription: '专业陪诊员全程协助就医流程', serviceDuration: index % 2 ? 180 : 240,
    hospitalId: index % 2 ? 'huashan' : 'ruijin', hospitalName: index % 2 ? '华山医院' : '上海瑞金医院', departmentName: index % 2 ? '神经内科' : '心内科',
    bookingDate: `2026-07-${`${index + 14}`.padStart(2, '0')}`, bookingTime: index % 2 ? '14:30' : '09:00', patientId: 'patient-1', patientName: '张建国', patientPhone: '138****2046',
    companionMode: platform ? 'platform' : 'selected', companionId: platform ? undefined : 'lin-xiaowen', companionName: platform ? undefined : '林晓雯', companionAvatar: platform ? undefined : '/assets/images/companion-lin-xiaowen.svg', companionRating: platform ? undefined : 4.98, companionServiceCount: platform ? undefined : 541, companionPhoneMasked: platform ? undefined : '平台隐私通话',
    specialNeeds: index % 2 ? [] : ['老人独自就诊'], remark: '', serviceFee: 19800, companionFee: 0, discountAmount: 1000, totalAmount: 18800, paidAmount: paid ? 18800 : 0,
    paymentStatus: (paid ? 'PAID' : 'UNPAID') as PaymentStatus, createdAt: `2026-07-${`${index + 4}`.padStart(2, '0')}T08:30:00.000Z`, paidAt: paid ? `2026-07-${`${index + 4}`.padStart(2, '0')}T08:31:00.000Z` : undefined,
    confirmedAt: ['PENDING_SERVICE', 'IN_SERVICE', 'PENDING_REVIEW', 'COMPLETED'].includes(status) ? `2026-07-${`${index + 4}`.padStart(2, '0')}T09:00:00.000Z` : undefined,
    serviceStartedAt: ['IN_SERVICE', 'PENDING_REVIEW', 'COMPLETED'].includes(status) ? `2026-07-${`${index + 4}`.padStart(2, '0')}T09:30:00.000Z` : undefined,
    completedAt: complete ? `2026-07-${`${index + 4}`.padStart(2, '0')}T12:30:00.000Z` : undefined,
    cancelledAt: status === 'CANCELLED' ? `2026-07-${`${index + 4}`.padStart(2, '0')}T08:40:00.000Z` : undefined, cancelReason: status === 'CANCELLED' ? '就诊计划有变' : undefined,
    timeline: [], source: 'MINIPROGRAM', paymentMethod: paid ? '微信支付（模拟）' : undefined,
  }
  const order = { ...base, ...overrides }; order.timeline = buildOrderTimeline(order); return order
}

export const mockOrders: Order[] = [
  seed(1, 'PENDING_PAYMENT'), seed(2, 'PENDING_ASSIGNMENT'), seed(3, 'PENDING_SERVICE'), seed(4, 'IN_SERVICE'),
  seed(5, 'PENDING_REVIEW'), seed(6, 'COMPLETED', { review: { overall: 5, attitude: 5, professional: 5, punctuality: 5, tags: ['服务专业', '耐心细致'], content: '陪诊过程很安心，沟通也很清楚。', anonymous: false, createdAt: '2026-07-10T13:00:00.000Z' } }), seed(7, 'CANCELLED'),
]

export const cancelReasons = ['就诊计划有变', '信息填写错误', '想重新选择服务', '暂时不需要陪诊', '其他原因']
export const reviewTags = ['服务专业', '耐心细致', '准时到达', '沟通顺畅', '熟悉医院', '值得推荐']

import type { Order, OrderActionItem, OrderFilter, OrderStatus, OrderTimelineItem } from '../types/order'

export const ORDER_STATUS_CONFIG: Record<OrderStatus, { text: string; color: string; description: string }> = {
  PENDING_PAYMENT: { text: '待付款', color: 'orange', description: '请尽快完成支付，以便平台安排服务。' },
  PENDING_CONFIRMATION: { text: '待确认', color: 'blue', description: '陪诊员正在确认您的预约，请耐心等待。' },
  PENDING_ASSIGNMENT: { text: '待匹配陪诊员', color: 'purple', description: '平台正在为您安排合适的陪诊员，请耐心等待。' },
  PENDING_SERVICE: { text: '待服务', color: 'blue', description: '预约已确认，陪诊员会按约定时间到达。' },
  IN_SERVICE: { text: '进行中', color: 'green', description: '陪诊服务正在进行，如需帮助请联系平台客服。' },
  PENDING_REVIEW: { text: '待评价', color: 'orange', description: '服务已完成，期待您分享本次陪诊体验。' },
  COMPLETED: { text: '已完成', color: 'green', description: '本次陪诊服务已顺利完成。' },
  CANCELLED: { text: '已取消', color: 'gray', description: '该订单已取消。' },
  REFUNDING: { text: '退款中', color: 'orange', description: '退款申请处理中，请耐心等待。' },
  REFUNDED: { text: '已退款', color: 'gray', description: '款项已按原支付方式退回。' },
}

export const ORDER_FILTERS: Array<{ id: OrderFilter; text: string; statuses?: OrderStatus[] }> = [
  { id: 'ALL', text: '全部' },
  { id: 'PENDING', text: '待处理', statuses: ['PENDING_PAYMENT', 'PENDING_CONFIRMATION', 'PENDING_ASSIGNMENT'] },
  { id: 'UPCOMING', text: '待服务', statuses: ['PENDING_SERVICE'] },
  { id: 'ACTIVE', text: '进行中', statuses: ['IN_SERVICE'] },
  { id: 'FINISHED', text: '已完成', statuses: ['PENDING_REVIEW', 'COMPLETED', 'CANCELLED', 'REFUNDED'] },
]

const actions: Record<OrderStatus, OrderActionItem[]> = {
  PENDING_PAYMENT: [{ type: 'CANCEL', text: '取消订单', style: 'danger' }, { type: 'PAY', text: '继续支付', style: 'primary' }],
  PENDING_CONFIRMATION: [{ type: 'CONTACT_SERVICE', text: '联系客服', style: 'secondary' }, { type: 'DETAIL', text: '查看详情', style: 'primary' }],
  PENDING_ASSIGNMENT: [{ type: 'CONTACT_SERVICE', text: '联系客服', style: 'secondary' }, { type: 'DETAIL', text: '查看详情', style: 'primary' }],
  PENDING_SERVICE: [{ type: 'CANCEL', text: '取消订单', style: 'danger' }, { type: 'CONTACT_COMPANION', text: '联系陪诊员', style: 'secondary' }, { type: 'DETAIL', text: '查看详情', style: 'primary' }],
  IN_SERVICE: [{ type: 'CONTACT_SERVICE', text: '联系客服', style: 'secondary' }, { type: 'CONTACT_COMPANION', text: '联系陪诊员', style: 'secondary' }, { type: 'DETAIL', text: '查看详情', style: 'primary' }],
  PENDING_REVIEW: [{ type: 'REBOOK', text: '再次预约', style: 'secondary' }, { type: 'REVIEW', text: '评价服务', style: 'primary' }],
  COMPLETED: [{ type: 'REBOOK', text: '再次预约', style: 'secondary' }, { type: 'VIEW_REVIEW', text: '查看评价', style: 'secondary' }, { type: 'DETAIL', text: '查看详情', style: 'primary' }],
  CANCELLED: [{ type: 'DELETE', text: '删除记录', style: 'danger' }, { type: 'REBOOK', text: '再次预约', style: 'secondary' }, { type: 'DETAIL', text: '查看详情', style: 'primary' }],
  REFUNDING: [{ type: 'CONTACT_SERVICE', text: '联系客服', style: 'secondary' }, { type: 'REFUND_PROGRESS', text: '退款进度', style: 'primary' }],
  REFUNDED: [{ type: 'REBOOK', text: '再次预约', style: 'secondary' }, { type: 'DETAIL', text: '查看详情', style: 'primary' }],
}
export const getOrderActions = (status: OrderStatus, detail = false) => actions[status].filter((item) => detail ? item.type !== 'DETAIL' : true).slice(-3)
export const matchesOrderFilter = (status: OrderStatus, filter: OrderFilter) => {
  if (filter === 'ALL') return true
  if (filter === 'PAYMENT') return status === 'PENDING_PAYMENT'
  if (filter === 'SERVICE') return ['PENDING_ASSIGNMENT', 'PENDING_SERVICE'].includes(status)
  if (filter === 'REVIEW') return status === 'PENDING_REVIEW'
  return Boolean(ORDER_FILTERS.find((item) => item.id === filter)?.statuses?.includes(status))
}

export function buildOrderTimeline(order: Pick<Order, 'status' | 'createdAt' | 'paidAt' | 'confirmedAt' | 'serviceStartedAt' | 'completedAt' | 'cancelledAt' | 'cancelReason' | 'companionId' | 'review'>): OrderTimelineItem[] {
  if (order.status === 'CANCELLED') return [
    { id: 'created', title: '预约已提交', time: order.createdAt, state: 'done' },
    { id: 'cancelled', title: '订单已取消', description: order.cancelReason, time: order.cancelledAt, state: 'current' },
  ]
  const rank: Record<OrderStatus, number> = { PENDING_PAYMENT: 0, PENDING_CONFIRMATION: 2, PENDING_ASSIGNMENT: 2, PENDING_SERVICE: 4, IN_SERVICE: 5, PENDING_REVIEW: 6, COMPLETED: 7, REFUNDING: 7, REFUNDED: 7, CANCELLED: 0 }
  const current = order.status === 'PENDING_REVIEW' ? 7 : order.status === 'COMPLETED' && order.review ? 8 : rank[order.status]
  const nodes = [
    ['created', '预约已提交', order.createdAt], ['paid', '支付成功', order.paidAt], ['confirmed', '平台确认', order.confirmedAt],
    ['assigned', '陪诊员已匹配', order.companionId && order.confirmedAt], ['waiting', '等待服务', order.confirmedAt],
    ['started', '服务开始', order.serviceStartedAt], ['completed', '服务完成', order.completedAt], ['review', '用户评价', order.status === 'COMPLETED' ? order.completedAt : undefined],
  ] as const
  return nodes.map(([id, title, time], index) => ({ id, title, time: time || undefined, state: index < current ? 'done' : index === current ? 'current' : 'future' }))
}

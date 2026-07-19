import type { Address, Coupon, FavoriteItem } from '../types/profile'
export const mockFavorites: FavoriteItem[] = [
  { id: 'fav-1', targetId: 'lin-xiaowen', type: 'companion', title: '林晓雯', subtitle: '护理本科 · 全程陪诊', image: '/assets/images/companion-lin-xiaowen.svg', createdAt: '2026-07-01T08:00:00.000Z' },
  { id: 'fav-2', targetId: 'ruijin', type: 'hospital', title: '上海瑞金医院', subtitle: '上海市黄浦区', createdAt: '2026-07-02T08:00:00.000Z' },
  { id: 'fav-3', targetId: 'full', type: 'service', title: '全程陪诊', subtitle: '从取号到取药，全流程贴心陪伴', createdAt: '2026-07-03T08:00:00.000Z' },
]
export const mockCoupons: Coupon[] = [
  { id: 'coupon-10', amount: 1000, threshold: 19800, serviceId: 'full', serviceName: '全程陪诊', validUntil: '2026-12-31', status: 'available' },
  { id: 'coupon-5', amount: 500, threshold: 9800, serviceId: 'report', serviceName: '报告解读', validUntil: '2026-10-31', status: 'available' },
  { id: 'coupon-used', amount: 1000, threshold: 16800, serviceName: '陪诊服务', validUntil: '2026-06-30', status: 'used' },
  { id: 'coupon-expired', amount: 800, threshold: 12800, serviceName: '陪诊服务', validUntil: '2026-05-31', status: 'expired' },
]
export const mockAddresses: Address[] = [{ id: 'address-1', contactName: '陈先生', phone: '13812345678', phoneMasked: '138****5678', city: '上海市', district: '黄浦区', detail: '瑞金二路街道', doorplate: '示例地址 1 号', isDefault: true }]

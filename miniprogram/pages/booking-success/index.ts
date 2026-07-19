import { bookingService } from '../../services/booking'
import { clientSubscriptionService } from '../../services/subscription'
import { formatMoney } from '../../stores/booking'
import type { SubscriptionItemView } from '../../types/subscription'
import { ORDER_STATUS_CONFIG } from '../../utils/order-status'
import { navigation } from '../../utils/navigation'

Page({
  data: { order: null as ReturnType<typeof bookingService.getOrder> | null, amountText: '0', statusText: '', notificationText: '开启订单通知', notificationBusy: false },
  onLoad(query: Record<string, string | undefined>) { const order = query.id ? bookingService.getOrder(query.id) : undefined; if (!order) { wx.showToast({ title: '未找到订单', icon: 'none' }); return } this.setData({ order, amountText: formatMoney(order.totalAmount), statusText: ORDER_STATUS_CONFIG[order.status].text }); this.refreshNotificationState() },
  refreshNotificationState(items: SubscriptionItemView[] = clientSubscriptionService.list()) { const accepted = items.filter((item) => item.status === 'ACCEPTED').length; this.setData({ notificationText: accepted === items.length ? '通知已授权，可再次订阅' : '开启订单通知' }) },
  async enableNotifications() { if (this.data.notificationBusy) return; this.setData({ notificationBusy: true }); const items = await clientSubscriptionService.request(['ORDER_PROGRESS', 'COMPANION_MATCHED', 'SERVICE_REMINDER']); this.refreshNotificationState(items); this.setData({ notificationBusy: false }) },
  toOrders() { if (this.data.order) navigation.openOrderAfterReset(this.data.order.id) },
  newBooking() { navigation.startBooking() },
  toHome() { navigation.openTab('/pages/home/index') },
})

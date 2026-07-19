import { cancelReasons } from '../../mocks/orders'
import { orderService } from '../../services/order'
import { clientSubscriptionService } from '../../services/subscription'
import { navigation } from '../../utils/navigation'
import { formatMoney } from '../../stores/booking'
import type { Order, OrderAction } from '../../types/order'
import { getOrderActions, ORDER_STATUS_CONFIG } from '../../utils/order-status'

const timeText = (value?: string) => value ? value.replace('T', ' ').slice(0, 16) : ''
const view = (order: Order) => ({ ...order, statusColor: ORDER_STATUS_CONFIG[order.status].color, statusDescription: ORDER_STATUS_CONFIG[order.status].description, serviceFeeText: formatMoney(order.serviceFee), companionFeeText: formatMoney(order.companionFee), discountText: formatMoney(order.discountAmount), paidText: formatMoney(order.paidAmount), paymentStatusText: order.paymentStatus === 'PAID' ? '已支付' : order.paymentStatus === 'UNPAID' ? '待支付' : order.paymentStatus === 'REFUNDING' ? '退款中' : '已退款', timeline: order.timeline.map((item) => ({ ...item, timeText: timeText(item.time) })), actions: getOrderActions(order.status, true), createdAtText: timeText(order.createdAt), paidAtText: timeText(order.paidAt), specialNeedsText: order.specialNeeds.join('、') || '无', reviewTagsText: order.review?.tags.join(' · ') || '' })

Page({
  data: { id: '', order: null as ReturnType<typeof view> | null, dialog: '', selectedReason: '', cancelReasons, busy: false, missing: false },
  onLoad(query: Record<string, string | undefined>) { this.setData({ id: query.id || '' }) }, onShow() { this.load() },
  load() { const order = orderService.getOrder(this.data.id); this.setData({ order: order ? view(order) : null, missing: !order }) },
  copyOrderNo() { if (this.data.order) wx.setClipboardData({ data: this.data.order.orderNo }) },
  onAction(e: WechatMiniprogram.CustomEvent<{ type: OrderAction }>) { const id = this.data.id; const type = e.detail.type
    if (type === 'CONTACT_SERVICE') return wx.showToast({ title: '正式上线后将接入平台客服', icon: 'none' })
    if (type === 'CONTACT_COMPANION') return wx.showToast({ title: '正式上线后将接入隐私通话', icon: 'none' })
    if (type === 'REVIEW') return wx.navigateTo({ url: `/pages/order-review/index?id=${id}` })
    if (type === 'REBOOK') { if (orderService.prepareRebook(id)) navigation.startBooking(); return }
    if (type === 'VIEW_REVIEW' || type === 'REFUND_PROGRESS') return wx.pageScrollTo({ scrollTop: 9999, duration: 280 })
    if (type === 'CANCEL') { if (this.data.order?.status === 'IN_SERVICE') return wx.showToast({ title: '服务已经开始，请联系平台客服处理', icon: 'none' }); this.setData({ dialog: 'cancel' }); return }
    if (type === 'PAY') { this.setData({ dialog: 'pay' }); return }
    if (type === 'DELETE') this.setData({ dialog: 'delete' })
  },
  viewCompanion() { wx.showToast({ title: '陪诊员资料页将在后续阶段接入', icon: 'none' }) },
  selectReason(e: WechatMiniprogram.CustomEvent<{ value: string }>) { this.setData({ selectedReason: e.detail.value }) }, closeDialog() { this.setData({ dialog: '', selectedReason: '', busy: false }) },
  async confirmDialog() { if (this.data.busy) return; const kind = this.data.dialog; if (kind === 'cancel' && !this.data.selectedReason) return wx.showToast({ title: '请选择取消原因', icon: 'none' }); this.setData({ busy: true }); if (kind === 'cancel') orderService.cancel(this.data.id, this.data.selectedReason); if (kind === 'pay') orderService.pay(this.data.id); if (kind === 'delete') { orderService.deleteOrder(this.data.id); wx.navigateBack(); return } this.closeDialog(); this.load(); wx.showToast({ title: kind === 'pay' ? '支付成功' : '订单已取消', icon: 'success' }); if (kind === 'pay') await clientSubscriptionService.request(['ORDER_PROGRESS', 'COMPANION_MATCHED', 'SERVICE_REMINDER']) },
  toOrders() { navigation.openTab('/pages/orders/index') },
})

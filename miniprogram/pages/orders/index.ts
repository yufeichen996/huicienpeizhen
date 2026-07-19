import { cancelReasons } from '../../mocks/orders'
import { orderService } from '../../services/order'
import { formatMoney } from '../../stores/booking'
import type { Order, OrderAction, OrderFilter } from '../../types/order'
import { getOrderActions, matchesOrderFilter, ORDER_FILTERS, ORDER_STATUS_CONFIG } from '../../utils/order-status'
import { storage } from '../../utils/storage'
import { StorageKeys } from '../../utils/storage-keys'
import { userService } from '../../services/user'
import { navigation } from '../../utils/navigation'
import { formatDate } from '../../utils/format'

const toView = (order: Order) => ({ ...order, statusColor: ORDER_STATUS_CONFIG[order.status].color, statusDescription: ORDER_STATUS_CONFIG[order.status].description, dateText: `${formatDate(order.bookingDate,'zh')} ${order.bookingTime}`, amountLabel: order.paymentStatus === 'UNPAID' ? '应付' : '实付', amountText: formatMoney(order.paymentStatus === 'UNPAID' ? order.totalAmount : order.paidAmount), companionText: order.companionName || '平台匹配中', actions: getOrderActions(order.status) })

Page({
  data: { filters: ORDER_FILTERS, activeFilter: 'ALL' as OrderFilter, filterNotice: '', orders: [] as ReturnType<typeof toView>[], loading: true, loadError: false, loginVisible: false, dialog: '', targetId: '', selectedReason: '', cancelReasons, busy: false },
  onShow() { const tabBar = this.getTabBar(); if (tabBar) tabBar.setData({ selected: 2, hidden: false }); if(!userService.requireLogin()){this.setTabBarHidden(true);this.setData({loginVisible:true,orders:[],loading:false});return} const requested=storage.get<OrderFilter>(StorageKeys.requestedOrderFilter,'ALL');storage.remove(StorageKeys.requestedOrderFilter);const names:Partial<Record<OrderFilter,string>>={PAYMENT:'待付款',SERVICE:'待服务',REVIEW:'待评价'};this.setData({activeFilter:requested,filterNotice:names[requested]||'',loginVisible:false});this.loadOrders() },
  onHide() { this.setTabBarHidden(false) },
  setTabBarHidden(hidden: boolean) { const tabBar = this.getTabBar(); if (tabBar) tabBar.setData({ hidden }) },
  loginSuccess(){this.setTabBarHidden(false);this.setData({loginVisible:false});this.loadOrders()},closeLogin(){this.setTabBarHidden(false);this.setData({loginVisible:false});navigation.openTab('/pages/profile/index')},
  onPullDownRefresh() { this.loadOrders(); wx.stopPullDownRefresh() },
  loadOrders() { try { const all = orderService.listOrders(); const orders = all.filter((item) => matchesOrderFilter(item.status, this.data.activeFilter)).map(toView); this.setData({ orders, loading: false, loadError: false }) } catch { this.setData({ loading: false, loadError: true, orders: [] }) } },
  selectFilter(e: WechatMiniprogram.TouchEvent) { this.setData({ activeFilter: e.currentTarget.dataset.id, filterNotice: '' }); this.loadOrders() },
  onDetail(e: WechatMiniprogram.CustomEvent<{ id: string }>) { navigation.openOrder(e.detail.id) },
  onAction(e: WechatMiniprogram.CustomEvent<{ id: string; type: OrderAction }>) { this.handleAction(e.detail.id, e.detail.type) },
  handleAction(id: string, type: OrderAction) {
    if (type === 'DETAIL' || type === 'VIEW_REVIEW' || type === 'REFUND_PROGRESS') return navigation.openOrder(id)
    if (type === 'CONTACT_SERVICE') return wx.showToast({ title: '正式上线后将接入平台客服', icon: 'none' })
    if (type === 'CONTACT_COMPANION') return wx.showToast({ title: '正式上线后将接入隐私通话', icon: 'none' })
    if (type === 'REVIEW') return wx.navigateTo({ url: `/pages/order-review/index?id=${id}` })
    if (type === 'REBOOK') { if (orderService.prepareRebook(id)) navigation.startBooking(); return }
    if (type === 'CANCEL') { const order = orderService.getOrder(id); if (order?.status === 'IN_SERVICE') return wx.showToast({ title: '服务已经开始，请联系平台客服处理', icon: 'none' }); this.setTabBarHidden(true); this.setData({ dialog: 'cancel', targetId: id, selectedReason: '' }); return }
    if (type === 'PAY') { this.setTabBarHidden(true); this.setData({ dialog: 'pay', targetId: id }); return }
    if (type === 'DELETE') { this.setTabBarHidden(true); this.setData({ dialog: 'delete', targetId: id }) }
  },
  selectReason(e: WechatMiniprogram.CustomEvent<{ value: string }>) { this.setData({ selectedReason: e.detail.value }) },
  closeDialog() { this.setTabBarHidden(false); this.setData({ dialog: '', targetId: '', selectedReason: '', busy: false }) },
  confirmDialog() {
    if (this.data.busy) return
    if (this.data.dialog === 'cancel' && !this.data.selectedReason) return wx.showToast({ title: '请选择取消原因', icon: 'none' })
    const kind = this.data.dialog; this.setData({ busy: true })
    if (kind === 'cancel') orderService.cancel(this.data.targetId, this.data.selectedReason)
    if (kind === 'pay') orderService.pay(this.data.targetId)
    if (kind === 'delete') orderService.deleteOrder(this.data.targetId)
    this.closeDialog(); this.loadOrders(); wx.showToast({ title: kind === 'pay' ? '支付成功' : '操作成功', icon: 'success' })
  },
  onBook() { navigation.startBooking() }, retry() { this.setData({ loading: true }); this.loadOrders() },
})

import { companionService } from '../../services/companion'
import { companionSubscriptionService } from '../../services/subscription'
import type { GrabOrder } from '../../types/domain'
import { guardApproved } from '../../utils/auth'

interface GrabOrderView extends GrabOrder {
  bookingText: string
  durationText: string
  feeText: string
  sourceText: string
}

const toView = (order: GrabOrder): GrabOrderView => ({
  ...order,
  serviceNeeds: [...order.serviceNeeds],
  bookingText: `${order.bookingDate} ${order.bookingTime}`,
  durationText: `预计 ${Math.max(1, Math.round(order.serviceDurationMinutes / 60))} 小时`,
  feeText: `¥${(order.companionFee / 100).toFixed(0)}`,
  sourceText: `${order.institutionName}${order.institutionVerified ? ' · 已认证机构' : ''}`,
})

Page({
  data: {
    loading: true,
    claimingId: '',
    orders: [] as GrabOrderView[],
  },

  onShow() {
    if (!guardApproved()) return
    this.load()
  },

  onPullDownRefresh() {
    this.load().finally(() => wx.stopPullDownRefresh())
  },

  async load() {
    this.setData({ loading: true })
    try {
      const orders = await companionService.getGrabOrders()
      this.setData({ orders: orders.map(toView) })
    } catch (error) {
      wx.showToast({
        title: error instanceof Error ? error.message : '抢单大厅加载失败',
        icon: 'none',
      })
    } finally {
      this.setData({ loading: false })
    }
  },

  claimOrder(event: WechatMiniprogram.TouchEvent) {
    const orderId = event.currentTarget.dataset.orderId as string
    const order = this.data.orders.find((item) => item.id === orderId)
    if (!order || this.data.claimingId) return
    wx.showModal({
      title: '确认抢单',
      content: `${order.serviceName} · ${order.bookingText}\n${order.hospitalName} ${order.departmentName}\n预计收入 ${order.feeText}`,
      confirmText: '确认抢单',
      success: async ({ confirm }) => {
        if (!confirm) return
        this.setData({ claimingId: order.id })
        try {
          const result = await companionService.claimGrabOrder(order)
          await companionSubscriptionService.request(['TASK_UPDATE', 'SERVICE_REMINDER'])
          this.setData({
            orders: this.data.orders.filter((item) => item.id !== order.id),
          })
          wx.showModal({
            title: '抢单成功',
            content: '客户脱敏联系方式和集合地点已解锁，请及时查看任务并做好服务准备。',
            showCancel: false,
            confirmText: '查看任务',
            success: () => {
              wx.navigateTo({ url: `/pages/task-detail/index?id=${result.task.id}` })
            },
          })
        } catch (error) {
          wx.showToast({
            title: error instanceof Error ? error.message : '抢单失败，请刷新后重试',
            icon: 'none',
          })
          await this.load()
        } finally {
          this.setData({ claimingId: '' })
        }
      },
    })
  },
})

import { companionSubscriptionService } from '../../services/subscription'
import type { CompanionSubscriptionKey, SubscriptionItemView } from '../../types/subscription'
import { guardApproved } from '../../utils/auth'

Page({
  data: {
    items: [] as SubscriptionItemView[],
    busyKey: '',
  },

  async onShow() {
    if (!guardApproved()) return
    this.setData({ items: await companionSubscriptionService.syncFromWechat() })
  },

  async enableAll() {
    if (this.data.busyKey) return
    this.setData({ busyKey: 'ALL' })
    const items = await companionSubscriptionService.request([
      'NEW_TASK',
      'TASK_UPDATE',
      'SERVICE_REMINDER',
    ])
    this.setData({ items, busyKey: '' })
  },

  async enableOne(event: WechatMiniprogram.TouchEvent) {
    const key = event.currentTarget.dataset.key as CompanionSubscriptionKey
    if (!key || this.data.busyKey) return
    this.setData({ busyKey: key })
    const items = await companionSubscriptionService.request([key])
    this.setData({ items, busyKey: '' })
  },

  openWechatSettings() {
    wx.openSetting({
      success: () => this.onShow(),
      fail: () => wx.showToast({ title: '暂时无法打开微信设置', icon: 'none' }),
    })
  },
})

import { clientSubscriptionService } from '../../services/subscription'
import type { ClientSubscriptionKey, SubscriptionItemView } from '../../types/subscription'

Page({
  data: {
    items: [] as SubscriptionItemView[],
    busyKey: '',
  },

  async onShow() {
    this.setData({ items: await clientSubscriptionService.syncFromWechat() })
  },

  async enableAll() {
    if (this.data.busyKey) return
    this.setData({ busyKey: 'ALL' })
    const items = await clientSubscriptionService.request([
      'ORDER_PROGRESS',
      'COMPANION_MATCHED',
      'SERVICE_REMINDER',
    ])
    this.setData({ items, busyKey: '' })
  },

  async enableOne(event: WechatMiniprogram.TouchEvent) {
    const key = event.currentTarget.dataset.key as ClientSubscriptionKey
    if (!key || this.data.busyKey) return
    this.setData({ busyKey: key })
    const items = await clientSubscriptionService.request([key])
    this.setData({ items, busyKey: '' })
  },

  openWechatSettings() {
    wx.openSetting({
      success: () => this.onShow(),
      fail: () => wx.showToast({ title: '暂时无法打开微信设置', icon: 'none' }),
    })
  },
})

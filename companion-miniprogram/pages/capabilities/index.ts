import { companionService } from '../../services/companion'
import type { CompanionProfile } from '../../types/domain'
import { guardApproved } from '../../utils/auth'

Page({
  data: {
    loading: true,
    profile: null as CompanionProfile | null,
  },

  onShow() {
    if (!guardApproved()) return
    this.load()
  },

  async load() {
    this.setData({ loading: true })
    try {
      this.setData({ profile: await companionService.getProfile() })
    } catch (error) {
      wx.showToast({
        title: error instanceof Error ? error.message : '能力信息加载失败',
        icon: 'none',
      })
    } finally {
      this.setData({ loading: false })
    }
  },

  requestChange() {
    wx.showModal({
      title: '申请变更',
      content: '技能和医院范围需要平台核验资质后调整。正式环境将在此接入资料提交入口。',
      showCancel: false,
    })
  },
})

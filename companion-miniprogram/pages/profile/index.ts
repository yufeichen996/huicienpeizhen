import { companionService } from '../../services/companion'
import type { CompanionProfile } from '../../types/domain'
import { clearSession, guardApproved } from '../../utils/auth'

Page({
  data: {
    loading: true,
    profile: null as CompanionProfile | null,
    availabilityText: '',
    availabilityTone: '',
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
      const profile = await companionService.getProfile()
      const availabilityMeta = {
        AVAILABLE: { text: '可接单', tone: 'green' },
        BUSY: { text: '服务中', tone: 'blue' },
        OFFLINE: { text: '休息中', tone: 'gray' },
      }[profile.availability]
      this.setData({
        profile,
        availabilityText: availabilityMeta.text,
        availabilityTone: availabilityMeta.tone,
      })
    } catch (error) {
      wx.showToast({
        title: error instanceof Error ? error.message : '个人信息加载失败',
        icon: 'none',
      })
    } finally {
      this.setData({ loading: false })
    }
  },

  openMenu(event: WechatMiniprogram.TouchEvent) {
    const action = event.currentTarget.dataset.action as string
    const routes: Record<string, string> = {
      capabilities: '/pages/capabilities/index',
      schedule: '/pages/schedule/index',
      settlements: '/pages/settlements/index',
      exceptions: '/pages/exceptions/index',
      training: '/pages/training/index',
      quality: '/pages/quality/index',
      notifications: '/pages/notification-settings/index',
    }
    if (routes[action]) {
      wx.navigateTo({ url: routes[action] })
      return
    }
    const content: Record<string, { title: string; content: string }> = {
      support: {
        title: '联系平台',
        content: '正式环境将在此显示调度与客服专线。服务中的紧急情况请从任务页报告异常。',
      },
      rules: {
        title: '服务规范',
        content: '遵守服务边界、保护用户隐私、如实记录履约节点，不提供诊断或治疗建议。',
      },
      privacy: {
        title: '隐私政策',
        content: '仅在任务履约所必需的范围内展示用户信息，严禁截图传播或用于其他目的。',
      },
      security: {
        title: '账号安全',
        content: '当前账号仅限本人使用。如发现异常登录，请立即退出并联系平台。',
      },
    }
    const item = content[action]
    if (item) wx.showModal({ ...item, showCancel: false })
  },

  logout() {
    wx.showModal({
      title: '退出当前账号',
      content: '退出后会清理本地任务、异常和服务记录缓存。',
      confirmText: '确认退出',
      success: ({ confirm }) => {
        if (!confirm) return
        clearSession()
        wx.reLaunch({ url: '/pages/login/index' })
      },
    })
  },
})

import { companionService } from '../../services/companion'
import { companionSubscriptionService } from '../../services/subscription'
import { getSession, getSessionEntry } from '../../utils/auth'

Page({
  data: {
    agreementAccepted: false,
    loading: false,
    hasApplication: false,
    applicationStatusText: '',
  },

  async onShow() {
    const session = getSession()
    if (session) {
      wx.reLaunch({ url: getSessionEntry(session) })
      return
    }
    try {
      const application = await companionService.getApplication()
      if (!application) {
        this.setData({ hasApplication: false, applicationStatusText: '' })
        return
      }
      const statusText = application.status === 'PENDING_REVIEW'
        ? '审核中'
        : application.status === 'REJECTED'
          ? '需补充资料'
          : '已审核通过'
      this.setData({ hasApplication: true, applicationStatusText: statusText })
    } catch {
      this.setData({ hasApplication: false, applicationStatusText: '' })
    }
  },

  onAgreementChange(event: WechatMiniprogram.CustomEvent<{ value: string[] }>) {
    this.setData({ agreementAccepted: event.detail.value.includes('accepted') })
  },

  async onLogin() {
    if (this.data.loading) return
    this.setData({
      agreementAccepted: true,
      loading: true,
    })
    try {
      const session = await companionService.login()
      if (session.profile.accountStatus === 'APPROVED') {
        await companionSubscriptionService.request(['NEW_TASK', 'TASK_UPDATE'])
      }
      wx.reLaunch({ url: getSessionEntry(session) })
    } catch (error) {
      wx.showToast({
        title: error instanceof Error ? error.message : '登录失败，请稍后重试',
        icon: 'none',
      })
    } finally {
      this.setData({ loading: false })
    }
  },

  openRegistration() {
    wx.navigateTo({ url: '/pages/registration/index' })
  },

  async resumeApplication() {
    if (this.data.loading) return
    this.setData({ loading: true })
    try {
      const session = await companionService.resumeApplication()
      wx.reLaunch({ url: getSessionEntry(session) })
    } catch (error) {
      wx.showToast({
        title: error instanceof Error ? error.message : '申请状态加载失败',
        icon: 'none',
      })
    } finally {
      this.setData({ loading: false })
    }
  },
})

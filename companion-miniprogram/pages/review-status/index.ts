import { ENV } from '../../config/env'
import { companionService } from '../../services/companion'
import type {
  CompanionAccountStatus,
  CompanionApplication,
} from '../../types/domain'
import { clearSession, getSession } from '../../utils/auth'

const STATUS_COPY: Record<CompanionAccountStatus, {
  title: string
  description: string
  tone: string
}> = {
  PENDING_REVIEW: {
    title: '资料审核中',
    description: '平台正在核验身份、服务经历和资质材料。审核通过前不会接收任务。',
    tone: 'orange',
  },
  APPROVED: {
    title: '审核已通过',
    description: '账号已具备服务权限，公开档案将进入客户端陪诊师推荐池。',
    tone: 'green',
  },
  REJECTED: {
    title: '资料需要补充',
    description: '请根据审核意见补充或修正资料后重新提交。',
    tone: 'red',
  },
  SUSPENDED: {
    title: '账号已暂停',
    description: '当前账号暂时无法提供服务，请联系平台了解处理进度。',
    tone: 'red',
  },
  DISABLED: {
    title: '账号已停用',
    description: '当前账号已停止服务权限，如有疑问请联系平台。',
    tone: 'gray',
  },
}

const formatDateTime = (value?: string) => {
  if (!value) return ''
  const date = new Date(value)
  const pad = (part: number) => `${part}`.padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

Page({
  data: {
    statusText: '',
    description: '',
    tone: 'orange',
    application: null as CompanionApplication | null,
    submittedText: '',
    reviewedText: '',
    skillText: '',
    hospitalText: '',
    canResubmit: false,
    showMockReview: ENV.mode === 'mock',
    canMockReview: false,
    reviewBusy: false,
  },

  async onShow() {
    const session = getSession()
    if (!session) {
      wx.reLaunch({ url: '/pages/login/index' })
      return
    }
    if (session.profile.accountStatus === 'APPROVED') {
      wx.reLaunch({ url: '/pages/workbench/index' })
      return
    }
    await this.load()
  },

  async load() {
    const session = getSession()
    if (!session) return
    try {
      const application = await companionService.getApplication()
      const status = application?.status || session.profile.accountStatus
      const copy = STATUS_COPY[status]
      this.setData({
        statusText: copy.title,
        description: copy.description,
        tone: copy.tone,
        application,
        submittedText: formatDateTime(application?.submittedAt),
        reviewedText: formatDateTime(application?.reviewedAt),
        skillText: application?.serviceSkillNames.join('、') || '',
        hospitalText: application?.serviceHospitalNames.join('、') || '',
        canResubmit: status === 'REJECTED',
        canMockReview: ENV.mode === 'mock' && status === 'PENDING_REVIEW',
      })
    } catch (error) {
      wx.showToast({
        title: error instanceof Error ? error.message : '审核状态加载失败',
        icon: 'none',
      })
    }
  },

  mockApprove() {
    this.runMockReview('APPROVED')
  },

  mockReject() {
    this.runMockReview('REJECTED')
  },

  runMockReview(decision: 'APPROVED' | 'REJECTED') {
    if (!this.data.showMockReview || this.data.reviewBusy) return
    wx.showModal({
      title: decision === 'APPROVED' ? '模拟审核通过' : '模拟审核驳回',
      content: decision === 'APPROVED'
        ? '将生成陪诊师公开档案并进入工作台。此操作仅用于本地演示。'
        : '将使用“资质证明不清晰”作为驳回原因，申请人可重新提交。',
      confirmText: '确认模拟',
      success: async ({ confirm }) => {
        if (!confirm) return
        this.setData({ reviewBusy: true })
        try {
          const result = await companionService.reviewApplication(
            decision,
            decision === 'REJECTED' ? '资质证明照片不清晰，请重新拍摄并提交。' : '',
          )
          if (result.application.status === 'APPROVED') {
            wx.showModal({
              title: '审核已通过',
              content: 'Mock 已生成客户端公开档案。真实跨小程序同步将在后端接入后生效。',
              showCancel: false,
              success: () => wx.reLaunch({ url: '/pages/workbench/index' }),
            })
          } else {
            await this.load()
          }
        } catch (error) {
          wx.showToast({
            title: error instanceof Error ? error.message : '审核模拟失败',
            icon: 'none',
          })
        } finally {
          this.setData({ reviewBusy: false })
        }
      },
    })
  },

  resubmit() {
    wx.navigateTo({ url: '/pages/registration/index' })
  },

  contactPlatform() {
    wx.showModal({
      title: '联系平台',
      content: '正式客服渠道将在接入后显示。当前为本地 Mock 审核流程。',
      showCancel: false,
    })
  },

  logout() {
    clearSession()
    wx.reLaunch({ url: '/pages/login/index' })
  },
})

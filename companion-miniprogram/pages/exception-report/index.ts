import { companionService } from '../../services/companion'
import type {
  TaskExceptionCategory,
  TaskExceptionUrgency,
} from '../../types/domain'
import { guardApproved } from '../../utils/auth'

interface CategoryOption {
  value: TaskExceptionCategory
  label: string
  highRisk: boolean
}

interface UrgencyOption {
  value: TaskExceptionUrgency
  label: string
  description: string
}

const CATEGORY_OPTIONS: CategoryOption[] = [
  { value: 'USER_UNREACHABLE', label: '联系不上用户', highRisk: false },
  { value: 'USER_LATE', label: '用户迟到', highRisk: false },
  { value: 'USER_NO_SHOW', label: '用户未到场', highRisk: true },
  { value: 'HOSPITAL_CHANGED', label: '医院有变更', highRisk: false },
  { value: 'DEPARTMENT_CHANGED', label: '科室有变更', highRisk: false },
  { value: 'SERVICE_OVERTIME', label: '服务超时', highRisk: false },
  { value: 'EXTRA_SERVICE_REQUEST', label: '额外服务需求', highRisk: false },
  { value: 'EXPENSE_DISPUTE', label: '费用争议', highRisk: true },
  { value: 'HEALTH_EMERGENCY', label: '身体突发不适', highRisk: true },
  { value: 'COMPLAINT_OR_CONFLICT', label: '投诉或冲突', highRisk: true },
  { value: 'OTHER', label: '其他情况', highRisk: false },
]

const URGENCY_OPTIONS: UrgencyOption[] = [
  { value: 'LOW', label: '一般', description: '暂不影响当前服务' },
  { value: 'MEDIUM', label: '关注', description: '需要平台跟进' },
  { value: 'HIGH', label: '紧急', description: '已影响服务进程' },
  { value: 'CRITICAL', label: '立即处理', description: '涉及人身安全或严重冲突' },
]

Page({
  data: {
    taskId: '',
    submitting: false,
    categoryOptions: CATEGORY_OPTIONS,
    urgencyOptions: URGENCY_OPTIONS,
    category: '' as TaskExceptionCategory | '',
    urgency: 'MEDIUM' as TaskExceptionUrgency,
    description: '',
    evidencePaths: [] as string[],
    showEmergencyNotice: false,
  },

  onLoad(options: Record<string, string | undefined>) {
    this.setData({ taskId: options.id || '' })
  },

  onShow() {
    guardApproved()
  },

  selectCategory(event: WechatMiniprogram.TouchEvent) {
    const category = event.currentTarget.dataset.category as TaskExceptionCategory
    const option = CATEGORY_OPTIONS.find((item) => item.value === category)
    if (!option) return
    this.setData({
      category,
      showEmergencyNotice: option.highRisk || ['HIGH', 'CRITICAL'].includes(this.data.urgency),
    })
  },

  selectUrgency(event: WechatMiniprogram.TouchEvent) {
    const urgency = event.currentTarget.dataset.urgency as TaskExceptionUrgency
    const categoryOption = CATEGORY_OPTIONS.find((item) => item.value === this.data.category)
    this.setData({
      urgency,
      showEmergencyNotice: urgency === 'HIGH' || urgency === 'CRITICAL' || Boolean(categoryOption?.highRisk),
    })
  },

  onDescriptionInput(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setData({ description: event.detail.value })
  },

  addEvidence() {
    const remaining = 3 - this.data.evidencePaths.length
    if (remaining <= 0) return
    wx.chooseMedia({
      count: remaining,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      sizeType: ['compressed'],
      success: ({ tempFiles }) => {
        this.setData({
          evidencePaths: [
            ...this.data.evidencePaths,
            ...tempFiles.map((file) => file.tempFilePath),
          ],
        })
      },
    })
  },

  previewEvidence(event: WechatMiniprogram.TouchEvent) {
    const current = event.currentTarget.dataset.path as string
    wx.previewImage({ current, urls: this.data.evidencePaths })
  },

  removeEvidence(event: WechatMiniprogram.TouchEvent) {
    const index = Number(event.currentTarget.dataset.index)
    this.setData({
      evidencePaths: this.data.evidencePaths.filter((_, itemIndex) => itemIndex !== index),
    })
  },

  submit() {
    if (!this.data.category) {
      wx.showToast({ title: '请选择异常分类', icon: 'none' })
      return
    }
    if (this.data.description.trim().length < 10) {
      wx.showToast({ title: '异常说明至少填写 10 个字', icon: 'none' })
      return
    }
    wx.showModal({
      title: this.data.showEmergencyNotice ? '提交紧急异常' : '提交异常记录',
      content: this.data.showEmergencyNotice
        ? '提交后平台会优先处理。身体突发不适请同时联系现场医务人员。'
        : '提交后平台将创建独立异常工单并跟进。',
      confirmText: '确认提交',
      success: async ({ confirm }) => {
        if (!confirm || this.data.submitting) return
        this.setData({ submitting: true })
        try {
          const exception = await companionService.createException(this.data.taskId, {
            category: this.data.category as TaskExceptionCategory,
            urgency: this.data.urgency,
            description: this.data.description,
            evidencePaths: this.data.evidencePaths,
            occurredAt: new Date().toISOString(),
          })
          wx.showModal({
            title: '平台已接收',
            content: `异常单号：${exception.ticketNo}\n当前状态：待平台处理`,
            showCancel: false,
            success: () => wx.navigateBack(),
          })
        } catch (error) {
          wx.showToast({
            title: error instanceof Error ? error.message : '异常提交失败',
            icon: 'none',
          })
        } finally {
          this.setData({ submitting: false })
        }
      },
    })
  },

  contactPlatform() {
    wx.showModal({
      title: '立即联系平台',
      content: '正式环境将在此接入调度和客服专线。紧急医疗情况请先联系现场医务人员。',
      showCancel: false,
    })
  },
})

import { companionService } from '../../services/companion'
import type { CompanionTask, ServiceMilestone } from '../../types/domain'
import { guardApproved } from '../../utils/auth'

const displayTime = (value?: string): string => {
  if (!value) return '未记录'
  const date = new Date(value)
  const pad = (part: number) => `${part}`.padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

Page({
  data: {
    taskId: '',
    loading: true,
    submitting: false,
    task: null as CompanionTask | null,
    milestones: [] as ServiceMilestone[],
    startedAtText: '',
    endedAtText: '',
    resultSummary: '',
    unfinishedItems: '',
    hasException: false,
    completedCount: 0,
    skippedCount: 0,
    expenseCount: 0,
    expenseAmountText: '¥0.00',
  },

  onLoad(options: Record<string, string | undefined>) {
    this.setData({ taskId: options.id || '' })
  },

  onShow() {
    if (!guardApproved() || !this.data.taskId) return
    this.load()
  },

  async load() {
    this.setData({ loading: true })
    try {
      const detail = await companionService.getTaskDetail(this.data.taskId)
      if (detail.task.status === 'COMPLETED') {
        wx.redirectTo({ url: `/pages/task-detail/index?id=${detail.task.id}` })
        return
      }
      if (detail.task.status !== 'PENDING_SUMMARY') {
        wx.showModal({
          title: '暂不能填写总结',
          content: '请先完成服务执行流程。',
          showCancel: false,
          success: () => wx.navigateBack(),
        })
        return
      }
      this.setData({
        task: detail.task,
        milestones: detail.milestones,
        startedAtText: displayTime(detail.task.serviceStartedAt),
        endedAtText: displayTime(detail.task.serviceEndedAt),
        hasException: detail.task.activeExceptionCount > 0,
        completedCount: detail.milestones.filter((item) => item.status === 'COMPLETED').length,
        skippedCount: detail.milestones.filter((item) => item.status === 'SKIPPED').length,
        expenseCount: detail.expenses.length,
        expenseAmountText: `¥${(detail.expenses.reduce((sum, item) => sum + item.amount, 0) / 100).toFixed(2)}`,
      })
    } catch (error) {
      wx.showToast({
        title: error instanceof Error ? error.message : '总结信息加载失败',
        icon: 'none',
      })
    } finally {
      this.setData({ loading: false })
    }
  },

  onResultInput(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setData({ resultSummary: event.detail.value })
  },

  onUnfinishedInput(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setData({ unfinishedItems: event.detail.value })
  },

  onExceptionChange(event: WechatMiniprogram.SwitchChange) {
    if (this.data.task?.activeExceptionCount && !event.detail.value) {
      wx.showToast({ title: '已有异常记录，不能选择无异常', icon: 'none' })
      this.setData({ hasException: true })
      return
    }
    this.setData({ hasException: event.detail.value })
  },

  submit() {
    const task = this.data.task
    if (!task || this.data.submitting) return
    if (this.data.resultSummary.trim().length < 10) {
      wx.showToast({ title: '服务结果摘要至少填写 10 个字', icon: 'none' })
      return
    }
    wx.showModal({
      title: '提交服务总结',
      content: '提交后陪诊师不能直接修改，请确认记录真实完整。',
      confirmText: '确认提交',
      success: async ({ confirm }) => {
        if (!confirm) return
        this.setData({ submitting: true })
        try {
          await companionService.submitSummary(task, {
            actualStartedAt: task.serviceStartedAt || '',
            actualEndedAt: task.serviceEndedAt || '',
            resultSummary: this.data.resultSummary,
            unfinishedItems: this.data.unfinishedItems,
            hasException: this.data.hasException,
          })
          wx.showModal({
            title: '服务已完成',
            content: '服务总结已提交，平台和用户端状态已进入待评价。',
            showCancel: false,
            success: () => wx.redirectTo({ url: `/pages/task-detail/index?id=${task.id}` }),
          })
        } catch (error) {
          wx.showToast({
            title: error instanceof Error ? error.message : '总结提交失败',
            icon: 'none',
          })
        } finally {
          this.setData({ submitting: false })
        }
      },
    })
  },

  reportException() {
    if (!this.data.taskId) return
    wx.navigateTo({ url: `/pages/exception-report/index?id=${this.data.taskId}` })
  },

  recordExpense() {
    if (!this.data.taskId) return
    wx.navigateTo({ url: `/pages/expense-record/index?id=${this.data.taskId}` })
  },
})

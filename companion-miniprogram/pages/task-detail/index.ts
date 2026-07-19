import { companionService } from '../../services/companion'
import { companionSubscriptionService } from '../../services/subscription'
import type { TaskDetail, TaskExpense, TaskExpenseCategory } from '../../types/domain'
import { guardApproved } from '../../utils/auth'
import {
  buildTaskTimeline,
  TaskCardView,
  TaskTimelineItem,
  toTaskCardView,
} from '../../utils/task-presenter'
import { getPrimaryAction, TASK_STATUS_META } from '../../utils/task-state'

interface ExpenseView extends TaskExpense {
  categoryText: string
  amountText: string
  statusText: string
}

const EXPENSE_CATEGORY_TEXT: Record<TaskExpenseCategory, string> = {
  REGISTRATION: '挂号费用',
  MEDICINE: '药品费用',
  EXAMINATION: '检查费用',
  TRANSPORT: '交通费用',
  OTHER: '其他费用',
}

const toExpenseView = (expense: TaskExpense): ExpenseView => ({
  ...expense,
  categoryText: EXPENSE_CATEGORY_TEXT[expense.category],
  amountText: `¥${(expense.amount / 100).toFixed(2)}`,
  statusText: expense.status === 'SUBMITTED'
    ? '待平台审核'
    : expense.status === 'CONFIRMED'
      ? '已确认'
      : '已驳回',
})

Page({
  data: {
    taskId: '',
    loading: true,
    actionBusy: false,
    detail: null as TaskDetail | null,
    task: null as TaskCardView | null,
    timeline: [] as TaskTimelineItem[],
    statusDescription: '',
    primaryActionText: '',
    secondaryActionText: '',
    expenses: [] as ExpenseView[],
    canRecordExpense: false,
  },

  onLoad(options: Record<string, string | undefined>) {
    this.setData({ taskId: options.id || '' })
  },

  onShow() {
    if (!guardApproved() || !this.data.taskId) return
    this.load()
  },

  onPullDownRefresh() {
    this.load().finally(() => wx.stopPullDownRefresh())
  },

  async load() {
    this.setData({ loading: true })
    try {
      const detail = await companionService.getTaskDetail(this.data.taskId)
      const task = toTaskCardView(detail.task)
      const action = getPrimaryAction(task.status)
      this.setData({
        detail,
        task,
        timeline: buildTaskTimeline(task),
        statusDescription: TASK_STATUS_META[task.status].description,
        primaryActionText: action?.text || '',
        secondaryActionText: task.status === 'OFFERED'
          ? '拒绝任务'
          : ['COMPLETED', 'REJECTED', 'EXPIRED', 'CANCELLED'].includes(task.status)
            ? ''
            : '报告异常',
        expenses: detail.expenses.map(toExpenseView),
        canRecordExpense: ['IN_SERVICE', 'PENDING_SUMMARY'].includes(task.status),
      })
    } catch (error) {
      wx.showToast({
        title: error instanceof Error ? error.message : '任务详情加载失败',
        icon: 'none',
      })
    } finally {
      this.setData({ loading: false })
    }
  },

  async onPrimaryAction() {
    const task = this.data.task
    if (!task || this.data.actionBusy) return
    if (task.status === 'IN_SERVICE') {
      wx.navigateTo({ url: `/pages/service-execution/index?id=${task.id}` })
      return
    }
    if (task.status === 'PENDING_SUMMARY') {
      wx.navigateTo({ url: `/pages/service-summary/index?id=${task.id}` })
      return
    }
    const action = getPrimaryAction(task.status)
    if (!action?.nextStatus) return
    this.setData({ actionBusy: true })
    try {
      if (task.status === 'OFFERED') {
        await companionService.acceptTask(task)
        await companionSubscriptionService.request(['TASK_UPDATE', 'SERVICE_REMINDER'])
      } else {
        await companionService.transitionTask(task, action.nextStatus)
      }
      await this.load()
      if (action.nextStatus === 'IN_SERVICE') {
        wx.navigateTo({ url: `/pages/service-execution/index?id=${task.id}` })
      }
    } catch (error) {
      wx.showToast({
        title: error instanceof Error ? error.message : '任务状态更新失败',
        icon: 'none',
      })
    } finally {
      this.setData({ actionBusy: false })
    }
  },

  onSecondaryAction() {
    const task = this.data.task
    if (!task || this.data.actionBusy) return
    if (task.status !== 'OFFERED') {
      wx.navigateTo({ url: `/pages/exception-report/index?id=${task.id}` })
      return
    }
    const reasons = ['时间冲突', '距离过远', '服务能力不匹配', '临时不可服务', '其他']
    wx.showActionSheet({
      itemList: reasons,
      success: async ({ tapIndex }) => {
        this.setData({ actionBusy: true })
        try {
          await companionService.rejectTask(task, reasons[tapIndex])
          await this.load()
        } catch (error) {
          wx.showToast({
            title: error instanceof Error ? error.message : '拒绝任务失败',
            icon: 'none',
          })
        } finally {
          this.setData({ actionBusy: false })
        }
      },
    })
  },

  privacyCall() {
    wx.showModal({
      title: '隐私通话',
      content: '正式环境将通过平台隐私号呼叫，不会向双方展示真实手机号。',
      showCancel: false,
    })
  },

  showNavigation() {
    wx.showToast({ title: '正式环境将唤起医院导航', icon: 'none' })
  },

  recordExpense() {
    if (!this.data.taskId) return
    wx.navigateTo({ url: `/pages/expense-record/index?id=${this.data.taskId}` })
  },
})

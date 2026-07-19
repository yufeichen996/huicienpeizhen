import { companionService } from '../../services/companion'
import { companionSubscriptionService } from '../../services/subscription'
import type {
  CompanionAvailability,
  CompanionTask,
  WorkbenchSummary,
} from '../../types/domain'
import { clearSession, guardApproved } from '../../utils/auth'
import { getPrimaryAction, TASK_STATUS_META } from '../../utils/task-state'

interface TaskView extends CompanionTask {
  statusText: string
  statusTone: string
  statusDescription: string
  bookingText: string
  primaryActionText: string
  canReject: boolean
}

const toTaskView = (task: CompanionTask): TaskView => {
  const status = TASK_STATUS_META[task.status]
  const action = getPrimaryAction(task.status)
  return {
    ...task,
    statusText: status.text,
    statusTone: status.tone,
    statusDescription: status.description,
    bookingText: `${task.bookingDate} ${task.bookingTime}`,
    primaryActionText: action?.text || '',
    canReject: task.status === 'OFFERED',
  }
}

Page({
  data: {
    summary: null as WorkbenchSummary | null,
    task: null as TaskView | null,
    loading: true,
    actionBusy: false,
    isAvailable: false,
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
      const [summary, messages] = await Promise.all([
        companionService.getWorkbench(),
        companionService.getMessages(),
      ])
      const unreadCount = messages.filter((message) => !message.read).length
      if (unreadCount) {
        wx.setTabBarBadge({ index: 2, text: unreadCount > 99 ? '99+' : `${unreadCount}` })
      } else {
        wx.removeTabBarBadge({ index: 2 })
      }
      this.setData({
        summary,
        task: summary.nextTask ? toTaskView(summary.nextTask) : null,
        isAvailable: summary.profile.availability === 'AVAILABLE',
        loading: false,
      })
    } catch (error) {
      this.setData({ loading: false })
      wx.showToast({
        title: error instanceof Error ? error.message : '工作台加载失败',
        icon: 'none',
      })
    }
  },

  async onAvailabilityChange(event: WechatMiniprogram.SwitchChange) {
    if (this.data.actionBusy) return
    const availability: CompanionAvailability = event.detail.value ? 'AVAILABLE' : 'OFFLINE'
    this.setData({ actionBusy: true })
    try {
      await companionService.setAvailability(availability)
      await this.load()
    } catch (error) {
      this.setData({ isAvailable: !event.detail.value })
      wx.showToast({
        title: error instanceof Error ? error.message : '状态更新失败',
        icon: 'none',
      })
    } finally {
      this.setData({ actionBusy: false })
    }
  },

  async onPrimaryAction() {
    const task = this.data.task
    if (!task || this.data.actionBusy) return
    const action = getPrimaryAction(task.status)
    if (!action) return
    if (!action.nextStatus) {
      const route = task.status === 'PENDING_SUMMARY'
        ? '/pages/service-summary/index'
        : '/pages/service-execution/index'
      wx.navigateTo({ url: `${route}?id=${task.id}` })
      return
    }
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
        title: error instanceof Error ? error.message : '任务更新失败',
        icon: 'none',
      })
    } finally {
      this.setData({ actionBusy: false })
    }
  },

  onReject() {
    const task = this.data.task
    if (!task || task.status !== 'OFFERED' || this.data.actionBusy) return
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

  contactPlatform() {
    wx.showModal({
      title: '联系平台',
      content: '正式客服渠道将在服务端接入后显示。',
      showCancel: false,
    })
  },

  openTasks() {
    wx.switchTab({ url: '/pages/tasks/index' })
  },

  openOrderHall() {
    wx.navigateTo({ url: '/pages/order-hall/index' })
  },

  openTaskDetail() {
    const taskId = this.data.task?.id
    if (!taskId) return
    wx.navigateTo({ url: `/pages/task-detail/index?id=${taskId}` })
  },

  openExceptions() {
    wx.navigateTo({ url: '/pages/exceptions/index' })
  },

  logout() {
    wx.showModal({
      title: '退出登录',
      content: '确定退出陪诊师工作台吗？',
      success: ({ confirm }) => {
        if (!confirm) return
        clearSession()
        wx.reLaunch({ url: '/pages/login/index' })
      },
    })
  },
})

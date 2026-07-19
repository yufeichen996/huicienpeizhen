import { companionService } from '../../services/companion'
import type { CompanionMessage, CompanionMessageType } from '../../types/domain'
import { guardApproved } from '../../utils/auth'

interface MessageView extends CompanionMessage {
  typeText: string
  tone: string
  timeText: string
}

const TYPE_META: Record<CompanionMessageType, { text: string; tone: string }> = {
  NEW_TASK: { text: '新任务', tone: 'blue' },
  TASK_UPDATE: { text: '任务变化', tone: 'green' },
  SERVICE_REMINDER: { text: '服务提醒', tone: 'orange' },
  EXCEPTION_UPDATE: { text: '异常处理', tone: 'red' },
  ANNOUNCEMENT: { text: '平台公告', tone: 'gray' },
}

const formatMessageTime = (value: string): string => {
  const date = new Date(value)
  const diffMinutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000))
  if (diffMinutes < 1) return '刚刚'
  if (diffMinutes < 60) return `${diffMinutes} 分钟前`
  if (diffMinutes < 24 * 60) return `${Math.floor(diffMinutes / 60)} 小时前`
  const pad = (part: number) => `${part}`.padStart(2, '0')
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

const toMessageView = (message: CompanionMessage): MessageView => ({
  ...message,
  typeText: TYPE_META[message.type].text,
  tone: TYPE_META[message.type].tone,
  timeText: formatMessageTime(message.createdAt),
})

Page({
  data: {
    loading: true,
    messages: [] as CompanionMessage[],
    visibleMessages: [] as MessageView[],
    filter: 'all' as 'all' | 'unread',
    unreadCount: 0,
    actionBusy: false,
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
      const messages = await companionService.getMessages()
      this.applyMessages(messages, this.data.filter)
    } catch (error) {
      wx.showToast({
        title: error instanceof Error ? error.message : '消息加载失败',
        icon: 'none',
      })
    } finally {
      this.setData({ loading: false })
    }
  },

  applyMessages(messages: CompanionMessage[], filter: 'all' | 'unread') {
    const unreadCount = messages.filter((message) => !message.read).length
    const visibleMessages = messages
      .filter((message) => filter === 'all' || !message.read)
      .map(toMessageView)
    this.setData({ messages, visibleMessages, filter, unreadCount })
    if (unreadCount) {
      wx.setTabBarBadge({ index: 2, text: unreadCount > 99 ? '99+' : `${unreadCount}` })
    } else {
      wx.removeTabBarBadge({ index: 2 })
    }
  },

  selectFilter(event: WechatMiniprogram.TouchEvent) {
    const filter = event.currentTarget.dataset.filter as 'all' | 'unread'
    if (!filter || filter === this.data.filter) return
    this.applyMessages(this.data.messages, filter)
  },

  async markAllRead() {
    if (!this.data.unreadCount || this.data.actionBusy) return
    this.setData({ actionBusy: true })
    try {
      const messages = await companionService.markAllMessagesRead()
      this.applyMessages(messages, this.data.filter)
      wx.showToast({ title: '已全部标为已读', icon: 'success' })
    } catch (error) {
      wx.showToast({
        title: error instanceof Error ? error.message : '操作失败',
        icon: 'none',
      })
    } finally {
      this.setData({ actionBusy: false })
    }
  },

  async openMessage(event: WechatMiniprogram.TouchEvent) {
    const messageId = event.currentTarget.dataset.messageId as string
    const message = this.data.messages.find((item) => item.id === messageId)
    if (!message || this.data.actionBusy) return
    if (!message.read) {
      this.setData({ actionBusy: true })
      try {
        const messages = await companionService.markMessageRead(message.id)
        this.applyMessages(messages, this.data.filter)
      } catch (error) {
        wx.showToast({
          title: error instanceof Error ? error.message : '消息状态更新失败',
          icon: 'none',
        })
        return
      } finally {
        this.setData({ actionBusy: false })
      }
    }
    if (message.taskId) {
      wx.navigateTo({ url: `/pages/task-detail/index?id=${message.taskId}` })
      return
    }
    wx.showModal({
      title: message.title,
      content: message.content,
      showCancel: false,
    })
  },
})

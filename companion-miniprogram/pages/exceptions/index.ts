import { companionService } from '../../services/companion'
import type {
  TaskException,
  TaskExceptionCategory,
  TaskExceptionUrgency,
} from '../../types/domain'
import { guardApproved } from '../../utils/auth'

interface ExceptionView extends TaskException {
  categoryText: string
  urgencyText: string
  urgencyTone: string
  statusText: string
  submittedText: string
}

const CATEGORY_TEXT: Record<TaskExceptionCategory, string> = {
  USER_UNREACHABLE: '联系不上用户',
  USER_LATE: '用户迟到',
  USER_NO_SHOW: '用户未到场',
  HOSPITAL_CHANGED: '医院有变更',
  DEPARTMENT_CHANGED: '科室有变更',
  SERVICE_OVERTIME: '服务超时',
  EXTRA_SERVICE_REQUEST: '额外服务需求',
  EXPENSE_DISPUTE: '费用争议',
  HEALTH_EMERGENCY: '身体突发不适',
  COMPLAINT_OR_CONFLICT: '投诉或冲突',
  OTHER: '其他情况',
}

const URGENCY_META: Record<TaskExceptionUrgency, { text: string; tone: string }> = {
  LOW: { text: '一般', tone: 'gray' },
  MEDIUM: { text: '关注', tone: 'orange' },
  HIGH: { text: '紧急', tone: 'red' },
  CRITICAL: { text: '立即处理', tone: 'red' },
}

const formatDateTime = (value: string) => {
  const date = new Date(value)
  const pad = (part: number) => `${part}`.padStart(2, '0')
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

const toExceptionView = (item: TaskException): ExceptionView => ({
  ...item,
  categoryText: CATEGORY_TEXT[item.category],
  urgencyText: URGENCY_META[item.urgency].text,
  urgencyTone: URGENCY_META[item.urgency].tone,
  statusText: item.status === 'OPEN'
    ? '待处理'
    : item.status === 'PROCESSING'
      ? '处理中'
      : item.status === 'RESOLVED'
        ? '已解决'
        : '已关闭',
  submittedText: formatDateTime(item.submittedAt),
})

Page({
  data: {
    loading: true,
    exceptions: [] as TaskException[],
    visibleExceptions: [] as ExceptionView[],
    filter: 'open' as 'open' | 'all' | 'resolved',
    openCount: 0,
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
      this.applyExceptions(await companionService.getAllExceptions(), this.data.filter)
    } catch (error) {
      wx.showToast({
        title: error instanceof Error ? error.message : '异常工单加载失败',
        icon: 'none',
      })
    } finally {
      this.setData({ loading: false })
    }
  },

  applyExceptions(exceptions: TaskException[], filter: 'open' | 'all' | 'resolved') {
    const visibleExceptions = exceptions
      .filter((item) => {
        if (filter === 'open') return item.status === 'OPEN' || item.status === 'PROCESSING'
        if (filter === 'resolved') return item.status === 'RESOLVED' || item.status === 'CLOSED'
        return true
      })
      .map(toExceptionView)
    this.setData({
      exceptions,
      visibleExceptions,
      filter,
      openCount: exceptions.filter((item) => item.status === 'OPEN' || item.status === 'PROCESSING').length,
    })
  },

  selectFilter(event: WechatMiniprogram.TouchEvent) {
    const filter = event.currentTarget.dataset.filter as 'open' | 'all' | 'resolved'
    if (!filter) return
    this.applyExceptions(this.data.exceptions, filter)
  },

  openTask(event: WechatMiniprogram.TouchEvent) {
    const taskId = event.currentTarget.dataset.taskId as string
    if (!taskId) return
    wx.navigateTo({ url: `/pages/task-detail/index?id=${taskId}` })
  },

  contactPlatform() {
    wx.showModal({
      title: '联系平台',
      content: '正式环境将在此显示调度与客服工单联系方式。紧急医疗情况请先联系现场医务人员。',
      showCancel: false,
    })
  },
})

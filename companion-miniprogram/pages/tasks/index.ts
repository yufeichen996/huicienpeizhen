import { companionService } from '../../services/companion'
import type { CompanionTask } from '../../types/domain'
import { guardApproved } from '../../utils/auth'
import {
  matchesTaskFilter,
  TaskCardView,
  TaskFilter,
  toTaskCardView,
} from '../../utils/task-presenter'

interface FilterTab {
  key: TaskFilter
  label: string
  count: number
}

const FILTERS: Array<Pick<FilterTab, 'key' | 'label'>> = [
  { key: 'confirmation', label: '待确认' },
  { key: 'upcoming', label: '待服务' },
  { key: 'active', label: '服务中' },
  { key: 'history', label: '已结束' },
]

Page({
  data: {
    loading: true,
    activeFilter: 'confirmation' as TaskFilter,
    tasks: [] as CompanionTask[],
    visibleTasks: [] as TaskCardView[],
    tabs: FILTERS.map((item) => ({ ...item, count: 0 })) as FilterTab[],
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
      const tasks = await companionService.getTasks()
      this.applyTasks(tasks, this.data.activeFilter)
    } catch (error) {
      wx.showToast({
        title: error instanceof Error ? error.message : '任务加载失败',
        icon: 'none',
      })
    } finally {
      this.setData({ loading: false })
    }
  },

  applyTasks(tasks: CompanionTask[], activeFilter: TaskFilter) {
    const tabs = FILTERS.map((item) => ({
      ...item,
      count: tasks.filter((task) => matchesTaskFilter(task, item.key)).length,
    }))
    const visibleTasks = tasks
      .filter((task) => matchesTaskFilter(task, activeFilter))
      .map(toTaskCardView)
    this.setData({ tasks, tabs, activeFilter, visibleTasks })
  },

  selectFilter(event: WechatMiniprogram.TouchEvent) {
    const filter = event.currentTarget.dataset.filter as TaskFilter
    if (!filter || filter === this.data.activeFilter) return
    this.applyTasks(this.data.tasks, filter)
  },

  openTask(event: WechatMiniprogram.TouchEvent) {
    const taskId = event.currentTarget.dataset.taskId as string
    if (!taskId) return
    wx.navigateTo({ url: `/pages/task-detail/index?id=${taskId}` })
  },
})

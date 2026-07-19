import { companionService } from '../../services/companion'
import type { QualityFeedback, QualityOverview } from '../../types/domain'
import { guardApproved } from '../../utils/auth'

interface QualityView extends Omit<QualityOverview, 'feedback'> {
  feedback: Array<QualityFeedback & { dateText: string }>
}

Page({
  data: {
    loading: true,
    quality: null as QualityView | null,
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
      const quality = await companionService.getQuality()
      this.setData({
        quality: {
          ...quality,
          feedback: quality.feedback.map((item) => ({
            ...item,
            dateText: item.createdAt.slice(0, 10),
          })),
        },
      })
    } catch (error) {
      wx.showToast({
        title: error instanceof Error ? error.message : '质量数据加载失败',
        icon: 'none',
      })
    } finally {
      this.setData({ loading: false })
    }
  },

  openFeedbackTask(event: WechatMiniprogram.TouchEvent) {
    const taskId = event.currentTarget.dataset.taskId as string
    if (taskId === 'task-history-001') {
      wx.navigateTo({ url: `/pages/task-detail/index?id=${taskId}` })
      return
    }
    wx.showToast({ title: '演示反馈未关联当前本地任务', icon: 'none' })
  },
})

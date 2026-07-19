import { companionService } from '../../services/companion'
import type { TrainingCourse, TrainingOverview } from '../../types/domain'
import { guardApproved } from '../../utils/auth'

interface CourseView extends TrainingCourse {
  statusText: string
  actionText: string
}

const toCourseView = (course: TrainingCourse): CourseView => ({
  ...course,
  statusText: course.status === 'COMPLETED'
    ? '已完成'
    : course.status === 'IN_PROGRESS'
      ? `已学习 ${course.progress}%`
      : '未开始',
  actionText: course.status === 'COMPLETED'
    ? '再次查看'
    : course.status === 'IN_PROGRESS'
      ? '继续学习'
      : '开始学习',
})

Page({
  data: {
    loading: true,
    actionBusy: false,
    overview: null as TrainingOverview | null,
    courses: [] as CourseView[],
    completionPercent: 0,
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
      this.applyOverview(await companionService.getTraining())
    } catch (error) {
      wx.showToast({
        title: error instanceof Error ? error.message : '培训内容加载失败',
        icon: 'none',
      })
    } finally {
      this.setData({ loading: false })
    }
  },

  applyOverview(overview: TrainingOverview) {
    this.setData({
      overview,
      courses: overview.courses.map(toCourseView),
      completionPercent: overview.requiredTotal
        ? Math.round(overview.requiredCompleted / overview.requiredTotal * 100)
        : 0,
    })
  },

  openCourse(event: WechatMiniprogram.TouchEvent) {
    const courseId = event.currentTarget.dataset.courseId as string
    const course = this.data.courses.find((item) => item.id === courseId)
    if (!course || this.data.actionBusy) return
    const content = [
      course.summary,
      '',
      ...course.lessons.map((lesson, index) => `${index + 1}. ${lesson}`),
      '',
      `预计学习 ${course.durationMinutes} 分钟`,
    ].join('\n')
    wx.showModal({
      title: course.title,
      content,
      confirmText: course.status === 'COMPLETED'
        ? '知道了'
        : course.status === 'IN_PROGRESS'
          ? '完成课程'
          : '开始学习',
      cancelText: '稍后再学',
      showCancel: course.status !== 'COMPLETED',
      success: async ({ confirm }) => {
        if (!confirm || course.status === 'COMPLETED') return
        this.setData({ actionBusy: true })
        try {
          const nextProgress = course.status === 'NOT_STARTED' ? 50 : 100
          const overview = await companionService.updateTrainingProgress(course.id, nextProgress)
          this.applyOverview(overview)
          wx.showToast({
            title: nextProgress === 100 ? '课程已完成' : '已保存学习进度',
            icon: 'success',
          })
        } catch (error) {
          wx.showToast({
            title: error instanceof Error ? error.message : '进度保存失败',
            icon: 'none',
          })
        } finally {
          this.setData({ actionBusy: false })
        }
      },
    })
  },
})

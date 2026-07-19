import { companionService } from '../../services/companion'
import type { ScheduleOverview } from '../../types/domain'
import { guardApproved } from '../../utils/auth'

Page({
  data: {
    loading: true,
    actionDate: '',
    schedule: null as ScheduleOverview | null,
    availableCount: 0,
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
      this.applySchedule(await companionService.getSchedule())
    } catch (error) {
      wx.showToast({
        title: error instanceof Error ? error.message : '排班加载失败',
        icon: 'none',
      })
    } finally {
      this.setData({ loading: false })
    }
  },

  applySchedule(schedule: ScheduleOverview) {
    this.setData({
      schedule,
      availableCount: schedule.days.filter((day) => day.available).length,
    })
  },

  async onAvailabilityChange(event: WechatMiniprogram.SwitchChange) {
    const date = event.currentTarget.dataset.date as string
    if (!date || this.data.actionDate) return
    this.setData({ actionDate: date })
    try {
      this.applySchedule(await companionService.setScheduleDay(date, event.detail.value))
      wx.showToast({ title: '排班已更新', icon: 'success' })
    } catch (error) {
      await this.load()
      wx.showToast({
        title: error instanceof Error ? error.message : '排班更新失败',
        icon: 'none',
      })
    } finally {
      this.setData({ actionDate: '' })
    }
  },
})

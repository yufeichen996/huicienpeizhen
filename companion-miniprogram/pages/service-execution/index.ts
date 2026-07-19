import { companionService } from '../../services/companion'
import type { CompanionTask, ServiceMilestone, TaskDetail } from '../../types/domain'
import { guardApproved } from '../../utils/auth'

type ExecutionNodeStatus = 'pending' | 'active' | 'completed' | 'failed'

interface ServiceExecutionNode extends Omit<ServiceMilestone, 'status' | 'evidenceImages'> {
  orderId: string
  index: number
  status: ExecutionNodeStatus
  evidenceImages: string[]
}

interface MilestoneView extends ServiceExecutionNode {
  anchorId: string
  indexText: string
  statusText: string
  resultTimeText: string
  failureReasonDraft: string
  failureReasonLength: number
  evidenceDraft: string[]
}

interface NodeDraftMap {
  [nodeId: string]: string
}

interface NodeEvidenceMap {
  [nodeId: string]: string[]
}

let elapsedTimer: number | undefined

const formatRecordTime = (value?: string): string => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const pad = (part: number) => `${part}`.padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

const isFailed = (item: ServiceMilestone): boolean =>
  item.status === 'FAILED' || item.status === 'SKIPPED'

Page({
  data: {
    taskId: '',
    loading: true,
    actionBusy: false,
    busyAction: '',
    busyMilestoneId: '',
    task: null as CompanionTask | null,
    detail: null as TaskDetail | null,
    milestones: [] as MilestoneView[],
    activeMilestoneId: '',
    expandedFailureNodeId: '',
    failureReasonByNode: {} as NodeDraftMap,
    evidenceByNode: {} as NodeEvidenceMap,
    elapsedText: '00:00',
    completedCount: 0,
    totalCount: 0,
    canFinish: false,
  },

  onLoad(options: Record<string, string | undefined>) {
    this.setData({ taskId: options.id || '' })
  },

  onShow() {
    if (!guardApproved() || !this.data.taskId) return
    this.load()
    this.startTimer()
  },

  onHide() {
    this.stopTimer()
  },

  onUnload() {
    this.stopTimer()
  },

  onPullDownRefresh() {
    this.load().finally(() => wx.stopPullDownRefresh())
  },

  startTimer() {
    this.stopTimer()
    this.updateElapsed()
    elapsedTimer = setInterval(() => this.updateElapsed(), 30000) as unknown as number
  },

  stopTimer() {
    if (elapsedTimer !== undefined) clearInterval(elapsedTimer)
    elapsedTimer = undefined
  },

  updateElapsed() {
    const startedAt = this.data.task?.serviceStartedAt
    if (!startedAt) return
    const minutes = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 60000))
    const hoursText = `${Math.floor(minutes / 60)}`.padStart(2, '0')
    const minutesText = `${minutes % 60}`.padStart(2, '0')
    this.setData({ elapsedText: `${hoursText}:${minutesText}` })
  },

  async load(scrollToActive = false) {
    this.setData({ loading: true })
    try {
      const detail = await companionService.getTaskDetail(this.data.taskId)
      if (detail.task.status === 'PENDING_SUMMARY') {
        wx.redirectTo({ url: `/pages/service-summary/index?id=${detail.task.id}` })
        return
      }
      if (detail.task.status !== 'IN_SERVICE') {
        wx.showModal({
          title: '当前无需执行服务',
          content: '任务状态已变化，请返回任务详情查看。',
          showCancel: false,
          success: () => wx.navigateBack(),
        })
        return
      }
      const activeAnchorId = this.applyDetail(detail)
      if (scrollToActive && activeAnchorId) {
        wx.nextTick(() => this.scrollToAnchor(activeAnchorId))
      }
    } catch (error) {
      wx.showToast({
        title: error instanceof Error ? error.message : '服务记录加载失败',
        icon: 'none',
      })
    } finally {
      this.setData({ loading: false })
    }
  },

  applyDetail(detail: TaskDetail): string {
    let activeIndex = -1
    for (let index = 0; index < detail.milestones.length; index += 1) {
      const milestone = detail.milestones[index]
      if (milestone.status === 'COMPLETED') continue
      if (isFailed(milestone)) {
        if (milestone.required) break
        continue
      }
      activeIndex = index
      break
    }

    const milestones = detail.milestones.map((item, index) => {
      let executionStatus: ExecutionNodeStatus = 'pending'
      if (item.status === 'COMPLETED') executionStatus = 'completed'
      else if (isFailed(item)) executionStatus = 'failed'
      else if (index === activeIndex) executionStatus = 'active'

      const failureReasonDraft = this.data.failureReasonByNode[item.id] || ''
      const evidenceDraft = [...(this.data.evidenceByNode[item.id] || [])]
      const statusText = executionStatus === 'completed'
        ? '已完成'
        : executionStatus === 'failed'
          ? '无法完成'
          : executionStatus === 'active'
            ? '进行中'
            : '待记录'

      return {
        ...item,
        orderId: detail.task.orderId,
        index: index + 1,
        status: executionStatus,
        anchorId: `milestone-node-${index + 1}`,
        indexText: `${index + 1}`.padStart(2, '0'),
        statusText,
        resultTimeText: formatRecordTime(
          executionStatus === 'failed' ? item.failedAt || item.completedAt : item.completedAt,
        ),
        failureReasonDraft,
        failureReasonLength: failureReasonDraft.length,
        evidenceDraft,
        evidenceImages: [...(item.evidenceImages || [])],
      }
    })

    const activeMilestone = activeIndex >= 0 ? milestones[activeIndex] : undefined
    const canFinish = milestones
      .filter((item) => item.required)
      .every((item) => item.status === 'completed')
    this.setData({
      detail,
      task: detail.task,
      milestones,
      activeMilestoneId: activeMilestone?.id || '',
      completedCount: milestones.filter(
        (item) => item.status === 'completed' || item.status === 'failed',
      ).length,
      totalCount: milestones.length,
      canFinish,
    })
    this.updateElapsed()
    return activeMilestone?.anchorId || ''
  },

  refreshNodeDraft(nodeId: string) {
    const failureReasonDraft = this.data.failureReasonByNode[nodeId] || ''
    const evidenceDraft = [...(this.data.evidenceByNode[nodeId] || [])]
    this.setData({
      milestones: this.data.milestones.map((item) => item.id === nodeId
        ? {
          ...item,
          failureReasonDraft,
          failureReasonLength: failureReasonDraft.length,
          evidenceDraft,
        }
        : item),
    })
  },

  expandFailure(event: WechatMiniprogram.TouchEvent) {
    const nodeId = event.currentTarget.dataset.nodeId as string
    if (nodeId !== this.data.activeMilestoneId || this.data.actionBusy) return
    this.setData({ expandedFailureNodeId: nodeId })
  },

  collapseFailure(event: WechatMiniprogram.TouchEvent) {
    const nodeId = event.currentTarget.dataset.nodeId as string
    if (this.data.expandedFailureNodeId !== nodeId) return
    this.setData({ expandedFailureNodeId: '' })
  },

  onFailureReasonInput(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
    const nodeId = event.currentTarget.dataset.nodeId as string
    if (nodeId !== this.data.activeMilestoneId) return
    this.setData({
      failureReasonByNode: {
        ...this.data.failureReasonByNode,
        [nodeId]: event.detail.value,
      },
    })
    this.refreshNodeDraft(nodeId)
  },

  addEvidence(event: WechatMiniprogram.TouchEvent) {
    const nodeId = event.currentTarget.dataset.nodeId as string
    if (nodeId !== this.data.activeMilestoneId || this.data.actionBusy) return
    const current = this.data.evidenceByNode[nodeId] || []
    const remaining = 9 - current.length
    if (remaining <= 0) {
      wx.showToast({ title: '最多上传 9 张凭证', icon: 'none' })
      return
    }
    wx.chooseMedia({
      count: remaining,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      sizeType: ['compressed'],
      success: ({ tempFiles }) => {
        this.setData({
          evidenceByNode: {
            ...this.data.evidenceByNode,
            [nodeId]: [
              ...current,
              ...tempFiles.map((file) => file.tempFilePath),
            ].slice(0, 9),
          },
        })
        this.refreshNodeDraft(nodeId)
      },
    })
  },

  previewEvidence(event: WechatMiniprogram.TouchEvent) {
    const nodeId = event.currentTarget.dataset.nodeId as string
    const current = event.currentTarget.dataset.path as string
    const milestone = this.data.milestones.find((item) => item.id === nodeId)
    const urls = milestone?.status === 'failed' || milestone?.status === 'completed'
      ? milestone.evidenceImages || []
      : this.data.evidenceByNode[nodeId] || []
    if (current && urls.length) wx.previewImage({ current, urls })
  },

  removeEvidence(event: WechatMiniprogram.TouchEvent) {
    const nodeId = event.currentTarget.dataset.nodeId as string
    const imageIndex = Number(event.currentTarget.dataset.imageIndex)
    if (nodeId !== this.data.activeMilestoneId || this.data.actionBusy) return
    const current = this.data.evidenceByNode[nodeId] || []
    this.setData({
      evidenceByNode: {
        ...this.data.evidenceByNode,
        [nodeId]: current.filter((_, index) => index !== imageIndex),
      },
    })
    this.refreshNodeDraft(nodeId)
  },

  completeMilestone(event: WechatMiniprogram.TouchEvent) {
    const nodeId = event.currentTarget.dataset.nodeId as string
    const milestone = this.data.milestones.find((item) => item.id === nodeId)
    if (!milestone || milestone.status !== 'active' || this.data.actionBusy) return
    wx.showModal({
      title: '确认完成节点',
      content: `确定已完成“${milestone.title}”吗？`,
      confirmText: '确认完成',
      success: async ({ confirm }) => {
        if (!confirm || this.data.actionBusy) return
        await this.saveCompletedMilestone(milestone)
      },
    })
  },

  async saveCompletedMilestone(milestone: MilestoneView) {
    this.setData({ actionBusy: true, busyAction: 'complete', busyMilestoneId: milestone.id })
    try {
      await companionService.updateMilestone(
        this.data.taskId,
        milestone.id,
        'COMPLETED',
        milestone.note || '',
        { evidenceImages: milestone.evidenceImages || [] },
      )
      this.setData({ expandedFailureNodeId: '' })
      await this.load(true)
      wx.showToast({ title: '节点已完成', icon: 'success' })
    } catch (error) {
      wx.showToast({
        title: error instanceof Error ? error.message : '节点记录失败',
        icon: 'none',
      })
    } finally {
      this.setData({ actionBusy: false, busyAction: '', busyMilestoneId: '' })
    }
  },

  async submitFailure(event: WechatMiniprogram.TouchEvent) {
    const nodeId = event.currentTarget.dataset.nodeId as string
    const milestone = this.data.milestones.find((item) => item.id === nodeId)
    const failureReason = (this.data.failureReasonByNode[nodeId] || '').trim()
    if (!milestone || milestone.status !== 'active' || this.data.actionBusy) return
    if (!failureReason) {
      wx.showToast({ title: '请填写当前节点无法完成的原因', icon: 'none' })
      return
    }
    this.setData({ actionBusy: true, busyAction: 'failure', busyMilestoneId: nodeId })
    try {
      await companionService.updateMilestone(
        this.data.taskId,
        nodeId,
        'FAILED',
        milestone.note || '',
        {
          failureReason,
          evidenceImages: this.data.evidenceByNode[nodeId] || [],
        },
      )
      const failureReasonByNode = { ...this.data.failureReasonByNode }
      const evidenceByNode = { ...this.data.evidenceByNode }
      delete failureReasonByNode[nodeId]
      delete evidenceByNode[nodeId]
      this.setData({
        expandedFailureNodeId: '',
        failureReasonByNode,
        evidenceByNode,
      })
      await this.load(true)
      wx.showToast({ title: '异常已记录', icon: 'success' })
    } catch (error) {
      wx.showToast({
        title: error instanceof Error ? error.message : '异常提交失败',
        icon: 'none',
      })
    } finally {
      this.setData({ actionBusy: false, busyAction: '', busyMilestoneId: '' })
    }
  },

  scrollToAnchor(anchorId: string) {
    const query = wx.createSelectorQuery()
    query.select(`#${anchorId}`).boundingClientRect()
    query.selectViewport().scrollOffset()
    query.exec((results) => {
      const rect = results[0] as { top?: number } | null
      const viewport = results[1] as { scrollTop?: number } | null
      if (typeof rect?.top !== 'number') return
      wx.pageScrollTo({
        scrollTop: Math.max(0, (viewport?.scrollTop || 0) + rect.top - 118),
        duration: 280,
      })
    })
  },

  finishService() {
    const task = this.data.task
    if (!task || !this.data.canFinish || this.data.actionBusy) {
      if (!this.data.canFinish) wx.showToast({ title: '请先完成所有必需节点', icon: 'none' })
      return
    }
    wx.showModal({
      title: '结束服务流程',
      content: '结束后将进入服务总结，履约节点不能由陪诊师直接回退。',
      confirmText: '确认结束',
      success: async ({ confirm }) => {
        if (!confirm) return
        this.setData({ actionBusy: true, busyAction: 'finish' })
        try {
          await companionService.transitionTask(task, 'PENDING_SUMMARY')
          wx.redirectTo({ url: `/pages/service-summary/index?id=${task.id}` })
        } catch (error) {
          wx.showToast({
            title: error instanceof Error ? error.message : '状态更新失败',
            icon: 'none',
          })
        } finally {
          this.setData({ actionBusy: false, busyAction: '' })
        }
      },
    })
  },

  reportException() {
    const activeMilestone = this.data.milestones.find(
      (item) => item.id === this.data.activeMilestoneId,
    )
    if (!activeMilestone) {
      wx.showToast({ title: '当前没有可记录的进行中节点', icon: 'none' })
      return
    }
    this.setData({ expandedFailureNodeId: activeMilestone.id })
    wx.nextTick(() => this.scrollToAnchor(activeMilestone.anchorId))
  },

  recordExpense() {
    if (!this.data.taskId) return
    wx.navigateTo({ url: `/pages/expense-record/index?id=${this.data.taskId}` })
  },
})

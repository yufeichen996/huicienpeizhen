import { companionService } from '../../services/companion'
import type { CompanionTask, TaskExpenseCategory } from '../../types/domain'
import { guardApproved } from '../../utils/auth'

const CATEGORY_OPTIONS: Array<{ value: TaskExpenseCategory; label: string }> = [
  { value: 'REGISTRATION', label: '挂号费用' },
  { value: 'MEDICINE', label: '药品费用' },
  { value: 'EXAMINATION', label: '检查费用' },
  { value: 'TRANSPORT', label: '交通费用' },
  { value: 'OTHER', label: '其他费用' },
]

Page({
  data: {
    taskId: '',
    loading: true,
    submitting: false,
    task: null as CompanionTask | null,
    categoryOptions: CATEGORY_OPTIONS,
    category: '' as TaskExpenseCategory | '',
    amountText: '',
    description: '',
    receiptPaths: [] as string[],
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
      if (!['IN_SERVICE', 'PENDING_SUMMARY'].includes(detail.task.status)) {
        wx.showModal({
          title: '当前不能记录费用',
          content: '费用只能在服务进行中或提交总结前记录。',
          showCancel: false,
          success: () => wx.navigateBack(),
        })
        return
      }
      this.setData({ task: detail.task })
    } catch (error) {
      wx.showToast({
        title: error instanceof Error ? error.message : '任务信息加载失败',
        icon: 'none',
      })
    } finally {
      this.setData({ loading: false })
    }
  },

  selectCategory(event: WechatMiniprogram.TouchEvent) {
    this.setData({ category: event.currentTarget.dataset.category as TaskExpenseCategory })
  },

  onAmountInput(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setData({ amountText: event.detail.value })
  },

  onDescriptionInput(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setData({ description: event.detail.value })
  },

  addReceipt() {
    const remaining = 3 - this.data.receiptPaths.length
    if (remaining <= 0) return
    wx.chooseMedia({
      count: remaining,
      mediaType: ['image'],
      sourceType: ['camera', 'album'],
      sizeType: ['compressed'],
      success: ({ tempFiles }) => {
        this.setData({
          receiptPaths: [
            ...this.data.receiptPaths,
            ...tempFiles.map((file) => file.tempFilePath),
          ],
        })
      },
    })
  },

  previewReceipt(event: WechatMiniprogram.TouchEvent) {
    wx.previewImage({
      current: event.currentTarget.dataset.path as string,
      urls: this.data.receiptPaths,
    })
  },

  removeReceipt(event: WechatMiniprogram.TouchEvent) {
    const index = Number(event.currentTarget.dataset.index)
    this.setData({
      receiptPaths: this.data.receiptPaths.filter((_, itemIndex) => itemIndex !== index),
    })
  },

  submit() {
    if (!this.data.category) {
      wx.showToast({ title: '请选择费用类型', icon: 'none' })
      return
    }
    if (!/^\d+(\.\d{1,2})?$/.test(this.data.amountText)) {
      wx.showToast({ title: '请输入正确金额，最多两位小数', icon: 'none' })
      return
    }
    const amount = Math.round(Number(this.data.amountText) * 100)
    if (amount <= 0 || amount > 1000000) {
      wx.showToast({ title: '费用金额需在 0.01 至 10000 元之间', icon: 'none' })
      return
    }
    if (!this.data.description.trim()) {
      wx.showToast({ title: '请填写费用用途', icon: 'none' })
      return
    }
    if (!this.data.receiptPaths.length) {
      wx.showToast({ title: '请添加票据或支付凭证', icon: 'none' })
      return
    }
    wx.showModal({
      title: '提交费用记录',
      content: `记录金额 ¥${(amount / 100).toFixed(2)}，提交后等待平台审核。`,
      confirmText: '确认提交',
      success: async ({ confirm }) => {
        if (!confirm || this.data.submitting) return
        this.setData({ submitting: true })
        try {
          await companionService.createExpense(this.data.taskId, {
            category: this.data.category as TaskExpenseCategory,
            amount,
            description: this.data.description,
            receiptPaths: this.data.receiptPaths,
            paidAt: new Date().toISOString(),
          })
          wx.showModal({
            title: '费用已记录',
            content: '平台审核前不会自动改变用户订单金额或结算金额。',
            showCancel: false,
            success: () => wx.navigateBack(),
          })
        } catch (error) {
          wx.showToast({
            title: error instanceof Error ? error.message : '费用提交失败',
            icon: 'none',
          })
        } finally {
          this.setData({ submitting: false })
        }
      },
    })
  },
})

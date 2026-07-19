import { reviewTags } from '../../mocks/orders'
import { orderService } from '../../services/order'

const stars = (rating: number) => [1, 2, 3, 4, 5].map((value) => ({ value, active: value <= rating }))
Page({
  data: { id: '', order: null as ReturnType<typeof orderService.getOrder> | null, overall: 5, attitude: 5, professional: 5, punctuality: 5, overallStars: stars(5), attitudeStars: stars(5), professionalStars: stars(5), punctualityStars: stars(5), tags: reviewTags.map((value) => ({ value, selected: false })), content: '', anonymous: false, submitting: false },
  onLoad(query: Record<string, string | undefined>) { const id = query.id || ''; const order = orderService.getOrder(id); if (!order || order.status !== 'PENDING_REVIEW' || order.review) { wx.showToast({ title: '该订单暂不可评价', icon: 'none' }); return } this.setData({ id, order }) },
  rate(e: WechatMiniprogram.TouchEvent) { const field = e.currentTarget.dataset.field as 'overall' | 'attitude' | 'professional' | 'punctuality'; const value = Number(e.currentTarget.dataset.value); this.setData({ [field]: value, [`${field}Stars`]: stars(value) }) },
  toggleTag(e: WechatMiniprogram.TouchEvent) { const value = e.currentTarget.dataset.value; this.setData({ tags: this.data.tags.map((item) => item.value === value ? { ...item, selected: !item.selected } : item) }) },
  onContent(e: WechatMiniprogram.Input) { this.setData({ content: e.detail.value.slice(0, 300) }) }, onAnonymous(e: WechatMiniprogram.SwitchChange) { this.setData({ anonymous: e.detail.value }) },
  submit() { if (this.data.submitting || !this.data.order) return; this.setData({ submitting: true }); const result = orderService.submitReview(this.data.id, { overall: this.data.overall, attitude: this.data.attitude, professional: this.data.professional, punctuality: this.data.punctuality, tags: this.data.tags.filter((item) => item.selected).map((item) => item.value), content: this.data.content, anonymous: this.data.anonymous }); if (!result) { this.setData({ submitting: false }); return wx.showToast({ title: '评价提交失败，请重试', icon: 'none' }) } wx.showToast({ title: '感谢您的评价', icon: 'success' }); setTimeout(() => wx.navigateBack(), 500) },
})

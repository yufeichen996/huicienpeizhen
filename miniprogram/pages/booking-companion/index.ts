import { companions } from '../../mocks/companions'
import { bookingStore } from '../../stores/booking'
import { navigation } from '../../utils/navigation'

Page({
  data: { mode: 'platform', selectedId: '', companions, detail: null as typeof companions[number] | null },
  onShow() { const d = bookingStore.getDraft(); this.setData({ mode: d.companionMode, selectedId: d.companionId || '' }) },
  selectMode(e: WechatMiniprogram.TouchEvent) { const mode = e.currentTarget.dataset.mode as 'platform' | 'selected'; bookingStore.setCompanionMode(mode); this.setData({ mode, selectedId: mode === 'platform' ? '' : this.data.selectedId }) },
  selectCompanion(e: WechatMiniprogram.TouchEvent) { const c = companions.find((item) => item.id === e.currentTarget.dataset.id); if (!c) return; bookingStore.update({ companionMode: 'selected', companionId: c.id, companionName: c.name, companionPrice: c.priceFrom * 100 }); this.setData({ mode: 'selected', selectedId: c.id, detail: null }) },
  openDetail(e: WechatMiniprogram.TouchEvent) { this.setData({ detail: companions.find((item) => item.id === e.currentTarget.dataset.id) || null }) },
  closeDetail() { this.setData({ detail: null }) }, stop() {},
  onNext() { if (this.data.mode === 'selected' && !this.data.selectedId) return wx.showToast({ title: '请选择一位陪诊员', icon: 'none' }); bookingStore.update({ progressStep: Math.max(3, bookingStore.getDraft().progressStep) }); navigation.openPage('/pages/booking-confirm/index') },
  onBack() { navigation.back('/pages/book/index') },
})

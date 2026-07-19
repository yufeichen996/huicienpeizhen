import { bookingServices } from '../../mocks/booking'
import { bookingStore, formatMoney } from '../../stores/booking'
import { navigation } from '../../utils/navigation'

Page({
  data: { services: bookingServices.map((item) => ({ ...item, priceText: formatMoney(item.price), durationText: item.duration >= 60 ? `${item.duration / 60}小时` : `${item.duration}分钟` })), selectedId: '' },
  onShow() { this.setData({ selectedId: bookingStore.getDraft().serviceId || '' }) },
  onSelect(e: WechatMiniprogram.TouchEvent) { const service = bookingServices.find((item) => item.id === e.currentTarget.dataset.id); if (service) { bookingStore.selectService(service); this.setData({ selectedId: service.id }) } },
  onNext() { if (!this.data.selectedId) return wx.showToast({ title: '请先选择服务', icon: 'none' }); bookingStore.update({ progressStep: Math.max(1, bookingStore.getDraft().progressStep) }); navigation.openPage('/pages/booking-time/index') },
  onBack() { navigation.back('/pages/book/index') },
})

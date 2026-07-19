import { bookingTimeSlots, createBookingDates, departments } from '../../mocks/booking'
import { hospitals } from '../../mocks/hospitals'
import { bookingStore } from '../../stores/booking'
import { navigation } from '../../utils/navigation'

Page({
  data: { hospitals, departments, dates: createBookingDates(), times: bookingTimeSlots, hospitalId: '', hospitalName: '', departmentName: '', bookingDate: '', bookingTime: '', hospitalSheet: false, valid: false },
  onShow() { const d = bookingStore.getDraft(); this.setData({ hospitalId: d.hospitalId || '', hospitalName: d.hospitalName || '', departmentName: d.departmentName || '', bookingDate: d.bookingDate || '', bookingTime: d.bookingTime || '' }); this.checkValid() },
  checkValid() { this.setData({ valid: Boolean(this.data.hospitalId && this.data.departmentName && this.data.bookingDate && this.data.bookingTime) }) },
  openHospitals() { this.setData({ hospitalSheet: true }) }, closeHospitals() { this.setData({ hospitalSheet: false }) }, stop() {},
  selectHospital(e: WechatMiniprogram.TouchEvent) { const h = hospitals.find((item) => item.id === e.currentTarget.dataset.id); if (!h) return; this.setData({ hospitalId: h.id, hospitalName: h.name, hospitalSheet: false }); bookingStore.update({ hospitalId: h.id, hospitalName: h.name }); this.checkValid() },
  selectDepartment(e: WechatMiniprogram.TouchEvent) { const value = e.currentTarget.dataset.value; this.setData({ departmentName: value }); bookingStore.update({ departmentName: value }); this.checkValid() },
  selectDate(e: WechatMiniprogram.TouchEvent) { const item = this.data.dates.find((date) => date.date === e.currentTarget.dataset.date); if (!item || item.disabled) return; this.setData({ bookingDate: item.date }); bookingStore.update({ bookingDate: item.date, bookingDateLabel: item.label }); this.checkValid() },
  selectTime(e: WechatMiniprogram.TouchEvent) { const item = bookingTimeSlots.find((time) => time.value === e.currentTarget.dataset.value); if (!item || item.disabled) return; this.setData({ bookingTime: item.value }); bookingStore.update({ bookingTime: item.value }); this.checkValid() },
  onNext() { if (!this.data.valid) return wx.showToast({ title: '请完整选择医院、科室和就诊时间', icon: 'none' }); bookingStore.update({ progressStep: Math.max(2, bookingStore.getDraft().progressStep) }); navigation.openPage('/pages/booking-companion/index') },
  onBack() { navigation.back('/pages/book/index') },
})

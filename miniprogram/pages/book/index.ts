import { bookingServices } from '../../mocks/booking'
import { hospitals } from '../../mocks/hospitals'
import { APP_ICONS } from '../../config/icon-map'
import { orderService } from '../../services/order'
import { userService } from '../../services/user'
import { bookingStore, formatMoney } from '../../stores/booking'
import { getFrequentlyUsedHospitals } from '../../utils/frequent-hospitals'
import { navigation } from '../../utils/navigation'

const bookingServiceIconMap: Record<string, string> = {
  full: APP_ICONS.fullCompanion,
  exam: APP_ICONS.examCompanion,
  medicine: APP_ICONS.medicinePickup,
  report: APP_ICONS.reportAnalysis,
}

Page({
  data: {
    hasDraft: false,
    draftSummary: '',
    services: bookingServices
      .filter((item) => item.recommended)
      .map((item) => ({
        ...item,
        iconName: bookingServiceIconMap[item.id],
        priceText: formatMoney(item.price),
      })),
    hospitals: [] as typeof hospitals,
    steps: [
      { no: '01', name: '选择服务', note: '选择适合的陪诊服务' },
      { no: '02', name: '就诊信息', note: '医院、科室与时间' },
      { no: '03', name: '陪诊员', note: '平台匹配或指定人员' },
      { no: '04', name: '确认订单', note: '核对信息并提交' },
    ],
  },
  onShow() {
    const tabBar = this.getTabBar(); if (tabBar) tabBar.setData({ selected: 1 })
    const draft = bookingStore.getDraft()
    this.setData({
      hasDraft: bookingStore.hasDraft(),
      draftSummary: [draft.serviceName, draft.hospitalName, draft.bookingDateLabel || draft.bookingDate].filter(Boolean).join(' · '),
      hospitals: userService.requireLogin()
        ? getFrequentlyUsedHospitals(orderService.listOrders(), hospitals)
        : [],
    })
  },
  onStart() { navigation.openPage(bookingStore.hasDraft() ? bookingStore.getNextRoute() : '/pages/booking-service/index') },
  onRestart() {
    wx.showModal({ title: '重新预约', content: '将清除当前已填写的预约信息，是否继续？', confirmText: '重新开始', success: ({ confirm }) => { if (confirm) { bookingStore.clear(); navigation.openPage('/pages/booking-service/index') } } })
  },
  onService(e: WechatMiniprogram.TouchEvent) {
    const service = bookingServices.find((item) => item.id === e.currentTarget.dataset.id)
    if (service) bookingStore.selectService(service)
    navigation.openPage('/pages/booking-service/index')
  },
  onHospital(e: WechatMiniprogram.TouchEvent) {
    const hospital = hospitals.find((item) => item.id === e.currentTarget.dataset.id)
    if (hospital) bookingStore.update({ hospitalId: hospital.id, hospitalName: hospital.name })
    navigation.openPage('/pages/booking-time/index')
  },
})

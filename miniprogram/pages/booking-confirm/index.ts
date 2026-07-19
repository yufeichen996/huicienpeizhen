import { specialNeedOptions } from '../../mocks/booking'
import { bookingService } from '../../services/booking'
import { patientService } from '../../services/patient'
import { clientSubscriptionService } from '../../services/subscription'
import { userService } from '../../services/user'
import { bookingStore, formatMoney } from '../../stores/booking'
import type { PatientSummary } from '../../types/patient'
import { navigation } from '../../utils/navigation'

Page({
  data: { draft: bookingStore.getDraft(), patientSheet: false, patients: [] as Array<PatientSummary & { genderText: string }>, needOptions: specialNeedOptions.map((value) => ({ value, selected: false })), remarkLength: 0, submitting: false, pendingSubmitAfterLogin: false, pendingAddAfterLogin: false, serviceFeeText: '0', companionFeeText: '0', discountText: '0', totalText: '0' },
  onShow() { this.refresh(); if (this.data.pendingAddAfterLogin && userService.requireLogin()) { this.setData({ pendingAddAfterLogin: false }); navigation.openPage('/pages/patient-edit/index?source=booking'); return } if (this.data.pendingSubmitAfterLogin && userService.requireLogin()) { this.setData({ pendingSubmitAfterLogin: false }); this.submitOrder(false) } },
  refresh() { let draft = bookingStore.getDraft(); const patients = patientService.list().map((item) => ({ ...item, genderText: item.gender === 'male' ? '男' : '女' })); if (!draft.patientId) { const patient = patientService.getDefault(); if (patient) { bookingStore.update({ patientId: patient.id, patientName: patient.name, patientPhone: patient.phoneMasked }); draft = bookingStore.getDraft() } } this.setData({ draft, patients, needOptions: specialNeedOptions.map((value) => ({ value, selected: draft.specialNeeds.includes(value) })), remarkLength: draft.remark.length, serviceFeeText: formatMoney(draft.serviceFee), companionFeeText: formatMoney(draft.companionFee), discountText: formatMoney(draft.discountAmount), totalText: formatMoney(draft.totalAmount) }) },
  modifyService() { navigation.backTo('/pages/booking-service/index','/pages/booking-service/index') }, modifyTime() { navigation.backTo('/pages/booking-time/index','/pages/booking-time/index') }, modifyCompanion() { navigation.backTo('/pages/booking-companion/index','/pages/booking-companion/index') },
  openPatients() { this.setData({ patientSheet: true }) }, closePatients() { this.setData({ patientSheet: false }) }, stop() {},
  selectPatient(e: WechatMiniprogram.TouchEvent) { const patient = this.data.patients.find((item) => item.id === e.currentTarget.dataset.id); if (!patient) return; this.savePatient(patient); this.setData({ patientSheet: false }); this.refresh() },
  savePatient(patient: PatientSummary) { bookingStore.update({ patientId: patient.id, patientName: patient.name, patientPhone: patient.phoneMasked }) },
  addPatient() { this.setData({ patientSheet: false }); if(!userService.requireLogin()){this.setData({pendingAddAfterLogin:true});navigation.openPage('/pages/login/index');return} navigation.openPage('/pages/patient-edit/index?source=booking') },
  toggleNeed(e: WechatMiniprogram.TouchEvent) { const need = e.currentTarget.dataset.value; const current = bookingStore.getDraft().specialNeeds; bookingStore.update({ specialNeeds: current.includes(need) ? current.filter((item) => item !== need) : [...current, need] }); this.refresh() },
  onRemark(e: WechatMiniprogram.Input) { bookingStore.update({ remark: e.detail.value.slice(0, 200) }); this.refresh() },
  toggleAgreement() { bookingStore.update({ agreementAccepted: !bookingStore.getDraft().agreementAccepted }); this.refresh() },
  onBack() { navigation.back('/pages/book/index') },
  onSubmit() {
    this.submitOrder(true)
  },
  async submitOrder(requestSubscription: boolean) {
    if (this.data.submitting) return
    if (!userService.requireLogin()) { this.setData({ pendingSubmitAfterLogin: true }); navigation.openPage('/pages/login/index'); return }
    const draft = bookingStore.getDraft()
    if (!draft.patientId) return wx.showToast({ title: '请选择就诊人', icon: 'none' })
    if (!draft.agreementAccepted) return wx.showToast({ title: '请先阅读并同意服务协议', icon: 'none' })
    if (!draft.serviceId || !draft.hospitalId || !draft.departmentName || !draft.bookingDate || !draft.bookingTime) return wx.showToast({ title: '预约信息不完整，请返回补充', icon: 'none' })
    this.setData({ submitting: true })
    const order = bookingService.createOrder(draft)
    bookingStore.clear()
    if (requestSubscription) {
      await clientSubscriptionService.request([
        'ORDER_PROGRESS',
        'COMPANION_MATCHED',
        'SERVICE_REMINDER',
      ])
    }
    wx.redirectTo({ url: `/pages/booking-success/index?id=${order.id}`, fail: () => this.setData({ submitting: false }) })
  },
})

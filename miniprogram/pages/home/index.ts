import { companions } from '../../mocks/companions'
import { hospitals } from '../../mocks/hospitals'
import { services as serviceEntries } from '../../mocks/services'
import { bookingServices } from '../../mocks/booking'
import { bookingStore } from '../../stores/booking'
import { navigation } from '../../utils/navigation'
import type { Companion, ServiceId } from '../../types/domain'

interface IdDetail {
  companionId?: string
  hospitalId?: string
  serviceId?: ServiceId
}

const services = serviceEntries.map((item) => ({ ...item, iconName: item.id === 'appointment' ? 'appointment' : item.id === 'companion' ? 'companion' : item.id }))

Page({
  data: {
    services,
    companions,
    hospitals,
    selectedCompanion: null as Companion | null,
    companionSheetVisible: false,
  },

  onShow() {
    this.syncTabBar(0)
    this.setTabBarHidden(this.data.companionSheetVisible)
  },

  onHide() {
    this.setTabBarHidden(false)
  },

  syncTabBar(index: number) {
    const tabBar = this.getTabBar()
    if (tabBar) tabBar.setData({ selected: index })
  },

  setTabBarHidden(hidden: boolean) {
    const tabBar = this.getTabBar()
    if (tabBar) tabBar.setData({ hidden })
  },

  onMessageTap() {
    wx.showToast({ title: '暂无新消息', icon: 'none' })
  },

  onSearchTap() {
    navigation.openPage('/pages/search/index')
  },

  onHeroBook() {
    this.openBooking('appointment')
  },

  onQuickServiceTap(event: WechatMiniprogram.TouchEvent) {
    const serviceId = event.currentTarget.dataset.serviceId as ServiceId | undefined
    if (!serviceId) return
    if (serviceId === 'companion') {
      navigation.openPage('/pages/companions/index')
      return
    }
    if (serviceId === 'medicine' || serviceId === 'report') {
      navigation.openService(serviceId)
      return
    }
    this.openBooking(serviceId)
  },

  openBooking(serviceId: ServiceId, companionId?: string) {
    bookingStore.clear()
    const bookingId = serviceId === 'medicine' ? 'medicine' : serviceId === 'report' ? 'report' : 'full'
    const service = bookingServices.find((item) => item.id === bookingId)
    if (service) bookingStore.selectService(service)
    if (companionId) {
      const companion = companions.find((item) => item.id === companionId)
      if (companion) bookingStore.update({ companionMode: 'selected', companionId: companion.id, companionName: companion.name, companionPrice: companion.priceFrom * 100 })
    }
    navigation.startBooking()
  },

  onViewAllCompanions() {
    navigation.openPage('/pages/companions/index')
  },

  onCompanionSelect(event: WechatMiniprogram.CustomEvent<IdDetail>) {
    const companionId = event.detail.companionId
    const selectedCompanion = companions.find((item) => item.id === companionId)
    if (!selectedCompanion) return
    this.setData({ selectedCompanion, companionSheetVisible: true })
    this.setTabBarHidden(true)
  },

  onCloseCompanionSheet() {
    this.setData({ companionSheetVisible: false })
    this.setTabBarHidden(false)
  },

  onViewCompanionProfile() {
    const companionId = this.data.selectedCompanion?.id
    if (!companionId) return
    this.setData({ companionSheetVisible: false })
    this.setTabBarHidden(false)
    navigation.openCompanion(companionId)
  },

  onBookCompanion() {
    const companionId = this.data.selectedCompanion?.id
    if (!companionId) return
    this.setData({ companionSheetVisible: false })
    this.setTabBarHidden(false)
    const companion = companions.find((item) => item.id === companionId)
    if (!companion) return
    bookingStore.clear()
    bookingStore.update({ companionMode: 'selected', companionId: companion.id, companionName: companion.name, companionPrice: companion.priceFrom * 100 })
    navigation.startBooking()
  },

  onHospitalSelect(event: WechatMiniprogram.CustomEvent<IdDetail>) {
    const hospitalId = event.detail.hospitalId
    if (!hospitalId) return
    navigation.openHospital(hospitalId)
  },
})

import { bookingStore } from './stores/booking'
import { orderStore } from './stores/order'
import { userStore } from './stores/user'
import { patientStore } from './stores/patient'
import { profileDataStore } from './stores/profile'

App<IAppOption>({
  globalData: {
    windowInfo: undefined,
    capsuleRect: undefined,
  },

  onLaunch() {
    const windowInfo = wx.getWindowInfo()
    const capsuleRect = wx.getMenuButtonBoundingClientRect()
    this.globalData.windowInfo = windowInfo
    this.globalData.capsuleRect = capsuleRect
    bookingStore.hydrate()
    orderStore.hydrate()
    userStore.hydrate()
    patientStore.hydrate()
    profileDataStore.hydrate()
  },
})

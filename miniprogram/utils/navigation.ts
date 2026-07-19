const TAB_ROUTES = new Set(['/pages/home/index', '/pages/book/index', '/pages/orders/index', '/pages/profile/index'])
let lockedUntil = 0

const validId = (id?: string) => Boolean(id && id.trim() && id.length <= 100)
const encode = (value: string) => encodeURIComponent(value)

export const navigation = {
  openPage(url: string) {
    if (!url.startsWith('/') || TAB_ROUTES.has(url) || Date.now() < lockedUntil) return false
    lockedUntil = Date.now() + 500
    wx.navigateTo({ url, complete: () => { lockedUntil = 0 } })
    return true
  },
  openTab(url: string) {
    if (!TAB_ROUTES.has(url)) return false
    wx.switchTab({ url })
    return true
  },
  openService(id?: string) { return validId(id) ? this.openPage(`/pages/service-detail/index?id=${encode(id!)}`) : false },
  openCompanion(id?: string) { return validId(id) ? this.openPage(`/pages/companion-detail/index?id=${encode(id!)}`) : false },
  openHospital(id?: string, department?: string) { return validId(id) ? this.openPage(`/pages/hospital-detail/index?id=${encode(id!)}${department ? `&department=${encode(department)}` : ''}`) : false },
  openOrder(id?: string) { return validId(id) ? this.openPage(`/pages/order-detail/index?id=${encode(id!)}`) : false },
  openOrderAfterReset(id?: string) {
    if (!validId(id)) return false
    wx.switchTab({ url: '/pages/orders/index', success: () => this.openOrder(id) })
    return true
  },
  startBooking() { return this.openTab('/pages/book/index') },
  backTo(route: string, fallback: string) {
    const pages = getCurrentPages()
    const index = pages.map((page) => `/${page.route}`).lastIndexOf(route)
    if (index >= 0 && index < pages.length - 1) { wx.navigateBack({ delta: pages.length - 1 - index }); return true }
    return this.openPage(fallback)
  },
  back(fallbackTab = '/pages/home/index') {
    const pages = getCurrentPages()
    if (pages.length > 1) wx.navigateBack()
    else this.openTab(fallbackTab)
  },
}

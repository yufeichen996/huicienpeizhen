import { navigation } from '../../utils/navigation'

Component({
  properties: {
    eyebrow: { type: String, value: '汇慈恩陪诊' },
    title: { type: String, value: '' },
    showMessage: { type: Boolean, value: false },
    showBack: { type: Boolean, value: true },
  },
  data: {
    top: 0,
    height: 44,
    totalHeight: 44,
    capsuleRight: 24,
    titleInset: 56,
    backLeft: 8,
    canGoBack: false,
  },
  lifetimes: {
    attached() {
      const windowInfo = wx.getWindowInfo()
      const capsule = wx.getMenuButtonBoundingClientRect()
      const top = windowInfo.statusBarHeight || 0
      const hasValidCapsule = capsule.width > 0 && capsule.height > 0 && capsule.left > 0
      const navHeight = hasValidCapsule
        ? Math.max(44, capsule.bottom + capsule.top - top * 2)
        : 44
      const capsuleRight = hasValidCapsule
        ? Math.max(12, windowInfo.windowWidth - capsule.left + 8)
        : 16
      const titleInset = Math.max(56, capsuleRight)
      const canGoBack = this.data.showBack && getCurrentPages().length > 1
      this.setData({
        top,
        height: navHeight,
        totalHeight: top + navHeight,
        capsuleRight,
        titleInset,
        backLeft: 8,
        canGoBack,
      }, () => {
        if (!canGoBack) return
        this.createSelectorQuery()
          .select('.back-button')
          .boundingClientRect((rect) => {
            if (!rect || Math.abs(rect.left - 8) < 1) return
            this.setData({ backLeft: this.data.backLeft - (rect.left - 8) })
          })
          .exec()
      })
    },
  },
  methods: {
    onMessage() {
      this.triggerEvent('message')
    },
    goBack() {
      navigation.back()
    },
  },
})

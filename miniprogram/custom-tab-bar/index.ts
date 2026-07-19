const tabs = [
  { pagePath: '/pages/home/index', text: '首页', icon: 'home' },
  { pagePath: '/pages/book/index', text: '预约', icon: 'booking' },
  { pagePath: '/pages/orders/index', text: '订单', icon: 'orders' },
  { pagePath: '/pages/profile/index', text: '我的', icon: 'profile' },
]

Component({
  data: {
    selected: 0,
    hidden: false,
    tabs,
  },

  methods: {
    onSwitch(event: WechatMiniprogram.TouchEvent) {
      const index = Number(event.currentTarget.dataset.index)
      const tab = tabs[index]
      if (!tab || index === this.data.selected) return
      navigation.openTab(tab.pagePath)
    },
  },
})
import { navigation } from '../utils/navigation'

import { bookingServices } from '../../mocks/booking'
import { userService } from '../../services/user'
import { profileDataStore } from '../../stores/profile'
import { bookingStore, formatMoney } from '../../stores/booking'
import type { CouponStatus } from '../../types/profile'
import { navigation } from '../../utils/navigation'
Page({
  data:{tabs:[{id:'available',text:'可使用'},{id:'used',text:'已使用'},{id:'expired',text:'已过期'}],active:'available' as CouponStatus,coupons:[] as Array<Record<string,unknown>>,loginRequested:false},
  onShow(){if(!userService.requireLogin()){if(!this.data.loginRequested){this.setData({loginRequested:true});navigation.openPage('/pages/login/index')}return}this.setData({loginRequested:false});this.load()},
  load(){this.setData({coupons:profileDataStore.listCoupons().filter(i=>i.status===this.data.active).map(i=>({...i,amountText:formatMoney(i.amount),thresholdText:formatMoney(i.threshold),statusText:i.status==='available'?'可使用':i.status==='used'?'已使用':'已过期'}))})},
  tab(e:WechatMiniprogram.TouchEvent){this.setData({active:e.currentTarget.dataset.id});this.load()},
  use(e:WechatMiniprogram.TouchEvent){const coupon=profileDataStore.listCoupons().find(i=>i.id===e.currentTarget.dataset.id);if(!coupon||coupon.status!=='available')return;bookingStore.clear();const service=bookingServices.find(i=>i.id===coupon.serviceId);if(service)bookingStore.selectService(service);bookingStore.update({couponId:coupon.id});navigation.startBooking()},
})

import { favoriteService } from '../../services/favorite'
import { hospitalService } from '../../services/hospital'
import { serviceService } from '../../services/service'
import { bookingStore,formatMoney } from '../../stores/booking'
import { navigation } from '../../utils/navigation'
const defined=<T>(value:T|undefined):value is T=>Boolean(value)
Page({
  data:{id:'',service:null as ReturnType<typeof serviceService.getById>|null,hospitals:[] as Array<Record<string,unknown>>,priceText:'',favorited:false,loginVisible:false,pendingFavorite:false,missing:false},
  onLoad(query:Record<string,string|undefined>){this.setData({id:query.id||''});this.load()},onShow(){if(this.data.id)this.load()},
  load(){const service=serviceService.getById(this.data.id);if(!service){this.setData({missing:true});return}this.setData({service,priceText:formatMoney(service.price),hospitals:service.supportedHospitalIds.map(id=>hospitalService.getById(id)).filter(defined).slice(0,6),favorited:favoriteService.isFavorite('service',service.id),missing:false})},
  favorite(){const service=this.data.service;if(!service)return;const result=favoriteService.toggle({id:`service-${service.id}`,targetId:service.id,type:'service',title:service.name,subtitle:service.shortDescription,createdAt:new Date().toISOString()});if(result.loginRequired){this.setData({loginVisible:true,pendingFavorite:true});return}this.setData({favorited:result.favorited})},
  loginSuccess(){const pending=this.data.pendingFavorite;this.setData({loginVisible:false,pendingFavorite:false});if(pending)this.favorite()},closeLogin(){this.setData({loginVisible:false,pendingFavorite:false})},
  hospital(e:WechatMiniprogram.TouchEvent){navigation.openHospital(e.currentTarget.dataset.id)},customer(){navigation.openPage('/pages/customer-service/index')},
  book(){const item=serviceService.getBookingOption(this.data.id as never);if(!item)return;bookingStore.clear();bookingStore.selectService(item);navigation.startBooking()},
})

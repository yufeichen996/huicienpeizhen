import { companionService } from '../../services/companion'
import { favoriteService } from '../../services/favorite'
import { hospitalService } from '../../services/hospital'
import { serviceService } from '../../services/service'
import { bookingStore,formatMoney } from '../../stores/booking'
import { navigation } from '../../utils/navigation'
const defined=<T>(value:T|undefined):value is T=>Boolean(value)
Page({
  data:{id:'',companion:null as ReturnType<typeof companionService.getById>|null,services:[] as Array<Record<string,unknown>>,hospitals:[] as Array<Record<string,unknown>>,reviews:[] as Array<Record<string,unknown>>,priceText:'',favorited:false,loginVisible:false,pendingFavorite:false,missing:false},
  onLoad(query:Record<string,string|undefined>){this.setData({id:query.id||''});this.load()},onShow(){if(this.data.id)this.load()},
  load(){const item=companionService.getById(this.data.id);if(!item){this.setData({missing:true});return}this.setData({companion:item,priceText:formatMoney(item.price),services:item.skillServiceIds.map(id=>serviceService.getById(id)).filter(defined).map(i=>({...i,priceText:formatMoney(i.price)})),hospitals:item.serviceHospitalIds.map(id=>hospitalService.getById(id)).filter(defined),reviews:companionService.reviews(item.id).map(i=>({...i,tagsText:i.tags.join(' · ')})),favorited:favoriteService.isFavorite('companion',item.id),missing:false})},
  favorite(){const item=this.data.companion;if(!item)return;const result=favoriteService.toggle({id:`companion-${item.id}`,targetId:item.id,type:'companion',title:item.name,subtitle:item.tags.join(' · '),image:item.avatar,createdAt:new Date().toISOString()});if(result.loginRequired){this.setData({loginVisible:true,pendingFavorite:true});return}this.setData({favorited:result.favorited})},
  loginSuccess(){const pending=this.data.pendingFavorite;this.setData({loginVisible:false,pendingFavorite:false});if(pending)this.favorite()},closeLogin(){this.setData({loginVisible:false,pendingFavorite:false})},
  service(e:WechatMiniprogram.TouchEvent){navigation.openService(e.currentTarget.dataset.id)},hospital(e:WechatMiniprogram.TouchEvent){navigation.openHospital(e.currentTarget.dataset.id)},customer(){navigation.openPage('/pages/customer-service/index')},
  book(){const item=this.data.companion;if(!item)return;bookingStore.clear();bookingStore.update({companionMode:'selected',companionId:item.id,companionName:item.name,companionPrice:item.price});navigation.startBooking()},
})

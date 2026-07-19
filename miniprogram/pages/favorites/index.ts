import { userService } from '../../services/user'
import { profileDataStore } from '../../stores/profile'
import type { FavoriteType } from '../../types/profile'
import { navigation } from '../../utils/navigation'
Page({
  data:{tabs:[{id:'companion',text:'陪诊员'},{id:'hospital',text:'医院'},{id:'service',text:'服务'}],active:'companion' as FavoriteType,items:[] as Array<Record<string,unknown>>,loginRequested:false},
  onShow(){if(!userService.requireLogin()){if(!this.data.loginRequested){this.setData({loginRequested:true});navigation.openPage('/pages/login/index')}return}this.setData({loginRequested:false});this.load()},
  load(){this.setData({items:profileDataStore.listFavorites(this.data.active)})},
  tab(e:WechatMiniprogram.TouchEvent){this.setData({active:e.currentTarget.dataset.id});this.load()},
  remove(e:WechatMiniprogram.TouchEvent){const item=profileDataStore.listFavorites().find(i=>i.id===e.currentTarget.dataset.id);if(item){profileDataStore.toggleFavorite(item);this.load();wx.showToast({title:'已取消收藏',icon:'success'})}},
  open(e:WechatMiniprogram.TouchEvent){const item=profileDataStore.listFavorites().find(i=>i.id===e.currentTarget.dataset.id);if(!item)return;if(item.type==='companion')navigation.openCompanion(item.targetId);if(item.type==='hospital')navigation.openHospital(item.targetId);if(item.type==='service')navigation.openService(item.targetId)},toHome(){navigation.openTab('/pages/home/index')},
})

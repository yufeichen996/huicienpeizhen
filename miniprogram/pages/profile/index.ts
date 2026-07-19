import { orderService } from '../../services/order'
import { userService } from '../../services/user'
import { patientService } from '../../services/patient'
import { profileDataStore } from '../../stores/profile'
import { storage } from '../../utils/storage'
import { StorageKeys } from '../../utils/storage-keys'

Page({
  data:{user:userService.getCurrentUser(),loggedIn:false,loginVisible:false,patientCount:0,favoriteCount:0,couponCount:0,orderShortcuts:[] as Array<{filter:string;icon:string;title:string;count:number}>},
  onShow(){const tabBar=this.getTabBar();if(tabBar)tabBar.setData({selected:3,hidden:this.data.loginVisible});this.refresh()},
  onHide(){this.setTabBarHidden(false)},
  setTabBarHidden(hidden:boolean){const tabBar=this.getTabBar();if(tabBar)tabBar.setData({hidden})},
  refresh(){const user=userService.getCurrentUser();const orders=user.isLoggedIn?orderService.listOrders():[];this.setData({user,loggedIn:user.isLoggedIn,patientCount:user.isLoggedIn?patientService.list().length:0,favoriteCount:user.isLoggedIn?profileDataStore.listFavorites().length:0,couponCount:user.isLoggedIn?profileDataStore.listCoupons().filter(i=>i.status==='available').length:0,orderShortcuts:[{filter:'PAYMENT',icon:'payment',title:'待付款',count:orders.filter(i=>i.status==='PENDING_PAYMENT').length},{filter:'SERVICE',icon:'service',title:'待服务',count:orders.filter(i=>['PENDING_ASSIGNMENT','PENDING_SERVICE'].includes(i.status)).length},{filter:'ACTIVE',icon:'clock',title:'进行中',count:orders.filter(i=>i.status==='IN_SERVICE').length},{filter:'REVIEW',icon:'rating',title:'待评价',count:orders.filter(i=>i.status==='PENDING_REVIEW').length}]})},
  openLogin(){this.setTabBarHidden(true);this.setData({loginVisible:true})},closeLogin(){this.setTabBarHidden(false);this.setData({loginVisible:false})},loginSuccess(){this.setTabBarHidden(false);this.setData({loginVisible:false});this.refresh()},
  requireRoute(url:string){if(!userService.requireLogin()){this.openLogin();return}wx.navigateTo({url})},edit(){this.requireRoute('/pages/profile-edit/index')},
  orderSelect(e:WechatMiniprogram.CustomEvent<{filter:string}>){if(!userService.requireLogin()){this.openLogin();return}storage.set(StorageKeys.requestedOrderFilter,e.detail.filter);wx.switchTab({url:'/pages/orders/index'})},
  patients(){this.requireRoute('/pages/patients/index')},favorites(){this.requireRoute('/pages/favorites/index')},coupons(){this.requireRoute('/pages/coupons/index')},addresses(){wx.navigateTo({url:'/pages/addresses/index'})},customer(){wx.navigateTo({url:'/pages/customer-service/index'})},notifications(){this.requireRoute('/pages/notification-settings/index')},feedback(){wx.navigateTo({url:'/pages/feedback/index'})},agreement(){wx.navigateTo({url:'/pages/agreement/index?type=service'})},privacy(){wx.navigateTo({url:'/pages/privacy/index'})},security(){this.requireRoute('/pages/account-security/index')},about(){wx.navigateTo({url:'/pages/about/index'})},
  logout(){wx.showModal({title:'退出登录',content:'确定退出当前账号吗？本地订单和预约历史将会保留。',confirmColor:'#FF3B30',success:({confirm})=>{if(confirm){userService.logout();this.refresh();wx.showToast({title:'已退出登录',icon:'success'})}}})},
})

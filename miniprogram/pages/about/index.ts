import { APP_VERSION } from '../../mocks/user'
Page({data:{version:APP_VERSION},check(){wx.showToast({title:'当前已是最新开发版本',icon:'none'})},contact(){wx.navigateTo({url:'/pages/customer-service/index'})}})

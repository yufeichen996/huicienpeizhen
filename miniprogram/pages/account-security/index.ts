import { userService } from '../../services/user'
Page({data:{user:userService.getCurrentUser()},prototype(e:WechatMiniprogram.TouchEvent){wx.showToast({title:e.currentTarget.dataset.message,icon:'none'})},privacy(){wx.navigateTo({url:'/pages/privacy/index'})},deactivate(){wx.showModal({title:'注销账号',content:'账号注销功能将在正式上线后按平台规则提供，当前不会删除任何本地数据。',showCancel:false})}})

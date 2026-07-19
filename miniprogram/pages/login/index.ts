import { navigation } from '../../utils/navigation'
Page({data:{visible:true},close(){navigation.back()},success(){this.setData({visible:false});setTimeout(()=>navigation.back(),300)}})

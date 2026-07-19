import { searchService } from '../../services/search'
import { hospitalService } from '../../services/hospital'
import { serviceService } from '../../services/service'
import { formatMoney } from '../../stores/booking'
import type { SearchResult } from '../../types/search'
import { navigation } from '../../utils/navigation'
let timer:ReturnType<typeof setTimeout>|undefined
const empty:SearchResult={services:[],hospitals:[],departments:[],companions:[],total:0}
Page({
  data:{query:'',history:[] as string[],hot:searchService.hotKeywords,hotHospitals:hospitalService.list({popularOnly:true}).slice(0,4),hotServices:serviceService.list().slice(0,4).map(i=>({...i,priceText:formatMoney(i.price)})),result:empty,preview:empty,loading:false,error:false,searched:false},
  onShow(){this.setData({history:searchService.history()})},
  input(e:WechatMiniprogram.CustomEvent<{value:string}>){const query=e.detail.value;this.setData({query});if(timer)clearTimeout(timer);if(!query.trim()){this.setData({searched:false,result:empty,preview:empty,loading:false});return}this.setData({loading:true});timer=setTimeout(()=>this.run(query,false),300)},
  confirm(e?:WechatMiniprogram.CustomEvent<{value:string}>){this.run(e?.detail?.value||this.data.query,true)},retry(){this.run(this.data.query,true)},
  run(raw:string,save=true){const query=raw.trim();if(!query)return;try{const result=searchService.search(query);const preview={services:result.services.slice(0,3),hospitals:result.hospitals.slice(0,3),departments:result.departments.slice(0,3),companions:result.companions.slice(0,3),total:result.total};if(save)searchService.saveHistory(query);this.setData({query,result,preview,loading:false,error:false,searched:true,history:searchService.history()})}catch{this.setData({loading:false,error:true,searched:true})}},
  clear(){if(timer)clearTimeout(timer);this.setData({query:'',searched:false,result:empty,preview:empty,loading:false,error:false})},
  selectWord(e:WechatMiniprogram.CustomEvent<{value:string}>|WechatMiniprogram.TouchEvent){const value=(e as WechatMiniprogram.CustomEvent<{value:string}>).detail?.value||(e as WechatMiniprogram.TouchEvent).currentTarget.dataset.value;this.setData({query:value});this.run(value,true)},
  removeHistory(e:WechatMiniprogram.CustomEvent<{value:string}>){searchService.removeHistory(e.detail.value);this.setData({history:searchService.history()})},
  clearHistory(){wx.showModal({title:'清空搜索历史',content:'确定清空全部搜索记录吗？',success:({confirm})=>{if(confirm){searchService.clearHistory();this.setData({history:[]})}}})},
  open(e:WechatMiniprogram.TouchEvent){const {type,id,hospitalId,name}=e.currentTarget.dataset;if(type==='service')navigation.openService(id);if(type==='hospital')navigation.openHospital(id);if(type==='companion')navigation.openCompanion(id);if(type==='department')navigation.openHospital(hospitalId,name)},
  all(e:WechatMiniprogram.TouchEvent){const type=e.currentTarget.dataset.type;if(!this.data.query&&type==='services'){navigation.openPage('/pages/services/index');return}if(!this.data.query&&type==='hospitals'){navigation.openPage('/pages/hospitals/index');return}navigation.openPage(`/pages/search-result/index?type=${type}&query=${encodeURIComponent(this.data.query)}`)},
})

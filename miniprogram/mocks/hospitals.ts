import type { Hospital } from '../types/hospital'
const serviceIds=['full','exam','medicine','report','delivery','inpatient']
const groups=[{name:'内科',departments:['心内科','消化内科','神经内科']},{name:'外科',departments:['普外科','骨科','神经外科']},{name:'其他',departments:['儿科','妇科','眼科','检查中心']}]
const create=(data:Partial<Hospital>&Pick<Hospital,'id'|'name'|'shortName'|'icon'|'district'|'address'>):Hospital=>({level:'三级甲等',city:'上海市',introduction:`${data.name}是上海常见就诊医院之一。本页面仅用于说明陪诊服务地点，平台与医院不存在隶属关系。`,tags:['三甲医院','综合服务'],departmentGroups:groups,supportedServiceIds:serviceIds,isPopular:true,isPartner:false,...data})
export const hospitals:Hospital[]=[
create({id:'ruijin',name:'上海瑞金医院',shortName:'瑞金医院',icon:'瑞',district:'黄浦区',address:'瑞金二路197号'}),
create({id:'huashan',name:'华山医院',shortName:'华山医院',icon:'华',district:'静安区',address:'乌鲁木齐中路12号'}),
create({id:'renji',name:'仁济医院',shortName:'仁济医院',icon:'仁',district:'浦东新区',address:'浦建路160号'}),
create({id:'zhongshan',name:'中山医院',shortName:'中山医院',icon:'中',district:'徐汇区',address:'枫林路180号'}),
create({id:'children-medical-center',name:'上海儿童医学中心',shortName:'儿童医学中心',icon:'儿',district:'浦东新区',address:'东方路1678号',tags:['三级甲等','儿童专科'],departmentGroups:[{name:'儿童专科',departments:['儿内科','儿外科','儿童保健科']},{name:'检查',departments:['影像科','检查中心']}]}),
create({id:'changhai',name:'长海医院',shortName:'长海医院',icon:'长',district:'杨浦区',address:'长海路168号'}),
create({id:'xinhua',name:'新华医院',shortName:'新华医院',icon:'新',district:'杨浦区',address:'控江路1665号'}),
create({id:'tongji',name:'同济医院',shortName:'同济医院',icon:'同',district:'普陀区',address:'新村路389号'}),
]

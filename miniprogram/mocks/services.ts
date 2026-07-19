import type { ServiceItem } from '../types/domain'

export const services: ServiceItem[] = [
  {
    id: 'appointment',
    name: '立即预约',
    icon: '🏥',
    color: 'blue',
    description: '选择服务、时间与陪诊员',
    implemented: true,
  },
  {
    id: 'companion',
    name: '找陪诊师',
    icon: '👩‍⚕️',
    color: 'purple',
    description: '查看专业陪诊师',
    implemented: false,
  },
  {
    id: 'medicine',
    name: '代取药物',
    icon: '💊',
    color: 'green',
    description: '预选代取药物服务',
    implemented: false,
  },
  {
    id: 'report',
    name: '报告解读',
    icon: '📋',
    color: 'orange',
    description: '预选报告解读服务',
    implemented: false,
  },
]

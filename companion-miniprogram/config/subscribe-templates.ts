import type { CompanionSubscriptionTemplate } from '../types/subscription'

/**
 * 在陪诊师端对应的小程序后台选用模板后填写真实模板 ID。
 * 请以微信公众平台当前类目可用的模板标题和关键词为准。
 */
export const COMPANION_SUBSCRIPTION_TEMPLATES: CompanionSubscriptionTemplate[] = [
  {
    key: 'NEW_TASK',
    templateId: '',
    title: '新任务通知',
    description: '平台派发新任务或抢单大厅出现重要任务时提醒',
  },
  {
    key: 'TASK_UPDATE',
    templateId: '',
    title: '任务状态通知',
    description: '任务变更、取消及平台处理结果提醒',
  },
  {
    key: 'SERVICE_REMINDER',
    templateId: '',
    title: '服务时间提醒',
    description: '出发、到院和服务开始前的关键时间提醒',
  },
]

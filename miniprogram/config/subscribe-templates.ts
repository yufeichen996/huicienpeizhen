import type { ClientSubscriptionTemplate } from '../types/subscription'

/**
 * 在微信公众平台「功能 - 订阅消息」选用正式模板后填写模板 ID。
 * 模板标题和字段必须以当前小程序所属类目下的实际模板为准。
 */
export const CLIENT_SUBSCRIPTION_TEMPLATES: ClientSubscriptionTemplate[] = [
  {
    key: 'ORDER_PROGRESS',
    templateId: '',
    title: '订单状态通知',
    description: '预约提交、支付结果及订单状态发生变化时提醒',
  },
  {
    key: 'COMPANION_MATCHED',
    templateId: '',
    title: '陪诊师匹配通知',
    description: '陪诊师确认或平台匹配成功后提醒',
  },
  {
    key: 'SERVICE_REMINDER',
    templateId: '',
    title: '服务时间提醒',
    description: '服务开始前及关键服务节点提醒',
  },
]

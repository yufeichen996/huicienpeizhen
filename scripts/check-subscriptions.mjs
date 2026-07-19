import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import {
  createWechatSubscribeSender,
  getSubscriptionTemplateConfig,
} from '../server/wechat-subscribe.mjs'

const read = (path) => readFile(path, 'utf8')

const [
  clientApp,
  companionApp,
  clientService,
  companionService,
  bookingConfirm,
  orderDetail,
  companionLogin,
  companionWorkbench,
  companionOrderHall,
  companionTaskDetail,
  clientProfile,
  companionProfile,
] = await Promise.all([
  read('miniprogram/app.json'),
  read('companion-miniprogram/app.json'),
  read('miniprogram/services/subscription.ts'),
  read('companion-miniprogram/services/subscription.ts'),
  read('miniprogram/pages/booking-confirm/index.ts'),
  read('miniprogram/pages/order-detail/index.ts'),
  read('companion-miniprogram/pages/login/index.ts'),
  read('companion-miniprogram/pages/workbench/index.ts'),
  read('companion-miniprogram/pages/order-hall/index.ts'),
  read('companion-miniprogram/pages/task-detail/index.ts'),
  read('miniprogram/pages/profile/index.wxml'),
  read('companion-miniprogram/pages/profile/index.wxml'),
])

assert.equal(JSON.parse(clientApp).pages.includes('pages/notification-settings/index'), true)
assert.equal(JSON.parse(companionApp).pages.includes('pages/notification-settings/index'), true)
for (const source of [clientService, companionService]) {
  assert.match(source, /wx\.requestSubscribeMessage/)
  assert.match(source, /slice\(0,\s*5\)/)
  assert.match(source, /拒绝不会影响/)
}
assert.match(bookingConfirm, /clientSubscriptionService\.request/)
assert.match(orderDetail, /clientSubscriptionService\.request/)
assert.match(companionLogin, /companionSubscriptionService\.request/)
assert.match(companionWorkbench, /companionSubscriptionService\.request/)
assert.match(companionOrderHall, /companionSubscriptionService\.request/)
assert.match(companionTaskDetail, /companionSubscriptionService\.request/)
assert.match(clientProfile, /pages\/notification-settings|bindtap="notifications"/)
assert.match(companionProfile, /data-action="notifications"/)

const environment = {
  WECHAT_TEMPLATE_CLIENT_ORDER_PROGRESS: 'client-order-template',
  WECHAT_TEMPLATE_COMPANION_NEW_TASK: 'companion-task-template',
}
const templates = getSubscriptionTemplateConfig(environment)
assert.equal(templates.CLIENT_ORDER_PROGRESS, 'client-order-template')
assert.equal(templates.COMPANION_NEW_TASK, 'companion-task-template')

let sentRequest
const sender = createWechatSubscribeSender({
  environment,
  accessTokenProvider: async () => 'test-token',
  fetchImpl: async (url, options) => {
    sentRequest = { url, options }
    return {
      ok: true,
      status: 200,
      json: async () => ({ errcode: 0, errmsg: 'ok', msgid: 'mock-msg-id' }),
    }
  },
})
const result = await sender.send({
  recipientOpenId: 'openid-test',
  templateKey: 'CLIENT_ORDER_PROGRESS',
  page: '/pages/order-detail/index?id=order-test',
  data: { thing1: { value: '订单状态已更新' } },
  miniprogramState: 'trial',
})
assert.equal(result.msgid, 'mock-msg-id')
assert.match(sentRequest.url, /access_token=test-token/)
const body = JSON.parse(sentRequest.options.body)
assert.equal(body.template_id, 'client-order-template')
assert.equal(body.page, 'pages/order-detail/index?id=order-test')
assert.equal(body.touser, 'openid-test')

await assert.rejects(
  sender.send({
    recipientOpenId: 'openid-test',
    templateKey: 'CLIENT_SERVICE_REMINDER',
    page: 'pages/order-detail/index',
    data: {},
  }),
  (error) => error.code === 'SUBSCRIBE_TEMPLATE_NOT_CONFIGURED',
)

console.log('Validated client and companion subscription prompts, settings routes, business triggers and WeChat server sender contract.')

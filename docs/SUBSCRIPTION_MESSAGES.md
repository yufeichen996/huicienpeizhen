# 汇慈恩陪诊订阅消息接入说明

## 当前实现

客户端与陪诊师端均已接入统一的订阅消息交互：

- 没有填写微信模板 ID 时，Mock 环境使用明确标注的模拟授权弹窗。
- 填写真实模板 ID 后，自动调用微信原生 `wx.requestSubscribeMessage`。
- 用户拒绝、关闭弹窗或接口失败，不会阻断预约、支付、登录、派单接受或抢单。
- 授权结果只记录必要的模板状态、来源和更新时间，不保存医疗资料。
- 两端“我的”页面均提供“消息通知”设置入口，也可以进入微信权限设置。

客户端触发点：

- 提交预约后。
- 模拟支付成功后。
- 预约成功页手动再次授权。

陪诊师端触发点：

- 已审核陪诊师登录后。
- 接受平台派单后。
- 抢单成功后。

## 微信公众平台配置

需要分别在客户端小程序和陪诊师端小程序的微信公众平台中，根据各自类目选用实际可用模板。

客户端模板配置文件：

```text
miniprogram/config/subscribe-templates.ts
```

陪诊师端模板配置文件：

```text
companion-miniprogram/config/subscribe-templates.ts
```

模板标题、关键词和字段必须以微信公众平台当前可选模板为准，不应把本地展示名称直接当作已审核模板标题。

## 服务端发送

服务端发送适配器：

```text
server/wechat-subscribe.mjs
```

需要在部署环境配置：

```text
WECHAT_TEMPLATE_CLIENT_ORDER_PROGRESS
WECHAT_TEMPLATE_CLIENT_COMPANION_MATCHED
WECHAT_TEMPLATE_CLIENT_SERVICE_REMINDER
WECHAT_TEMPLATE_COMPANION_NEW_TASK
WECHAT_TEMPLATE_COMPANION_TASK_UPDATE
WECHAT_TEMPLATE_COMPANION_SERVICE_REMINDER
```

适配器要求业务层提供：

- 用户真实 `openid`。
- 有效的微信 `access_token` 提供器。
- 与微信模板关键词完全匹配的数据。
- 小程序内部 `pages/...` 跳转路径。

当前项目尚未接入真实微信登录，因此没有真实 `openid` 和 `access_token`。在接入微信登录前，服务端发送适配器只用于契约校验与自动化测试，不会向微信发送真实消息。

## 推荐事件映射

客户端：

- 预约提交、支付成功、订单取消：`CLIENT_ORDER_PROGRESS`
- 陪诊师确认或平台匹配成功：`CLIENT_COMPANION_MATCHED`
- 服务前提醒、关键节点提醒：`CLIENT_SERVICE_REMINDER`

陪诊师端：

- 平台派发新任务：`COMPANION_NEW_TASK`
- 任务取消、变更、异常处理结果：`COMPANION_TASK_UPDATE`
- 出发或服务开始前提醒：`COMPANION_SERVICE_REMINDER`

通知正文只应显示必要状态和时间，不直接发送患者姓名、手机号、具体病情、报告内容等敏感信息。详细资料必须登录小程序后在订单或任务详情中查看。

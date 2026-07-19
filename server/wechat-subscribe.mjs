const SEND_ENDPOINT = 'https://api.weixin.qq.com/cgi-bin/message/subscribe/send'

export const SUBSCRIPTION_TEMPLATE_ENV = Object.freeze({
  CLIENT_ORDER_PROGRESS: 'WECHAT_TEMPLATE_CLIENT_ORDER_PROGRESS',
  CLIENT_COMPANION_MATCHED: 'WECHAT_TEMPLATE_CLIENT_COMPANION_MATCHED',
  CLIENT_SERVICE_REMINDER: 'WECHAT_TEMPLATE_CLIENT_SERVICE_REMINDER',
  COMPANION_NEW_TASK: 'WECHAT_TEMPLATE_COMPANION_NEW_TASK',
  COMPANION_TASK_UPDATE: 'WECHAT_TEMPLATE_COMPANION_TASK_UPDATE',
  COMPANION_SERVICE_REMINDER: 'WECHAT_TEMPLATE_COMPANION_SERVICE_REMINDER',
})

export const getSubscriptionTemplateConfig = (environment = process.env) =>
  Object.fromEntries(
    Object.entries(SUBSCRIPTION_TEMPLATE_ENV).map(([key, variable]) => [
      key,
      String(environment[variable] || '').trim(),
    ]),
  )

const createError = (code, message, details) => {
  const error = new Error(message)
  error.code = code
  error.details = details
  return error
}

const normalizePage = (page) => String(page || '').replace(/^\//, '')

const validatePayload = ({ recipientOpenId, templateKey, page, data }, templates) => {
  if (!recipientOpenId?.trim()) {
    throw createError('SUBSCRIBE_OPENID_REQUIRED', '订阅消息缺少接收用户 openid')
  }
  const templateId = templates[templateKey]
  if (!templateId) {
    throw createError(
      'SUBSCRIBE_TEMPLATE_NOT_CONFIGURED',
      `订阅模板尚未配置：${templateKey}`,
    )
  }
  const normalizedPage = normalizePage(page)
  if (!/^pages\/[A-Za-z0-9_/-]+(?:\?[^#]*)?$/.test(normalizedPage)) {
    throw createError('SUBSCRIBE_PAGE_INVALID', '订阅消息跳转页面必须是小程序 pages 路径')
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw createError('SUBSCRIBE_DATA_INVALID', '订阅消息模板数据格式不正确')
  }
  return { templateId, normalizedPage }
}

export const createWechatSubscribeSender = ({
  accessTokenProvider,
  fetchImpl = fetch,
  environment = process.env,
} = {}) => ({
  async send({
    recipientOpenId,
    templateKey,
    page,
    data,
    miniprogramState = 'formal',
    language = 'zh_CN',
  }) {
    if (typeof accessTokenProvider !== 'function') {
      throw createError('SUBSCRIBE_TOKEN_PROVIDER_REQUIRED', '未配置微信 access_token 提供器')
    }
    const templates = getSubscriptionTemplateConfig(environment)
    const { templateId, normalizedPage } = validatePayload(
      { recipientOpenId, templateKey, page, data },
      templates,
    )
    const accessToken = await accessTokenProvider()
    if (!accessToken) {
      throw createError('SUBSCRIBE_ACCESS_TOKEN_MISSING', '未获取到微信 access_token')
    }
    const response = await fetchImpl(`${SEND_ENDPOINT}?access_token=${encodeURIComponent(accessToken)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        touser: recipientOpenId,
        template_id: templateId,
        page: normalizedPage,
        miniprogram_state: miniprogramState,
        lang: language,
        data,
      }),
    })
    const result = await response.json()
    if (!response.ok || result.errcode) {
      throw createError(
        'SUBSCRIBE_SEND_FAILED',
        result.errmsg || `微信订阅消息发送失败（HTTP ${response.status}）`,
        result,
      )
    }
    return result
  },
})

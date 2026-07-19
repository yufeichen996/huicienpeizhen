import { env } from '../config/env'
import { RequestError, type ApiResponse } from '../types/request'

type RequestOptions<T> = Omit<WechatMiniprogram.RequestOption<ApiResponse<T>>, 'url' | 'success' | 'fail'> & { url: string; token?: string }

export const request = <T>(options: RequestOptions<T>) => new Promise<T>((resolve, reject) => {
  if (!env.apiBaseUrl) return reject(new RequestError('当前未配置正式接口地址'))
  wx.request<ApiResponse<T>>({
    ...options,
    url: `${env.apiBaseUrl}${options.url}`,
    timeout: env.requestTimeout,
    header: { ...options.header, ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}), 'X-Request-Id': `${Date.now()}-${Math.random().toString(16).slice(2)}` },
    success: ({ statusCode, data }) => {
      if (statusCode === 401) return reject(new RequestError('登录状态已失效', 401, data?.requestId))
      if (statusCode < 200 || statusCode >= 300 || data.code !== 0) return reject(new RequestError(data?.message || '请求失败', data?.code || statusCode, data?.requestId))
      resolve(data.data)
    },
    fail: ({ errMsg }) => reject(new RequestError(errMsg || '网络请求失败')),
  })
})

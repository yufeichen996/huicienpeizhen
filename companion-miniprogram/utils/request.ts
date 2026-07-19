import { ENV } from '../config/env'
import type { ApiErrorShape, RequestOptions } from '../types/api'
import { StorageKeys, storage } from './storage'
import type { CompanionSession } from '../types/domain'

export class ApiError extends Error {
  code: string
  requestId?: string

  constructor(shape: ApiErrorShape) {
    super(shape.message)
    this.name = 'ApiError'
    this.code = shape.code
    this.requestId = shape.requestId
  }
}

const wait = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds))

export async function request<T>(options: RequestOptions<T>): Promise<T> {
  if (ENV.mode === 'mock') {
    if (!options.mock) {
      throw new ApiError({ code: 'MOCK_NOT_IMPLEMENTED', message: '当前 Mock 接口尚未实现' })
    }
    await wait(ENV.mockDelayMs)
    return options.mock()
  }

  if (!ENV.baseUrl) {
    throw new ApiError({ code: 'API_BASE_URL_MISSING', message: '尚未配置服务端地址' })
  }

  const session = storage.get<CompanionSession | null>(StorageKeys.session, null)

  return new Promise<T>((resolve, reject) => {
    wx.request({
      url: `${ENV.baseUrl}${options.path}`,
      method: options.method || 'GET',
      data: options.data,
      timeout: ENV.timeoutMs,
      header: {
        'content-type': 'application/json',
        ...(options.authenticated !== false && session?.token
          ? { Authorization: `Bearer ${session.token}` }
          : {}),
      },
      success(response) {
        if (response.statusCode >= 200 && response.statusCode < 300) {
          resolve(response.data as T)
          return
        }
        const error = response.data as Partial<ApiErrorShape>
        reject(new ApiError({
          code: error.code || `HTTP_${response.statusCode}`,
          message: error.message || '服务请求失败，请稍后重试',
          requestId: error.requestId,
        }))
      },
      fail(error) {
        reject(new ApiError({ code: 'NETWORK_ERROR', message: error.errMsg || '网络连接失败' }))
      },
    })
  })
}

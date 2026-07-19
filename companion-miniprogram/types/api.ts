export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE'

export interface RequestOptions<T> {
  path: string
  method?: HttpMethod
  data?: WechatMiniprogram.IAnyObject | string | ArrayBuffer
  authenticated?: boolean
  mock?: () => T | Promise<T>
}

export interface ApiErrorShape {
  code: string
  message: string
  requestId?: string
}

export interface ApiResponse<T> { code: number; message: string; data: T; requestId?: string }
export interface PageResult<T> { list: T[]; page: number; pageSize: number; total: number; hasMore: boolean }
export class RequestError extends Error { constructor(message: string, public code = -1, public requestId?: string) { super(message) } }

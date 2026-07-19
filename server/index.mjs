import { createServer } from 'node:http'
import { createHash, randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { extname, join, resolve } from 'node:path'
import { config } from './config.mjs'
import { createRepository } from './db.mjs'
import { createLogger } from './logger.mjs'

const publicRoot = join(config.serverRoot, 'public')
const repository = createRepository(config.databaseFile, {
  seedData: config.seedTestData,
  demoInstitutionPassword: config.demoInstitutionPassword,
  demoAdminPassword: config.demoAdminPassword,
  dataEncryptionKey: config.dataEncryptionKey,
  tokenTtlSeconds: config.tokenTtlSeconds,
})
const logger = createLogger(config.logDir)
const loginWindows = new Map()

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json; charset=utf-8',
}

const errorStatus = {
  BODY_INVALID: 400,
  BODY_TOO_LARGE: 413,
  UNAUTHORIZED: 401,
  LOGIN_INVALID: 401,
  LOGIN_LOCKED: 429,
  RATE_LIMITED: 429,
  FORBIDDEN: 403,
  FEATURE_DISABLED: 503,
  SERVICE_NOT_FOUND: 404,
  SERVICE_NOT_AVAILABLE: 409,
  COMPANION_NOT_FOUND: 404,
  COMPANION_NOT_AVAILABLE: 409,
  COMPANION_HOSPITAL_MISMATCH: 409,
  INSTITUTION_NOT_APPROVED: 403,
  INSTITUTION_ACCOUNT_INVALID: 401,
  INSTITUTION_ACCOUNT_DISABLED: 403,
  INSTITUTION_FIELDS_REQUIRED: 422,
  INSTITUTION_STATUS_INVALID: 422,
  ACCOUNT_STATUS_INVALID: 422,
  LOGIN_NAME_INVALID: 422,
  LOGIN_NAME_EXISTS: 409,
  PASSWORD_INVALID: 422,
  ORDER_NOT_FOUND: 404,
  ORDER_NOT_DRAFT: 409,
  ORDER_CANNOT_WITHDRAW: 409,
  ORDER_ALREADY_CLAIMED: 409,
  ORDER_VERSION_CONFLICT: 409,
  ORDER_STATUS_INVALID: 409,
  ORDER_REVIEW_INCOMPLETE: 409,
  PATIENT_NAME_REQUIRED: 422,
  PATIENT_PHONE_INVALID: 422,
  HOSPITAL_DEPARTMENT_REQUIRED: 422,
  BOOKING_TIME_INVALID: 422,
  DISPATCH_MODE_INVALID: 422,
  DIRECT_COMPANION_REQUIRED: 422,
  PRICE_INVALID: 422,
  EXECUTION_NODE_NOT_ACTIVE: 409,
  EXECUTION_NODE_NOT_FOUND: 404,
  FAILURE_REASON_REQUIRED: 422,
  EXCEPTION_DESCRIPTION_REQUIRED: 422,
  REQUIRED_NODES_INCOMPLETE: 409,
  REVIEW_STATUS_INVALID: 422,
  REVIEW_NOT_FOUND: 404,
  EXCEPTION_NOT_FOUND: 404,
  EXPENSE_NOT_FOUND: 404,
  UPLOAD_TYPE_INVALID: 415,
  UPLOAD_SIZE_INVALID: 413,
}

const errorMessages = {
  UNAUTHORIZED: '登录状态已失效，请重新登录',
  LOGIN_INVALID: '账号或密码不正确',
  LOGIN_LOCKED: '登录失败次数过多，请 15 分钟后重试',
  RATE_LIMITED: '请求过于频繁，请稍后重试',
  FORBIDDEN: '当前账号没有执行该操作的权限',
  FEATURE_DISABLED: '该能力在当前环境未启用',
  SERVICE_NOT_FOUND: '服务不存在',
  SERVICE_NOT_AVAILABLE: '服务未启用',
  COMPANION_NOT_FOUND: '陪诊师不存在',
  COMPANION_NOT_AVAILABLE: '陪诊师当前不可用',
  COMPANION_HOSPITAL_MISMATCH: '陪诊师服务医院不匹配',
  INSTITUTION_NOT_APPROVED: '合作机构尚未通过审核',
  INSTITUTION_ACCOUNT_INVALID: '合作机构账号不存在',
  INSTITUTION_ACCOUNT_DISABLED: '合作机构账号已停用',
  INSTITUTION_FIELDS_REQUIRED: '请完整填写机构名称和联系人信息',
  INSTITUTION_STATUS_INVALID: '机构状态不正确',
  ACCOUNT_STATUS_INVALID: '账号状态不正确',
  LOGIN_NAME_INVALID: '登录账号需为 4–32 位字母、数字或下划线',
  LOGIN_NAME_EXISTS: '登录账号已存在',
  PASSWORD_INVALID: '临时密码至少需要 8 位',
  ORDER_NOT_FOUND: '订单不存在或不属于当前账号',
  ORDER_NOT_DRAFT: '只有草稿订单可以修改或发布',
  ORDER_CANNOT_WITHDRAW: '当前订单状态不能撤回',
  ORDER_ALREADY_CLAIMED: '订单已被其他陪诊师抢走',
  ORDER_VERSION_CONFLICT: '订单状态已更新，请刷新后重试',
  ORDER_STATUS_INVALID: '当前订单状态不允许此操作',
  ORDER_REVIEW_INCOMPLETE: '请先完成异常和费用审核',
  PATIENT_NAME_REQUIRED: '请填写客户姓名',
  PATIENT_PHONE_INVALID: '请填写正确的客户手机号',
  HOSPITAL_DEPARTMENT_REQUIRED: '请填写医院和科室',
  BOOKING_TIME_INVALID: '预约日期或时间格式不正确',
  DISPATCH_MODE_INVALID: '派单方式不正确',
  DIRECT_COMPANION_REQUIRED: '定向派单必须选择陪诊师',
  PRICE_INVALID: '价格必须是大于等于零的整数分',
  EXECUTION_NODE_NOT_ACTIVE: '只能记录当前进行中的服务节点',
  EXECUTION_NODE_NOT_FOUND: '服务节点不存在',
  FAILURE_REASON_REQUIRED: '请填写当前节点无法完成的原因',
  EXCEPTION_DESCRIPTION_REQUIRED: '请填写异常说明',
  REQUIRED_NODES_INCOMPLETE: '所有必需节点完成后才能结束服务',
  REVIEW_STATUS_INVALID: '审核状态不正确',
  REVIEW_NOT_FOUND: '审核记录不存在',
  EXCEPTION_NOT_FOUND: '异常记录不存在或已审核',
  EXPENSE_NOT_FOUND: '费用记录不存在或已审核',
  BODY_INVALID: '请求内容格式不正确',
  BODY_TOO_LARGE: '请求内容过大',
  UPLOAD_TYPE_INVALID: '仅支持 JPG、PNG 和 PDF 文件',
  UPLOAD_SIZE_INVALID: '上传文件不能超过 5MB',
}

const clientIp = (req) => {
  if (config.trustProxy) {
    const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()
    if (forwarded) return forwarded
  }
  return req.socket.remoteAddress || ''
}

const allowedOrigin = (req) => {
  const origin = String(req.headers.origin || '')
  if (!origin) return ''
  return config.corsOrigins.includes(origin) ? origin : null
}

const baseHeaders = (req, requestId) => {
  const origin = allowedOrigin(req)
  return {
    'x-request-id': requestId,
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    'referrer-policy': 'no-referrer',
    'permissions-policy': 'camera=(), microphone=(), geolocation=()',
    'content-security-policy': "default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data: blob:; connect-src 'self' https://api-test.huicien.com",
    ...(origin ? {
      'access-control-allow-origin': origin,
      vary: 'Origin',
    } : {}),
  }
}

const sendJson = (req, res, status, data, requestId) => {
  res.writeHead(status, {
    ...baseHeaders(req, requestId),
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  })
  res.end(JSON.stringify(data))
}

const success = (req, res, data, requestId, status = 200) =>
  sendJson(req, res, status, { code: 0, message: 'ok', data, requestId }, requestId)

const failure = (req, res, error, requestId) => {
  const code = error instanceof Error ? error.message : 'INTERNAL_ERROR'
  const status = errorStatus[code] || 500
  if (status >= 500) {
    logger.error({
      requestId,
      code,
      method: req.method,
      path: req.url,
      stack: error instanceof Error ? error.stack : undefined,
    })
  }
  sendJson(req, res, status, {
    code,
    message: errorMessages[code] || '服务暂时不可用',
    requestId,
  }, requestId)
}

const readBody = async (req, maxBytes = config.maxBodyBytes) => {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > maxBytes) throw new Error('BODY_TOO_LARGE')
    chunks.push(chunk)
  }
  if (!chunks.length) return {}
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw new Error('BODY_INVALID')
  }
}

const readBuffer = async (req, maxBytes) => {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > maxBytes) throw new Error('UPLOAD_SIZE_INVALID')
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}

const bearerToken = (req) => {
  const authorization = String(req.headers.authorization || '')
  return authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : ''
}

const authenticate = (req) => {
  const token = bearerToken(req)
  const session = repository.resolveSession(token)
  if (session) return { ...session, token }
  if (config.allowDemoAuth) {
    const role = String(req.headers['x-demo-role'] || '')
    if (role === 'platform-admin') {
      return {
        actorType: 'PLATFORM',
        actorId: 'platform-admin-demo',
        roleCode: 'PLATFORM_SUPER_ADMIN',
        permissions: ['*'],
        token: '',
      }
    }
    if (role === 'institution-operator') {
      const institutionId = String(req.headers['x-institution-id'] || 'institution-demo')
      const actorId = String(req.headers['x-institution-account-id'] || 'institution-demo-operator')
      const access = repository.getInstitutionAccess(institutionId, actorId)
      return {
        actorType: 'INSTITUTION',
        actorId,
        institutionId,
        roleCode: 'INSTITUTION_OPERATOR',
        permissions: access.permissions,
        token: '',
      }
    }
    const companionId = String(req.headers['x-companion-id'] || '')
    if (companionId) {
      return {
        actorType: 'COMPANION',
        actorId: companionId,
        roleCode: 'COMPANION',
        permissions: [],
        token: '',
      }
    }
  }
  throw new Error('UNAUTHORIZED')
}

const requireActor = (req, ...actorTypes) => {
  const session = authenticate(req)
  if (!actorTypes.includes(session.actorType)) throw new Error('FORBIDDEN')
  return session
}

const requirePermission = (req, permission, actorType) => {
  const session = requireActor(req, actorType)
  if (!session.permissions.includes('*') && !session.permissions.includes(permission)) {
    throw new Error('FORBIDDEN')
  }
  return session
}

const checkLoginRate = (req, scope) => {
  const key = `${clientIp(req)}:${scope}`
  const cutoff = Date.now() - 15 * 60 * 1000
  const recent = (loginWindows.get(key) || []).filter((value) => value > cutoff)
  if (recent.length >= 10) throw new Error('RATE_LIMITED')
  recent.push(Date.now())
  loginWindows.set(key, recent)
}

const audit = (req, requestId, session, action, resourceType, resourceId = '', metadata = {}) => {
  repository.recordOperation({
    requestId,
    actorType: session.actorType,
    actorId: session.actorId,
    institutionId: session.institutionId,
    action,
    resourceType,
    resourceId,
    ipAddress: clientIp(req),
    metadata,
  })
}

const match = (pathname, pattern) => {
  const keys = []
  const expression = pattern.replace(/:([A-Za-z]+)/g, (_, key) => {
    keys.push(key)
    return '([^/]+)'
  })
  const result = pathname.match(new RegExp(`^${expression}$`))
  if (!result) return null
  return Object.fromEntries(keys.map((key, index) => [key, decodeURIComponent(result[index + 1])]))
}

const handleAuth = async (req, res, pathname, requestId) => {
  const method = req.method || 'GET'
  if (method === 'POST' && pathname === '/api/auth/institution/login') {
    checkLoginRate(req, 'institution')
    const body = await readBody(req)
    return success(req, res, repository.authenticateInstitution(
      body.loginName,
      body.password,
      clientIp(req),
    ), requestId)
  }
  if (method === 'POST' && pathname === '/api/auth/admin/login') {
    checkLoginRate(req, 'admin')
    const body = await readBody(req)
    return success(req, res, repository.authenticatePlatform(
      body.loginName,
      body.password,
      clientIp(req),
    ), requestId)
  }
  if (method === 'GET' && pathname === '/api/auth/me') {
    const session = authenticate(req)
    const data = session.actorType === 'INSTITUTION'
      ? repository.getInstitutionAccess(session.institutionId, session.actorId)
      : {
        id: session.actorId,
        roleCode: session.roleCode,
        permissions: session.permissions,
      }
    return success(req, res, data, requestId)
  }
  if (method === 'POST' && pathname === '/api/auth/logout') {
    const session = authenticate(req)
    repository.revokeSession(session.token)
    return success(req, res, { loggedOut: true }, requestId)
  }
  return false
}

const handleApi = async (req, res, url, requestId) => {
  const { pathname, searchParams } = url
  const method = req.method || 'GET'
  let params

  if (method === 'GET' && pathname === '/api/health') {
    return success(req, res, {
      ...repository.health(),
      appEnv: config.appEnv,
      capabilities: {
        wechatLogin: config.wechatLoginEnabled,
        wechatPayment: config.wechatPaymentEnabled,
        miniprogram: config.miniprogramEnabled,
        subscribeMessage: config.subscribeMessageEnabled,
      },
    }, requestId)
  }
  const authHandled = await handleAuth(req, res, pathname, requestId)
  if (authHandled !== false) return authHandled

  if (method === 'GET' && pathname === '/api/services') {
    requireActor(req, 'INSTITUTION', 'PLATFORM')
    return success(req, res, repository.listServices(), requestId)
  }
  if (method === 'GET' && pathname === '/api/companions') {
    requireActor(req, 'INSTITUTION', 'PLATFORM')
    return success(req, res, repository.listCompanions(searchParams.get('serviceId') || undefined), requestId)
  }
  if (method === 'GET' && pathname === '/api/pricing/quote') {
    requireActor(req, 'INSTITUTION', 'PLATFORM')
    return success(req, res, repository.quote(
      searchParams.get('serviceId'),
      searchParams.get('companionId') || null,
    ), requestId)
  }
  if (method === 'POST' && pathname === '/api/uploads') {
    const session = requireActor(req, 'INSTITUTION', 'PLATFORM')
    const mimeType = String(req.headers['content-type'] || '').split(';')[0].toLowerCase()
    const extensionByMime = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'application/pdf': '.pdf',
    }
    const extension = extensionByMime[mimeType]
    if (!extension) throw new Error('UPLOAD_TYPE_INVALID')
    const body = await readBuffer(req, 5 * 1024 * 1024)
    if (!body.length) throw new Error('UPLOAD_SIZE_INVALID')
    const validSignature = mimeType === 'image/png'
      ? body.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
      : mimeType === 'image/jpeg'
        ? body.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))
        : body.subarray(0, 5).toString('ascii') === '%PDF-'
    if (!validSignature) throw new Error('UPLOAD_TYPE_INVALID')
    const ownerType = String(req.headers['x-owner-type'] || session.actorType)
    const ownerId = String(req.headers['x-owner-id'] || session.actorId)
    if (session.actorType === 'INSTITUTION') {
      if (ownerType !== 'ORDER') throw new Error('FORBIDDEN')
      repository.getInstitutionOrder(ownerId, session.institutionId)
    }
    const storageKey = `${new Date().toISOString().slice(0, 10)}/${randomUUID()}${extension}`
    const target = resolve(config.uploadDir, storageKey)
    if (!target.startsWith(config.uploadDir)) throw new Error('FORBIDDEN')
    await mkdir(resolve(target, '..'), { recursive: true })
    await writeFile(target, body, { flag: 'wx' })
    const file = repository.recordUploadedFile({
      ownerType,
      ownerId,
      storageKey,
      originalName: String(req.headers['x-file-name'] || `upload${extension}`).slice(0, 128),
      mimeType,
      sizeBytes: body.length,
      sha256: createHash('sha256').update(body).digest('hex'),
      createdByType: session.actorType,
      createdById: session.actorId,
    })
    audit(req, requestId, session, 'FILE_UPLOAD', 'UPLOADED_FILE', file.id)
    return success(req, res, file, requestId, 201)
  }

  if (method === 'GET' && pathname === '/api/institution/me') {
    const session = requireActor(req, 'INSTITUTION')
    return success(
      req,
      res,
      repository.getInstitutionAccess(session.institutionId, session.actorId),
      requestId,
    )
  }
  if (method === 'GET' && pathname === '/api/institution/dashboard') {
    const session = requirePermission(req, 'VIEW_DASHBOARD', 'INSTITUTION')
    return success(req, res, repository.dashboard(session.institutionId), requestId)
  }
  if (pathname === '/api/institution/orders' && method === 'GET') {
    const session = requirePermission(req, 'MANAGE_ORDERS', 'INSTITUTION')
    return success(req, res, repository.listInstitutionOrders(session.institutionId), requestId)
  }
  if (pathname === '/api/institution/orders' && method === 'POST') {
    const session = requirePermission(req, 'PUBLISH_ORDER', 'INSTITUTION')
    const body = await readBody(req)
    const order = repository.createInstitutionOrder({
      ...body,
      institutionId: session.institutionId,
      operatorType: session.actorType,
      operatorId: session.actorId,
    })
    audit(req, requestId, session, 'ORDER_CREATE', 'ORDER', order.id)
    return success(req, res, order, requestId, 201)
  }
  if (method === 'GET' && (params = match(pathname, '/api/institution/orders/:id'))) {
    const session = requirePermission(req, 'MANAGE_ORDERS', 'INSTITUTION')
    return success(req, res, repository.getInstitutionOrder(params.id, session.institutionId), requestId)
  }
  if (method === 'PATCH' && (params = match(pathname, '/api/institution/orders/:id'))) {
    const session = requirePermission(req, 'MANAGE_ORDERS', 'INSTITUTION')
    const order = repository.updateInstitutionOrder(
      params.id,
      session.institutionId,
      await readBody(req),
    )
    audit(req, requestId, session, 'ORDER_UPDATE', 'ORDER', order.id)
    return success(req, res, order, requestId)
  }
  if (method === 'POST' && (params = match(pathname, '/api/institution/orders/:id/publish'))) {
    const session = requirePermission(req, 'MANAGE_ORDERS', 'INSTITUTION')
    const order = repository.publishOrder(params.id, session.institutionId)
    audit(req, requestId, session, 'ORDER_PUBLISH', 'ORDER', order.id)
    return success(req, res, order, requestId)
  }
  if (method === 'POST' && (params = match(pathname, '/api/institution/orders/:id/payment-confirm'))) {
    const session = requirePermission(req, 'MANAGE_ORDERS', 'INSTITUTION')
    const order = repository.confirmInstitutionPayment(params.id, session.institutionId, session.actorId)
    audit(req, requestId, session, 'ORDER_PAYMENT_CONFIRM', 'ORDER', order.id)
    return success(req, res, order, requestId)
  }
  if (method === 'POST' && (params = match(pathname, '/api/institution/orders/:id/assign'))) {
    const session = requirePermission(req, 'MANAGE_ORDERS', 'INSTITUTION')
    const body = await readBody(req)
    const order = repository.assignInstitutionOrder(
      params.id,
      session.institutionId,
      body.companionId,
      session.actorId,
    )
    audit(req, requestId, session, 'ORDER_ASSIGN', 'ORDER', order.id)
    return success(req, res, order, requestId)
  }
  if (method === 'POST' && (params = match(pathname, '/api/institution/orders/:id/cancel'))) {
    const session = requirePermission(req, 'MANAGE_ORDERS', 'INSTITUTION')
    const body = await readBody(req)
    const order = repository.cancelInstitutionOrder(
      params.id,
      session.institutionId,
      session.actorId,
      body.reason,
    )
    audit(req, requestId, session, 'ORDER_CANCEL', 'ORDER', order.id)
    return success(req, res, order, requestId)
  }
  if (method === 'GET' && (params = match(pathname, '/api/institution/orders/:id/execution-records'))) {
    const session = requirePermission(req, 'MANAGE_ORDERS', 'INSTITUTION')
    return success(
      req,
      res,
      repository.getInstitutionExecutionRecords(session.institutionId, params.id),
      requestId,
    )
  }
  if (method === 'GET' && (params = match(pathname, '/api/institution/orders/:id/exceptions'))) {
    const session = requirePermission(req, 'MANAGE_ORDERS', 'INSTITUTION')
    return success(
      req,
      res,
      repository.getInstitutionExceptions(session.institutionId, params.id),
      requestId,
    )
  }
  if (method === 'GET' && (params = match(pathname, '/api/institution/orders/:id/expenses'))) {
    const session = requirePermission(req, 'MANAGE_ORDERS', 'INSTITUTION')
    return success(
      req,
      res,
      repository.getInstitutionExpenses(session.institutionId, params.id),
      requestId,
    )
  }

  if (method === 'GET' && pathname === '/api/admin/dashboard') {
    requirePermission(req, 'PLATFORM_DASHBOARD', 'PLATFORM')
    return success(req, res, repository.adminDashboard(), requestId)
  }
  if (method === 'GET' && pathname === '/api/admin/institution-orders') {
    requirePermission(req, 'VIEW_ALL_ORDERS', 'PLATFORM')
    return success(req, res, repository.adminInstitutionOrders(), requestId)
  }
  if (method === 'GET' && pathname === '/api/admin/institutions') {
    requirePermission(req, 'MANAGE_INSTITUTIONS', 'PLATFORM')
    return success(req, res, repository.listInstitutions(), requestId)
  }
  if (method === 'POST' && pathname === '/api/admin/institutions') {
    const session = requirePermission(req, 'MANAGE_INSTITUTIONS', 'PLATFORM')
    const institution = repository.createInstitution(await readBody(req))
    audit(req, requestId, session, 'INSTITUTION_CREATE', 'INSTITUTION', institution.institutionId)
    return success(req, res, institution, requestId, 201)
  }
  if (method === 'PUT' && (params = match(pathname, '/api/admin/institutions/:id/access'))) {
    const session = requirePermission(req, 'MANAGE_ACCOUNTS', 'PLATFORM')
    const institution = repository.updateInstitutionAccess(params.id, await readBody(req))
    audit(req, requestId, session, 'INSTITUTION_ACCESS_UPDATE', 'INSTITUTION', params.id)
    return success(req, res, institution, requestId)
  }
  if (method === 'PATCH' && (params = match(pathname, '/api/admin/services/:id/pricing'))) {
    const session = requirePermission(req, 'MANAGE_PRICING', 'PLATFORM')
    const service = repository.updateServicePricing(params.id, await readBody(req))
    audit(req, requestId, session, 'SERVICE_PRICING_UPDATE', 'SERVICE', params.id)
    return success(req, res, service, requestId)
  }
  if (method === 'PUT' && (params = match(pathname, '/api/admin/companions/:companionId/prices/:serviceId'))) {
    const session = requirePermission(req, 'MANAGE_PRICING', 'PLATFORM')
    const body = await readBody(req)
    const quote = repository.setCompanionPrice(params.companionId, params.serviceId, body.price)
    audit(req, requestId, session, 'COMPANION_PRICING_UPDATE', 'COMPANION', params.companionId)
    return success(req, res, quote, requestId)
  }
  if (method === 'POST' && (params = match(pathname, '/api/admin/orders/:id/adjust'))) {
    const session = requirePermission(req, 'ADJUST_ORDERS', 'PLATFORM')
    const order = repository.adminAdjustOrder(params.id, await readBody(req), session.actorId)
    audit(req, requestId, session, 'ORDER_ADMIN_ADJUST', 'ORDER', params.id)
    return success(req, res, order, requestId)
  }
  if (method === 'GET' && pathname === '/api/admin/companion-reviews') {
    requirePermission(req, 'REVIEW_COMPANIONS', 'PLATFORM')
    return success(req, res, repository.listCompanionReviews(), requestId)
  }
  if (method === 'POST' && (params = match(pathname, '/api/admin/companion-reviews/:id/review'))) {
    const session = requirePermission(req, 'REVIEW_COMPANIONS', 'PLATFORM')
    const body = await readBody(req)
    const review = repository.reviewCompanion(params.id, body.status, body.reason, session.actorId)
    audit(req, requestId, session, 'COMPANION_REVIEW', 'COMPANION_REVIEW', params.id)
    return success(req, res, review, requestId)
  }
  if (method === 'GET' && pathname === '/api/admin/exceptions') {
    requirePermission(req, 'REVIEW_EXCEPTIONS', 'PLATFORM')
    return success(req, res, repository.listServiceExceptions(), requestId)
  }
  if (method === 'POST' && (params = match(pathname, '/api/admin/exceptions/:id/review'))) {
    const session = requirePermission(req, 'REVIEW_EXCEPTIONS', 'PLATFORM')
    const body = await readBody(req)
    const exception = repository.reviewServiceException(
      params.id,
      body.status,
      body.note,
      session.actorId,
    )
    audit(req, requestId, session, 'EXCEPTION_REVIEW', 'SERVICE_EXCEPTION', params.id)
    return success(req, res, exception, requestId)
  }
  if (method === 'GET' && pathname === '/api/admin/expenses') {
    requirePermission(req, 'REVIEW_EXPENSES', 'PLATFORM')
    return success(req, res, repository.listOrderExpenses(), requestId)
  }
  if (method === 'POST' && (params = match(pathname, '/api/admin/expenses/:id/review'))) {
    const session = requirePermission(req, 'REVIEW_EXPENSES', 'PLATFORM')
    const body = await readBody(req)
    const expense = repository.reviewOrderExpense(params.id, body.status, body.note, session.actorId)
    audit(req, requestId, session, 'EXPENSE_REVIEW', 'ORDER_EXPENSE', params.id)
    return success(req, res, expense, requestId)
  }
  if (method === 'POST' && (params = match(pathname, '/api/admin/orders/:id/finalize'))) {
    const session = requirePermission(req, 'ADJUST_ORDERS', 'PLATFORM')
    const result = repository.finalizeOrderReview(params.id, session.actorId)
    audit(req, requestId, session, 'ORDER_REVIEW_FINALIZE', 'ORDER', params.id)
    return success(req, res, result, requestId)
  }
  if (method === 'GET' && pathname === '/api/admin/permissions') {
    requirePermission(req, 'MANAGE_PERMISSIONS', 'PLATFORM')
    return success(req, res, repository.listPermissions(), requestId)
  }
  if (method === 'GET' && pathname === '/api/admin/operation-logs') {
    requirePermission(req, 'VIEW_OPERATION_LOGS', 'PLATFORM')
    return success(
      req,
      res,
      repository.listOperationLogs(searchParams.get('limit')),
      requestId,
    )
  }

  if (pathname === '/api/client/orders' && method === 'POST') {
    if (!config.miniprogramEnabled) throw new Error('FEATURE_DISABLED')
    throw new Error('UNAUTHORIZED')
  }
  if (pathname.startsWith('/api/wechat/') || pathname.startsWith('/api/payments/')) {
    throw new Error('FEATURE_DISABLED')
  }
  return false
}

const serveStatic = async (req, res, pathname, requestId) => {
  const normalized = pathname === '/' || pathname === '/institution' || pathname === '/institution/'
    ? '/index.html'
    : pathname === '/admin' || pathname === '/admin/'
      ? '/admin.html'
      : pathname
  const file = resolve(publicRoot, `.${normalized}`)
  if (!file.startsWith(publicRoot) || !existsSync(file)) return false
  const body = await readFile(file)
  res.writeHead(200, {
    ...baseHeaders(req, requestId),
    'content-type': mimeTypes[extname(file)] || 'application/octet-stream',
    'cache-control': extname(file) === '.html' ? 'no-cache' : 'public, max-age=300',
  })
  res.end(body)
  return true
}

const server = createServer(async (req, res) => {
  const requestId = String(req.headers['x-request-id'] || randomUUID())
  const startedAt = Date.now()
  let status = 200
  try {
    const origin = allowedOrigin(req)
    if (origin === null) throw new Error('FORBIDDEN')
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        ...baseHeaders(req, requestId),
        'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
        'access-control-allow-headers': [
          'authorization',
          'content-type',
          'x-request-id',
          'x-owner-type',
          'x-owner-id',
          'x-file-name',
        ].join(','),
        'access-control-max-age': '600',
      })
      res.end()
      return
    }
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
    if (url.pathname.startsWith('/api/')) {
      const handled = await handleApi(req, res, url, requestId)
      if (handled === false) {
        status = 404
        return sendJson(req, res, 404, {
          code: 'NOT_FOUND',
          message: '接口不存在',
          requestId,
        }, requestId)
      }
      return
    }
    if (await serveStatic(req, res, url.pathname, requestId)) return
    if (await serveStatic(req, res, '/index.html', requestId)) return
    status = 404
    res.writeHead(404, baseHeaders(req, requestId))
    res.end('Not found')
  } catch (error) {
    const code = error instanceof Error ? error.message : 'INTERNAL_ERROR'
    status = errorStatus[code] || 500
    failure(req, res, error, requestId)
  } finally {
    logger.access({
      requestId,
      method: req.method,
      path: String(req.url || '').split('?')[0],
      status,
      durationMs: Date.now() - startedAt,
      ipAddress: clientIp(req),
    })
  }
})

server.listen(config.port, config.host, () => {
  console.log(`汇慈恩陪诊测试服务已启动：http://${config.host}:${config.port}`)
  console.log(`环境：${config.appEnv}`)
  console.log(`数据库：${config.databaseFile}`)
})

let shuttingDown = false
const shutdown = () => {
  if (shuttingDown) return
  shuttingDown = true
  const forceTimer = setTimeout(() => process.exit(1), 10000)
  forceTimer.unref()
  server.close(() => {
    repository.checkpoint()
    repository.close()
    process.exit(0)
  })
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
process.on('uncaughtException', (error) => {
  logger.error({ event: 'uncaughtException', stack: error.stack })
  shutdown()
})
process.on('unhandledRejection', (error) => {
  logger.error({ event: 'unhandledRejection', stack: error instanceof Error ? error.stack : String(error) })
})

export { server, repository }

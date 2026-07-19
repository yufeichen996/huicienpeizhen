import assert from 'node:assert/strict'
import { existsSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawn } from 'node:child_process'

const databaseFile = resolve('server/.data/http-integration.sqlite')
if (existsSync(databaseFile)) rmSync(databaseFile, { force: true })

const port = 8798
const baseUrl = `http://127.0.0.1:${port}`
const child = spawn(process.execPath, ['server/index.mjs'], {
  cwd: resolve('.'),
  env: {
    ...process.env,
    NODE_ENV: 'test',
    APP_ENV: 'test',
    HOST: '127.0.0.1',
    PORT: String(port),
    DATABASE_FILE: databaseFile,
    LOG_DIR: resolve('server/.logs/http-integration'),
    SEED_TEST_DATA: 'true',
    ALLOW_DEMO_AUTH: 'false',
    TRUST_PROXY: 'false',
    CORS_ALLOWED_ORIGINS: baseUrl,
    TEST_INSTITUTION_PASSWORD: 'HttpOrg@2026',
    TEST_ADMIN_PASSWORD: 'HttpAdmin@2026',
    DATA_ENCRYPTION_KEY: 'http-integration-encryption-key',
    WECHAT_LOGIN_ENABLED: 'false',
    WECHAT_PAYMENT_ENABLED: 'false',
    MINIPROGRAM_ENABLED: 'false',
    SUBSCRIBE_MESSAGE_ENABLED: 'false',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
})

let stderr = ''
child.stderr.on('data', (chunk) => { stderr += chunk.toString() })

const waitForHealth = async () => {
  const deadline = Date.now() + 10000
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/api/health`)
      if (response.ok) return
    } catch {
      // 服务进程仍在启动。
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 100))
  }
  throw new Error(`HTTP_SERVER_START_TIMEOUT\n${stderr}`)
}

const api = async (path, { token = '', method = 'GET', body, headers = {} } = {}) => {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const payload = await response.json()
  return { response, payload }
}

try {
  await waitForHealth()

  const noToken = await api('/api/institution/me')
  assert.equal(noToken.response.status, 401)

  const fakeHeaders = await api('/api/institution/me', {
    headers: {
      'x-demo-role': 'institution-operator',
      'x-institution-id': 'institution-demo',
      'x-institution-account-id': 'institution-demo-operator',
    },
  })
  assert.equal(fakeHeaders.response.status, 401, '测试环境必须关闭演示请求头鉴权')

  const adminLogin = await api('/api/auth/admin/login', {
    method: 'POST',
    body: { loginName: 'huicien_admin', password: 'HttpAdmin@2026' },
  })
  assert.equal(adminLogin.response.status, 200)
  const adminToken = adminLogin.payload.data.token

  const currentAdmin = await api('/api/auth/me', { token: adminToken })
  assert.equal(currentAdmin.response.status, 200)
  assert.equal(currentAdmin.payload.data.loginName, 'huicien_admin')
  const platformAccounts = await api('/api/admin/platform-accounts', { token: adminToken })
  assert.equal(platformAccounts.response.status, 200)
  assert.equal(platformAccounts.payload.data.length, 1)
  assert.equal(Object.hasOwn(platformAccounts.payload.data[0], 'passwordHash'), false)
  const createdPlatformAccount = await api('/api/admin/platform-accounts', {
    token: adminToken,
    method: 'POST',
    body: {
      loginName: 'http_operation_admin',
      displayName: 'HTTP 运营管理员',
      temporaryPassword: 'HttpOperation@2026',
    },
  })
  assert.equal(createdPlatformAccount.response.status, 201)
  const selfDisable = await api(`/api/admin/platform-accounts/${currentAdmin.payload.data.id}/access`, {
    token: adminToken,
    method: 'PUT',
    body: { accountStatus: 'DISABLED' },
  })
  assert.equal(selfDisable.response.status, 409)
  const disablePlatformAccount = await api(`/api/admin/platform-accounts/${createdPlatformAccount.payload.data.id}/access`, {
    token: adminToken,
    method: 'PUT',
    body: { accountStatus: 'DISABLED' },
  })
  assert.equal(disablePlatformAccount.response.status, 200)

  const institutionLogin = await api('/api/auth/institution/login', {
    method: 'POST',
    body: { loginName: 'kangyi_admin', password: 'HttpOrg@2026' },
  })
  assert.equal(institutionLogin.response.status, 200)
  const institutionToken = institutionLogin.payload.data.token

  const createdOrder = await api('/api/institution/orders', {
    token: institutionToken,
    method: 'POST',
    body: {
      patientName: 'HTTP 联调客户',
      patientPhone: '13812345678',
      patientAgeGroup: '40–49 岁',
      serviceId: 'full',
      hospitalName: '上海瑞金医院',
      departmentName: '心内科',
      bookingDate: '2026-08-20',
      bookingTime: '10:00',
      dispatchMode: 'MARKET',
      publish: false,
    },
  })
  assert.equal(createdOrder.response.status, 201)
  assert.equal(createdOrder.payload.data.status, 'DRAFT')

  const invalidUpload = await fetch(`${baseUrl}/api/uploads`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${institutionToken}`,
      'content-type': 'application/octet-stream',
    },
    body: Buffer.from('invalid'),
  })
  assert.equal(invalidUpload.status, 415)
  const invalidOwnerUpload = await fetch(`${baseUrl}/api/uploads`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${institutionToken}`,
      'content-type': 'image/png',
      'x-file-name': 'invalid-owner.png',
      'x-owner-type': 'INSTITUTION',
      'x-owner-id': 'institution-demo',
    },
    body: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  })
  assert.equal(invalidOwnerUpload.status, 403)
  const validUpload = await fetch(`${baseUrl}/api/uploads`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${institutionToken}`,
      'content-type': 'image/png',
      'x-file-name': 'test.png',
      'x-owner-type': 'ORDER',
      'x-owner-id': createdOrder.payload.data.id,
    },
    body: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  })
  assert.equal(validUpload.status, 201)

  const secondInstitution = await api('/api/admin/institutions', {
    token: adminToken,
    method: 'POST',
    body: {
      name: 'HTTP 隔离机构',
      contactName: '王老师',
      contactPhone: '13700001111',
      loginName: 'http_isolation_org',
      displayName: '王老师',
      temporaryPassword: 'HttpIsolation@2026',
      permissions: ['VIEW_DASHBOARD', 'PUBLISH_ORDER', 'MANAGE_ORDERS'],
      institutionStatus: 'APPROVED',
    },
  })
  assert.equal(secondInstitution.response.status, 201)

  const secondLogin = await api('/api/auth/institution/login', {
    method: 'POST',
    body: { loginName: 'http_isolation_org', password: 'HttpIsolation@2026' },
  })
  const crossTenant = await api(`/api/institution/orders/${createdOrder.payload.data.id}`, {
    token: secondLogin.payload.data.token,
  })
  assert.equal(crossTenant.response.status, 404, '机构 Token 不得读取其他机构订单')

  const adminOrders = await api('/api/admin/institution-orders', { token: adminToken })
  assert.equal(adminOrders.response.status, 200)
  assert.ok(adminOrders.payload.data.orders.some((order) => order.id === createdOrder.payload.data.id))

  const logs = await api('/api/admin/operation-logs?limit=20', { token: adminToken })
  assert.equal(logs.response.status, 200)
  assert.ok(logs.payload.data.some((item) => item.action === 'ORDER_CREATE'))

  await api('/api/auth/logout', { token: institutionToken, method: 'POST', body: {} })
  const afterLogout = await api('/api/auth/me', { token: institutionToken })
  assert.equal(afterLogout.response.status, 401)

  console.log(JSON.stringify({
    databaseFile,
    realPasswordLogin: 'passed',
    demoHeaderDisabled: 'passed',
    institutionIsolation: 'passed',
    adminOrderVisibility: 'passed',
    operationAudit: 'passed',
    platformAccountManagement: 'passed',
    uploadRestrictions: 'passed',
    logoutRevocation: 'passed',
  }, null, 2))
} finally {
  child.kill('SIGTERM')
  await new Promise((resolveExit) => {
    if (child.exitCode !== null) return resolveExit()
    child.once('exit', resolveExit)
    setTimeout(resolveExit, 5000)
  })
}

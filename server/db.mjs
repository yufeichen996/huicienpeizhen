import { mkdirSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual,
} from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'

const now = () => new Date().toISOString()
const institutionPermissions = ['VIEW_DASHBOARD', 'PUBLISH_ORDER', 'MANAGE_ORDERS']
const platformPermissions = [
  'PLATFORM_DASHBOARD',
  'MANAGE_INSTITUTIONS',
  'MANAGE_ACCOUNTS',
  'REVIEW_COMPANIONS',
  'VIEW_ALL_ORDERS',
  'ADJUST_ORDERS',
  'REVIEW_EXCEPTIONS',
  'REVIEW_EXPENSES',
  'MANAGE_PERMISSIONS',
  'VIEW_OPERATION_LOGS',
  'MANAGE_PRICING',
]
const migrationsRoot = fileURLToPath(new URL('./migrations', import.meta.url))
const asJson = (value, fallback = []) => {
  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

const mapService = (row) => row && ({
  id: row.id,
  name: row.name,
  category: row.category,
  durationMinutes: row.duration_minutes,
  servicePrice: row.service_price,
  defaultCompanionPrice: row.default_companion_price,
  enabled: Boolean(row.enabled),
  updatedAt: row.updated_at,
})

const mapCompanion = (row) => row && ({
  id: row.id,
  name: row.name,
  status: row.status,
  skills: asJson(row.skills_json),
  hospitals: asJson(row.hospitals_json),
})

const mapInstitutionAccess = (row) => row && ({
  institutionId: row.institution_id,
  institutionName: row.institution_name,
  institutionStatus: row.institution_status,
  contactName: row.contact_name,
  contactPhone: row.contact_phone,
  accountId: row.account_id,
  loginName: row.login_name,
  displayName: row.display_name,
  accountStatus: row.account_status,
  permissions: asJson(row.permissions_json),
  passwordResetRequired: Boolean(row.password_reset_required),
  lastLoginAt: row.last_login_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

const mapOrderRaw = (row, decryptSensitive) => row && ({
  id: row.id,
  orderNo: row.order_no,
  source: row.source,
  institutionId: row.institution_id,
  institutionName: row.institution_name,
  patientName: decryptSensitive(row.patient_name),
  patientPhone: decryptSensitive(row.patient_phone),
  patientAgeGroup: row.patient_age_group,
  serviceId: row.service_id,
  serviceName: row.service_name_snapshot,
  servicePrice: row.service_price_snapshot,
  companionId: row.companion_id,
  companionName: row.companion_name,
  companionPrice: row.companion_price_snapshot,
  totalAmount: row.total_amount,
  paidAmount: row.paid_amount,
  paymentStatus: row.payment_status,
  hospitalName: row.hospital_name,
  departmentName: row.department_name,
  bookingDate: row.booking_date,
  bookingTime: row.booking_time,
  dispatchMode: row.dispatch_mode,
  status: row.status,
  specialNeeds: asJson(row.special_needs_json),
  remark: row.remark || '',
  version: row.version,
  publishedAt: row.published_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

const serviceSeeds = [
  ['full', '全程陪诊', '就医陪诊', 240, 19800, 15800],
  ['exam', '检查陪同', '检查陪同', 180, 16800, 12800],
  ['medicine', '代取药物', '院内代办', 60, 6800, 4800],
  ['report', '报告解读', '报告服务', 60, 9800, 6800],
  ['delivery', '取送报告', '报告服务', 90, 8800, 5800],
  ['inpatient', '住院陪护', '住院服务', 480, 29800, 23800],
]

const companionSeeds = [
  ['lin-xiaowen', '林晓雯', ['full', 'exam', 'medicine'], ['上海瑞金医院', '华山医院', '仁济医院', '中山医院']],
  ['chen-jianguo', '陈建国', ['exam', 'medicine', 'report', 'delivery'], ['华山医院', '中山医院', '长海医院', '同济医院']],
  ['wang-meilin', '王美琳', ['full', 'exam', 'inpatient'], ['上海儿童医学中心', '新华医院', '仁济医院']],
  ['registered-mock-application-zhou-ning', '周宁', ['full', 'exam'], ['上海瑞金医院', '华山医院']],
]

const runMigrations = (db) => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    )
  `)
  const migrations = readdirSync(migrationsRoot)
    .filter((name) => /^\d+_.+\.sql$/.test(name))
    .sort()
  for (const name of migrations) {
    const version = Number(name.split('_')[0])
    const applied = db.prepare('SELECT 1 FROM schema_migrations WHERE version = ?').get(version)
    if (applied) continue
    const source = readFileSync(join(migrationsRoot, name), 'utf8')
    db.exec('BEGIN IMMEDIATE')
    try {
      db.exec(source)
      db.prepare(`
        INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)
      `).run(version, name, now())
      db.exec(`PRAGMA user_version = ${version}`)
      db.exec('COMMIT')
    } catch (error) {
      db.exec('ROLLBACK')
      throw error
    }
  }
}

const ensureLegacyColumns = (db) => {
  const addColumn = (table, name, definition) => {
    const exists = db.prepare(`PRAGMA table_info(${table})`).all()
      .some((column) => column.name === name)
    if (!exists) db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`)
  }
  addColumn('institution_accounts', 'failed_login_count', 'INTEGER NOT NULL DEFAULT 0')
  addColumn('institution_accounts', 'locked_until', 'TEXT')
  addColumn('companions', 'phone_masked', "TEXT NOT NULL DEFAULT ''")
  addColumn('companions', 'identity_masked', "TEXT NOT NULL DEFAULT ''")
  addColumn('orders', 'user_id', 'TEXT')
  addColumn('orders', 'patient_id', 'TEXT')
  addColumn('orders', 'patient_snapshot_json', "TEXT NOT NULL DEFAULT '{}'")
  addColumn('orders', 'paid_amount', 'INTEGER NOT NULL DEFAULT 0')
  addColumn('orders', 'payment_status', "TEXT NOT NULL DEFAULT 'UNPAID'")
}

export function createRepository(filename, options = {}) {
  if (filename !== ':memory:') mkdirSync(dirname(filename), { recursive: true })
  const db = new DatabaseSync(filename)
  db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;')
  runMigrations(db)
  ensureLegacyColumns(db)

  const stamp = now()
  const seedData = options.seedData !== false
  const demoInstitutionPassword = options.demoInstitutionPassword || 'Huicien@2026'
  const demoAdminPassword = options.demoAdminPassword || 'Admin@2026!'
  const tokenTtlSeconds = Number(options.tokenTtlSeconds || 7200)
  const encryptionKey = createHash('sha256')
    .update(options.dataEncryptionKey || 'development-only-data-key')
    .digest()
  const passwordHash = (password, salt) => scryptSync(password, salt, 64).toString('hex')
  const encryptSensitive = (value) => {
    const iv = randomBytes(12)
    const cipher = createCipheriv('aes-256-gcm', encryptionKey, iv)
    const encrypted = Buffer.concat([cipher.update(String(value || ''), 'utf8'), cipher.final()])
    return [
      'v1',
      iv.toString('base64url'),
      cipher.getAuthTag().toString('base64url'),
      encrypted.toString('base64url'),
    ].join('.')
  }
  const decryptSensitive = (value) => {
    const normalized = String(value || '')
    if (!normalized.startsWith('v1.')) return normalized
    const [, ivValue, tagValue, encryptedValue] = normalized.split('.')
    const decipher = createDecipheriv(
      'aes-256-gcm',
      encryptionKey,
      Buffer.from(ivValue, 'base64url'),
    )
    decipher.setAuthTag(Buffer.from(tagValue, 'base64url'))
    return Buffer.concat([
      decipher.update(Buffer.from(encryptedValue, 'base64url')),
      decipher.final(),
    ]).toString('utf8')
  }
  const mapOrder = (row) => mapOrderRaw(row, decryptSensitive)

  for (const [code, name, scope] of [
    ['PLATFORM_SUPER_ADMIN', '平台超级管理员', 'PLATFORM'],
    ['INSTITUTION_OPERATOR', '合作机构操作员', 'INSTITUTION'],
  ]) {
    db.prepare(`
      INSERT OR IGNORE INTO roles (id, code, name, scope, created_at) VALUES (?, ?, ?, ?, ?)
    `).run(`role-${code.toLowerCase()}`, code, name, scope, stamp)
  }
  for (const code of [...platformPermissions, ...institutionPermissions]) {
    const scope = code.startsWith('PLATFORM_') || platformPermissions.includes(code)
      ? 'PLATFORM'
      : 'INSTITUTION'
    db.prepare(`
      INSERT OR IGNORE INTO permissions (id, code, name, scope, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(`permission-${code.toLowerCase()}`, code, code, scope, stamp)
  }
  for (const code of platformPermissions) {
    db.prepare(`
      INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
      VALUES ('role-platform_super_admin', ?)
    `).run(`permission-${code.toLowerCase()}`)
  }

  if (seedData) {
  db.prepare(`
    INSERT OR IGNORE INTO institutions
    (id, name, status, contact_name, contact_phone, created_at, updated_at)
    VALUES (?, ?, 'APPROVED', ?, ?, ?, ?)
  `).run('institution-demo', '康颐养老服务中心', '周老师', '138****1208', stamp, stamp)

  const demoSalt = 'huicien-demo-account-salt'
  const demoPasswordHash = passwordHash(demoInstitutionPassword, demoSalt)
  db.prepare(`
    INSERT OR IGNORE INTO institution_accounts (
      id, institution_id, login_name, display_name, contact_phone, status,
      permissions_json, password_hash, password_salt, password_reset_required,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, 'ENABLED', ?, ?, ?, 1, ?, ?)
  `).run(
    'institution-demo-operator',
    'institution-demo',
    'kangyi_admin',
    '周老师',
    '138****1208',
    JSON.stringify(institutionPermissions),
    demoPasswordHash,
    demoSalt,
    stamp,
    stamp,
  )

  const adminSalt = 'huicien-test-admin-salt'
  db.prepare(`
    INSERT OR IGNORE INTO platform_accounts (
      id, login_name, display_name, status, password_hash, password_salt,
      role_code, created_at, updated_at
    ) VALUES (?, ?, ?, 'ENABLED', ?, ?, 'PLATFORM_SUPER_ADMIN', ?, ?)
  `).run(
    'platform-admin-demo',
    'huicien_admin',
    '平台测试管理员',
    passwordHash(demoAdminPassword, adminSalt),
    adminSalt,
    stamp,
    stamp,
  )

  const insertService = db.prepare(`
    INSERT OR IGNORE INTO services
    (id, name, category, duration_minutes, service_price, default_companion_price, enabled, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 1, ?)
  `)
  for (const service of serviceSeeds) insertService.run(...service, stamp)

  const insertCompanion = db.prepare(`
    INSERT OR IGNORE INTO companions
    (id, name, status, skills_json, hospitals_json, created_at, updated_at)
    VALUES (?, ?, 'APPROVED', ?, ?, ?, ?)
  `)
  for (const [id, name, skills, hospitals] of companionSeeds) {
    insertCompanion.run(id, name, JSON.stringify(skills), JSON.stringify(hospitals), stamp, stamp)
  }

  for (const [id, name] of [
    ['hospital-ruijin', '上海瑞金医院'],
    ['hospital-huashan', '华山医院'],
    ['hospital-renji', '仁济医院'],
    ['hospital-zhongshan', '中山医院'],
  ]) {
    db.prepare(`
      INSERT OR IGNORE INTO hospitals (id, name, city, enabled, created_at, updated_at)
      VALUES (?, ?, '上海', 1, ?, ?)
    `).run(id, name, stamp, stamp)
  }

  const legacyOrderSensitiveRows = db.prepare(`
    SELECT id, patient_name, patient_phone, patient_age_group
    FROM orders
    WHERE patient_name NOT LIKE 'v1.%' OR patient_phone NOT LIKE 'v1.%'
  `).all()
  const encryptLegacyOrder = db.prepare(`
    UPDATE orders
    SET patient_name = ?, patient_phone = ?, patient_snapshot_json = ?, updated_at = ?
    WHERE id = ?
  `)
  for (const row of legacyOrderSensitiveRows) {
    const patientName = decryptSensitive(row.patient_name)
    const patientPhone = decryptSensitive(row.patient_phone)
    encryptLegacyOrder.run(
      encryptSensitive(patientName),
      encryptSensitive(patientPhone),
      JSON.stringify({
        nameEncrypted: encryptSensitive(patientName),
        phoneEncrypted: encryptSensitive(patientPhone),
        ageGroup: row.patient_age_group,
      }),
      stamp,
      row.id,
    )
  }

  const executionNodeSeeds = [
    ['meet', 1, '确认集合', '与用户核对集合地点和服务安排', 1],
    ['register', 2, '到院报到', '协助完成取号或报到流程', 1],
    ['waiting', 3, '科室候诊', '确认候诊位置并留意叫号', 1],
    ['care', 4, '就诊检查协助', '按服务边界提供流程协助', 1],
    ['medicine', 5, '缴费或取药协助', '按用户实际需求完成，可说明不适用', 0],
    ['result', 6, '服务结果确认', '与用户确认交付物和后续非诊断事项', 1],
  ]
  for (const service of serviceSeeds) {
    for (const [code, index, title, description, required] of executionNodeSeeds) {
      db.prepare(`
        INSERT OR IGNORE INTO service_execution_nodes (
          id, service_id, node_code, node_index, title, description, required, enabled
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 1)
      `).run(`node-${service[0]}-${code}`, service[0], code, index, title, description, required)
    }
  }
  }

  const getOrderRow = db.prepare(`
    SELECT o.*, i.name AS institution_name, c.name AS companion_name
    FROM orders o
    LEFT JOIN institutions i ON i.id = o.institution_id
    LEFT JOIN companions c ON c.id = o.companion_id
    WHERE o.id = ?
  `)

  const getService = (id) => mapService(db.prepare('SELECT * FROM services WHERE id = ?').get(id))
  const getCompanion = (id) => mapCompanion(db.prepare('SELECT * FROM companions WHERE id = ?').get(id))
  const institutionAccessSelect = `
    SELECT
      i.id AS institution_id, i.name AS institution_name, i.status AS institution_status,
      i.contact_name, i.contact_phone,
      a.id AS account_id, a.login_name, a.display_name, a.status AS account_status,
      a.permissions_json, a.password_reset_required, a.last_login_at,
      a.created_at, a.updated_at
    FROM institutions i
    LEFT JOIN institution_accounts a ON a.institution_id = i.id
  `
  const getInstitutionAccessRow = db.prepare(`${institutionAccessSelect} WHERE i.id = ? ORDER BY a.created_at LIMIT 1`)
  const getInstitutionAccessRowByAccount = db.prepare(`
    ${institutionAccessSelect} WHERE i.id = ? AND a.id = ?
  `)

  const normalizePermissions = (permissions) => {
    const requested = Array.isArray(permissions) ? permissions : []
    return institutionPermissions.filter((permission) => requested.includes(permission))
  }

  const passwordFields = (password) => {
    if (typeof password !== 'string' || password.length < 8) throw new Error('PASSWORD_INVALID')
    const salt = randomBytes(16).toString('hex')
    return {
      salt,
      hash: scryptSync(password, salt, 64).toString('hex'),
    }
  }

  const verifyPassword = (password, salt, expectedHex) => {
    if (typeof password !== 'string' || !salt || !expectedHex) return false
    const actual = scryptSync(password, salt, 64)
    const expected = Buffer.from(expectedHex, 'hex')
    return actual.length === expected.length && timingSafeEqual(actual, expected)
  }

  const tokenHash = (token) => createHash('sha256').update(token).digest('hex')

  const recordLoginAttempt = (loginName, actorType, ipAddress, succeeded, failureCode = null) => {
    db.prepare(`
      INSERT INTO login_attempts (
        id, login_name, actor_type, ip_address, succeeded, failure_code, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      `login-${randomUUID()}`,
      String(loginName || '').slice(0, 64),
      actorType,
      String(ipAddress || '').slice(0, 96),
      Number(Boolean(succeeded)),
      failureCode,
      now(),
    )
  }

  const issueSession = ({ actorType, actorId, institutionId = null, roleCode, permissions }) => {
    const token = randomBytes(32).toString('base64url')
    const createdAt = now()
    const expiresAt = new Date(Date.now() + tokenTtlSeconds * 1000).toISOString()
    db.prepare(`
      INSERT INTO auth_sessions (
        id, token_hash, actor_type, actor_id, institution_id, role_code,
        permissions_json, expires_at, created_at, last_seen_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      `session-${randomUUID()}`,
      tokenHash(token),
      actorType,
      actorId,
      institutionId,
      roleCode,
      JSON.stringify(permissions),
      expiresAt,
      createdAt,
      createdAt,
    )
    return { token, expiresAt }
  }

  const resolveSession = (token) => {
    if (!token) return null
    const row = db.prepare(`
      SELECT * FROM auth_sessions
      WHERE token_hash = ? AND revoked_at IS NULL AND expires_at > ?
    `).get(tokenHash(token), now())
    if (!row) return null
    db.prepare('UPDATE auth_sessions SET last_seen_at = ? WHERE id = ?').run(now(), row.id)
    return {
      sessionId: row.id,
      actorType: row.actor_type,
      actorId: row.actor_id,
      institutionId: row.institution_id,
      roleCode: row.role_code,
      permissions: asJson(row.permissions_json),
      expiresAt: row.expires_at,
    }
  }

  const addOrderStatusLog = (orderId, fromStatus, toStatus, actorType, actorId, reason = '') => {
    db.prepare(`
      INSERT INTO order_status_logs (
        id, order_id, from_status, to_status, operator_type, operator_id, reason, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      `order-log-${randomUUID()}`,
      orderId,
      fromStatus || null,
      toStatus,
      actorType,
      actorId,
      String(reason || '').slice(0, 500),
      now(),
    )
  }

  const quote = (serviceId, companionId = null) => {
    const service = getService(serviceId)
    if (!service || !service.enabled) throw new Error('SERVICE_NOT_AVAILABLE')
    let companionPrice = service.defaultCompanionPrice
    if (companionId) {
      const companion = getCompanion(companionId)
      if (!companion || companion.status !== 'APPROVED') throw new Error('COMPANION_NOT_AVAILABLE')
      const override = db.prepare(`
        SELECT price FROM companion_prices WHERE companion_id = ? AND service_id = ?
      `).get(companionId, serviceId)
      if (override) companionPrice = override.price
    }
    return {
      serviceId,
      companionId,
      servicePrice: service.servicePrice,
      companionPrice,
      totalAmount: service.servicePrice + companionPrice,
      priceSource: companionId && db.prepare(`
        SELECT 1 FROM companion_prices WHERE companion_id = ? AND service_id = ?
      `).get(companionId, serviceId) ? 'COMPANION_OVERRIDE' : 'SERVICE_DEFAULT',
    }
  }

  const createTaskForOrder = (orderId, companionId, status, mode, timestamp) => {
    db.prepare(`
      INSERT INTO companion_tasks
      (id, order_id, companion_id, status, assignment_mode, version, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 1, ?, ?)
    `).run(`task-${randomUUID()}`, orderId, companionId, status, mode, timestamp, timestamp)
  }

  const createOrder = (input, source = 'INSTITUTION') => {
    const timestamp = now()
    const id = `order-${randomUUID()}`
    const service = getService(input.serviceId)
    if (!service || !service.enabled) throw new Error('SERVICE_NOT_AVAILABLE')
    if (source === 'INSTITUTION') {
      const institution = db.prepare(`
        SELECT * FROM institutions WHERE id = ? AND status = 'APPROVED'
      `).get(input.institutionId)
      if (!institution) throw new Error('INSTITUTION_NOT_APPROVED')
    }
    if (!input.patientName?.trim()) throw new Error('PATIENT_NAME_REQUIRED')
    if (!/^1[3-9]\d{9}$/.test(input.patientPhone || '')) throw new Error('PATIENT_PHONE_INVALID')
    if (!input.hospitalName?.trim() || !input.departmentName?.trim()) throw new Error('HOSPITAL_DEPARTMENT_REQUIRED')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.bookingDate || '') || !/^\d{2}:\d{2}$/.test(input.bookingTime || '')) {
      throw new Error('BOOKING_TIME_INVALID')
    }
    const dispatchMode = input.dispatchMode || 'MARKET'
    if (!['PLATFORM', 'DIRECT', 'MARKET'].includes(dispatchMode)) throw new Error('DISPATCH_MODE_INVALID')
    if (dispatchMode === 'DIRECT' && !input.companionId) throw new Error('DIRECT_COMPANION_REQUIRED')
    const pricing = quote(input.serviceId, input.companionId || null)
    const shouldPublish = Boolean(input.publish)
    const status = !shouldPublish
      ? 'DRAFT'
      : dispatchMode === 'MARKET'
        ? 'PUBLISHED'
        : dispatchMode === 'DIRECT'
          ? 'PENDING_CONFIRMATION'
          : 'PENDING_ASSIGNMENT'
    const orderNo = `JG${new Date().toISOString().slice(0, 10).replaceAll('-', '')}${String(
      db.prepare('SELECT COUNT(*) AS count FROM orders').get().count + 1,
    ).padStart(4, '0')}`
    db.exec('BEGIN IMMEDIATE')
    try {
      db.prepare(`
        INSERT INTO orders (
          id, order_no, source, user_id, institution_id, patient_id,
          patient_name, patient_phone, patient_age_group,
          patient_snapshot_json,
          service_id, service_name_snapshot, service_price_snapshot, companion_id,
          companion_price_snapshot, total_amount, hospital_name, department_name,
          booking_date, booking_time, dispatch_mode, status, special_needs_json, remark,
          version, published_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
      `).run(
        id,
        orderNo,
        source,
        input.userId || null,
        input.institutionId || null,
        input.patientId || null,
        encryptSensitive(input.patientName.trim()),
        encryptSensitive(input.patientPhone),
        input.patientAgeGroup?.trim() || '',
        JSON.stringify({
          nameEncrypted: encryptSensitive(input.patientName.trim()),
          phoneEncrypted: encryptSensitive(input.patientPhone),
          ageGroup: input.patientAgeGroup?.trim() || '',
        }),
        service.id,
        service.name,
        pricing.servicePrice,
        input.companionId || null,
        pricing.companionPrice,
        pricing.totalAmount,
        input.hospitalName.trim(),
        input.departmentName.trim(),
        input.bookingDate,
        input.bookingTime,
        dispatchMode,
        status,
        JSON.stringify(input.specialNeeds || []),
        input.remark?.trim() || '',
        shouldPublish ? timestamp : null,
        timestamp,
        timestamp,
      )
      if (status === 'PENDING_CONFIRMATION') {
        createTaskForOrder(id, input.companionId, 'OFFERED', 'selected', timestamp)
      }
      addOrderStatusLog(
        id,
        null,
        status,
        input.operatorType || (source === 'INSTITUTION' ? 'INSTITUTION' : 'CLIENT'),
        input.operatorId || input.institutionId || input.userId || 'system',
        '创建订单',
      )
      db.exec('COMMIT')
    } catch (error) {
      db.exec('ROLLBACK')
      throw error
    }
    return mapOrder(getOrderRow.get(id))
  }

  const getOrderExecution = (orderId) => db.prepare(`
    SELECT
      r.id, r.order_id AS orderId, r.node_id AS nodeId, r.companion_id AS companionId,
      n.node_index AS nodeIndex, n.title, n.description, n.required,
      r.status, r.note, r.failure_reason AS failureReason, r.evidence_json AS evidenceJson,
      r.started_at AS startedAt, r.completed_at AS completedAt, r.failed_at AS failedAt,
      r.updated_at AS updatedAt
    FROM service_execution_records r
    JOIN service_execution_nodes n ON n.id = r.node_id
    WHERE r.order_id = ?
    ORDER BY n.node_index
  `).all(orderId).map((row) => ({
    ...row,
    required: Boolean(row.required),
    evidenceImages: asJson(row.evidenceJson),
    evidenceJson: undefined,
  }))

  const initializeExecution = (order) => {
    const nodes = db.prepare(`
      SELECT * FROM service_execution_nodes
      WHERE service_id = ? AND enabled = 1 ORDER BY node_index
    `).all(order.serviceId)
    const timestamp = now()
    for (const [index, node] of nodes.entries()) {
      db.prepare(`
        INSERT OR IGNORE INTO service_execution_records (
          id, order_id, node_id, companion_id, status, started_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        `execution-${randomUUID()}`,
        order.id,
        node.id,
        order.companionId,
        index === 0 ? 'ACTIVE' : 'PENDING',
        index === 0 ? timestamp : null,
        timestamp,
      )
    }
    return getOrderExecution(order.id)
  }

  const transitionOrder = (
    orderId,
    nextStatus,
    actorType,
    actorId,
    reason = '',
    allowedStatuses = null,
  ) => {
    const current = mapOrder(getOrderRow.get(orderId))
    if (!current) throw new Error('ORDER_NOT_FOUND')
    if (allowedStatuses && !allowedStatuses.includes(current.status)) throw new Error('ORDER_STATUS_INVALID')
    const timestamp = now()
    const result = db.prepare(`
      UPDATE orders SET status = ?, version = version + 1, updated_at = ?
      WHERE id = ? AND version = ?
    `).run(nextStatus, timestamp, orderId, current.version)
    if (!result.changes) throw new Error('ORDER_VERSION_CONFLICT')
    addOrderStatusLog(orderId, current.status, nextStatus, actorType, actorId, reason)
    return mapOrder(getOrderRow.get(orderId))
  }

  const assignOrder = (orderId, companionId, actorType, actorId, mode = 'platform') => {
    const current = mapOrder(getOrderRow.get(orderId))
    const companion = getCompanion(companionId)
    if (!current) throw new Error('ORDER_NOT_FOUND')
    if (!companion || companion.status !== 'APPROVED') throw new Error('COMPANION_NOT_AVAILABLE')
    if (['IN_SERVICE', 'PENDING_REVIEW', 'COMPLETED', 'CANCELLED'].includes(current.status)) {
      throw new Error('ORDER_STATUS_INVALID')
    }
    const pricing = quote(current.serviceId, companionId)
    const timestamp = now()
    db.exec('BEGIN IMMEDIATE')
    try {
      db.prepare(`
        UPDATE order_assignments SET status = 'REASSIGNED', responded_at = ?
        WHERE order_id = ? AND status IN ('OFFERED', 'ACCEPTED')
      `).run(timestamp, orderId)
      db.prepare(`
        INSERT INTO order_assignments (
          id, order_id, companion_id, assignment_mode, status,
          assigned_by_type, assigned_by_id, assigned_at
        ) VALUES (?, ?, ?, ?, 'OFFERED', ?, ?, ?)
      `).run(
        `assignment-${randomUUID()}`,
        orderId,
        companionId,
        mode,
        actorType,
        actorId,
        timestamp,
      )
      db.prepare(`
        INSERT INTO companion_tasks (
          id, order_id, companion_id, status, assignment_mode, version, created_at, updated_at
        ) VALUES (?, ?, ?, 'OFFERED', ?, 1, ?, ?)
        ON CONFLICT(order_id) DO UPDATE SET
          companion_id = excluded.companion_id,
          status = 'OFFERED',
          assignment_mode = excluded.assignment_mode,
          version = companion_tasks.version + 1,
          updated_at = excluded.updated_at
      `).run(`task-${randomUUID()}`, orderId, companionId, mode, timestamp, timestamp)
      db.prepare(`
        UPDATE orders
        SET companion_id = ?, companion_price_snapshot = ?,
            total_amount = service_price_snapshot + ?, status = 'PENDING_CONFIRMATION',
            version = version + 1, updated_at = ?
        WHERE id = ?
      `).run(companionId, pricing.companionPrice, pricing.companionPrice, timestamp, orderId)
      addOrderStatusLog(
        orderId,
        current.status,
        'PENDING_CONFIRMATION',
        actorType,
        actorId,
        current.companionId ? '改派陪诊师' : '派单',
      )
      db.exec('COMMIT')
    } catch (error) {
      db.exec('ROLLBACK')
      throw error
    }
    return mapOrder(getOrderRow.get(orderId))
  }

  return {
    close: () => db.close(),

    checkpoint: () => db.exec('PRAGMA wal_checkpoint(TRUNCATE)'),

    schemaInfo: () => ({
      version: db.prepare('PRAGMA user_version').get().user_version,
      migrations: db.prepare(`
        SELECT version, name, applied_at AS appliedAt
        FROM schema_migrations ORDER BY version
      `).all(),
      tables: db.prepare(`
        SELECT name FROM sqlite_master
        WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
        ORDER BY name
      `).all().map((row) => row.name),
      indexes: db.prepare(`
        SELECT name FROM sqlite_master
        WHERE type = 'index' AND name NOT LIKE 'sqlite_%'
        ORDER BY name
      `).all().map((row) => row.name),
    }),

    authenticateInstitution: (loginName, password, ipAddress = '') => {
      const row = db.prepare(`
        SELECT a.*, i.status AS institution_status, i.name AS institution_name
        FROM institution_accounts a
        JOIN institutions i ON i.id = a.institution_id
        WHERE a.login_name = ?
      `).get(String(loginName || '').trim())
      const locked = row?.locked_until && row.locked_until > now()
      const valid = row
        && !locked
        && row.status === 'ENABLED'
        && row.institution_status === 'APPROVED'
        && verifyPassword(password, row.password_salt, row.password_hash)
      if (!valid) {
        recordLoginAttempt(loginName, 'INSTITUTION', ipAddress, false, locked ? 'LOGIN_LOCKED' : 'LOGIN_INVALID')
        if (row && !locked) {
          const failedCount = Number(row.failed_login_count || 0) + 1
          const lockedUntil = failedCount >= 5
            ? new Date(Date.now() + 15 * 60 * 1000).toISOString()
            : null
          db.prepare(`
            UPDATE institution_accounts
            SET failed_login_count = ?, locked_until = ?, updated_at = ?
            WHERE id = ?
          `).run(failedCount, lockedUntil, now(), row.id)
        }
        throw new Error(locked ? 'LOGIN_LOCKED' : 'LOGIN_INVALID')
      }
      const loggedInAt = now()
      db.prepare(`
        UPDATE institution_accounts
        SET failed_login_count = 0, locked_until = NULL, last_login_at = ?, updated_at = ?
        WHERE id = ?
      `).run(loggedInAt, loggedInAt, row.id)
      recordLoginAttempt(loginName, 'INSTITUTION', ipAddress, true)
      const session = issueSession({
        actorType: 'INSTITUTION',
        actorId: row.id,
        institutionId: row.institution_id,
        roleCode: 'INSTITUTION_OPERATOR',
        permissions: asJson(row.permissions_json),
      })
      return {
        ...session,
        account: mapInstitutionAccess(getInstitutionAccessRowByAccount.get(row.institution_id, row.id)),
      }
    },

    authenticatePlatform: (loginName, password, ipAddress = '') => {
      const row = db.prepare('SELECT * FROM platform_accounts WHERE login_name = ?')
        .get(String(loginName || '').trim())
      const locked = row?.locked_until && row.locked_until > now()
      const valid = row
        && !locked
        && row.status === 'ENABLED'
        && verifyPassword(password, row.password_salt, row.password_hash)
      if (!valid) {
        recordLoginAttempt(loginName, 'PLATFORM', ipAddress, false, locked ? 'LOGIN_LOCKED' : 'LOGIN_INVALID')
        if (row && !locked) {
          const failedCount = Number(row.failed_login_count || 0) + 1
          const lockedUntil = failedCount >= 5
            ? new Date(Date.now() + 15 * 60 * 1000).toISOString()
            : null
          db.prepare(`
            UPDATE platform_accounts
            SET failed_login_count = ?, locked_until = ?, updated_at = ?
            WHERE id = ?
          `).run(failedCount, lockedUntil, now(), row.id)
        }
        throw new Error(locked ? 'LOGIN_LOCKED' : 'LOGIN_INVALID')
      }
      const loggedInAt = now()
      db.prepare(`
        UPDATE platform_accounts
        SET failed_login_count = 0, locked_until = NULL, last_login_at = ?, updated_at = ?
        WHERE id = ?
      `).run(loggedInAt, loggedInAt, row.id)
      recordLoginAttempt(loginName, 'PLATFORM', ipAddress, true)
      const session = issueSession({
        actorType: 'PLATFORM',
        actorId: row.id,
        roleCode: row.role_code,
        permissions: platformPermissions,
      })
      return {
        ...session,
        account: {
          id: row.id,
          loginName: row.login_name,
          displayName: row.display_name,
          roleCode: row.role_code,
          permissions: platformPermissions,
          lastLoginAt: loggedInAt,
        },
      }
    },

    resolveSession,

    revokeSession: (token) => {
      if (!token) return
      db.prepare(`
        UPDATE auth_sessions SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL
      `).run(now(), tokenHash(token))
    },

    recordOperation: ({
      requestId,
      actorType,
      actorId,
      institutionId = null,
      action,
      resourceType,
      resourceId = '',
      result = 'SUCCESS',
      ipAddress = '',
      metadata = {},
    }) => {
      const safeMetadata = Object.fromEntries(
        Object.entries(metadata || {}).filter(([key]) =>
          !/password|token|secret|identity|phone|patient/i.test(key)),
      )
      db.prepare(`
        INSERT INTO operation_logs (
          id, request_id, actor_type, actor_id, institution_id, action,
          resource_type, resource_id, result, ip_address, metadata_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        `operation-${randomUUID()}`,
        requestId,
        actorType,
        actorId,
        institutionId,
        action,
        resourceType,
        resourceId,
        result,
        ipAddress,
        JSON.stringify(safeMetadata),
        now(),
      )
    },

    listOperationLogs: (limit = 100) => db.prepare(`
      SELECT
        id, request_id AS requestId, actor_type AS actorType, actor_id AS actorId,
        institution_id AS institutionId, action, resource_type AS resourceType,
        resource_id AS resourceId, result, ip_address AS ipAddress,
        metadata_json AS metadataJson, created_at AS createdAt
      FROM operation_logs ORDER BY created_at DESC LIMIT ?
    `).all(Math.min(Math.max(Number(limit) || 100, 1), 500)).map((row) => ({
      ...row,
      metadata: asJson(row.metadataJson, {}),
      metadataJson: undefined,
    })),

    createClientUser: (input = {}) => {
      const id = `user-${randomUUID()}`
      const timestamp = now()
      db.prepare(`
        INSERT INTO users (id, phone_masked, display_name, status, created_at, updated_at)
        VALUES (?, ?, ?, 'ACTIVE', ?, ?)
      `).run(
        id,
        String(input.phoneMasked || ''),
        String(input.displayName || '测试用户').slice(0, 64),
        timestamp,
        timestamp,
      )
      return {
        id,
        phoneMasked: String(input.phoneMasked || ''),
        displayName: String(input.displayName || '测试用户').slice(0, 64),
      }
    },

    createPatient: (userId, input) => {
      const user = db.prepare('SELECT id FROM users WHERE id = ? AND status = ?').get(userId, 'ACTIVE')
      if (!user) throw new Error('USER_NOT_FOUND')
      const id = `patient-${randomUUID()}`
      const timestamp = now()
      db.prepare(`
        INSERT INTO patients (
          id, user_id, name_encrypted, phone_encrypted, identity_encrypted,
          gender, age_group, relationship, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        userId,
        encryptSensitive(input.name),
        encryptSensitive(input.phone),
        encryptSensitive(input.identityNumber || ''),
        String(input.gender || ''),
        String(input.ageGroup || ''),
        String(input.relationship || ''),
        timestamp,
        timestamp,
      )
      return {
        id,
        userId,
        nameMasked: input.name ? `${String(input.name).slice(0, 1)}**` : '',
        phoneMasked: input.phone ? `${String(input.phone).slice(0, 3)}****${String(input.phone).slice(-4)}` : '',
      }
    },

    recordUploadedFile: (input) => {
      const id = `file-${randomUUID()}`
      db.prepare(`
        INSERT INTO uploaded_files (
          id, owner_type, owner_id, storage_key, original_name, mime_type,
          size_bytes, sha256, created_by_type, created_by_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        input.ownerType,
        input.ownerId,
        input.storageKey,
        input.originalName,
        input.mimeType,
        input.sizeBytes,
        input.sha256,
        input.createdByType,
        input.createdById,
        now(),
      )
      return {
        id,
        originalName: input.originalName,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        createdAt: now(),
      }
    },

    health: () => ({
      database: 'ok',
      services: db.prepare('SELECT COUNT(*) AS count FROM services').get().count,
      orders: db.prepare('SELECT COUNT(*) AS count FROM orders').get().count,
      timestamp: now(),
    }),

    adminDashboard: () => ({
      metrics: {
        institutions: db.prepare('SELECT COUNT(*) AS count FROM institutions').get().count,
        approvedInstitutions: db.prepare("SELECT COUNT(*) AS count FROM institutions WHERE status = 'APPROVED'").get().count,
        enabledAccounts: db.prepare("SELECT COUNT(*) AS count FROM institution_accounts WHERE status = 'ENABLED'").get().count,
        enabledServices: db.prepare('SELECT COUNT(*) AS count FROM services WHERE enabled = 1').get().count,
        orders: db.prepare('SELECT COUNT(*) AS count FROM orders').get().count,
      },
    }),

    adminInstitutionOrders: () => ({
      summary: {
        total: db.prepare("SELECT COUNT(*) AS count FROM orders WHERE source = 'INSTITUTION'").get().count,
        dispatching: db.prepare(`
          SELECT COUNT(*) AS count FROM orders
          WHERE source = 'INSTITUTION'
            AND status IN ('PUBLISHED', 'PENDING_ASSIGNMENT', 'PENDING_CONFIRMATION')
        `).get().count,
        inService: db.prepare(`
          SELECT COUNT(*) AS count FROM orders
          WHERE source = 'INSTITUTION' AND status IN ('PENDING_SERVICE', 'IN_SERVICE')
        `).get().count,
        completed: db.prepare(`
          SELECT COUNT(*) AS count FROM orders
          WHERE source = 'INSTITUTION' AND status = 'COMPLETED'
        `).get().count,
      },
      institutions: db.prepare(`
        SELECT
          i.id AS institution_id,
          i.name AS institution_name,
          COUNT(o.id) AS total,
          SUM(CASE WHEN o.status = 'DRAFT' THEN 1 ELSE 0 END) AS draft,
          SUM(CASE WHEN o.status IN ('PUBLISHED', 'PENDING_ASSIGNMENT', 'PENDING_CONFIRMATION') THEN 1 ELSE 0 END) AS dispatching,
          SUM(CASE WHEN o.status IN ('PENDING_SERVICE', 'IN_SERVICE') THEN 1 ELSE 0 END) AS in_service,
          SUM(CASE WHEN o.status = 'COMPLETED' THEN 1 ELSE 0 END) AS completed,
          SUM(CASE WHEN o.status = 'CANCELLED' THEN 1 ELSE 0 END) AS cancelled
        FROM institutions i
        LEFT JOIN orders o ON o.institution_id = i.id AND o.source = 'INSTITUTION'
        GROUP BY i.id, i.name
        ORDER BY total DESC, i.name
      `).all().map((row) => ({
        institutionId: row.institution_id,
        institutionName: row.institution_name,
        total: row.total,
        draft: row.draft,
        dispatching: row.dispatching,
        inService: row.in_service,
        completed: row.completed,
        cancelled: row.cancelled,
      })),
      orders: db.prepare(`
        SELECT o.*, i.name AS institution_name, c.name AS companion_name
        FROM orders o
        JOIN institutions i ON i.id = o.institution_id
        LEFT JOIN companions c ON c.id = o.companion_id
        WHERE o.source = 'INSTITUTION'
        ORDER BY o.created_at DESC
      `).all().map((row) => {
        const order = mapOrder(row)
        return {
          ...order,
          patientPhone: order.patientPhone
            ? `${order.patientPhone.slice(0, 3)}****${order.patientPhone.slice(-4)}`
            : '',
        }
      }),
    }),

    listInstitutions: () => db.prepare(`
      SELECT
        i.id AS institution_id, i.name AS institution_name, i.status AS institution_status,
        i.contact_name, i.contact_phone,
        a.id AS account_id, a.login_name, a.display_name, a.status AS account_status,
        a.permissions_json, a.password_reset_required, a.last_login_at,
        a.created_at, a.updated_at
      FROM institutions i
      LEFT JOIN institution_accounts a ON a.institution_id = i.id
      ORDER BY i.created_at DESC
    `).all().map(mapInstitutionAccess),

    getInstitutionAccess: (institutionId, accountId) => {
      const access = mapInstitutionAccess(getInstitutionAccessRowByAccount.get(institutionId, accountId))
      if (!access) throw new Error('INSTITUTION_ACCOUNT_INVALID')
      if (access.institutionStatus !== 'APPROVED') throw new Error('INSTITUTION_NOT_APPROVED')
      if (access.accountStatus !== 'ENABLED') throw new Error('INSTITUTION_ACCOUNT_DISABLED')
      return access
    },

    assertInstitutionPermission: (institutionId, accountId, permission) => {
      const access = mapInstitutionAccess(getInstitutionAccessRowByAccount.get(institutionId, accountId))
      if (!access) throw new Error('INSTITUTION_ACCOUNT_INVALID')
      if (access.institutionStatus !== 'APPROVED') throw new Error('INSTITUTION_NOT_APPROVED')
      if (access.accountStatus !== 'ENABLED') throw new Error('INSTITUTION_ACCOUNT_DISABLED')
      if (!access.permissions.includes(permission)) throw new Error('FORBIDDEN')
      return access
    },

    createInstitution: (input) => {
      if (!input.name?.trim() || !input.contactName?.trim() || !input.contactPhone?.trim()) {
        throw new Error('INSTITUTION_FIELDS_REQUIRED')
      }
      if (!/^[A-Za-z0-9_]{4,32}$/.test(input.loginName || '')) throw new Error('LOGIN_NAME_INVALID')
      if (db.prepare('SELECT 1 FROM institution_accounts WHERE login_name = ?').get(input.loginName)) {
        throw new Error('LOGIN_NAME_EXISTS')
      }
      const password = passwordFields(input.temporaryPassword)
      const timestamp = now()
      const institutionId = `institution-${randomUUID()}`
      const accountId = `institution-account-${randomUUID()}`
      const permissions = normalizePermissions(input.permissions)
      const institutionStatus = ['PENDING', 'APPROVED', 'SUSPENDED'].includes(input.institutionStatus)
        ? input.institutionStatus
        : 'APPROVED'
      db.exec('BEGIN IMMEDIATE')
      try {
        db.prepare(`
          INSERT INTO institutions
          (id, name, status, contact_name, contact_phone, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          institutionId,
          input.name.trim(),
          institutionStatus,
          input.contactName.trim(),
          input.contactPhone.trim(),
          timestamp,
          timestamp,
        )
        db.prepare(`
          INSERT INTO institution_accounts (
            id, institution_id, login_name, display_name, contact_phone, status,
            permissions_json, password_hash, password_salt, password_reset_required,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, 'ENABLED', ?, ?, ?, 1, ?, ?)
        `).run(
          accountId,
          institutionId,
          input.loginName,
          input.displayName?.trim() || input.contactName.trim(),
          input.contactPhone.trim(),
          JSON.stringify(permissions),
          password.hash,
          password.salt,
          timestamp,
          timestamp,
        )
        db.exec('COMMIT')
      } catch (error) {
        db.exec('ROLLBACK')
        throw error
      }
      return mapInstitutionAccess(getInstitutionAccessRow.get(institutionId))
    },

    updateInstitutionAccess: (institutionId, input) => {
      const current = mapInstitutionAccess(getInstitutionAccessRow.get(institutionId))
      if (!current?.accountId) throw new Error('INSTITUTION_ACCOUNT_INVALID')
      const institutionStatus = input.institutionStatus ?? current.institutionStatus
      const accountStatus = input.accountStatus ?? current.accountStatus
      if (!['PENDING', 'APPROVED', 'SUSPENDED'].includes(institutionStatus)) throw new Error('INSTITUTION_STATUS_INVALID')
      if (!['ENABLED', 'DISABLED'].includes(accountStatus)) throw new Error('ACCOUNT_STATUS_INVALID')
      const loginName = input.loginName?.trim() || current.loginName
      if (!/^[A-Za-z0-9_]{4,32}$/.test(loginName)) throw new Error('LOGIN_NAME_INVALID')
      const duplicate = db.prepare('SELECT id FROM institution_accounts WHERE login_name = ? AND id <> ?')
        .get(loginName, current.accountId)
      if (duplicate) throw new Error('LOGIN_NAME_EXISTS')
      const permissions = input.permissions === undefined
        ? current.permissions
        : normalizePermissions(input.permissions)
      const timestamp = now()
      const reset = input.temporaryPassword ? passwordFields(input.temporaryPassword) : null
      db.exec('BEGIN IMMEDIATE')
      try {
        db.prepare(`
          UPDATE institutions SET status = ?, contact_name = ?, contact_phone = ?, updated_at = ?
          WHERE id = ?
        `).run(
          institutionStatus,
          input.contactName?.trim() || current.contactName,
          input.contactPhone?.trim() || current.contactPhone,
          timestamp,
          institutionId,
        )
        if (reset) {
          db.prepare(`
            UPDATE institution_accounts
            SET login_name = ?, display_name = ?, contact_phone = ?, status = ?,
                permissions_json = ?, password_hash = ?, password_salt = ?,
                password_reset_required = 1, updated_at = ?
            WHERE id = ?
          `).run(
            loginName,
            input.displayName?.trim() || current.displayName,
            input.contactPhone?.trim() || current.contactPhone,
            accountStatus,
            JSON.stringify(permissions),
            reset.hash,
            reset.salt,
            timestamp,
            current.accountId,
          )
        } else {
          db.prepare(`
            UPDATE institution_accounts
            SET login_name = ?, display_name = ?, contact_phone = ?, status = ?,
                permissions_json = ?, updated_at = ?
            WHERE id = ?
          `).run(
            loginName,
            input.displayName?.trim() || current.displayName,
            input.contactPhone?.trim() || current.contactPhone,
            accountStatus,
            JSON.stringify(permissions),
            timestamp,
            current.accountId,
          )
        }
        db.exec('COMMIT')
      } catch (error) {
        db.exec('ROLLBACK')
        throw error
      }
      return mapInstitutionAccess(getInstitutionAccessRow.get(institutionId))
    },

    dashboard: (institutionId) => ({
      institution: db.prepare('SELECT id, name, status, contact_name AS contactName, contact_phone AS contactPhone FROM institutions WHERE id = ?').get(institutionId),
      metrics: {
        total: db.prepare('SELECT COUNT(*) AS count FROM orders WHERE institution_id = ?').get(institutionId).count,
        published: db.prepare("SELECT COUNT(*) AS count FROM orders WHERE institution_id = ? AND status = 'PUBLISHED'").get(institutionId).count,
        pendingService: db.prepare("SELECT COUNT(*) AS count FROM orders WHERE institution_id = ? AND status IN ('PENDING_CONFIRMATION', 'PENDING_ASSIGNMENT', 'PENDING_SERVICE')").get(institutionId).count,
        completed: db.prepare("SELECT COUNT(*) AS count FROM orders WHERE institution_id = ? AND status = 'COMPLETED'").get(institutionId).count,
      },
    }),

    listServices: () => db.prepare('SELECT * FROM services ORDER BY rowid').all().map(mapService),

    updateServicePricing: (id, input) => {
      const current = getService(id)
      if (!current) throw new Error('SERVICE_NOT_FOUND')
      const servicePrice = Number.isInteger(input.servicePrice) ? input.servicePrice : current.servicePrice
      const defaultCompanionPrice = Number.isInteger(input.defaultCompanionPrice)
        ? input.defaultCompanionPrice
        : current.defaultCompanionPrice
      if (servicePrice < 0 || defaultCompanionPrice < 0) throw new Error('PRICE_INVALID')
      db.prepare(`
        UPDATE services
        SET service_price = ?, default_companion_price = ?, enabled = ?, updated_at = ?
        WHERE id = ?
      `).run(
        servicePrice,
        defaultCompanionPrice,
        input.enabled === undefined ? Number(current.enabled) : Number(Boolean(input.enabled)),
        now(),
        id,
      )
      return getService(id)
    },

    listCompanions: (serviceId) => {
      const companions = db.prepare("SELECT * FROM companions WHERE status = 'APPROVED' ORDER BY name").all()
        .map(mapCompanion)
      return companions.map((companion) => ({
        ...companion,
        prices: Object.fromEntries(db.prepare(`
          SELECT service_id, price FROM companion_prices WHERE companion_id = ?
        `).all(companion.id).map((row) => [row.service_id, row.price])),
      }))
    },

    setCompanionPrice: (companionId, serviceId, price) => {
      const companion = getCompanion(companionId)
      const service = getService(serviceId)
      if (!companion) throw new Error('COMPANION_NOT_FOUND')
      if (!service) throw new Error('SERVICE_NOT_FOUND')
      if (price === null || price === undefined) {
        db.prepare('DELETE FROM companion_prices WHERE companion_id = ? AND service_id = ?').run(companionId, serviceId)
      } else {
        if (!Number.isInteger(price) || price < 0) throw new Error('PRICE_INVALID')
        db.prepare(`
          INSERT INTO companion_prices (companion_id, service_id, price, updated_at)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(companion_id, service_id)
          DO UPDATE SET price = excluded.price, updated_at = excluded.updated_at
        `).run(companionId, serviceId, price, now())
      }
      return quote(serviceId, companionId)
    },

    quote,

    createInstitutionOrder: (input) => createOrder(input, 'INSTITUTION'),
    createClientOrder: (input) => createOrder(input, 'CLIENT'),

    assignClientOrderToInstitution: (orderId, institutionId, adminId) => {
      const order = mapOrder(getOrderRow.get(orderId))
      const institution = db.prepare(`
        SELECT id FROM institutions WHERE id = ? AND status = 'APPROVED'
      `).get(institutionId)
      if (!order) throw new Error('ORDER_NOT_FOUND')
      if (!institution) throw new Error('INSTITUTION_NOT_APPROVED')
      db.prepare(`
        UPDATE orders SET institution_id = ?, version = version + 1, updated_at = ?
        WHERE id = ?
      `).run(institutionId, now(), orderId)
      addOrderStatusLog(
        orderId,
        order.status,
        order.status,
        'PLATFORM',
        adminId,
        '平台分配合作机构',
      )
      return mapOrder(getOrderRow.get(orderId))
    },

    listInstitutionOrders: (institutionId) => db.prepare(`
      SELECT o.*, i.name AS institution_name, c.name AS companion_name
      FROM orders o
      LEFT JOIN institutions i ON i.id = o.institution_id
      LEFT JOIN companions c ON c.id = o.companion_id
      WHERE o.institution_id = ?
      ORDER BY o.created_at DESC
    `).all(institutionId).map(mapOrder),

    getOrder: (id) => mapOrder(getOrderRow.get(id)),

    getInstitutionOrder: (id, institutionId) => {
      const order = mapOrder(getOrderRow.get(id))
      if (!order || order.institutionId !== institutionId) throw new Error('ORDER_NOT_FOUND')
      return {
        ...order,
        assignments: db.prepare(`
          SELECT
            id, companion_id AS companionId, assignment_mode AS assignmentMode,
            status, assigned_at AS assignedAt, responded_at AS respondedAt
          FROM order_assignments WHERE order_id = ? ORDER BY assigned_at DESC
        `).all(id),
        statusLogs: db.prepare(`
          SELECT
            from_status AS fromStatus, to_status AS toStatus, reason,
            operator_type AS operatorType, created_at AS createdAt
          FROM order_status_logs WHERE order_id = ? ORDER BY created_at
        `).all(id),
        executionRecords: getOrderExecution(id),
        exceptions: db.prepare(`
          SELECT
            id, node_id AS nodeId, category, urgency, description, status,
            review_note AS reviewNote, submitted_at AS submittedAt, reviewed_at AS reviewedAt
          FROM service_exceptions WHERE order_id = ? ORDER BY submitted_at DESC
        `).all(id),
        expenses: db.prepare(`
          SELECT
            id, category, amount, description, status, review_note AS reviewNote,
            submitted_at AS submittedAt, reviewed_at AS reviewedAt
          FROM order_expenses WHERE order_id = ? ORDER BY submitted_at DESC
        `).all(id),
      }
    },

    updateInstitutionOrder: (id, institutionId, input) => {
      const current = mapOrder(getOrderRow.get(id))
      if (!current || current.institutionId !== institutionId) throw new Error('ORDER_NOT_FOUND')
      if (current.status !== 'DRAFT') throw new Error('ORDER_NOT_DRAFT')
      const patientName = input.patientName?.trim() || current.patientName
      const patientPhone = input.patientPhone || current.patientPhone
      const serviceId = input.serviceId || current.serviceId
      if (!patientName) throw new Error('PATIENT_NAME_REQUIRED')
      if (!/^1[3-9]\d{9}$/.test(patientPhone)) throw new Error('PATIENT_PHONE_INVALID')
      const pricing = quote(serviceId, input.companionId || current.companionId || null)
      const service = getService(serviceId)
      const timestamp = now()
      db.prepare(`
        UPDATE orders SET
          patient_name = ?, patient_phone = ?, patient_age_group = ?,
          patient_snapshot_json = ?, service_id = ?, service_name_snapshot = ?,
          service_price_snapshot = ?, companion_id = ?, companion_price_snapshot = ?,
          total_amount = ?, hospital_name = ?, department_name = ?,
          booking_date = ?, booking_time = ?, dispatch_mode = ?,
          special_needs_json = ?, remark = ?, version = version + 1, updated_at = ?
        WHERE id = ? AND institution_id = ? AND status = 'DRAFT'
      `).run(
        encryptSensitive(patientName),
        encryptSensitive(patientPhone),
        input.patientAgeGroup?.trim() ?? current.patientAgeGroup,
        JSON.stringify({
          nameEncrypted: encryptSensitive(patientName),
          phoneEncrypted: encryptSensitive(patientPhone),
          ageGroup: input.patientAgeGroup?.trim() ?? current.patientAgeGroup,
        }),
        serviceId,
        service.name,
        pricing.servicePrice,
        input.companionId || current.companionId || null,
        pricing.companionPrice,
        pricing.totalAmount,
        input.hospitalName?.trim() || current.hospitalName,
        input.departmentName?.trim() || current.departmentName,
        input.bookingDate || current.bookingDate,
        input.bookingTime || current.bookingTime,
        input.dispatchMode || current.dispatchMode,
        JSON.stringify(input.specialNeeds ?? current.specialNeeds),
        input.remark?.trim() ?? current.remark,
        timestamp,
        id,
        institutionId,
      )
      return mapOrder(getOrderRow.get(id))
    },

    confirmInstitutionPayment: (id, institutionId, actorId) => {
      const current = mapOrder(getOrderRow.get(id))
      if (!current || current.institutionId !== institutionId) throw new Error('ORDER_NOT_FOUND')
      if (current.paymentStatus === 'PAID') return current
      db.prepare(`
        UPDATE orders SET payment_status = 'PAID', paid_amount = total_amount,
          version = version + 1, updated_at = ?
        WHERE id = ? AND institution_id = ?
      `).run(now(), id, institutionId)
      addOrderStatusLog(id, current.status, current.status, 'INSTITUTION', actorId, '机构确认客户已付款')
      return mapOrder(getOrderRow.get(id))
    },

    assignInstitutionOrder: (id, institutionId, companionId, actorId) => {
      const current = mapOrder(getOrderRow.get(id))
      if (!current || current.institutionId !== institutionId) throw new Error('ORDER_NOT_FOUND')
      return assignOrder(id, companionId, 'INSTITUTION', actorId, 'selected')
    },

    cancelInstitutionOrder: (id, institutionId, actorId, reason = '') => {
      const current = mapOrder(getOrderRow.get(id))
      if (!current || current.institutionId !== institutionId) throw new Error('ORDER_NOT_FOUND')
      const cancelled = transitionOrder(
        id,
        'CANCELLED',
        'INSTITUTION',
        actorId,
        reason || '机构取消订单',
        ['DRAFT', 'PUBLISHED', 'PENDING_ASSIGNMENT', 'PENDING_CONFIRMATION', 'PENDING_SERVICE'],
      )
      db.prepare(`
        UPDATE companion_tasks SET status = 'CANCELLED', version = version + 1, updated_at = ?
        WHERE order_id = ? AND status NOT IN ('COMPLETED', 'CANCELLED')
      `).run(now(), id)
      return cancelled
    },

    getInstitutionExecutionRecords: (institutionId, orderId) => {
      const order = mapOrder(getOrderRow.get(orderId))
      if (!order || order.institutionId !== institutionId) throw new Error('ORDER_NOT_FOUND')
      return getOrderExecution(orderId)
    },

    getInstitutionExceptions: (institutionId, orderId) => {
      const order = mapOrder(getOrderRow.get(orderId))
      if (!order || order.institutionId !== institutionId) throw new Error('ORDER_NOT_FOUND')
      return db.prepare(`
        SELECT
          id, node_id AS nodeId, category, urgency, description, status,
          submitted_at AS submittedAt, reviewed_at AS reviewedAt
        FROM service_exceptions WHERE order_id = ? ORDER BY submitted_at DESC
      `).all(orderId)
    },

    getInstitutionExpenses: (institutionId, orderId) => {
      const order = mapOrder(getOrderRow.get(orderId))
      if (!order || order.institutionId !== institutionId) throw new Error('ORDER_NOT_FOUND')
      return db.prepare(`
        SELECT
          id, category, amount, description, status,
          submitted_at AS submittedAt, reviewed_at AS reviewedAt
        FROM order_expenses WHERE order_id = ? ORDER BY submitted_at DESC
      `).all(orderId)
    },

    publishOrder: (id, institutionId) => {
      const current = mapOrder(getOrderRow.get(id))
      if (!current || current.institutionId !== institutionId) throw new Error('ORDER_NOT_FOUND')
      if (current.status !== 'DRAFT') throw new Error('ORDER_NOT_DRAFT')
      const status = current.dispatchMode === 'MARKET'
        ? 'PUBLISHED'
        : current.dispatchMode === 'DIRECT'
          ? 'PENDING_CONFIRMATION'
          : 'PENDING_ASSIGNMENT'
      const timestamp = now()
      db.exec('BEGIN IMMEDIATE')
      try {
        db.prepare(`
          UPDATE orders SET status = ?, version = version + 1, published_at = ?, updated_at = ?
          WHERE id = ? AND institution_id = ? AND status = 'DRAFT'
        `).run(status, timestamp, timestamp, id, institutionId)
        if (status === 'PENDING_CONFIRMATION') {
          createTaskForOrder(id, current.companionId, 'OFFERED', 'selected', timestamp)
        }
        db.exec('COMMIT')
      } catch (error) {
        db.exec('ROLLBACK')
        throw error
      }
      return mapOrder(getOrderRow.get(id))
    },

    withdrawOrder: (id, institutionId) => {
      const result = db.prepare(`
        UPDATE orders SET status = 'CANCELLED', version = version + 1, updated_at = ?
        WHERE id = ? AND institution_id = ? AND status IN ('DRAFT', 'PUBLISHED', 'PENDING_ASSIGNMENT', 'PENDING_CONFIRMATION')
      `).run(now(), id, institutionId)
      if (!result.changes) throw new Error('ORDER_CANNOT_WITHDRAW')
      return mapOrder(getOrderRow.get(id))
    },

    listMarketOrders: () => db.prepare(`
      SELECT o.*, i.name AS institution_name, c.name AS companion_name
      FROM orders o
      LEFT JOIN institutions i ON i.id = o.institution_id
      LEFT JOIN companions c ON c.id = o.companion_id
      WHERE o.status = 'PUBLISHED' AND o.dispatch_mode = 'MARKET'
      ORDER BY o.published_at ASC
    `).all().map((row) => {
      const order = mapOrder(row)
      return {
        id: order.id,
        orderNo: order.orderNo,
        institutionName: order.institutionName,
        patientAgeGroup: order.patientAgeGroup,
        serviceId: order.serviceId,
        serviceName: order.serviceName,
        hospitalName: order.hospitalName,
        departmentName: order.departmentName,
        bookingDate: order.bookingDate,
        bookingTime: order.bookingTime,
        specialNeeds: order.specialNeeds,
        companionFee: order.companionPrice,
        version: order.version,
      }
    }),

    claimMarketOrder: (id, companionId, expectedVersion) => {
      const companion = getCompanion(companionId)
      if (!companion || companion.status !== 'APPROVED') throw new Error('COMPANION_NOT_AVAILABLE')
      db.exec('BEGIN IMMEDIATE')
      try {
        const row = getOrderRow.get(id)
        if (!row || row.status !== 'PUBLISHED' || row.dispatch_mode !== 'MARKET') {
          throw new Error('ORDER_ALREADY_CLAIMED')
        }
        if (row.version !== expectedVersion) throw new Error('ORDER_VERSION_CONFLICT')
        if (!companion.hospitals.includes(row.hospital_name)) throw new Error('COMPANION_HOSPITAL_MISMATCH')
        const pricing = quote(row.service_id, companionId)
        const timestamp = now()
        const result = db.prepare(`
          UPDATE orders
          SET companion_id = ?, companion_price_snapshot = ?,
              total_amount = service_price_snapshot + ?, status = 'PENDING_SERVICE',
              version = version + 1, updated_at = ?
          WHERE id = ? AND status = 'PUBLISHED' AND version = ?
        `).run(companionId, pricing.companionPrice, pricing.companionPrice, timestamp, id, expectedVersion)
        if (!result.changes) throw new Error('ORDER_ALREADY_CLAIMED')
        createTaskForOrder(id, companionId, 'ACCEPTED', 'market', timestamp)
        db.exec('COMMIT')
      } catch (error) {
        db.exec('ROLLBACK')
        throw error
      }
      return mapOrder(getOrderRow.get(id))
    },

    acceptAssignedOrder: (orderId, companionId) => {
      const order = mapOrder(getOrderRow.get(orderId))
      if (!order || order.companionId !== companionId) throw new Error('ORDER_NOT_FOUND')
      if (order.status !== 'PENDING_CONFIRMATION') throw new Error('ORDER_STATUS_INVALID')
      const timestamp = now()
      db.prepare(`
        UPDATE order_assignments SET status = 'ACCEPTED', responded_at = ?
        WHERE order_id = ? AND companion_id = ? AND status = 'OFFERED'
      `).run(timestamp, orderId, companionId)
      db.prepare(`
        UPDATE companion_tasks SET status = 'ACCEPTED', version = version + 1, updated_at = ?
        WHERE order_id = ? AND companion_id = ?
      `).run(timestamp, orderId, companionId)
      return transitionOrder(
        orderId,
        'PENDING_SERVICE',
        'COMPANION',
        companionId,
        '陪诊师接受订单',
        ['PENDING_CONFIRMATION'],
      )
    },

    startOrderService: (orderId, companionId) => {
      const order = mapOrder(getOrderRow.get(orderId))
      if (!order || order.companionId !== companionId) throw new Error('ORDER_NOT_FOUND')
      const updated = transitionOrder(
        orderId,
        'IN_SERVICE',
        'COMPANION',
        companionId,
        '开始服务',
        ['PENDING_SERVICE'],
      )
      db.prepare(`
        UPDATE companion_tasks SET status = 'IN_SERVICE', version = version + 1, updated_at = ?
        WHERE order_id = ? AND companion_id = ?
      `).run(now(), orderId, companionId)
      initializeExecution(updated)
      return updated
    },

    recordExecutionNode: (orderId, companionId, nodeId, input) => {
      const order = mapOrder(getOrderRow.get(orderId))
      if (!order || order.companionId !== companionId) throw new Error('ORDER_NOT_FOUND')
      if (order.status !== 'IN_SERVICE') throw new Error('ORDER_STATUS_INVALID')
      const current = db.prepare(`
        SELECT r.*, n.required, n.node_index
        FROM service_execution_records r
        JOIN service_execution_nodes n ON n.id = r.node_id
        WHERE r.order_id = ? AND r.node_id = ?
      `).get(orderId, nodeId)
      if (!current || current.status !== 'ACTIVE') throw new Error('EXECUTION_NODE_NOT_ACTIVE')
      const status = input.status === 'FAILED' ? 'FAILED' : 'COMPLETED'
      const failureReason = String(input.failureReason || '').trim()
      if (status === 'FAILED' && !failureReason) throw new Error('FAILURE_REASON_REQUIRED')
      const timestamp = now()
      db.exec('BEGIN IMMEDIATE')
      try {
        db.prepare(`
          UPDATE service_execution_records SET
            status = ?, note = ?, failure_reason = ?, evidence_json = ?,
            completed_at = ?, failed_at = ?, updated_at = ?
          WHERE id = ? AND status = 'ACTIVE'
        `).run(
          status,
          String(input.note || '').trim(),
          failureReason,
          JSON.stringify(input.evidenceImages || []),
          status === 'COMPLETED' ? timestamp : null,
          status === 'FAILED' ? timestamp : null,
          timestamp,
          current.id,
        )
        if (status === 'COMPLETED' || !Boolean(current.required)) {
          const next = db.prepare(`
            SELECT r.id
            FROM service_execution_records r
            JOIN service_execution_nodes n ON n.id = r.node_id
            WHERE r.order_id = ? AND r.status = 'PENDING' AND n.node_index > ?
            ORDER BY n.node_index LIMIT 1
          `).get(orderId, current.node_index)
          if (next) {
            db.prepare(`
              UPDATE service_execution_records
              SET status = 'ACTIVE', started_at = ?, updated_at = ?
              WHERE id = ? AND status = 'PENDING'
            `).run(timestamp, timestamp, next.id)
          }
        }
        db.exec('COMMIT')
      } catch (error) {
        db.exec('ROLLBACK')
        throw error
      }
      return getOrderExecution(orderId)
    },

    createServiceException: (orderId, companionId, input) => {
      const order = mapOrder(getOrderRow.get(orderId))
      if (!order || order.companionId !== companionId) throw new Error('ORDER_NOT_FOUND')
      if (!String(input.description || '').trim()) throw new Error('EXCEPTION_DESCRIPTION_REQUIRED')
      if (input.nodeId) {
        const record = db.prepare(`
          SELECT 1 FROM service_execution_records
          WHERE order_id = ? AND node_id = ? AND companion_id = ?
        `).get(orderId, input.nodeId, companionId)
        if (!record) throw new Error('EXECUTION_NODE_NOT_FOUND')
      }
      const id = `exception-${randomUUID()}`
      const timestamp = now()
      db.prepare(`
        INSERT INTO service_exceptions (
          id, order_id, node_id, companion_id, category, urgency,
          description, evidence_json, status, submitted_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'OPEN', ?)
      `).run(
        id,
        orderId,
        input.nodeId || null,
        companionId,
        input.category || 'OTHER',
        input.urgency || 'MEDIUM',
        String(input.description).trim(),
        JSON.stringify(input.evidenceImages || []),
        timestamp,
      )
      return db.prepare('SELECT * FROM service_exceptions WHERE id = ?').get(id)
    },

    createOrderExpense: (orderId, companionId, input) => {
      const order = mapOrder(getOrderRow.get(orderId))
      if (!order || order.companionId !== companionId) throw new Error('ORDER_NOT_FOUND')
      if (!Number.isInteger(input.amount) || input.amount < 0) throw new Error('PRICE_INVALID')
      const id = `expense-${randomUUID()}`
      const timestamp = now()
      db.prepare(`
        INSERT INTO order_expenses (
          id, order_id, companion_id, category, amount, description,
          receipt_json, status, submitted_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'SUBMITTED', ?)
      `).run(
        id,
        orderId,
        companionId,
        input.category || 'OTHER',
        input.amount,
        String(input.description || '').trim(),
        JSON.stringify(input.receiptImages || []),
        timestamp,
      )
      return db.prepare('SELECT * FROM order_expenses WHERE id = ?').get(id)
    },

    finishOrderService: (orderId, companionId) => {
      const order = mapOrder(getOrderRow.get(orderId))
      if (!order || order.companionId !== companionId) throw new Error('ORDER_NOT_FOUND')
      const incomplete = db.prepare(`
        SELECT COUNT(*) AS count
        FROM service_execution_records r
        JOIN service_execution_nodes n ON n.id = r.node_id
        WHERE r.order_id = ? AND n.required = 1 AND r.status <> 'COMPLETED'
      `).get(orderId).count
      if (incomplete) throw new Error('REQUIRED_NODES_INCOMPLETE')
      const updated = transitionOrder(
        orderId,
        'PENDING_REVIEW',
        'COMPANION',
        companionId,
        '服务执行完成',
        ['IN_SERVICE'],
      )
      db.prepare(`
        UPDATE companion_tasks SET status = 'COMPLETED', version = version + 1, updated_at = ?
        WHERE order_id = ? AND companion_id = ?
      `).run(now(), orderId, companionId)
      return updated
    },

    adminAdjustOrder: (orderId, input, adminId) => {
      const order = mapOrder(getOrderRow.get(orderId))
      if (!order) throw new Error('ORDER_NOT_FOUND')
      if (input.companionId) return assignOrder(orderId, input.companionId, 'PLATFORM', adminId, 'platform')
      if (input.status) {
        return transitionOrder(
          orderId,
          input.status,
          'PLATFORM',
          adminId,
          input.reason || '平台人工调整',
        )
      }
      return order
    },

    listCompanionReviews: () => db.prepare(`
      SELECT
        r.id, r.companion_id AS companionId, c.name AS companionName,
        r.status, r.reason, r.submitted_at AS submittedAt, r.reviewed_at AS reviewedAt
      FROM companion_reviews r
      JOIN companions c ON c.id = r.companion_id
      ORDER BY r.submitted_at DESC
    `).all(),

    reviewCompanion: (reviewId, status, reason, adminId) => {
      if (!['APPROVED', 'REJECTED'].includes(status)) throw new Error('REVIEW_STATUS_INVALID')
      const review = db.prepare('SELECT * FROM companion_reviews WHERE id = ?').get(reviewId)
      if (!review) throw new Error('REVIEW_NOT_FOUND')
      const timestamp = now()
      db.exec('BEGIN IMMEDIATE')
      try {
        db.prepare(`
          UPDATE companion_reviews SET status = ?, reviewer_id = ?, reason = ?, reviewed_at = ?
          WHERE id = ?
        `).run(status, adminId, String(reason || '').trim(), timestamp, reviewId)
        db.prepare(`
          UPDATE companions SET status = ?, updated_at = ? WHERE id = ?
        `).run(status, timestamp, review.companion_id)
        db.exec('COMMIT')
      } catch (error) {
        db.exec('ROLLBACK')
        throw error
      }
      return db.prepare('SELECT * FROM companion_reviews WHERE id = ?').get(reviewId)
    },

    listServiceExceptions: () => db.prepare(`
      SELECT
        e.id, e.order_id AS orderId, e.node_id AS nodeId, e.companion_id AS companionId,
        e.category, e.urgency, e.description, e.status,
        e.review_note AS reviewNote, e.submitted_at AS submittedAt, e.reviewed_at AS reviewedAt
      FROM service_exceptions e ORDER BY e.submitted_at DESC
    `).all(),

    reviewServiceException: (id, status, note, adminId) => {
      if (!['RESOLVED', 'REJECTED'].includes(status)) throw new Error('REVIEW_STATUS_INVALID')
      const result = db.prepare(`
        UPDATE service_exceptions SET status = ?, reviewer_id = ?, review_note = ?, reviewed_at = ?
        WHERE id = ? AND status IN ('OPEN', 'REVIEWING')
      `).run(status, adminId, String(note || '').trim(), now(), id)
      if (!result.changes) throw new Error('EXCEPTION_NOT_FOUND')
      return db.prepare('SELECT * FROM service_exceptions WHERE id = ?').get(id)
    },

    listOrderExpenses: () => db.prepare(`
      SELECT
        id, order_id AS orderId, companion_id AS companionId, category,
        amount, description, status, review_note AS reviewNote,
        submitted_at AS submittedAt, reviewed_at AS reviewedAt
      FROM order_expenses ORDER BY submitted_at DESC
    `).all(),

    reviewOrderExpense: (id, status, note, adminId) => {
      if (!['APPROVED', 'REJECTED'].includes(status)) throw new Error('REVIEW_STATUS_INVALID')
      const result = db.prepare(`
        UPDATE order_expenses SET status = ?, reviewer_id = ?, review_note = ?, reviewed_at = ?
        WHERE id = ? AND status = 'SUBMITTED'
      `).run(status, adminId, String(note || '').trim(), now(), id)
      if (!result.changes) throw new Error('EXPENSE_NOT_FOUND')
      return db.prepare('SELECT * FROM order_expenses WHERE id = ?').get(id)
    },

    finalizeOrderReview: (orderId, adminId) => {
      const order = mapOrder(getOrderRow.get(orderId))
      if (!order) throw new Error('ORDER_NOT_FOUND')
      const openExceptions = db.prepare(`
        SELECT COUNT(*) AS count FROM service_exceptions
        WHERE order_id = ? AND status IN ('OPEN', 'REVIEWING')
      `).get(orderId).count
      const pendingExpenses = db.prepare(`
        SELECT COUNT(*) AS count FROM order_expenses
        WHERE order_id = ? AND status = 'SUBMITTED'
      `).get(orderId).count
      if (openExceptions || pendingExpenses) throw new Error('ORDER_REVIEW_INCOMPLETE')
      const completed = transitionOrder(
        orderId,
        'COMPLETED',
        'PLATFORM',
        adminId,
        '平台完成履约审核',
        ['PENDING_REVIEW'],
      )
      const companionAmount = completed.companionPrice
      db.prepare(`
        INSERT OR IGNORE INTO settlements (
          id, order_id, institution_id, companion_id, gross_amount,
          companion_amount, platform_amount, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING', ?)
      `).run(
        `settlement-${randomUUID()}`,
        orderId,
        completed.institutionId,
        completed.companionId,
        completed.totalAmount,
        companionAmount,
        completed.totalAmount - companionAmount,
        now(),
      )
      return {
        order: completed,
        settlement: db.prepare('SELECT * FROM settlements WHERE order_id = ?').get(orderId),
      }
    },

    listPermissions: () => ({
      roles: db.prepare('SELECT id, code, name, scope FROM roles ORDER BY scope, code').all(),
      permissions: db.prepare('SELECT id, code, name, scope FROM permissions ORDER BY scope, code').all(),
      rolePermissions: db.prepare(`
        SELECT r.code AS roleCode, p.code AS permissionCode
        FROM role_permissions rp
        JOIN roles r ON r.id = rp.role_id
        JOIN permissions p ON p.id = rp.permission_id
        ORDER BY r.code, p.code
      `).all(),
    }),
  }
}

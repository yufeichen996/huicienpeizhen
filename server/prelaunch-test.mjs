import assert from 'node:assert/strict'
import { existsSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { createRepository } from './db.mjs'

const databaseFile = resolve('server/.data/prelaunch-chain.sqlite')
if (existsSync(databaseFile)) rmSync(databaseFile, { force: true })

const institutionPassword = process.env.TEST_INSTITUTION_PASSWORD || 'HuicienTestOrg@2026'
const adminPassword = process.env.TEST_ADMIN_PASSWORD || 'HuicienTestAdmin@2026'
const repository = createRepository(databaseFile, {
  seedData: true,
  demoInstitutionPassword: institutionPassword,
  demoAdminPassword: adminPassword,
  dataEncryptionKey: process.env.DATA_ENCRYPTION_KEY,
  tokenTtlSeconds: 7200,
})

try {
  const schema = repository.schemaInfo()
  const requiredTables = [
    'users',
    'institutions',
    'institution_accounts',
    'companions',
    'companion_reviews',
    'services',
    'hospitals',
    'patients',
    'orders',
    'order_assignments',
    'order_status_logs',
    'service_execution_nodes',
    'service_execution_records',
    'service_exceptions',
    'order_expenses',
    'uploaded_files',
    'settlements',
    'operation_logs',
    'roles',
    'permissions',
    'role_permissions',
  ]
  assert.equal(schema.version, 1)
  assert.deepEqual(requiredTables.filter((table) => !schema.tables.includes(table)), [])

  assert.throws(
    () => repository.authenticatePlatform('huicien_admin', 'wrong-password', '127.0.0.1'),
    /LOGIN_INVALID/,
  )
  const adminLogin = repository.authenticatePlatform(
    'huicien_admin',
    adminPassword,
    '127.0.0.1',
  )
  const adminSession = repository.resolveSession(adminLogin.token)
  assert.equal(adminSession.actorType, 'PLATFORM')
  assert.ok(adminSession.permissions.includes('VIEW_ALL_ORDERS'))

  const institutionLogin = repository.authenticateInstitution(
    'kangyi_admin',
    institutionPassword,
    '127.0.0.1',
  )
  const institutionSession = repository.resolveSession(institutionLogin.token)
  assert.equal(institutionSession.institutionId, 'institution-demo')
  assert.ok(institutionSession.permissions.includes('MANAGE_ORDERS'))

  const otherInstitution = repository.createInstitution({
    name: '隔离验证机构',
    contactName: '隔离测试员',
    contactPhone: '13900001111',
    loginName: 'isolation_org',
    displayName: '隔离测试员',
    temporaryPassword: 'Isolation@2026',
    permissions: ['VIEW_DASHBOARD', 'PUBLISH_ORDER', 'MANAGE_ORDERS'],
    institutionStatus: 'APPROVED',
  })

  const user = repository.createClientUser({
    displayName: '预上线用户',
    phoneMasked: '138****5678',
  })
  const patient = repository.createPatient(user.id, {
    name: '测试就诊人',
    phone: '13812345678',
    identityNumber: '310101199001010000',
    ageGroup: '30–39 岁',
    relationship: '本人',
  })

  let order = repository.createClientOrder({
    userId: user.id,
    patientId: patient.id,
    patientName: '测试就诊人',
    patientPhone: '13812345678',
    patientAgeGroup: '30–39 岁',
    serviceId: 'full',
    hospitalName: '上海瑞金医院',
    departmentName: '心内科',
    bookingDate: '2026-08-18',
    bookingTime: '09:00',
    dispatchMode: 'PLATFORM',
    specialNeeds: ['轮椅协助'],
    remark: '预上线完整链路',
    publish: true,
    operatorType: 'CLIENT',
    operatorId: user.id,
  })
  assert.equal(order.source, 'CLIENT')
  assert.equal(Number.isInteger(order.totalAmount), true, '订单金额必须使用整数分')
  const atRestDatabase = new DatabaseSync(databaseFile, { readOnly: true })
  const atRestOrder = atRestDatabase.prepare(`
    SELECT patient_name, patient_phone, patient_snapshot_json FROM orders WHERE id = ?
  `).get(order.id)
  atRestDatabase.close()
  assert.match(atRestOrder.patient_name, /^v1\./)
  assert.match(atRestOrder.patient_phone, /^v1\./)
  const atRestSnapshot = JSON.parse(atRestOrder.patient_snapshot_json)
  assert.equal(atRestSnapshot.name, undefined)
  assert.equal(atRestSnapshot.phone, undefined)
  assert.match(atRestSnapshot.nameEncrypted, /^v1\./)
  assert.match(atRestSnapshot.phoneEncrypted, /^v1\./)

  order = repository.assignClientOrderToInstitution(
    order.id,
    institutionSession.institutionId,
    adminSession.actorId,
  )
  assert.equal(order.institutionId, institutionSession.institutionId)
  assert.throws(
    () => repository.getInstitutionOrder(order.id, otherInstitution.institutionId),
    /ORDER_NOT_FOUND/,
    '机构账号不得读取其他机构订单',
  )

  order = repository.confirmInstitutionPayment(
    order.id,
    institutionSession.institutionId,
    institutionSession.actorId,
  )
  assert.equal(order.paymentStatus, 'PAID')
  assert.equal(order.paidAmount, order.totalAmount)

  order = repository.assignInstitutionOrder(
    order.id,
    institutionSession.institutionId,
    'lin-xiaowen',
    institutionSession.actorId,
  )
  assert.equal(order.status, 'PENDING_CONFIRMATION')
  order = repository.acceptAssignedOrder(order.id, 'lin-xiaowen')
  assert.equal(order.status, 'PENDING_SERVICE')
  order = repository.startOrderService(order.id, 'lin-xiaowen')
  assert.equal(order.status, 'IN_SERVICE')

  let execution = repository.getInstitutionExecutionRecords(
    institutionSession.institutionId,
    order.id,
  )
  assert.equal(execution.length, 6)
  assert.equal(execution.filter((node) => node.status === 'ACTIVE').length, 1)

  let failedNode
  for (const node of execution) {
    if (!node.required) {
      failedNode = node
      execution = repository.recordExecutionNode(order.id, 'lin-xiaowen', node.nodeId, {
        status: 'FAILED',
        failureReason: '用户现场确认本次无需取药',
        evidenceImages: ['mock://node-evidence'],
      })
    } else {
      execution = repository.recordExecutionNode(order.id, 'lin-xiaowen', node.nodeId, {
        status: 'COMPLETED',
        note: '现场节点已完成',
        evidenceImages: [],
      })
    }
  }
  assert.ok(failedNode)
  assert.equal(execution.filter((node) => node.status === 'COMPLETED').length, 5)
  assert.equal(execution.filter((node) => node.status === 'FAILED').length, 1)

  const exception = repository.createServiceException(order.id, 'lin-xiaowen', {
    nodeId: failedNode.nodeId,
    category: 'SERVICE_CHANGE',
    urgency: 'LOW',
    description: '用户现场确认不需要执行可选取药节点。',
    evidenceImages: ['mock://exception-evidence'],
  })
  const expense = repository.createOrderExpense(order.id, 'lin-xiaowen', {
    category: 'REGISTRATION',
    amount: 2000,
    description: '现场挂号垫付',
    receiptImages: ['mock://receipt'],
  })

  order = repository.finishOrderService(order.id, 'lin-xiaowen')
  assert.equal(order.status, 'PENDING_REVIEW')
  repository.reviewServiceException(
    exception.id,
    'RESOLVED',
    '已核对，不影响履约结算',
    adminSession.actorId,
  )
  repository.reviewOrderExpense(
    expense.id,
    'APPROVED',
    '票据与金额一致',
    adminSession.actorId,
  )
  const finalized = repository.finalizeOrderReview(order.id, adminSession.actorId)
  assert.equal(finalized.order.status, 'COMPLETED')
  assert.equal(finalized.settlement.status, 'PENDING')
  assert.equal(
    finalized.settlement.gross_amount,
    finalized.settlement.companion_amount + finalized.settlement.platform_amount,
  )

  repository.recordOperation({
    requestId: 'prelaunch-chain',
    actorType: adminSession.actorType,
    actorId: adminSession.actorId,
    action: 'PRELAUNCH_CHAIN_VERIFY',
    resourceType: 'ORDER',
    resourceId: order.id,
    ipAddress: '127.0.0.1',
    metadata: { patientPhone: 'must-not-be-logged', result: 'passed' },
  })
  const operationLog = repository.listOperationLogs(1)[0]
  assert.equal(operationLog.metadata.patientPhone, undefined)
  assert.equal(operationLog.metadata.result, 'passed')

  repository.revokeSession(institutionLogin.token)
  assert.equal(repository.resolveSession(institutionLogin.token), null)

  console.log(JSON.stringify({
    databaseFile,
    schemaVersion: schema.version,
    orderId: order.id,
    finalStatus: finalized.order.status,
    settlementStatus: finalized.settlement.status,
    executionNodes: execution.length,
    failedNodes: execution.filter((node) => node.status === 'FAILED').length,
    institutionIsolation: 'passed',
    authSession: 'passed',
    auditRedaction: 'passed',
    orderPatientEncryption: 'passed',
  }, null, 2))
} finally {
  repository.checkpoint()
  repository.close()
}

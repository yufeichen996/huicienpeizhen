import assert from 'node:assert/strict'
import { createRepository } from './db.mjs'

const repository = createRepository(':memory:')

try {
  assert.equal(repository.health().database, 'ok')
  assert.equal(repository.listServices().length, 6)
  assert.equal(repository.listCompanions().length, 4)
  assert.equal(repository.listCompanions('report').length, 4, '服务类型不得限制可选陪诊师')
  const unrestrictedPrice = repository.setCompanionPrice('wang-meilin', 'medicine', 5200)
  assert.equal(unrestrictedPrice.companionPrice, 5200, '任意陪诊师均可配置任意服务价格')
  const demoAccess = repository.getInstitutionAccess('institution-demo', 'institution-demo-operator')
  assert.deepEqual(demoAccess.permissions, ['VIEW_DASHBOARD', 'PUBLISH_ORDER', 'MANAGE_ORDERS'])
  assert.equal(Object.hasOwn(demoAccess, 'passwordHash'), false, '机构账号接口不得返回密码摘要')
  assert.equal(Object.hasOwn(demoAccess, 'passwordSalt'), false, '机构账号接口不得返回密码盐')
  repository.assertInstitutionPermission(
    'institution-demo',
    'institution-demo-operator',
    'PUBLISH_ORDER',
  )

  const institution = repository.createInstitution({
    name: '测试合作机构',
    contactName: '李老师',
    contactPhone: '13900001111',
    loginName: 'test_partner',
    displayName: '李老师',
    temporaryPassword: 'Partner@2026',
    permissions: ['VIEW_DASHBOARD', 'PUBLISH_ORDER'],
    institutionStatus: 'APPROVED',
  })
  assert.equal(institution.accountStatus, 'ENABLED')
  assert.deepEqual(institution.permissions, ['VIEW_DASHBOARD', 'PUBLISH_ORDER'])
  assert.equal(repository.listInstitutions().length, 2)
  assert.throws(
    () => repository.assertInstitutionPermission(
      institution.institutionId,
      institution.accountId,
      'MANAGE_ORDERS',
    ),
    /FORBIDDEN/,
  )
  const restricted = repository.updateInstitutionAccess(institution.institutionId, {
    permissions: ['VIEW_DASHBOARD'],
    accountStatus: 'ENABLED',
    institutionStatus: 'APPROVED',
  })
  assert.deepEqual(restricted.permissions, ['VIEW_DASHBOARD'])
  assert.throws(
    () => repository.assertInstitutionPermission(
      institution.institutionId,
      institution.accountId,
      'PUBLISH_ORDER',
    ),
    /FORBIDDEN/,
  )
  assert.equal(repository.adminDashboard().metrics.institutions, 2)

  const fullBefore = repository.listServices().find((service) => service.id === 'full')
  const fullAfter = repository.updateServicePricing('full', {
    servicePrice: 20800,
    defaultCompanionPrice: 14800,
    enabled: true,
  })
  assert.equal(fullAfter.servicePrice, 20800)
  assert.equal(fullAfter.defaultCompanionPrice, 14800)

  let quote = repository.quote('full', 'lin-xiaowen')
  assert.equal(quote.servicePrice, 20800)
  assert.equal(quote.companionPrice, 14800)
  assert.equal(quote.priceSource, 'SERVICE_DEFAULT')

  quote = repository.setCompanionPrice('lin-xiaowen', 'full', 16600)
  assert.equal(quote.companionPrice, 16600)
  assert.equal(quote.totalAmount, 37400)
  assert.equal(quote.priceSource, 'COMPANION_OVERRIDE')

  const order = repository.createInstitutionOrder({
    institutionId: 'institution-demo',
    patientName: '测试客户',
    patientPhone: '13812345678',
    patientAgeGroup: '60–69 岁',
    serviceId: 'full',
    hospitalName: '上海瑞金医院',
    departmentName: '心内科',
    bookingDate: '2026-08-08',
    bookingTime: '09:00',
    dispatchMode: 'MARKET',
    specialNeeds: ['轮椅协助'],
    remark: '测试订单',
    publish: true,
  })
  assert.equal(order.source, 'INSTITUTION')
  assert.equal(order.status, 'PUBLISHED')
  assert.equal(order.servicePrice, 20800)
  assert.equal(order.companionPrice, 14800)
  assert.equal(order.totalAmount, 35600)

  repository.updateServicePricing('full', {
    servicePrice: 22800,
    defaultCompanionPrice: 15800,
  })
  const storedOrder = repository.getOrder(order.id)
  assert.equal(storedOrder.servicePrice, 20800, '历史订单必须保留服务价格快照')
  assert.equal(storedOrder.companionPrice, 14800, '历史订单必须保留创建时陪诊师默认价')

  const publicOrders = repository.listMarketOrders()
  assert.equal(publicOrders.length, 1)
  assert.equal(JSON.stringify(publicOrders).includes('测试客户'), false, '抢单大厅不得返回客户姓名')
  assert.equal(JSON.stringify(publicOrders).includes('13812345678'), false, '抢单大厅不得返回客户手机号')

  const claimed = repository.claimMarketOrder(order.id, 'lin-xiaowen', order.version)
  assert.equal(claimed.status, 'PENDING_SERVICE')
  assert.equal(claimed.companionId, 'lin-xiaowen')
  assert.equal(claimed.companionPrice, 16600, '抢单时应写入陪诊师个人价格快照')
  assert.equal(claimed.totalAmount, 37400)
  assert.throws(
    () => repository.claimMarketOrder(order.id, 'chen-jianguo', order.version),
    /ORDER_ALREADY_CLAIMED/,
    '同一订单不得被第二位陪诊师重复抢取',
  )

  const draft = repository.createInstitutionOrder({
    institutionId: 'institution-demo',
    patientName: '草稿客户',
    patientPhone: '13912345678',
    serviceId: 'exam',
    hospitalName: '华山医院',
    departmentName: '神经内科',
    bookingDate: '2026-08-09',
    bookingTime: '13:30',
    dispatchMode: 'DIRECT',
    companionId: 'chen-jianguo',
    publish: false,
  })
  assert.equal(draft.status, 'DRAFT')
  assert.equal(repository.publishOrder(draft.id, 'institution-demo').status, 'PENDING_CONFIRMATION')

  const dashboard = repository.dashboard('institution-demo')
  assert.equal(dashboard.metrics.total, 2)
  assert.equal(dashboard.metrics.pendingService, 2)
  const adminOrders = repository.adminInstitutionOrders()
  assert.equal(adminOrders.summary.total, 2)
  assert.equal(adminOrders.summary.inService, 1)
  assert.equal(adminOrders.summary.dispatching, 1)
  assert.equal(adminOrders.orders.length, 2)
  assert.equal(adminOrders.orders.every((item) => item.institutionName === '康颐养老服务中心'), true)
  assert.equal(
    adminOrders.institutions.find((item) => item.institutionId === 'institution-demo').total,
    2,
  )
  assert.throws(
    () => repository.createInstitutionOrder({
      institutionId: 'institution-demo',
      patientName: '',
      patientPhone: '123',
      serviceId: 'full',
    }),
    /PATIENT_NAME_REQUIRED/,
  )

  const unrestrictedOrder = repository.createInstitutionOrder({
    institutionId: 'institution-demo',
    patientName: '不限类型客户',
    patientPhone: '13712345678',
    patientAgeGroup: '其他',
    serviceId: 'medicine',
    hospitalName: '上海儿童医学中心',
    departmentName: '门诊药房',
    bookingDate: '2026-08-10',
    bookingTime: '15:00',
    dispatchMode: 'MARKET',
    publish: true,
  })
  const unrestrictedClaim = repository.claimMarketOrder(
    unrestrictedOrder.id,
    'wang-meilin',
    unrestrictedOrder.version,
  )
  assert.equal(unrestrictedClaim.status, 'PENDING_SERVICE')
  assert.equal(unrestrictedClaim.companionId, 'wang-meilin', '陪诊师应可抢未认证服务类型的订单')

  console.log('Validated unified orders, institution monitoring, pricing, accounts, permissions and atomic claims.')
} finally {
  repository.close()
}

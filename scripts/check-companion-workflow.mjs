import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import ts from 'typescript'

const memory = new Map()
globalThis.wx = {
  getStorageSync: (key) => memory.get(key),
  setStorageSync: (key, value) => memory.set(key, structuredClone(value)),
  removeStorageSync: (key) => memory.delete(key),
}

const cache = new Map()
function loadTs(filename) {
  const absolute = path.resolve(filename)
  if (cache.has(absolute)) return cache.get(absolute).exports
  const module = { exports: {} }
  cache.set(absolute, module)
  const source = fs.readFileSync(absolute, 'utf8')
  const code = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText
  const localRequire = (request) => {
    if (!request.startsWith('.')) return {}
    return loadTs(`${path.resolve(path.dirname(absolute), request)}.ts`)
  }
  const wrapper = vm.runInThisContext(
    `(function(require,module,exports){${code}\n})`,
    { filename: absolute },
  )
  wrapper(localRequire, module, module.exports)
  return module.exports
}

const { mockCompanionApi } = loadTs('companion-miniprogram/mocks/companion-api.ts')
const { clearSession, saveSession } = loadTs('companion-miniprogram/utils/auth.ts')

const session = mockCompanionApi.login()
assert.equal(session.profile.accountStatus, 'APPROVED')
saveSession(session)

const initialTasks = mockCompanionApi.getTasks()
assert.equal(initialTasks.length, 2, 'Mock 应同时提供当前任务和历史任务')
const offered = initialTasks.find((task) => task.status === 'OFFERED')
assert.ok(offered, '应存在一条待确认任务')
assert.equal(offered.patientDisplayName, undefined, '接单前不得返回就诊人姓名')
assert.equal(offered.meetingPoint, undefined, '接单前不得返回集合地点')

const initialGrabOrders = mockCompanionApi.getGrabOrders()
assert.equal(initialGrabOrders.length, 3, '应返回服务医院范围内的全部机构抢单任务')
assert.equal(
  initialGrabOrders.some((order) => !session.profile.serviceSkills.includes(order.serviceName)),
  true,
  '服务技能标签不得限制抢单大厅的服务类型',
)
assert.equal(mockCompanionApi.getWorkbench().openGrabOrderCount, 3)
assert.equal(
  JSON.stringify(initialGrabOrders).includes('王先生'),
  false,
  '抢单前公开任务不得返回客户姓名',
)
assert.equal(
  JSON.stringify(initialGrabOrders).includes('136****4182'),
  false,
  '抢单前公开任务不得返回客户联系方式',
)
const concurrentClaim = mockCompanionApi.claimGrabOrder(initialGrabOrders[0].id, {
  expectedVersion: initialGrabOrders[0].version,
  clientActionId: 'claim-with-active-task',
})
assert.equal(concurrentClaim.task.status, 'ACCEPTED', '已有待确认任务时仍应允许继续抢单')
assert.equal(
  mockCompanionApi.getTasks().filter((item) => !['COMPLETED', 'REJECTED', 'EXPIRED', 'CANCELLED'].includes(item.status)).length,
  2,
  '同时进行中的任务数量不应被限制',
)
assert.equal(mockCompanionApi.getWorkbench().openGrabOrderCount, 2)

let messages = mockCompanionApi.getMessages()
assert.equal(messages.filter((message) => !message.read).length, 3, '抢单后应增加一条未读任务消息')
messages = mockCompanionApi.markMessageRead(messages[0].id)
assert.equal(messages[0].read, true, '单条消息应可标记为已读')
messages = mockCompanionApi.markAllMessagesRead()
assert.equal(messages.every((message) => message.read), true, '消息应支持全部已读')

let schedule = mockCompanionApi.getSchedule()
const bookedDay = schedule.days.find((day) => day.hasTask)
assert.ok(bookedDay, '已有任务必须占用对应排班日期')
assert.throws(
  () => mockCompanionApi.setScheduleDay(bookedDay.date, false),
  /已有任务/,
  '已有任务日期不得关闭',
)
const editableDay = schedule.days.find((day) => !day.hasTask)
schedule = mockCompanionApi.setScheduleDay(editableDay.date, !editableDay.available)
assert.equal(
  schedule.days.find((day) => day.date === editableDay.date).available,
  !editableDay.available,
  '无任务日期应允许调整排班',
)

const settlements = mockCompanionApi.getSettlements()
assert.equal(settlements.records.length, 2)
for (const record of settlements.records) {
  assert.equal(
    record.serviceAmount + record.adjustmentAmount,
    record.payableAmount,
    `结算金额应以分为单位正确汇总: ${record.id}`,
  )
}

assert.equal(mockCompanionApi.getAllExceptions().length, 1, '异常中心应包含一条已解决历史工单')
let training = mockCompanionApi.getTraining()
assert.equal(training.requiredTotal, 3)
assert.equal(training.requiredCompleted, 1)
training = mockCompanionApi.updateTrainingProgress('course-privacy', 100)
assert.equal(training.requiredCompleted, 2, '培训进度应持久化并重新计算')
const quality = mockCompanionApi.getQuality()
assert.equal(quality.rating, 4.98)
assert.equal(quality.feedback.every((item) => item.comment.length > 0), true)

assert.throws(
  () => mockCompanionApi.createExpense(offered.id, {
    category: 'REGISTRATION',
    amount: 2000,
    description: '挂号费用',
    receiptPaths: ['mock://receipt'],
    paidAt: new Date().toISOString(),
    clientActionId: 'expense-too-early',
  }),
  /当前任务状态不能记录费用/,
)

let task = mockCompanionApi.acceptTask(offered.id, {
  expectedVersion: offered.version,
  clientActionId: 'test-accept',
})
assert.equal(task.status, 'ACCEPTED')
assert.equal(task.patientDisplayName, '张先生', '接单后才可返回脱敏就诊人信息')
assert.equal(mockCompanionApi.login().profile.availability, 'AVAILABLE', '接单后仍应保持可继续接单')

for (const nextStatus of ['DEPARTING', 'ARRIVED', 'MET_PATIENT', 'IN_SERVICE']) {
  task = mockCompanionApi.transitionTask(task.id, nextStatus, {
    expectedVersion: task.version,
    clientActionId: `test-${nextStatus}`,
  })
}
assert.equal(task.status, 'IN_SERVICE')
assert.ok(task.serviceStartedAt, '开始服务时必须记录服务端时间')

let detail = mockCompanionApi.getTaskDetail(task.id)
assert.equal(detail.milestones.length, 6)
assert.throws(
  () => mockCompanionApi.createExpense(task.id, {
    category: 'REGISTRATION',
    amount: 2000,
    description: '挂号费用',
    receiptPaths: [],
    paidAt: new Date().toISOString(),
    clientActionId: 'expense-no-receipt',
  }),
  /请上传费用票据/,
)
const expense = mockCompanionApi.createExpense(task.id, {
  category: 'REGISTRATION',
  amount: 2000,
  description: '代用户垫付现场挂号费用',
  receiptPaths: ['mock://receipt'],
  paidAt: new Date().toISOString(),
  clientActionId: 'expense-valid',
})
assert.equal(expense.amount, 2000, '费用必须以分为单位保存')
assert.equal(mockCompanionApi.getTaskDetail(task.id).expenses.length, 1)
assert.throws(
  () => mockCompanionApi.transitionTask(task.id, 'PENDING_SUMMARY', {
    expectedVersion: task.version,
    clientActionId: 'test-too-early',
  }),
  /请先处理所有必需服务节点/,
)
assert.throws(
  () => mockCompanionApi.updateMilestone(task.id, detail.milestones[0].id, {
    status: 'SKIPPED',
    note: '',
    clientActionId: 'test-skip-no-reason',
  }),
  /必须填写原因/,
)

assert.throws(
  () => mockCompanionApi.updateMilestone(task.id, detail.milestones[1].id, {
    status: 'COMPLETED',
    note: '',
    clientActionId: 'test-out-of-order',
  }),
  /只能记录当前进行中的服务节点/,
  '未开始节点不能提前操作',
)

for (const milestone of detail.milestones) {
  if (!milestone.required) {
    mockCompanionApi.updateMilestone(task.id, milestone.id, {
      status: 'FAILED',
      note: '',
      failureReason: '用户现场确认本次不需要取药',
      evidenceImages: ['mock://milestone-evidence'],
      clientActionId: `test-milestone-${milestone.code}`,
    })
    continue
  }
  mockCompanionApi.updateMilestone(task.id, milestone.id, {
    status: 'COMPLETED',
    note: '已现场确认',
    clientActionId: `test-milestone-${milestone.code}`,
  })
}

detail = mockCompanionApi.getTaskDetail(task.id)
const failedMilestone = detail.milestones.find((item) => item.status === 'FAILED')
assert.ok(failedMilestone, '非必需节点无法完成后应保存为 FAILED')
assert.equal(failedMilestone?.failureReason, '用户现场确认本次不需要取药')
assert.deepEqual(failedMilestone?.evidenceImages, ['mock://milestone-evidence'])
assert.ok(failedMilestone?.failedAt, '无法完成节点必须保存提交时间')
assert.throws(
  () => mockCompanionApi.updateMilestone(task.id, failedMilestone.id, {
    status: 'FAILED',
    note: '',
    failureReason: '重复提交',
    evidenceImages: [],
    clientActionId: 'test-repeat-failure',
  }),
  /已经记录/,
  '已失败节点不能重复提交异常',
)
assert.throws(
  () => mockCompanionApi.updateMilestone(task.id, detail.milestones[0].id, {
    status: 'COMPLETED',
    note: '',
    clientActionId: 'test-repeat-complete',
  }),
  /已经记录/,
  '已完成节点不能重复完成',
)
assert.ok(
  detail.milestones.filter((item) => item.required).every((item) => item.status === 'COMPLETED'),
  '所有必需节点完成后才允许结束服务',
)

task = mockCompanionApi.transitionTask(task.id, 'PENDING_SUMMARY', {
  expectedVersion: task.version,
  clientActionId: 'test-finish-service',
})
assert.equal(task.status, 'PENDING_SUMMARY')
assert.ok(task.serviceEndedAt, '服务流程结束时必须记录时间')

const exception = mockCompanionApi.createException(task.id, {
  category: 'SERVICE_OVERTIME',
  urgency: 'MEDIUM',
  description: '现场候诊时间较长，服务时间预计延长一小时。',
  evidencePaths: [],
  occurredAt: new Date().toISOString(),
  clientActionId: 'test-exception',
})
assert.equal(exception.status, 'OPEN')
detail = mockCompanionApi.getTaskDetail(task.id)
assert.equal(detail.task.activeExceptionCount, 1)
assert.equal(detail.exceptions.length, 1)
assert.equal(mockCompanionApi.getAllExceptions().length, 2, '异常中心应聚合当前和历史工单')

const result = mockCompanionApi.submitSummary(task.id, {
  expectedVersion: detail.task.version,
  actualStartedAt: detail.task.serviceStartedAt,
  actualEndedAt: detail.task.serviceEndedAt,
  resultSummary: '已完成就诊陪同并向用户交付相关检查资料。',
  unfinishedItems: '',
  hasException: true,
  clientActionId: 'test-summary',
})
assert.equal(result.task.status, 'COMPLETED')
assert.ok(result.task.completedAt)
assert.equal(mockCompanionApi.getTaskDetail(task.id).summary.resultSummary, result.summary.resultSummary)

const availableGrabOrder = mockCompanionApi.getGrabOrders()[0]
assert.throws(
  () => mockCompanionApi.claimGrabOrder(availableGrabOrder.id, {
    expectedVersion: availableGrabOrder.version + 1,
    clientActionId: 'claim-stale-version',
  }),
  /任务状态已更新/,
  '抢单必须使用版本号防止并发覆盖',
)
const claimed = mockCompanionApi.claimGrabOrder(availableGrabOrder.id, {
  expectedVersion: availableGrabOrder.version,
  clientActionId: 'claim-success',
})
assert.equal(claimed.order.status, 'CLAIMED')
assert.equal(claimed.task.status, 'ACCEPTED')
assert.equal(claimed.task.assignmentMode, 'market')
assert.equal(claimed.task.companionId, session.profile.id)
assert.ok(claimed.task.patientDisplayName, '抢单成功后才解锁脱敏客户资料')
assert.equal(
  mockCompanionApi.getGrabOrders().some((order) => order.id === availableGrabOrder.id),
  false,
  '已抢任务必须立即从大厅移除',
)
assert.ok(mockCompanionApi.getTaskDetail(claimed.task.id).task.meetingPoint)
assert.equal(
  mockCompanionApi.getTasks().filter((item) => item.assignmentMode === 'market').length,
  2,
  '应允许连续抢取多张不同服务类型的订单',
)
assert.throws(
  () => mockCompanionApi.claimGrabOrder(availableGrabOrder.id, {
    expectedVersion: availableGrabOrder.version,
    clientActionId: 'claim-duplicate',
  }),
  /已被其他陪诊师抢走/,
  '重复抢单不得生成第二个任务',
)

clearSession()
assert.equal(memory.has('huicien-companion:session'), false, '退出后必须清理会话')
assert.equal(memory.has('huicien-companion:mock:task'), false, '退出后必须清理敏感任务缓存')
assert.equal(memory.has('huicien-companion:mock:tasks'), false, '退出后必须清理多任务缓存')
assert.equal(memory.has('huicien-companion:mock:exceptions'), false, '退出后必须清理异常缓存')
assert.equal(memory.has('huicien-companion:mock:messages'), false, '退出后必须清理消息缓存')
assert.equal(memory.has('huicien-companion:mock:schedule'), false, '退出后必须清理排班缓存')
assert.equal(memory.has('huicien-companion:mock:expenses'), false, '退出后必须清理费用凭证缓存')
assert.equal(memory.has('huicien-companion:mock:training-progress'), false, '退出后必须清理培训进度缓存')
assert.equal(memory.has('huicien-companion:mock:grab-orders'), false, '退出后必须清理抢单大厅 Mock 状态')

const registrationInput = {
  name: '周宁',
  phone: '13812345678',
  gender: 'female',
  identityNumber: '310101199001011234',
  workingYears: 4,
  introduction: '护理相关从业四年，熟悉三甲医院就诊流程，擅长老人检查陪同和信息记录。',
  skillServiceIds: ['full', 'exam'],
  serviceSkillNames: ['全程陪诊', '检查陪同'],
  serviceHospitalIds: ['ruijin', 'huashan'],
  serviceHospitalNames: ['上海瑞金医院', '华山医院'],
  serviceDistricts: ['黄浦区', '静安区'],
  identityImagePaths: ['mock://identity-front', 'mock://identity-back'],
  certificatePaths: ['mock://certificate'],
}
const registration = mockCompanionApi.register(registrationInput)
assert.equal(registration.application.status, 'PENDING_REVIEW')
assert.equal(registration.session.profile.accountStatus, 'PENDING_REVIEW')
assert.equal(registration.application.phoneMasked, '138****5678')
assert.equal(registration.application.identityImageCount, 2)
assert.equal(mockCompanionApi.getApprovedPublicProfile(), null, '审核通过前不得生成客户端公开档案')
assert.equal(
  JSON.stringify([...memory.entries()]).includes(registrationInput.identityNumber),
  false,
  '本地 Mock Store 不得保存完整身份证号',
)
assert.throws(
  () => mockCompanionApi.reviewApplication('REJECTED'),
  /驳回时必须填写原因/,
)
const review = mockCompanionApi.reviewApplication('APPROVED')
assert.equal(review.application.status, 'APPROVED')
assert.equal(review.session.profile.accountStatus, 'APPROVED')
assert.equal(review.publicProfile.isRecommended, true)
assert.equal(mockCompanionApi.getApprovedPublicProfile().name, '周宁')
assert.equal(mockCompanionApi.getWorkbench().nextTask, null, '新审核账号不得继承演示陪诊师任务')
assert.deepEqual(mockCompanionApi.getTasks(), [], '新审核账号任务列表应为空')
assert.equal(mockCompanionApi.getSettlements().records.length, 0, '新审核账号不得继承演示结算记录')
assert.equal(mockCompanionApi.getQuality().serviceCount, 0, '新审核账号质量数据应从零开始')
assert.throws(
  () => mockCompanionApi.getTaskDetail('task-demo-001'),
  /无权查看该任务/,
  '新审核账号不得访问其他陪诊师任务详情',
)

const {
  approvedRegisteredCompanions,
  companionReviewRegistry,
  mapApprovedPublicProfileToCompanion,
} = loadTs('miniprogram/mocks/approved-companion-registry.ts')
const mappedCompanion = mapApprovedPublicProfileToCompanion(review.publicProfile)
assert.equal(mappedCompanion.id, review.publicProfile.companionId)
assert.equal(mappedCompanion.name, '周宁')
assert.equal(mappedCompanion.verified, true)
assert.equal(mappedCompanion.isRecommended, true)
assert.equal(mappedCompanion.price, 16800, '客户端价格必须由服务配置映射，不由申请人填写')
assert.equal(approvedRegisteredCompanions.length, 1, '客户端注册表只能消费已审核公开档案')
assert.equal(
  companionReviewRegistry.filter((item) => item.status !== 'APPROVED').length,
  2,
  '待审核和驳回记录必须保留但不得公开',
)

console.log('Validated registration review, institution grab-order concurrency/privacy, unlimited multi-task claiming, workflow, expenses, training and quality.')

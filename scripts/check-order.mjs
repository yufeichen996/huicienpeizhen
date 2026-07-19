import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const memory = new Map()
const storage = { get: (key, fallback) => memory.has(key) ? memory.get(key) : fallback, set: (key, value) => memory.set(key, structuredClone(value)), remove: (key) => memory.delete(key) }
function loadTs(path, dependencies = {}) { const source = fs.readFileSync(path, 'utf8'); const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText; const module = { exports: {} }; vm.runInThisContext(`(function(require,module,exports){${code}\n})`, { filename: path })((id) => dependencies[id] || {}, module, module.exports); return module.exports }

const status = loadTs('miniprogram/utils/order-status.ts')
const mocks = loadTs('miniprogram/mocks/orders.ts', { '../utils/order-status': status })
const StorageKeys = { orderSequence: 'booking:sequence', orders: 'booking:orders', ordersSeeded: 'booking:orders:seeded' }
const number = loadTs('miniprogram/utils/order-number.ts', { './storage': { storage }, './storage-keys': { StorageKeys } })
const companions = [{ id: 'lin-xiaowen', name: '林晓雯', avatar: '/avatar.svg', rating: 4.98, serviceCount: 541 }]
const storeDeps = { '../mocks/companions': { companions }, '../mocks/orders': mocks, '../utils/order-number': number, '../utils/storage': { storage }, '../utils/storage-keys': { StorageKeys }, '../utils/order-status': status }
const storeModule = loadTs('miniprogram/stores/order.ts', storeDeps)
const orderStore = storeModule.orderStore
orderStore.hydrate()
assert.equal(orderStore.list().length, 7, '首次空 Storage 应初始化七种 Mock 订单')
orderStore.hydrate()
assert.equal(orderStore.list().length, 7, 'Mock 不得重复初始化')

const bookingCalls = []
const bookingStore = { clear: () => bookingCalls.push(['clear']), selectService: (value) => bookingCalls.push(['service', value.id]), update: (value) => bookingCalls.push(['update', value]) }
const bookingServices = [{ id: 'full', name: '全程陪诊', price: 19800, duration: 240 }]
const service = loadTs('miniprogram/services/order.ts', { '../mocks/booking': { bookingServices }, '../stores/booking': { bookingStore }, '../stores/order': { orderStore } }).orderService
const draft = { serviceId: 'full', serviceName: '全程陪诊', servicePrice: 19800, hospitalId: 'ruijin', hospitalName: '上海瑞金医院', departmentName: '心内科', bookingDate: '2026-07-20', bookingTime: '09:00', duration: 240, companionMode: 'platform', patientId: 'p1', patientName: '张建国', patientPhone: '138****2046', remark: '', specialNeeds: [], serviceFee: 19800, companionFee: 0, discountAmount: 1000, totalAmount: 18800 }
const created = service.createFromBookingDraft(draft)
const createdAgain = service.createFromBookingDraft(draft)
assert.match(created.orderNo, /^SH\d{8}\d{3}$/)
assert.notEqual(created.orderNo, createdAgain.orderNo, '连续创建的订单号必须唯一')
assert.equal(service.listOrders()[0].id, createdAgain.id, '新预约订单必须插入列表顶部')
assert.equal(created.totalAmount, 18800, '订单金额必须与预约确认金额一致')
assert.equal(created.status, 'PENDING_ASSIGNMENT')
assert.equal(status.matchesOrderFilter('PENDING_PAYMENT', 'PENDING'), true)
assert.equal(status.matchesOrderFilter('PENDING_SERVICE', 'UPCOMING'), true)
assert.equal(status.matchesOrderFilter('IN_SERVICE', 'ACTIVE'), true)
assert.equal(status.matchesOrderFilter('COMPLETED', 'FINISHED'), true)
assert.equal(status.matchesOrderFilter('PENDING_SERVICE', 'FINISHED'), false)
assert.equal(status.matchesOrderFilter('PENDING_PAYMENT', 'PAYMENT'), true)
assert.equal(status.matchesOrderFilter('PENDING_ASSIGNMENT', 'SERVICE'), true)
assert.equal(status.matchesOrderFilter('PENDING_SERVICE', 'SERVICE'), true)
assert.equal(status.matchesOrderFilter('PENDING_REVIEW', 'REVIEW'), true)

const pendingPayment = service.listOrders().find((item) => item.status === 'PENDING_PAYMENT')
assert.equal(service.pay(pendingPayment.id).status, 'PENDING_ASSIGNMENT')
assert.equal(service.pay(pendingPayment.id), undefined, '已支付订单不得重复支付')
const upcoming = service.listOrders().find((item) => item.status === 'PENDING_SERVICE')
assert.equal(service.cancel(upcoming.id, '就诊计划有变').status, 'CANCELLED')
assert.equal(service.getOrder(upcoming.id).cancelReason, '就诊计划有变')
const reviewable = service.listOrders().find((item) => item.status === 'PENDING_REVIEW')
const review = { overall: 5, attitude: 5, professional: 5, punctuality: 5, tags: ['服务专业'], content: '很好', anonymous: false }
assert.equal(service.submitReview(reviewable.id, review).status, 'COMPLETED')
assert.equal(service.submitReview(reviewable.id, review), undefined, '评价不得重复提交')
assert.equal(service.prepareRebook(created.id), true)
assert.equal(bookingCalls.some((item) => item[0] === 'update' && !('bookingDate' in item[1])), true, '再次预约不得复制旧日期时间')

const reloaded = loadTs('miniprogram/stores/order.ts', storeDeps).orderStore
assert.equal(reloaded.list().length, service.listOrders().length, '重新打开后订单应从 Storage 恢复')
const legacyDraft = { ...draft, agreementAccepted: true, updatedAt: Date.now(), progressStep: 3 }
memory.set('booking:orders', [{ id: 'legacy-1', orderNo: 'SH20260701001', status: 'pending-match', createdAt: Date.now(), draft: legacyDraft }])
const migrated = loadTs('miniprogram/stores/order.ts', storeDeps).orderStore.list()[0]
assert.equal(migrated.status, 'PENDING_ASSIGNMENT', '旧预约订单应自动迁移到统一状态枚举')
assert.equal(migrated.totalAmount, draft.totalAmount)
memory.set('booking:orders', service.listOrders())
for (const item of reloaded.list()) reloaded.remove(item.id)
const emptyReload = loadTs('miniprogram/stores/order.ts', storeDeps).orderStore
assert.equal(emptyReload.list().length, 0, 'Mock 只能初始化一次，用户清空订单后不得重新写入')
console.log('Validated order seed initialization, persistence, creation, filtering source data, payment, cancellation, rebooking and review transitions.')

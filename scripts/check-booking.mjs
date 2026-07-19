import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const memory = new Map()
const storage = { get: (key, fallback) => memory.has(key) ? memory.get(key) : fallback, set: (key, value) => memory.set(key, value), remove: (key) => memory.delete(key) }

function loadTs(path, dependencies) {
  const source = fs.readFileSync(path, 'utf8')
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
  const module = { exports: {} }
  const wrapper = vm.runInThisContext(`(function(require,module,exports){${code}\n})`, { filename: path })
  wrapper((id) => dependencies[id] || {}, module, module.exports)
  return module.exports
}

const storeModule = loadTs('miniprogram/stores/booking.ts', { '../utils/storage': { storage }, '../utils/storage-keys': { StorageKeys: { bookingDraft: 'booking:draft' } }, '../utils/format': { formatPrice: (value) => `${value / 100}` } })
const { bookingStore, calculateBookingFees } = storeModule
bookingStore.hydrate()
bookingStore.selectService({ id: 'full', name: '全程陪诊', price: 19800, duration: 240 })
assert.equal(bookingStore.getDraft().totalAmount, 18800, '满 198 元优惠应在总价中生效')
bookingStore.update({ companionMode: 'selected', companionId: 'c1', companionPrice: 21800 })
assert.deepEqual(calculateBookingFees(bookingStore.getDraft()), { serviceFee: 19800, companionFee: 2000, discountAmount: 1000, totalAmount: 20800 })
bookingStore.update({ hospitalId: 'h1', departmentName: '内科', bookingDate: '2026-07-15', bookingTime: '09:00', progressStep: 2 })
assert.equal(bookingStore.getNextRoute(), '/pages/booking-companion/index')
bookingStore.update({ patientId: 'p1', patientName: '测试就诊人', agreementAccepted: true, progressStep: 3 })

bookingStore.clear()
assert.equal(bookingStore.hasDraft(), false, '预约成功后草稿应被清空')

const { getFrequentlyUsedHospitals } = loadTs('miniprogram/utils/frequent-hospitals.ts', {})
const hospitalList = [{ id: 'h1', name: '医院一' }, { id: 'h2', name: '医院二' }]
const order = (id, hospitalId, createdAt, status = 'COMPLETED') => ({
  id,
  hospitalId,
  createdAt,
  status,
  paymentStatus: 'PAID',
})
assert.deepEqual(
  getFrequentlyUsedHospitals([order('real-1', 'h1', '2026-07-01T08:00:00.000Z')], hospitalList),
  [],
  '首次使用不得显示最近常选医院',
)
assert.deepEqual(
  getFrequentlyUsedHospitals([
    order('mock-order-1', 'h1', '2026-07-03T08:00:00.000Z'),
    order('real-1', 'h1', '2026-07-01T08:00:00.000Z'),
  ], hospitalList),
  [],
  'Mock 订单不得计入医院偏好',
)
assert.deepEqual(
  getFrequentlyUsedHospitals([
    order('real-1', 'h1', '2026-07-01T08:00:00.000Z'),
    order('real-2', 'h1', '2026-07-02T08:00:00.000Z'),
    order('real-3', 'h2', '2026-07-03T08:00:00.000Z', 'CANCELLED'),
  ], hospitalList).map((item) => item.id),
  ['h1'],
  '同一医院真实使用两次后才应进入最近常选',
)

console.log('Validated booking draft persistence, fee calculation, route progress, draft cleanup and frequent hospital rules.')

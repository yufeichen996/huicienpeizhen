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
function resolveTs(from, request) {
  const candidate = path.resolve(path.dirname(from), request)
  return candidate.endsWith('.ts') ? candidate : `${candidate}.ts`
}
function loadTs(filename) {
  const absolute = path.resolve(filename)
  if (cache.has(absolute)) return cache.get(absolute).exports
  const module = { exports: {} }
  cache.set(absolute, module)
  const source = fs.readFileSync(absolute, 'utf8')
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText
  const localRequire = (request) => request.startsWith('.') ? loadTs(resolveTs(absolute, request)) : {}
  vm.runInThisContext(`(function(require,module,exports){${code}\n})`, { filename: absolute })(localRequire, module, module.exports)
  return module.exports
}

const { catalogServices } = loadTs('miniprogram/mocks/catalog-services.ts')
const { bookingServices } = loadTs('miniprogram/mocks/booking.ts')
const { companions } = loadTs('miniprogram/mocks/companions.ts')
const { hospitals } = loadTs('miniprogram/mocks/hospitals.ts')
const { serviceService } = loadTs('miniprogram/services/service.ts')
const { companionService } = loadTs('miniprogram/services/companion.ts')
const { hospitalService } = loadTs('miniprogram/services/hospital.ts')
const { searchService } = loadTs('miniprogram/services/search.ts')
const { favoriteService } = loadTs('miniprogram/services/favorite.ts')
const { userStore } = loadTs('miniprogram/stores/user.ts')

assert.equal(catalogServices.length, 6, '服务 Mock 应包含 6 项完整服务')
assert.deepEqual(
  bookingServices.map(({ id, price }) => [id, price]),
  catalogServices.map(({ id, price }) => [id, price]),
  '预约流程与服务目录必须共用同一套价格',
)
assert.deepEqual(
  companions.map(({ name, rating, serviceCount, price }) => [name, rating, serviceCount, price]),
  [
    ['林晓雯', 4.98, 541, 19800],
    ['陈建国', 4.95, 328, 15800],
    ['王美琳', 4.97, 412, 21800],
    ['周宁', 5, 0, 16800],
  ],
)
assert.equal(hospitals.length, 8, '医院 Mock 应包含 8 家医院')

assert.deepEqual(serviceService.list({ categoryId: 'agency' }).map((item) => item.id), ['medicine'])
assert.equal(serviceService.list({ sort: 'price' })[0].id, 'medicine')
assert.equal(serviceService.list({ sort: 'duration' })[0].durationMinutes, 60)
assert.deepEqual(companionService.list({ gender: 'male' }).map((item) => item.id), ['chen-jianguo'])
assert.equal(companionService.list({ hospitalId: 'ruijin' }).every((item) => item.serviceHospitalIds.includes('ruijin')), true)
assert.equal(companionService.list({ sort: 'rating' })[0].id, 'registered-mock-application-zhou-ning')
assert.equal(hospitalService.list({ district: '杨浦区' }).length, 2)
assert.equal(hospitalService.list({ query: '心内科' }).length > 0, true, '医院搜索应覆盖科室名称')

assert.equal(searchService.search('全程陪诊').services[0].id, 'full')
assert.equal(searchService.search('瑞金').hospitals[0].id, 'ruijin')
assert.equal(searchService.search('儿科陪诊').departments.length > 0, true, '热词应支持去除“陪诊”后匹配科室')
assert.equal(searchService.search('林晓雯').companions[0].id, 'lin-xiaowen')
assert.equal(searchService.search('周宁').companions[0].id, 'registered-mock-application-zhou-ning')
for (let index = 0; index < 12; index += 1) searchService.saveHistory(`关键词${index}`)
assert.equal(searchService.history().length, 10)
searchService.removeHistory('关键词11')
assert.equal(searchService.history().includes('关键词11'), false)
searchService.clearHistory()
assert.deepEqual(searchService.history(), [])

userStore.hydrate()
const favorite = { id: 'service-exam-test', targetId: 'exam', type: 'service', title: '检查陪同', subtitle: '测试收藏', createdAt: new Date().toISOString() }
assert.equal(favoriteService.toggle(favorite).loginRequired, true, '游客收藏必须先登录')
userStore.login()
assert.equal(favoriteService.toggle(favorite).favorited, true)
assert.equal(favoriteService.isFavorite('service', 'exam'), true)
assert.equal(favoriteService.toggle(favorite).favorited, false)

const sourceFiles = [
  'miniprogram/pages/service-detail/index.ts',
  'miniprogram/pages/companion-detail/index.ts',
  'miniprogram/pages/hospital-detail/index.ts',
  'miniprogram/pages/home/index.ts',
]
const linkageSource = sourceFiles.map((file) => fs.readFileSync(file, 'utf8')).join('\n')
assert.match(linkageSource, /bookingStore\.selectService/)
assert.match(linkageSource, /companionMode:'selected'/)
assert.match(linkageSource, /departmentName:name/)
assert.match(linkageSource, /pages\/search\/index/)
assert.match(linkageSource, /pages\/companions\/index/)
assert.match(linkageSource, /navigation\.openHospital/)

console.log('Validated catalog data, filters, sorts, grouped search, search history, login-gated favorites and booking/home linkage.')

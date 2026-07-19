import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import ts from 'typescript'

const root = path.resolve('miniprogram')
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? walk(path.join(dir, entry.name)) : path.join(dir, entry.name))
const files = walk(root)
const sourceFiles = files.filter((file) => /\.(ts|wxml|wxss|json)$/.test(file))
const sources = new Map(sourceFiles.map((file) => [file, fs.readFileSync(file, 'utf8')]))
const app = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'))

assert.equal(app.pages.length, 33, '页面清单应保持 33 个有效路由')
assert.equal(app.pages.includes('pages/placeholder/index'), false, '废弃占位页不得继续进入主包')
for (const [file, source] of sources) {
  assert.doesNotMatch(source, /wx\.getSystemInfoSync\(/, '不得继续使用已废弃的 getSystemInfoSync')
  assert.doesNotMatch(source, /(?:data:image\/|base64,)/, '不得在源码中内嵌 Base64 图片')
  if (file.endsWith('.wxml')) assert.doesNotMatch(source, /📅|👩‍⚕️|💊|📋|❤️|🏥/, '正式页面不得渲染 Emoji 功能图标')
}

const tokenStyle = fs.readFileSync(path.join(root, 'styles', 'tokens.wxss'), 'utf8')
assert.match(tokenStyle, /button\s*\{[^}]*min-width:\s*0[^}]*display:\s*flex[^}]*align-items:\s*center[^}]*justify-content:\s*center/s, '公共 Button 必须清除默认最小宽度并保持水平、垂直居中')
assert.match(tokenStyle, /button::after\s*\{[^}]*border:\s*0/s, '公共 Button 必须清除微信默认边框')
for (const [file, source] of sources) {
  if (!file.endsWith('.wxml') || !source.includes('<button') || (!file.includes(`${path.sep}components${path.sep}`) && !file.includes(`${path.sep}custom-tab-bar${path.sep}`))) continue
  const styleFile = file.replace(/\.wxml$/, '.wxss')
  assert.equal(sources.has(styleFile), true, `含 Button 的组件必须存在 WXSS: ${file}`)
  assert.match(sources.get(styleFile), /tokens\.wxss/, `含 Button 的组件必须引入公共居中规则: ${file}`)
}

const tabStyle = fs.readFileSync(path.join(root, 'custom-tab-bar', 'index.wxss'), 'utf8')
const tabWxml = fs.readFileSync(path.join(root, 'custom-tab-bar', 'index.wxml'), 'utf8')
const confirmStyle = fs.readFileSync(path.join(root, 'components', 'confirm-dialog', 'index.wxss'), 'utf8')
const loginStyle = fs.readFileSync(path.join(root, 'components', 'login-sheet', 'index.wxss'), 'utf8')
const homeStyle = fs.readFileSync(path.join(root, 'pages', 'home', 'index.wxss'), 'utf8')
const zIndexOf = (source) => Number(source.match(/z-index:\s*(\d+)/)?.[1] || 0)
assert.equal(zIndexOf(confirmStyle) > zIndexOf(tabStyle), true, '确认/支付弹层必须高于自定义 Tab Bar')
assert.equal(zIndexOf(loginStyle) > zIndexOf(tabStyle), true, '登录弹层必须高于自定义 Tab Bar')
assert.match(confirmStyle, /max-height:\s*calc\(100vh/, '确认/支付弹层必须限制视口高度')
assert.match(confirmStyle, /safe-area-inset-bottom/, '确认/支付弹层必须适配底部安全区')
assert.match(tabWxml, /wx:if="\{\{!hidden\}\}"/, '支付等关键弹层打开时必须允许隐藏自定义 Tab Bar')
assert.match(loginStyle, /\.close\s*\{[^}]*min-width:\s*60rpx[^}]*max-width:\s*60rpx/s, '登录关闭按钮必须锁定为圆形尺寸')
assert.match(homeStyle, /\.section-action\s*\{[^}]*min-width:\s*0\s*!important[^}]*margin:\s*0\s+0\s+0\s+auto/s, '首页“查看全部”必须贴齐标题行右侧')

const navbarWxml = fs.readFileSync(path.join(root, 'components', 'custom-navbar', 'index.wxml'), 'utf8')
const navbarTs = fs.readFileSync(path.join(root, 'components', 'custom-navbar', 'index.ts'), 'utf8')
const navbarStyle = fs.readFileSync(path.join(root, 'components', 'custom-navbar', 'index.wxss'), 'utf8')
const ordersTs = fs.readFileSync(path.join(root, 'pages', 'orders', 'index.ts'), 'utf8')
assert.match(navbarWxml, /class="back-glyph"/, '公共返回按钮必须使用组件内部箭头，避免嵌套图标布局偏移')
assert.doesNotMatch(navbarWxml, /name="back"/, '公共返回按钮不得再次嵌套图片图标')
assert.match(navbarTs, /boundingClientRect/, '公共返回按钮必须根据真实屏幕坐标完成位置校正')
assert.match(navbarStyle, /\.back-button\s*\{[^}]*min-width:\s*88rpx[^}]*max-width:\s*88rpx/s, '公共返回按钮必须锁定 44px 触控宽度')
assert.match(ordersTs, /setTabBarHidden\(true\)/, '订单弹层打开时必须主动隐藏自定义 Tab Bar')
assert.match(ordersTs, /setTabBarHidden\(false\)/, '订单弹层关闭时必须恢复自定义 Tab Bar')

for (const [file, source] of sources) {
  if (!file.endsWith('.ts')) continue
  assert.doesNotMatch(source, /wx\.navigateTo\(\{\s*url:\s*['"]\/pages\/(?:home|book|orders|profile)\/index/, `Tab 页面必须使用 switchTab: ${file}`)
  if (!file.endsWith(path.join('utils', 'request.ts'))) assert.doesNotMatch(source, /wx\.request\(/, `页面和 Service 不得直接请求网络: ${file}`)
  assert.doesNotMatch(source, /console\.(?:log|debug)\(/, `生产源码不得保留调试日志: ${file}`)
}

const assets = files.filter((file) => file.includes(`${path.sep}assets${path.sep}`))
const allSource = [...sources.values()].join('\n')
for (const asset of assets) {
  const referenced = asset.includes(`${path.sep}assets${path.sep}icons${path.sep}`) ? allSource.includes(path.parse(asset).name) : allSource.includes(path.basename(asset))
  assert.equal(referenced, true, `未使用资源: ${asset}`)
}
assert.equal(assets.some((file) => fs.statSync(file).size > 200 * 1024), false, '主包不得包含超过 200KB 的未审查资源')
assert.equal(files.some((file) => file.endsWith('.js') && file.includes(`${path.sep}pages${path.sep}`)), false, '页面目录不得包含 TypeScript 编译产物')

const cache = new Map()
function loadTs(filename) {
  const absolute = path.resolve(filename)
  if (cache.has(absolute)) return cache.get(absolute).exports
  const module = { exports: {} }; cache.set(absolute, module)
  const code = ts.transpileModule(fs.readFileSync(absolute, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
  const localRequire = (request) => request.startsWith('.') ? loadTs(`${path.resolve(path.dirname(absolute), request)}.ts`) : {}
  vm.runInThisContext(`(function(require,module,exports){${code}\n})`, { filename: absolute })(localRequire, module, module.exports)
  return module.exports
}

const { StorageKeys } = loadTs('miniprogram/utils/storage-keys.ts')
const keyValues = Object.values(StorageKeys)
assert.equal(new Set(keyValues).size, keyValues.length, 'Storage key 不得重复')
const memory = new Map()
globalThis.wx = { getStorageSync: (key) => memory.get(key), setStorageSync: (key, value) => memory.set(key, structuredClone(value)), removeStorageSync: (key) => memory.delete(key) }
cache.delete(path.resolve('miniprogram/utils/storage.ts'))
const { storage } = loadTs('miniprogram/utils/storage.ts')
memory.set('huicien:search:history', '{broken-json')
assert.deepEqual(storage.get(StorageKeys.searchHistory, []), [], '损坏 Storage 必须安全回退')
storage.set(StorageKeys.searchHistory, ['瑞金医院'])
assert.deepEqual(memory.get('huicien:search:history'), { version: 1, data: ['瑞金医院'] }, '新写入数据必须带版本')

const { catalogServices } = loadTs('miniprogram/mocks/catalog-services.ts')
const { companions } = loadTs('miniprogram/mocks/companions.ts')
const { hospitals } = loadTs('miniprogram/mocks/hospitals.ts')
const serviceIds = new Set(catalogServices.map((item) => item.id))
const hospitalIds = new Set(hospitals.map((item) => item.id))
for (const companion of companions) {
  assert.equal(companion.skillServiceIds.every((id) => serviceIds.has(id)), true, `陪诊员服务 ID 无效: ${companion.id}`)
  assert.equal(companion.serviceHospitalIds.every((id) => hospitalIds.has(id)), true, `陪诊员医院 ID 无效: ${companion.id}`)
}
for (const hospital of hospitals) assert.equal(hospital.supportedServiceIds.every((id) => serviceIds.has(id)), true, `医院服务 ID 无效: ${hospital.id}`)

const packageBytes = files.reduce((sum, file) => sum + fs.statSync(file).size, 0)
assert.equal(packageBytes < 2 * 1024 * 1024, true, `源码主包估算超过 2MB: ${packageBytes}`)
console.log(`Validated navigation, modal layering, centered buttons, navbar alignment, Storage v1 fallback, Mock references, assets, icon policy and filesystem package estimate (${packageBytes} bytes).`)

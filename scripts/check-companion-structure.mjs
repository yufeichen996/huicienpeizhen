import { access, readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'

const root = resolve('companion-miniprogram')
const failures = []

async function mustExist(path, label) {
  try {
    await access(path)
  } catch {
    failures.push(`${label}: ${path}`)
  }
}

const [appSource, projectSource] = await Promise.all([
  readFile(join(root, 'app.json'), 'utf8'),
  readFile(join(root, 'project.config.json'), 'utf8'),
])
const appConfig = JSON.parse(appSource)
const projectConfig = JSON.parse(projectSource)

if (projectConfig.compileType !== 'miniprogram') failures.push('陪诊师端 compileType 必须为 miniprogram')
if (projectConfig.miniprogramRoot !== './') failures.push('陪诊师端必须以独立目录作为 miniprogramRoot')
if (!projectConfig.setting?.useCompilerPlugins?.includes('typescript')) {
  failures.push('陪诊师端未启用微信 TypeScript 编译插件')
}

const requiredRoutes = [
  'pages/login/index',
  'pages/review-status/index',
  'pages/workbench/index',
  'pages/order-hall/index',
]
for (const route of requiredRoutes) {
  if (!appConfig.pages.includes(route)) failures.push(`缺少首阶段路由: ${route}`)
}

const requiredTabs = [
  'pages/workbench/index',
  'pages/tasks/index',
  'pages/messages/index',
  'pages/profile/index',
]
if (appConfig.tabBar?.list?.length !== 4) failures.push('陪诊师端必须保持四栏主导航')
for (const tab of appConfig.tabBar?.list || []) {
  if (!requiredTabs.includes(tab.pagePath)) failures.push(`无效 Tab 路由: ${tab.pagePath}`)
  if (!appConfig.pages.includes(tab.pagePath)) failures.push(`Tab 路由未注册: ${tab.pagePath}`)
  await mustExist(join(root, tab.iconPath), '缺少 Tab 图标')
  await mustExist(join(root, tab.selectedIconPath), '缺少选中态 Tab 图标')
}
for (const route of requiredTabs) {
  if (!appConfig.tabBar?.list?.some((tab) => tab.pagePath === route)) {
    failures.push(`缺少主导航入口: ${route}`)
  }
}

for (const page of appConfig.pages) {
  for (const extension of ['.ts', '.json', '.wxml', '.wxss']) {
    await mustExist(join(root, `${page}${extension}`), '缺少页面文件')
  }
  try {
    await access(join(root, `${page}.js`))
    failures.push(`页面目录不应保留 TypeScript 编译产物: ${page}.js`)
  } catch {
    // 微信开发者工具负责内存编译。
  }

  const [pageJson, wxml, source] = await Promise.all([
    readFile(join(root, `${page}.json`), 'utf8'),
    readFile(join(root, `${page}.wxml`), 'utf8'),
    readFile(join(root, `${page}.ts`), 'utf8'),
  ])
  JSON.parse(pageJson)

  const handlers = [
    ...wxml.matchAll(/(?:bind|catch):?[\w-]+="([\w]+)"/g),
  ].map((match) => match[1])
  for (const handler of new Set(handlers)) {
    if (!new RegExp(`\\b${handler}\\s*\\(`).test(source)) {
      failures.push(`WXML 事件 ${handler} 未在 ${page}.ts 中实现`)
    }
  }
}

const [globalStyle, requestSource, authSource] = await Promise.all([
  readFile(join(root, 'app.wxss'), 'utf8'),
  readFile(join(root, 'utils/request.ts'), 'utf8'),
  readFile(join(root, 'utils/auth.ts'), 'utf8'),
])
if (!globalStyle.includes('env(safe-area-inset-bottom)')) failures.push('全局页面未适配底部安全区')
if (!globalStyle.includes('button::after')) failures.push('全局按钮未清除微信默认边框')
if (!requestSource.includes("ENV.mode === 'mock'")) failures.push('请求层缺少 Mock/远程环境切换')
if (!requestSource.includes('Authorization')) failures.push('请求层缺少登录令牌注入')
if (!authSource.includes('guardApproved')) failures.push('缺少已审核陪诊师身份守卫')

const [
  workbenchSource,
  workbenchStyle,
  workbenchWxml,
  orderHallWxml,
  loginWxml,
  loginSource,
  loginStyle,
  messagesStyle,
  profileStyle,
  trainingStyle,
  executionSource,
  executionWxml,
  executionStyle,
  summaryStyle,
] = await Promise.all([
  readFile(join(root, 'pages/workbench/index.ts'), 'utf8'),
  readFile(join(root, 'pages/workbench/index.wxss'), 'utf8'),
  readFile(join(root, 'pages/workbench/index.wxml'), 'utf8'),
  readFile(join(root, 'pages/order-hall/index.wxml'), 'utf8'),
  readFile(join(root, 'pages/login/index.wxml'), 'utf8'),
  readFile(join(root, 'pages/login/index.ts'), 'utf8'),
  readFile(join(root, 'pages/login/index.wxss'), 'utf8'),
  readFile(join(root, 'pages/messages/index.wxss'), 'utf8'),
  readFile(join(root, 'pages/profile/index.wxss'), 'utf8'),
  readFile(join(root, 'pages/training/index.wxss'), 'utf8'),
  readFile(join(root, 'pages/service-execution/index.ts'), 'utf8'),
  readFile(join(root, 'pages/service-execution/index.wxml'), 'utf8'),
  readFile(join(root, 'pages/service-execution/index.wxss'), 'utf8'),
  readFile(join(root, 'pages/service-summary/index.wxss'), 'utf8'),
])
if (!workbenchSource.includes("wx.switchTab({ url: '/pages/tasks/index' })")) {
  failures.push('工作台进入任务 Tab 必须使用 switchTab')
}
if (!workbenchSource.includes("wx.navigateTo({ url: '/pages/order-hall/index' })")) {
  failures.push('工作台缺少抢单大厅入口')
}
if (workbenchWxml.includes('查看 B 端认证机构发布的匹配任务')) {
  failures.push('工作台不得保留 B 端任务说明行')
}
if (!workbenchWxml.includes('任务数量与服务类型不限')) {
  failures.push('工作台必须明确显示不限任务数量与服务类型')
}
if (!orderHallWxml.includes('同时接单数') || orderHallWxml.includes('B 端')) {
  failures.push('抢单大厅必须展示不限接单规则并统一使用合作机构称呼')
}
if (loginWxml.indexOf('class="agreement"') < loginWxml.indexOf('class="environment-note"')) {
  failures.push('登录协议必须位于登录操作区最下方')
}
if (!loginWxml.includes('disabled="{{loading}}"') || !loginSource.includes('agreementAccepted: true')) {
  failures.push('已有陪诊师登录必须允许点击并自动确认协议')
}
if (!loginWxml.includes('class="agreement-group"')
  || !/\.agreement-group\s*\{[^}]*display:\s*flex[^}]*justify-content:\s*center/s.test(loginStyle)) {
  failures.push('登录协议行必须整体水平居中')
}
if (!/\.account-button\s*\{[^}]*flex:\s*0 0 104rpx/s.test(workbenchStyle)) {
  failures.push('工作台退出按钮必须锁定紧凑宽度，不能占满头部')
}
if (!/\.all-tasks\s*\{[^}]*margin-right:\s*auto[^}]*justify-content:\s*flex-start/s.test(workbenchStyle)) {
  failures.push('工作台全部任务入口必须靠近标题左侧')
}
for (const [style, selector, label] of [
  [workbenchStyle, '.exception-link', '工作台异常入口'],
  [workbenchStyle, '.support-link', '工作台帮助入口'],
  [trainingStyle, '.course-action', '培训课程操作'],
]) {
  const escaped = selector.replace('.', '\\.')
  if (!new RegExp(`${escaped}\\s*\\{[^}]*width:\\s*auto[^}]*justify-content:\\s*flex-start`, 's').test(style)) {
    failures.push(`${label}必须使用左对齐的内容宽度`)
  }
}
if (!/\.read-all\s*\{[^}]*margin-left:\s*auto[^}]*justify-content:\s*flex-end/s.test(messagesStyle)) {
  failures.push('消息全部已读必须靠工具栏右侧')
}
if (!/\.menu-card \.menu-row\s*\{[^}]*min-width:\s*100%\s*!important[^}]*margin-left:\s*0\s*!important[^}]*justify-content:\s*flex-start\s*!important/s.test(profileStyle)
  || !/\.menu-copy\s*\{[^}]*text-align:\s*left/s.test(profileStyle)) {
  failures.push('我的页面菜单选项必须明确左对齐')
}
if (executionWxml.includes('记录当前节点') || executionWxml.includes('class="record-card')) {
  failures.push('服务执行页不得保留底部统一节点记录卡')
}
if (!executionWxml.includes('expandedFailureNodeId === item.id')
  || !executionWxml.includes('data-node-id="{{item.id}}"')) {
  failures.push('服务执行页异常输入和凭证必须绑定当前 nodeId')
}
if (!executionSource.includes("type ExecutionNodeStatus = 'pending' | 'active' | 'completed' | 'failed'")
  || !executionSource.includes('interface ServiceExecutionNode')) {
  failures.push('服务执行页缺少统一的节点执行状态结构')
}
if (!executionSource.includes('wx.pageScrollTo')
  || !executionSource.includes('await this.load(true)')) {
  failures.push('节点完成后必须自动定位下一进行中节点')
}
if (!executionStyle.includes('.status-active .milestone-card')
  || !executionStyle.includes('.status-failed .state-mark')
  || !executionStyle.includes('.status-completed .state-mark')) {
  failures.push('服务执行页缺少 active、failed、completed 的时间轴视觉状态')
}
if (!summaryStyle.includes('padding-bottom: calc(188rpx + env(safe-area-inset-bottom))')
  || !summaryStyle.includes('box-sizing: border-box')) {
  failures.push('服务总结输入区必须避让底部操作栏并限制在卡片宽度内')
}

if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}

console.log(`Validated companion project configuration, ${appConfig.pages.length} routes, handlers, request adapter, auth guard and safe areas.`)

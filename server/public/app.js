const state = {
  services: [],
  companions: [],
  orders: [],
  dashboard: null,
  access: null,
  activeView: 'overview',
}
const API_BASE_URL = String(window.__HUICIEN_CONFIG__?.apiBaseUrl || '').replace(/\/$/, '')
const TOKEN_KEY = 'huicien_org_access_token'
let accessToken = sessionStorage.getItem(TOKEN_KEY) || ''

const statusMeta = {
  DRAFT: ['草稿', 'gray'],
  PENDING_PAYMENT: ['待付款', 'orange'],
  PENDING_ASSIGNMENT: ['待平台匹配', 'orange'],
  PENDING_CONFIRMATION: ['待陪诊师确认', 'orange'],
  PUBLISHED: ['抢单中', 'blue'],
  PENDING_SERVICE: ['待服务', 'blue'],
  IN_SERVICE: ['服务中', 'green'],
  PENDING_REVIEW: ['待评价', 'orange'],
  COMPLETED: ['已完成', 'green'],
  CANCELLED: ['已取消', 'red'],
}

const pageMeta = {
  overview: ['合作机构工作台', '业务总览'],
  publish: ['合作机构下单', '发布订单'],
  orders: ['统一订单中心', '订单管理'],
}

const currency = (cents = 0) => `¥${(Number(cents) / 100).toFixed(2)}`
const escapeHtml = (value = '') => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;')

const toastElement = document.querySelector('#toast')
let toastTimer
function toast(message, type = 'success') {
  clearTimeout(toastTimer)
  toastElement.textContent = message
  toastElement.className = `toast show ${type === 'error' ? 'error' : ''}`
  toastTimer = setTimeout(() => { toastElement.className = 'toast' }, 2600)
}

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
      ...options.headers,
    },
  })
  const payload = await response.json()
  if (response.status === 401) {
    accessToken = ''
    sessionStorage.removeItem(TOKEN_KEY)
    document.body.classList.add('auth-required')
  }
  if (!response.ok || payload.code !== 0) throw new Error(payload.message || '请求失败')
  return payload.data
}

function setView(view) {
  const requiredPermission = {
    overview: 'VIEW_DASHBOARD',
    publish: 'PUBLISH_ORDER',
    orders: 'MANAGE_ORDERS',
  }[view]
  if (state.access && requiredPermission && !state.access.permissions.includes(requiredPermission)) {
    toast('当前账号未开通该功能', 'error')
    return
  }
  state.activeView = view
  document.querySelectorAll('.view').forEach((panel) => {
    panel.classList.toggle('active', panel.dataset.viewPanel === view)
  })
  document.querySelectorAll('.nav-item').forEach((item) => {
    item.classList.toggle('active', item.dataset.view === view)
  })
  const [eyebrow, title] = pageMeta[view]
  document.querySelector('#page-eyebrow').textContent = eyebrow
  document.querySelector('#page-title').textContent = title
  document.body.classList.remove('menu-open')
  if (view === 'orders') renderOrders()
}

function orderRows(orders) {
  if (!orders.length) return '<div class="empty-state">还没有订单，发布第一张合作机构订单后会显示在这里。</div>'
  return `
    <table>
      <thead><tr><th>订单</th><th>服务时间</th><th>医院科室</th><th>派单方式</th><th>金额</th><th>状态</th><th>操作</th></tr></thead>
      <tbody>${orders.map((order) => {
        const [statusText, tone] = statusMeta[order.status] || [order.status, 'gray']
        const actions = [
          order.status === 'DRAFT' ? `<button class="row-action" data-order-action="publish" data-id="${order.id}">发布</button>` : '',
          order.paymentStatus !== 'PAID' && !['COMPLETED', 'CANCELLED'].includes(order.status)
            ? `<button class="row-action" data-order-action="payment-confirm" data-id="${order.id}">确认付款</button>`
            : '',
          ['DRAFT', 'PUBLISHED', 'PENDING_ASSIGNMENT', 'PENDING_CONFIRMATION', 'PENDING_SERVICE'].includes(order.status)
            ? `<button class="row-action" data-order-action="assign" data-id="${order.id}">派单/改派</button>`
            : '',
          ['DRAFT', 'PUBLISHED', 'PENDING_ASSIGNMENT', 'PENDING_CONFIRMATION', 'PENDING_SERVICE'].includes(order.status)
            ? `<button class="row-action danger" data-order-action="cancel" data-id="${order.id}">取消</button>`
            : '',
          `<button class="row-action" data-order-action="detail" data-id="${order.id}">详情</button>`,
        ].join('')
        return `
          <tr>
            <td class="cell-main"><strong>${escapeHtml(order.orderNo)}</strong><small>${escapeHtml(order.patientName)} · ${escapeHtml(order.serviceName)}</small></td>
            <td class="cell-main"><strong>${escapeHtml(order.bookingDate)}</strong><small>${escapeHtml(order.bookingTime)}</small></td>
            <td class="cell-main"><strong>${escapeHtml(order.hospitalName)}</strong><small>${escapeHtml(order.departmentName)}</small></td>
            <td>${order.dispatchMode === 'MARKET' ? '抢单大厅' : order.dispatchMode === 'DIRECT' ? '定向陪诊师' : '平台匹配'}</td>
            <td class="money">${currency(order.totalAmount)}</td>
            <td><span class="status-pill ${tone}">${statusText}</span></td>
            <td>${actions || '—'}</td>
          </tr>
        `
      }).join('')}</tbody>
    </table>`
}

function renderDashboard() {
  const dashboard = state.dashboard
  if (!dashboard) return
  document.querySelector('#institution-name').textContent = dashboard.institution.name
  document.querySelector('#institution-contact').textContent = `${dashboard.institution.contactName} · ${dashboard.institution.contactPhone}`
  document.querySelector('#metric-total').textContent = dashboard.metrics.total
  document.querySelector('#metric-published').textContent = dashboard.metrics.published
  document.querySelector('#metric-pending').textContent = dashboard.metrics.pendingService
  document.querySelector('#metric-completed').textContent = dashboard.metrics.completed
  document.querySelector('#recent-orders').innerHTML = state.access.permissions.includes('MANAGE_ORDERS')
    ? orderRows(state.orders.slice(0, 5))
    : '<div class="empty-state">当前账号未开通订单管理权限。</div>'
}

function renderOrders() {
  const query = document.querySelector('#order-search').value.trim().toLowerCase()
  const status = document.querySelector('#order-status-filter').value
  const visible = state.orders.filter((order) => {
    const haystack = `${order.orderNo}${order.patientName}${order.hospitalName}${order.departmentName}`.toLowerCase()
    return (!query || haystack.includes(query)) && (!status || order.status === status)
  })
  document.querySelector('#orders-table').innerHTML = orderRows(visible)
}

function renderServiceOptions() {
  const options = state.services.filter((service) => service.enabled)
    .map((service) => `<option value="${service.id}">${escapeHtml(service.name)} · ${currency(service.servicePrice)}</option>`)
    .join('')
  document.querySelector('#service-select').innerHTML = options
}

function renderCompanionOptions() {
  document.querySelector('#companion-select').innerHTML = state.companions
    .map((companion) => `<option value="${companion.id}">${escapeHtml(companion.name)}</option>`)
    .join('')
}

async function refreshQuote() {
  const serviceId = document.querySelector('#service-select').value
  if (!serviceId) return
  const mode = document.querySelector('input[name="dispatchMode"]:checked').value
  const companionId = mode === 'DIRECT' ? document.querySelector('#companion-select').value : ''
  const params = new URLSearchParams({ serviceId })
  if (companionId) params.set('companionId', companionId)
  try {
    const quote = await api(`/api/pricing/quote?${params}`)
    document.querySelector('#quote-service').textContent = currency(quote.servicePrice)
    document.querySelector('#quote-companion').textContent = currency(quote.companionPrice)
    document.querySelector('#quote-total').textContent = currency(quote.totalAmount)
  } catch (error) {
    toast(error.message, 'error')
  }
}

async function loadAll() {
  if (!accessToken) {
    document.body.classList.add('auth-required')
    return
  }
  try {
    const [health, access, services, companions] = await Promise.all([
      api('/api/health'),
      api('/api/institution/me'),
      api('/api/services'),
      api('/api/companions'),
    ])
    state.access = access
    state.services = services
    state.companions = companions
    const [dashboard, orders] = await Promise.all([
      access.permissions.includes('VIEW_DASHBOARD') ? api('/api/institution/dashboard') : Promise.resolve(null),
      access.permissions.includes('MANAGE_ORDERS') ? api('/api/institution/orders') : Promise.resolve([]),
    ])
    state.dashboard = dashboard
    state.orders = orders
    document.querySelector('#server-status').textContent = `${health.orders} 张订单 · 运行正常`
    document.querySelector('.status-light').classList.add('online')
    document.querySelector('#institution-name').textContent = access.institutionName
    document.querySelector('#institution-contact').textContent = `${access.displayName} · ${access.contactPhone}`
    document.querySelectorAll('[data-permission]').forEach((item) => {
      item.classList.toggle('hidden', !access.permissions.includes(item.dataset.permission))
    })
    const activePermission = {
      overview: 'VIEW_DASHBOARD',
      publish: 'PUBLISH_ORDER',
      orders: 'MANAGE_ORDERS',
    }[state.activeView]
    if (!access.permissions.includes(activePermission)) {
      const firstAvailable = document.querySelector('.nav-item:not(.hidden)')
      if (firstAvailable) setView(firstAvailable.dataset.view)
    }
    if (dashboard) renderDashboard()
    renderServiceOptions()
    renderCompanionOptions()
    if (access.permissions.includes('PUBLISH_ORDER')) await refreshQuote()
    document.body.classList.remove('auth-required')
  } catch (error) {
    document.querySelector('#server-status').textContent = '连接失败'
    toast(error.message, 'error')
  }
}

document.querySelector('#login-environment').textContent =
  `${window.__HUICIEN_CONFIG__?.appEnv || 'test'} 环境 · 不依赖微信登录`

document.querySelector('#login-form').addEventListener('submit', async (event) => {
  event.preventDefault()
  const formElement = event.currentTarget
  const form = new FormData(formElement)
  const submit = formElement.querySelector('button[type="submit"]')
  submit.disabled = true
  try {
    const result = await api('/api/auth/institution/login', {
      method: 'POST',
      body: JSON.stringify({
        loginName: form.get('loginName'),
        password: form.get('password'),
      }),
    })
    accessToken = result.token
    sessionStorage.setItem(TOKEN_KEY, accessToken)
    formElement.reset()
    await loadAll()
    toast('登录成功')
  } catch (error) {
    toast(error.message, 'error')
  } finally {
    submit.disabled = false
  }
})

document.querySelector('#logout-button').addEventListener('click', async () => {
  try {
    if (accessToken) await api('/api/auth/logout', { method: 'POST', body: '{}' })
  } catch {
    // 服务端会话即使已经失效，本地仍应退出。
  }
  accessToken = ''
  sessionStorage.removeItem(TOKEN_KEY)
  document.body.classList.add('auth-required')
})

document.addEventListener('click', async (event) => {
  const nav = event.target.closest('[data-view]')
  if (nav) return setView(nav.dataset.view)
  const open = event.target.closest('[data-open-view]')
  if (open) return setView(open.dataset.openView)
  if (event.target.closest('#menu-button')) {
    document.body.classList.toggle('menu-open')
    return
  }
  const orderAction = event.target.closest('[data-order-action]')
  if (orderAction) {
    try {
      const action = orderAction.dataset.orderAction
      if (action === 'detail') {
        const detail = await api(`/api/institution/orders/${orderAction.dataset.id}`)
        window.alert([
          `${detail.orderNo} · ${detail.serviceName}`,
          `${detail.patientName} · ${detail.hospitalName} ${detail.departmentName}`,
          `${detail.bookingDate} ${detail.bookingTime}`,
          `状态：${statusMeta[detail.status]?.[0] || detail.status}`,
          `执行节点：${detail.executionRecords.length}，异常：${detail.exceptions.length}，费用：${detail.expenses.length}`,
        ].join('\n'))
        return
      }
      let body = {}
      if (action === 'assign') {
        const options = state.companions.map((item) => `${item.id}（${item.name}）`).join('\n')
        const companionId = window.prompt(`请输入陪诊师 ID：\n${options}`, state.companions[0]?.id || '')
        if (!companionId) return
        body = { companionId: companionId.trim() }
      }
      if (action === 'cancel' && !window.confirm('确认取消该订单吗？')) return
      await api(`/api/institution/orders/${orderAction.dataset.id}/${action}`, {
        method: 'POST',
        body: JSON.stringify(body),
      })
      const successText = {
        publish: '订单已发布',
        'payment-confirm': '客户付款已确认',
        assign: '派单信息已更新',
        cancel: '订单已取消',
      }[action] || '操作成功'
      toast(successText)
      await loadAll()
      renderOrders()
    } catch (error) {
      toast(error.message, 'error')
    }
    return
  }
})

document.querySelector('#dispatch-options').addEventListener('change', () => {
  const direct = document.querySelector('input[name="dispatchMode"]:checked').value === 'DIRECT'
  document.querySelector('#companion-field').classList.toggle('hidden', !direct)
  refreshQuote()
})
document.querySelector('#service-select').addEventListener('change', () => {
  renderCompanionOptions()
  refreshQuote()
})
document.querySelector('#companion-select').addEventListener('change', refreshQuote)
document.querySelector('#order-search').addEventListener('input', renderOrders)
document.querySelector('#order-status-filter').addEventListener('change', renderOrders)

document.querySelector('#order-form').addEventListener('submit', async (event) => {
  event.preventDefault()
  const formElement = event.currentTarget
  const form = new FormData(formElement)
  const dispatchMode = form.get('dispatchMode')
  const action = event.submitter?.value || 'draft'
  const body = {
    patientName: form.get('patientName'),
    patientPhone: form.get('patientPhone'),
    patientAgeGroup: form.get('patientAgeGroup'),
    serviceId: form.get('serviceId'),
    hospitalName: form.get('hospitalName'),
    departmentName: form.get('departmentName'),
    bookingDate: form.get('bookingDate'),
    bookingTime: form.get('bookingTime'),
    dispatchMode,
    companionId: dispatchMode === 'DIRECT' ? form.get('companionId') : null,
    specialNeeds: String(form.get('specialNeeds') || '').split(/[、,，]/).map((item) => item.trim()).filter(Boolean),
    remark: form.get('remark'),
    publish: action === 'publish',
  }
  try {
    const order = await api('/api/institution/orders', {
      method: 'POST',
      body: JSON.stringify(body),
    })
    toast(action === 'publish' ? `订单 ${order.orderNo} 已发布` : `订单 ${order.orderNo} 已保存为草稿`)
    formElement.reset()
    document.querySelector('input[name="dispatchMode"][value="MARKET"]').checked = true
    document.querySelector('#companion-field').classList.add('hidden')
    await loadAll()
    setView('orders')
  } catch (error) {
    toast(error.message, 'error')
  }
})

if (!accessToken) document.body.classList.add('auth-required')
loadAll()

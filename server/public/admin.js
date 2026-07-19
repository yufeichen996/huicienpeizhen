const state = {
  currentAccount: null,
  dashboard: null,
  platformAccounts: [],
  institutions: [],
  institutionOrders: { summary: {}, institutions: [], orders: [] },
  services: [],
  companions: [],
  companionReviews: [],
  exceptions: [],
  expenses: [],
  operationLogs: [],
  activeView: 'overview',
}
const API_BASE_URL = String(window.__HUICIEN_CONFIG__?.apiBaseUrl || '').replace(/\/$/, '')
const TOKEN_KEY = 'huicien_admin_access_token'
let accessToken = sessionStorage.getItem(TOKEN_KEY) || ''

const pageMeta = {
  overview: ['平台控制台', '平台总览'],
  institutions: ['租户与权限', '机构账号'],
  'platform-accounts': ['平台权限与安全', '账号管理'],
  'institution-orders': ['统一订单监控', '机构订单'],
  'service-pricing': ['价格中心', '服务价格'],
  'companion-pricing': ['价格中心', '陪诊师价格'],
  'review-center': ['平台审核', '审核中心'],
  'operation-logs': ['安全审计', '操作日志'],
}

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

const permissionMeta = {
  VIEW_DASHBOARD: ['业务总览', '查看机构订单统计'],
  PUBLISH_ORDER: ['发布订单', '录入客户并发布需求'],
  MANAGE_ORDERS: ['订单管理', '查询、发布草稿和撤回'],
}

const currency = (cents = 0) => `¥${(Number(cents) / 100).toFixed(2)}`
const formatDateTime = (value) => value
  ? new Date(value).toLocaleString('zh-CN', { hour12: false })
  : '尚未登录'
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
  toastTimer = setTimeout(() => { toastElement.className = 'toast' }, 2800)
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
  if (view === 'institutions') renderInstitutions()
  if (view === 'platform-accounts') renderPlatformAccounts()
  if (view === 'institution-orders') renderInstitutionOrders()
  if (view === 'service-pricing') renderServicePricing()
  if (view === 'companion-pricing') renderCompanionPricing()
  if (view === 'review-center') renderReviewCenter()
  if (view === 'operation-logs') renderOperationLogs()
}

function reviewRows(items, type) {
  if (!items.length) return '<div class="empty-state">当前没有待处理记录。</div>'
  return items.map((item) => {
    const pending = ['PENDING', 'OPEN', 'REVIEWING', 'SUBMITTED'].includes(item.status)
    const title = type === 'companion'
      ? `${item.companionName || item.companionId} · 陪诊师申请`
      : type === 'exception'
        ? `${item.orderId} · ${item.category}`
        : `${item.orderId} · ${currency(item.amount)}`
    const description = type === 'exception'
      ? item.description
      : type === 'expense'
        ? item.description
        : `提交时间 ${item.submittedAt || '—'}`
    return `
      <div class="review-row">
        <div><strong>${escapeHtml(title)}</strong><small>${escapeHtml(description || '—')} · ${escapeHtml(item.status)}</small></div>
        ${pending ? `<div class="review-actions">
          <button class="approve" data-review-type="${type}" data-review-id="${item.id}" data-review-result="APPROVED">通过</button>
          <button class="reject" data-review-type="${type}" data-review-id="${item.id}" data-review-result="REJECTED">驳回</button>
        </div>` : ''}
      </div>`
  }).join('')
}

function renderReviewCenter() {
  document.querySelector('#companion-review-list').innerHTML =
    reviewRows(state.companionReviews, 'companion')
  document.querySelector('#exception-review-list').innerHTML =
    reviewRows(state.exceptions, 'exception')
  document.querySelector('#expense-review-list').innerHTML =
    reviewRows(state.expenses, 'expense')
}

function renderOperationLogs() {
  document.querySelector('#operation-log-list').innerHTML = state.operationLogs.length
    ? `<table>
      <thead><tr><th>时间</th><th>操作人</th><th>动作</th><th>资源</th><th>结果</th></tr></thead>
      <tbody>${state.operationLogs.map((item) => `
        <tr>
          <td>${escapeHtml(item.createdAt)}</td>
          <td>${escapeHtml(`${item.actorType} · ${item.actorId}`)}</td>
          <td>${escapeHtml(item.action)}</td>
          <td>${escapeHtml(`${item.resourceType} · ${item.resourceId || '—'}`)}</td>
          <td>${escapeHtml(item.result)}</td>
        </tr>`).join('')}</tbody>
    </table>`
    : '<div class="empty-state">暂无关键操作日志。</div>'
}

function renderInstitutionOrders() {
  const data = state.institutionOrders
  document.querySelector('#admin-order-total').textContent = data.summary.total || 0
  document.querySelector('#admin-order-dispatching').textContent = data.summary.dispatching || 0
  document.querySelector('#admin-order-service').textContent = data.summary.inService || 0
  document.querySelector('#admin-order-completed').textContent = data.summary.completed || 0

  document.querySelector('#institution-order-stats').innerHTML = data.institutions.length
    ? `
      <div class="status-lane-head">
        <span>合作机构</span><span>草稿</span><span>派单中</span><span>履约中</span><span>已完成</span><span>已取消</span>
      </div>
      ${data.institutions.map((institution) => `
        <div class="status-lane">
          <div><strong>${escapeHtml(institution.institutionName)}</strong><small>共 ${institution.total} 张</small></div>
          <span class="lane-count gray">${institution.draft}</span>
          <span class="lane-count orange">${institution.dispatching}</span>
          <span class="lane-count blue">${institution.inService}</span>
          <span class="lane-count green">${institution.completed}</span>
          <span class="lane-count red">${institution.cancelled}</span>
        </div>
      `).join('')}`
    : '<div class="empty-state">尚未产生合作机构订单。</div>'

  const institutionFilter = document.querySelector('#admin-order-institution')
  const currentInstitution = institutionFilter.value
  institutionFilter.innerHTML = '<option value="">全部机构</option>' + data.institutions
    .map((institution) => `<option value="${institution.institutionId}">${escapeHtml(institution.institutionName)}</option>`)
    .join('')
  institutionFilter.value = currentInstitution

  const query = document.querySelector('#admin-order-search').value.trim().toLowerCase()
  const institutionId = institutionFilter.value
  const status = document.querySelector('#admin-order-status').value
  const orders = data.orders.filter((order) => {
    const haystack = `${order.orderNo}${order.patientName}${order.patientPhone}${order.hospitalName}${order.departmentName}`.toLowerCase()
    return (!query || haystack.includes(query))
      && (!institutionId || order.institutionId === institutionId)
      && (!status || order.status === status)
  })
  document.querySelector('#admin-orders-table').innerHTML = orders.length
    ? `
      <table class="admin-order-table">
        <thead><tr><th>合作机构</th><th>订单与客户</th><th>服务时间</th><th>医院科室</th><th>陪诊师</th><th>金额</th><th>状态</th></tr></thead>
        <tbody>${orders.map((order) => {
          const [statusText, tone] = statusMeta[order.status] || [order.status, 'gray']
          return `
            <tr>
              <td class="cell-main"><strong>${escapeHtml(order.institutionName)}</strong><small>${order.dispatchMode === 'MARKET' ? '抢单大厅' : order.dispatchMode === 'DIRECT' ? '定向派单' : '平台匹配'}</small></td>
              <td class="cell-main"><strong>${escapeHtml(order.orderNo)}</strong><small>${escapeHtml(order.patientName)} · ${escapeHtml(order.serviceName)}</small></td>
              <td class="cell-main"><strong>${escapeHtml(order.bookingDate)}</strong><small>${escapeHtml(order.bookingTime)}</small></td>
              <td class="cell-main"><strong>${escapeHtml(order.hospitalName)}</strong><small>${escapeHtml(order.departmentName)}</small></td>
              <td>${escapeHtml(order.companionName || '尚未安排')}</td>
              <td class="money">${currency(order.totalAmount)}</td>
              <td><span class="status-pill ${tone}">${statusText}</span></td>
            </tr>
          `
        }).join('')}</tbody>
      </table>`
    : '<div class="empty-state">当前筛选条件下没有机构订单。</div>'
}

function renderDashboard() {
  const metrics = state.dashboard.metrics
  document.querySelector('#metric-institutions').textContent = metrics.institutions
  document.querySelector('#metric-accounts').textContent = metrics.enabledAccounts
  document.querySelector('#metric-services').textContent = metrics.enabledServices
  document.querySelector('#metric-orders').textContent = metrics.orders
  const summary = state.institutions.slice(0, 5)
  document.querySelector('#institution-summary').innerHTML = summary.length
    ? summary.map((institution) => `
      <div class="summary-row">
        <span class="institution-symbol">${escapeHtml(institution.institutionName.slice(0, 1))}</span>
        <div><strong>${escapeHtml(institution.institutionName)}</strong><small>${escapeHtml(institution.loginName)} · ${institution.permissions.length} 项权限</small></div>
        <span class="status-pill ${institution.accountStatus === 'ENABLED' ? 'green' : 'gray'}">${institution.accountStatus === 'ENABLED' ? '账号启用' : '账号停用'}</span>
      </div>
    `).join('')
    : '<div class="empty-state">尚未开通合作机构。</div>'
}

function permissionCheckboxes(institution) {
  return Object.entries(permissionMeta).map(([permission, [name, description]]) => `
    <label>
      <input type="checkbox" data-access-permission="${permission}" ${institution.permissions.includes(permission) ? 'checked' : ''}>
      <span><strong>${name}</strong><small>${description}</small></span>
    </label>
  `).join('')
}

function renderInstitutions() {
  document.querySelector('#institution-list').innerHTML = state.institutions.length
    ? state.institutions.map((institution) => `
      <article class="institution-access-card" data-institution-id="${institution.institutionId}">
        <header>
          <span class="institution-symbol">${escapeHtml(institution.institutionName.slice(0, 1))}</span>
          <div>
            <h3>${escapeHtml(institution.institutionName)}</h3>
            <p>${escapeHtml(institution.contactName)} · ${escapeHtml(institution.contactPhone)}</p>
          </div>
          <span class="status-pill ${institution.institutionStatus === 'APPROVED' ? 'green' : institution.institutionStatus === 'PENDING' ? 'orange' : 'red'}">
            ${institution.institutionStatus === 'APPROVED' ? '已审核' : institution.institutionStatus === 'PENDING' ? '待审核' : '已暂停'}
          </span>
        </header>
        <div class="access-account-grid">
          <label>机构状态
            <select data-access-field="institutionStatus">
              <option value="APPROVED" ${institution.institutionStatus === 'APPROVED' ? 'selected' : ''}>已审核</option>
              <option value="PENDING" ${institution.institutionStatus === 'PENDING' ? 'selected' : ''}>待审核</option>
              <option value="SUSPENDED" ${institution.institutionStatus === 'SUSPENDED' ? 'selected' : ''}>已暂停</option>
            </select>
          </label>
          <label>账号状态
            <select data-access-field="accountStatus">
              <option value="ENABLED" ${institution.accountStatus === 'ENABLED' ? 'selected' : ''}>启用</option>
              <option value="DISABLED" ${institution.accountStatus === 'DISABLED' ? 'selected' : ''}>停用</option>
            </select>
          </label>
          <label>登录账号<input data-access-field="loginName" value="${escapeHtml(institution.loginName)}"></label>
          <label>重置临时密码<input data-access-field="temporaryPassword" type="password" minlength="8" placeholder="不修改请留空"></label>
        </div>
        <fieldset class="permission-fieldset compact-permissions">
          <legend>开放功能</legend>
          ${permissionCheckboxes(institution)}
        </fieldset>
        <footer>
          <small>${institution.passwordResetRequired ? '首次登录需要修改密码' : '密码状态正常'}</small>
          <button class="primary-action compact" data-save-institution="${institution.institutionId}">保存账号与权限</button>
        </footer>
      </article>
    `).join('')
    : '<div class="empty-state">尚未开通合作机构。</div>'
}

function renderPlatformAccounts() {
  const list = document.querySelector('#platform-account-list')
  list.innerHTML = state.platformAccounts.length
    ? state.platformAccounts.map((account) => {
      const current = account.id === state.currentAccount?.id
      const locked = account.lockedUntil && new Date(account.lockedUntil) > new Date()
      return `
        <article class="platform-account-card ${current ? 'current' : ''}" data-platform-account-id="${account.id}">
          <header>
            <span class="platform-account-avatar">${escapeHtml(account.displayName.slice(0, 1))}</span>
            <div>
              <div class="platform-account-title">
                <h3>${escapeHtml(account.displayName)}</h3>
                ${current ? '<span class="current-account-tag">当前账号</span>' : ''}
              </div>
              <p>${escapeHtml(account.loginName)} · ${account.roleCode === 'PLATFORM_SUPER_ADMIN' ? '平台总管理员' : escapeHtml(account.roleCode)}</p>
            </div>
            <span class="status-pill ${account.status === 'ENABLED' ? (locked ? 'orange' : 'green') : 'gray'}">
              ${account.status === 'ENABLED' ? (locked ? '暂时锁定' : '账号启用') : '账号停用'}
            </span>
          </header>
          <div class="platform-account-grid">
            <label>登录账号<input data-platform-field="loginName" value="${escapeHtml(account.loginName)}" minlength="4" maxlength="32"></label>
            <label>管理员名称<input data-platform-field="displayName" value="${escapeHtml(account.displayName)}" maxlength="30"></label>
            <label>账号状态
              <select data-platform-field="accountStatus" ${current ? 'disabled' : ''}>
                <option value="ENABLED" ${account.status === 'ENABLED' ? 'selected' : ''}>启用</option>
                <option value="DISABLED" ${account.status === 'DISABLED' ? 'selected' : ''}>停用</option>
              </select>
            </label>
            <label>重置密码<input data-platform-field="temporaryPassword" type="password" minlength="8" autocomplete="new-password" placeholder="不修改请留空"></label>
          </div>
          <footer>
            <div>
              <small>最近登录：${escapeHtml(formatDateTime(account.lastLoginAt))}</small>
              <small>创建时间：${escapeHtml(formatDateTime(account.createdAt))}</small>
            </div>
            <button class="primary-action compact" data-save-platform-account="${account.id}">保存账号</button>
          </footer>
        </article>
      `
    }).join('')
    : '<div class="empty-state">尚未创建平台管理员账号。</div>'
}

function renderServicePricing() {
  document.querySelector('#service-price-list').innerHTML = state.services.map((service) => `
    <div class="price-row" data-service-row="${service.id}">
      <div><h3>${escapeHtml(service.name)}</h3><p>${escapeHtml(service.category)} · ${service.durationMinutes} 分钟</p></div>
      <label class="price-field">服务价格（元）<input data-field="servicePrice" type="number" min="0" step="1" value="${service.servicePrice / 100}"></label>
      <label class="price-field">默认陪诊师价（元）<input data-field="defaultCompanionPrice" type="number" min="0" step="1" value="${service.defaultCompanionPrice / 100}"></label>
      <div>
        <label class="price-toggle"><input data-field="enabled" type="checkbox" ${service.enabled ? 'checked' : ''}>启用</label>
        <button class="save-price" data-save-service="${service.id}">保存价格</button>
      </div>
    </div>
  `).join('')
}

function renderCompanionPricing() {
  const serviceId = document.querySelector('#price-service-filter').value || state.services[0]?.id
  const service = state.services.find((item) => item.id === serviceId)
  const companions = state.companions
  document.querySelector('#companion-price-list').innerHTML = companions.length
    ? companions.map((companion) => {
      const override = companion.prices[serviceId]
      return `
        <div class="companion-price-row">
          <div class="companion-identity"><span class="companion-avatar">${escapeHtml(companion.name.slice(0, 1))}</span><div><strong>${escapeHtml(companion.name)}</strong><small>${companion.skills.length} 项认证技能</small></div></div>
          <span class="default-price">服务默认价 ${currency(service.defaultCompanionPrice)}</span>
          <label>个人价格（元）<input data-companion-price="${companion.id}" value="${override === undefined ? '' : override / 100}" type="number" min="0" placeholder="使用默认价"></label>
          <button class="save-price" data-save-companion="${companion.id}" data-service-id="${serviceId}">保存</button>
        </div>`
    }).join('')
    : '<div class="empty-state">没有认证该服务的陪诊师。</div>'
}

async function loadAll() {
  if (!accessToken) {
    document.body.classList.add('auth-required')
    return
  }
  try {
    const [
      health,
      currentAccount,
      dashboard,
      platformAccounts,
      institutions,
      institutionOrders,
      services,
      companions,
      companionReviews,
      exceptions,
      expenses,
      operationLogs,
    ] = await Promise.all([
      api('/api/health'),
      api('/api/auth/me'),
      api('/api/admin/dashboard'),
      api('/api/admin/platform-accounts'),
      api('/api/admin/institutions'),
      api('/api/admin/institution-orders'),
      api('/api/services'),
      api('/api/companions'),
      api('/api/admin/companion-reviews'),
      api('/api/admin/exceptions'),
      api('/api/admin/expenses'),
      api('/api/admin/operation-logs?limit=100'),
    ])
    state.currentAccount = currentAccount
    state.dashboard = dashboard
    state.platformAccounts = platformAccounts
    state.institutions = institutions
    state.institutionOrders = institutionOrders
    state.services = services
    state.companions = companions
    state.companionReviews = companionReviews
    state.exceptions = exceptions
    state.expenses = expenses
    state.operationLogs = operationLogs
    document.querySelector('#admin-account-name').textContent = currentAccount.displayName || '平台管理员'
    document.querySelector('#admin-account-login').textContent = currentAccount.loginName || '账号已登录'
    document.querySelector('#server-status').textContent = `${health.orders} 张订单 · 运行正常`
    document.querySelector('.status-light').classList.add('online')
    document.querySelector('#price-service-filter').innerHTML = services
      .map((service) => `<option value="${service.id}">${escapeHtml(service.name)}</option>`)
      .join('')
    renderDashboard()
    renderPlatformAccounts()
    renderInstitutions()
    renderInstitutionOrders()
    renderServicePricing()
    renderCompanionPricing()
    renderReviewCenter()
    renderOperationLogs()
    document.body.classList.remove('auth-required')
  } catch (error) {
    document.querySelector('#server-status').textContent = '连接失败'
    toast(error.message, 'error')
  }
}

document.querySelector('#login-environment').textContent =
  `${window.__HUICIEN_CONFIG__?.appEnv || 'test'} 环境 · 管理员操作全程留痕`

document.querySelector('#login-form').addEventListener('submit', async (event) => {
  event.preventDefault()
  const formElement = event.currentTarget
  const form = new FormData(formElement)
  const submit = formElement.querySelector('button[type="submit"]')
  submit.disabled = true
  try {
    const result = await api('/api/auth/admin/login', {
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

  const savePlatformAccount = event.target.closest('[data-save-platform-account]')
  if (savePlatformAccount) {
    const accountId = savePlatformAccount.dataset.savePlatformAccount
    const card = document.querySelector(`[data-platform-account-id="${accountId}"]`)
    const password = card.querySelector('[data-platform-field="temporaryPassword"]').value
    savePlatformAccount.disabled = true
    try {
      await api(`/api/admin/platform-accounts/${accountId}/access`, {
        method: 'PUT',
        body: JSON.stringify({
          loginName: card.querySelector('[data-platform-field="loginName"]').value,
          displayName: card.querySelector('[data-platform-field="displayName"]').value,
          accountStatus: card.querySelector('[data-platform-field="accountStatus"]').value,
          temporaryPassword: password || undefined,
        }),
      })
      if (accountId === state.currentAccount?.id && password) {
        accessToken = ''
        sessionStorage.removeItem(TOKEN_KEY)
        document.body.classList.add('auth-required')
        toast('密码已更新，请使用新密码重新登录')
        return
      }
      toast('管理员账号已保存')
      await loadAll()
      setView('platform-accounts')
    } catch (error) {
      toast(error.message, 'error')
    } finally {
      savePlatformAccount.disabled = false
    }
    return
  }

  const saveInstitution = event.target.closest('[data-save-institution]')
  if (saveInstitution) {
    const card = document.querySelector(`[data-institution-id="${saveInstitution.dataset.saveInstitution}"]`)
    const permissions = [...card.querySelectorAll('[data-access-permission]:checked')].map((input) => input.value)
    try {
      await api(`/api/admin/institutions/${saveInstitution.dataset.saveInstitution}/access`, {
        method: 'PUT',
        body: JSON.stringify({
          institutionStatus: card.querySelector('[data-access-field="institutionStatus"]').value,
          accountStatus: card.querySelector('[data-access-field="accountStatus"]').value,
          loginName: card.querySelector('[data-access-field="loginName"]').value,
          temporaryPassword: card.querySelector('[data-access-field="temporaryPassword"]').value || undefined,
          permissions,
        }),
      })
      toast('机构账号与权限已保存')
      await loadAll()
      setView('institutions')
    } catch (error) {
      toast(error.message, 'error')
    }
    return
  }

  const reviewAction = event.target.closest('[data-review-type]')
  if (reviewAction) {
    const type = reviewAction.dataset.reviewType
    const approved = reviewAction.dataset.reviewResult === 'APPROVED'
    const note = window.prompt(approved ? '请输入审核备注（可选）' : '请输入驳回原因', '') || ''
    const endpoint = {
      companion: `/api/admin/companion-reviews/${reviewAction.dataset.reviewId}/review`,
      exception: `/api/admin/exceptions/${reviewAction.dataset.reviewId}/review`,
      expense: `/api/admin/expenses/${reviewAction.dataset.reviewId}/review`,
    }[type]
    const status = type === 'exception'
      ? (approved ? 'RESOLVED' : 'REJECTED')
      : (approved ? 'APPROVED' : 'REJECTED')
    try {
      await api(endpoint, {
        method: 'POST',
        body: JSON.stringify({
          status,
          reason: note,
          note,
        }),
      })
      toast('审核结果已保存')
      await loadAll()
      setView('review-center')
    } catch (error) {
      toast(error.message, 'error')
    }
    return
  }

  const saveService = event.target.closest('[data-save-service]')
  if (saveService) {
    const row = document.querySelector(`[data-service-row="${saveService.dataset.saveService}"]`)
    try {
      await api(`/api/admin/services/${saveService.dataset.saveService}/pricing`, {
        method: 'PATCH',
        body: JSON.stringify({
          servicePrice: Math.round(Number(row.querySelector('[data-field="servicePrice"]').value) * 100),
          defaultCompanionPrice: Math.round(Number(row.querySelector('[data-field="defaultCompanionPrice"]').value) * 100),
          enabled: row.querySelector('[data-field="enabled"]').checked,
        }),
      })
      toast('服务价格已保存，仅影响后续订单')
      await loadAll()
      setView('service-pricing')
    } catch (error) {
      toast(error.message, 'error')
    }
    return
  }

  const saveCompanion = event.target.closest('[data-save-companion]')
  if (saveCompanion) {
    const input = document.querySelector(`[data-companion-price="${saveCompanion.dataset.saveCompanion}"]`)
    try {
      await api(`/api/admin/companions/${saveCompanion.dataset.saveCompanion}/prices/${saveCompanion.dataset.serviceId}`, {
        method: 'PUT',
        body: JSON.stringify({ price: input.value === '' ? null : Math.round(Number(input.value) * 100) }),
      })
      toast(input.value === '' ? '已恢复服务默认价' : '陪诊师个人价格已保存')
      state.companions = await api('/api/companions')
      renderCompanionPricing()
    } catch (error) {
      toast(error.message, 'error')
    }
  }
})

document.querySelector('#institution-form').addEventListener('submit', async (event) => {
  event.preventDefault()
  const formElement = event.currentTarget
  const form = new FormData(formElement)
  try {
    const institution = await api('/api/admin/institutions', {
      method: 'POST',
      body: JSON.stringify({
        name: form.get('name'),
        contactName: form.get('contactName'),
        contactPhone: form.get('contactPhone'),
        loginName: form.get('loginName'),
        displayName: form.get('displayName'),
        temporaryPassword: form.get('temporaryPassword'),
        permissions: form.getAll('permissions'),
        institutionStatus: 'APPROVED',
      }),
    })
    toast(`${institution.institutionName} 已开通`)
    formElement.reset()
    formElement.querySelectorAll('[name="permissions"]').forEach((input) => { input.checked = true })
    await loadAll()
    setView('institutions')
  } catch (error) {
    toast(error.message, 'error')
  }
})

document.querySelector('#platform-account-form').addEventListener('submit', async (event) => {
  event.preventDefault()
  const formElement = event.currentTarget
  const form = new FormData(formElement)
  const submit = formElement.querySelector('button[type="submit"]')
  submit.disabled = true
  try {
    const account = await api('/api/admin/platform-accounts', {
      method: 'POST',
      body: JSON.stringify({
        loginName: form.get('loginName'),
        displayName: form.get('displayName'),
        temporaryPassword: form.get('temporaryPassword'),
      }),
    })
    toast(`${account.displayName} 的管理员账号已创建`)
    formElement.reset()
    await loadAll()
    setView('platform-accounts')
  } catch (error) {
    toast(error.message, 'error')
  } finally {
    submit.disabled = false
  }
})

document.querySelector('#price-service-filter').addEventListener('change', renderCompanionPricing)
document.querySelector('#admin-order-search').addEventListener('input', renderInstitutionOrders)
document.querySelector('#admin-order-institution').addEventListener('change', renderInstitutionOrders)
document.querySelector('#admin-order-status').addEventListener('change', renderInstitutionOrders)

if (!accessToken) document.body.classList.add('auth-required')
loadAll()

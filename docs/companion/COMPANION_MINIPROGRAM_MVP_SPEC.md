# 汇慈恩陪诊师端微信小程序 MVP 规格

版本：`0.1-draft`  
日期：`2026-07-18`  
状态：陪诊师端开发基线  
适用范围：上海地区首发 MVP

## 1. 产品定位

陪诊师端是内部履约工作台，不是 C 端换皮，也不是公开抢单平台。

首发目标只有三个：

1. 陪诊师随时知道当前任务和下一步操作。
2. 每个履约节点都有可追溯记录。
3. 任何异常都能立即上报平台并进入人工处理。

首发明确不做：

- 会员、积分、勋章、排行榜。
- 邀请奖励、裂变活动。
- 公开抢单大厅。
- 陪诊师自行改价、退款或取消用户订单。
- 复杂钱包、提现和金融账户。
- 医疗诊断、病情判断和医疗建议。
- 社交动态、评价互关等非履约功能。

## 2. 工程与系统边界

### 2.1 推荐工程形态

- 陪诊师端使用独立微信小程序和独立身份体系。
- 与 C 端共用服务端订单、医院、服务和消息数据。
- 不复用 C 端页面、路由、用户 Store 或本地 Mock。
- 可复用设计 Token、V3 图标和无业务含义的基础组件。
- 服务端必须根据角色校验每个接口，不能只靠前端隐藏入口。

建议后续在仓库中建立独立运行目录：

```text
companion-miniprogram/
```

在正式创建目录前，必须先确定 AppID、请求域名、登录方式和后端 API 基线。

### 2.2 与当前 C 端模型的关系

当前 C 端订单状态位于：

```text
miniprogram/types/order.ts
miniprogram/utils/order-status.ts
```

现有 `OrderStatus` 继续作为用户可见的订单聚合状态。陪诊师端不得把“出发、到院、会合”等内部节点直接塞入 `OrderStatus`，应新增独立的履约任务状态。

## 3. 角色与账户状态

### 3.1 角色

| 角色 | 权限 |
| --- | --- |
| 陪诊师 | 查看本人任务、执行履约节点、提交记录、上报异常 |
| 调度员 | 派单、改派、撤回、处理拒单和超时 |
| 客服 | 查看订单和异常、联系双方、记录处理结论 |
| 运营管理员 | 审核陪诊师、配置技能/医院/排班、查看质量数据 |
| 财务 | 查看结算单、确认结算，不修改履约记录 |

### 3.2 陪诊师账户状态

```ts
type CompanionAccountStatus =
  | 'PENDING_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'SUSPENDED'
  | 'DISABLED'
```

规则：

- 只有 `APPROVED` 可以进入工作台和接收任务。
- `PENDING_REVIEW` 只能查看审核进度。
- `REJECTED` 展示原因和重新提交入口。
- `SUSPENDED`、`DISABLED` 禁止执行任何订单动作，并展示平台联系方式。

### 3.3 在线状态

```ts
type CompanionAvailability = 'AVAILABLE' | 'BUSY' | 'OFFLINE'
```

- `AVAILABLE`：可以接收平台派单。
- `BUSY`：历史兼容状态，不再因已有任务自动进入该状态。
- `OFFLINE`：不接收新任务。
- 已接任务不影响继续接单；切换为 `OFFLINE` 只停止接收新任务，不影响已接任务。

### 3.4 注册审核与客户端推荐池

陪诊师注册申请包含姓名、手机号、身份证号、性别、从业年限、个人介绍、服务技能、服务医院、服务区域、身份证正反面和资质证明。申请人不能填写客户端服务价格，也不能自行设置评分、服务次数或“推荐”状态。

申请流转：

```text
提交注册
→ PENDING_REVIEW（仅能查看审核进度）
→ APPROVED（生成公开陪诊师档案并进入客户端推荐池）
或 REJECTED（展示原因，可修改后重新提交）
```

数据边界：

- 身份证原文和证件图片属于审核私密资料，不进入客户端公开档案。
- 当前本地 Mock 只持久化脱敏手机号、脱敏身份证号和图片数量；页面退出后不保留证件临时路径。
- 审核通过后生成独立公开档案，客户端推荐列表只消费 `APPROVED` 记录。
- 客户端价格由平台服务配置映射，不能信任申请人输入。
- 新审核账号的任务、账单、质量数据从空状态开始，不能继承演示账号数据。
- 两个独立微信小程序的本地 Storage 不互通；正式上线时“审核通过后自动加入推荐陪诊师”必须由后端审核事件和共享数据库完成，当前 Mock 仅验证状态机和数据契约。

## 4. 状态机

### 4.1 陪诊任务状态

```ts
type CompanionTaskStatus =
  | 'OFFERED'
  | 'ACCEPTED'
  | 'DEPARTING'
  | 'ARRIVED'
  | 'MET_PATIENT'
  | 'IN_SERVICE'
  | 'PENDING_SUMMARY'
  | 'COMPLETED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'CANCELLED'
```

### 4.2 正常流转

```text
OFFERED
→ ACCEPTED
→ DEPARTING
→ ARRIVED
→ MET_PATIENT
→ IN_SERVICE
→ PENDING_SUMMARY
→ COMPLETED
```

终止流转：

```text
OFFERED → REJECTED
OFFERED → EXPIRED
任一未完成状态 → CANCELLED（仅平台操作）
```

### 4.3 状态动作与校验

| 当前状态 | 陪诊师主操作 | 下一状态 | 必要校验 |
| --- | --- | --- | --- |
| `OFFERED` | 接受任务 | `ACCEPTED` | 任务未过期、账户可用、无时间冲突 |
| `OFFERED` | 拒绝任务 | `REJECTED` | 必选拒绝原因 |
| `ACCEPTED` | 确认出发 | `DEPARTING` | 已完成服务前确认清单 |
| `DEPARTING` | 已到医院 | `ARRIVED` | 记录时间；定位只在用户授权后使用 |
| `ARRIVED` | 已与用户会合 | `MET_PATIENT` | 会合确认 |
| `MET_PATIENT` | 开始服务 | `IN_SERVICE` | 双方身份和服务内容已核对 |
| `IN_SERVICE` | 服务流程结束 | `PENDING_SUMMARY` | 必要节点已完成或填写未完成原因 |
| `PENDING_SUMMARY` | 提交服务总结 | `COMPLETED` | 总结、费用和异常状态校验通过 |

规则：

- 所有状态变更由服务端校验当前版本，客户端不能本地直接认定成功。
- 每次动作携带唯一 `clientActionId`，防止弱网重复点击。
- 服务端保存操作者、设备、时间、前后状态和请求 ID。
- 陪诊师不能回退状态；确需回退由调度员操作并留下审计记录。

### 4.4 与 C 端订单状态映射

| 陪诊任务状态 | C 端 `OrderStatus` |
| --- | --- |
| 尚未创建任务、`REJECTED`、`EXPIRED` | `PENDING_ASSIGNMENT` |
| `OFFERED`（用户指定陪诊师） | `PENDING_CONFIRMATION` |
| `ACCEPTED`、`DEPARTING`、`ARRIVED`、`MET_PATIENT` | `PENDING_SERVICE` |
| `IN_SERVICE`、`PENDING_SUMMARY` | `IN_SERVICE` |
| `COMPLETED` | `PENDING_REVIEW` |
| 平台取消 | `CANCELLED` 或进入退款流程 |

用户提交评价后，C 端订单才进入 `COMPLETED`。陪诊任务完成与用户评价完成是两个不同事件。

## 5. 异常模型

异常不能取代主任务状态，应独立记录：

```ts
type TaskExceptionStatus = 'OPEN' | 'PROCESSING' | 'RESOLVED' | 'CLOSED'

type TaskExceptionCategory =
  | 'USER_UNREACHABLE'
  | 'USER_LATE'
  | 'USER_NO_SHOW'
  | 'HOSPITAL_CHANGED'
  | 'DEPARTMENT_CHANGED'
  | 'SERVICE_OVERTIME'
  | 'EXTRA_SERVICE_REQUEST'
  | 'EXPENSE_DISPUTE'
  | 'HEALTH_EMERGENCY'
  | 'COMPLAINT_OR_CONFLICT'
  | 'OTHER'
```

每条异常至少包含：

- 异常分类。
- 当前任务和履约节点。
- 文字说明。
- 发生时间。
- 陪诊师提交时间。
- 必要凭证。
- 平台处理人和处理结论。
- 是否影响订单、费用、退款或人员安全。

高优先级异常：

- `HEALTH_EMERGENCY`
- `COMPLAINT_OR_CONFLICT`
- `USER_NO_SHOW`
- `EXPENSE_DISPUTE`

高优先级异常提交后：

1. 固定显示“联系平台”操作。
2. 通知调度与客服。
3. 暂停不可逆的完成操作。
4. 按平台应急 SOP 处理；陪诊师不作医疗判断。

## 6. 信息架构

### 6.1 底部 Tab

| Tab | 路由建议 | 主要职责 |
| --- | --- | --- |
| 工作台 | `pages/workbench/index` | 在线状态、下一任务、今日任务和异常提醒 |
| 任务 | `pages/tasks/index` | 分类查看全部本人任务 |
| 消息 | `pages/messages/index` | 派单、平台通知和异常处理消息 |
| 我的 | `pages/profile/index` | 认证、能力、排班、结算与设置 |

### 6.2 MVP 页面

| 页面 | 路由建议 | MVP |
| --- | --- | --- |
| 登录 | `pages/login/index` | 必须 |
| 审核状态 | `pages/review-status/index` | 必须 |
| 工作台 | `pages/workbench/index` | 必须 |
| 任务列表 | `pages/tasks/index` | 必须 |
| 任务详情 | `pages/task-detail/index` | 必须 |
| 服务执行 | `pages/service-execution/index` | 必须 |
| 服务总结 | `pages/service-summary/index` | 必须 |
| 异常上报 | `pages/exception-report/index` | 必须 |
| 消息列表 | `pages/messages/index` | 必须 |
| 我的 | `pages/profile/index` | 必须 |
| 能力与服务范围 | `pages/capabilities/index` | 第二阶段 |
| 排班设置 | `pages/schedule/index` | 第二阶段 |
| 收入与结算 | `pages/settlements/index` | 第二阶段 |
| 培训中心 | `pages/training/index` | 第二阶段 |

## 7. 页面规格

### 7.1 登录与审核状态

登录页：

- 微信登录。
- 手机号绑定。
- 服务协议与隐私政策。
- 不允许普通 C 端用户凭同一身份直接进入。

审核状态页：

- 当前状态。
- 审核说明或驳回原因。
- 资料更新时间。
- 联系平台。
- 重新提交入口仅在服务端允许时显示。

### 7.2 工作台

从上到下：

1. 陪诊师姓名、审核标识和在线状态。
2. 下一任务大卡片。
3. 今日任务概览。
4. 未处理异常提醒。
5. 平台公告。

下一任务卡必须显示：

- 距离预约开始时间。
- 服务名称。
- 预约日期和时间。
- 医院、院区、科室。
- 当前履约状态。
- 唯一主操作。

没有任务时：

- 明确显示“当前暂无任务”。
- `AVAILABLE` 时提示保持消息通知。
- 不展示虚假任务、收入或排名。

### 7.3 任务列表

筛选：

- 待确认：`OFFERED`
- 待服务：`ACCEPTED`、`DEPARTING`、`ARRIVED`、`MET_PATIENT`
- 服务中：`IN_SERVICE`、`PENDING_SUMMARY`
- 已完成：`COMPLETED`

任务卡字段：

- 状态。
- 服务名称。
- 日期时间。
- 医院、科室。
- 就诊人脱敏称呼。
- 异常标识。
- 当前可执行主操作。

### 7.4 任务详情

信息分组：

1. 当前状态与下一步。
2. 预约信息。
3. 集合与导航信息。
4. 就诊人最小必要信息。
5. 特殊需求和备注。
6. 服务内容与边界。
7. 履约时间线。
8. 费用和异常记录。

接单前只显示：

- 服务类型。
- 日期时间。
- 医院、科室、区域。
- 预计服务时长。
- 特殊能力要求。

接单后才显示：

- 就诊人脱敏姓名。
- 脱敏手机号或隐私通话入口。
- 集合地点。
- 与服务直接相关的特殊需求。

不得显示：

- 完整身份证号。
- 与本次服务无关的病史。
- C 端完整支付信息。
- 其他陪诊师或内部调度评分。

### 7.5 服务执行

页面固定结构：

- 顶部：当前任务和服务计时。
- 中部：履约节点时间线。
- 底部：唯一主操作和“报告异常”次操作。

基础节点：

1. 与用户确认集合。
2. 到院报到。
3. 科室候诊。
4. 就诊/检查协助。
5. 缴费或取药协助。
6. 服务结果确认。

不同服务由服务端下发节点模板，客户端不硬编码所有流程。

节点记录：

- 完成时间。
- 备注。
- 是否需要凭证。
- 未完成原因。

### 7.6 服务总结

必填：

- 实际开始时间。
- 实际结束时间。
- 已完成节点。
- 服务结果摘要。
- 未完成事项及原因。
- 是否发生异常。

按业务需要填写：

- 垫付费用。
- 票据或凭证。
- 交付物说明。
- 需要家属后续关注的非诊断性事项。

提交后不可由陪诊师直接修改。需要更正时提交更正申请，由平台留痕处理。

### 7.7 异常上报

交互顺序：

1. 选择异常分类。
2. 选择紧急程度。
3. 填写说明。
4. 上传必要凭证。
5. 确认提交。

提交成功后显示：

- 异常单号。
- 当前处理状态。
- 平台是否已接收。
- 联系平台入口。

### 7.8 消息

消息类型：

- 新任务。
- 接单结果。
- 任务变更。
- 服务提醒。
- 异常处理结果。
- 平台公告。

消息只负责通知，关键状态必须重新从任务接口获取，不能以本地消息内容作为真实订单状态。

### 7.9 我的

MVP 保留：

- 头像、姓名、审核状态。
- 在线状态。
- 服务技能和医院范围摘要。
- 联系平台。
- 服务规范。
- 隐私政策。
- 账号安全。
- 退出登录。

第二阶段加入：

- 排班。
- 收入与结算。
- 培训。
- 服务质量反馈。

## 8. 视觉与交互规范

- 继续使用当前汇慈恩陪诊品牌蓝和 V3 图标。
- 页面背景、卡片、字号和圆角与 C 端保持品牌一致。
- 陪诊师端减少营销 Banner、装饰插图和横向滑动。
- 状态色：
  - 蓝：正常待办和主要操作。
  - 绿：已到达、进行中、已完成。
  - 橙：即将超时或需要关注。
  - 红：异常、冲突和不可逆危险操作。
- 每页只保留一个视觉最强的主操作。
- 主操作固定在底部安全区上方，不得被 Tab、键盘或系统手势区遮挡。
- 所有点击区域至少 `88rpx × 88rpx`。
- 状态不能只靠颜色表达，必须同时显示文字或图标。
- 375px 宽度、小屏 Android、系统字体放大必须可用。
- 服务执行页弱网时显示离线/重试状态，不允许静默丢失操作。

## 9. 派单规则

### 9.1 首发模式

采用“双接单模式”：

- 定向派单：平台或合作机构指定候选陪诊师，陪诊师确认或拒绝。
- 抢单大厅：认证合作机构填写客户资料并发布，符合医院或区域服务范围的陪诊师先抢先得。

服务技能只作为个人资料和推荐标签，不限制陪诊师可抢的服务类型。

### 9.2 候选人硬性过滤

陪诊师必须同时满足：

- 账户为 `APPROVED`。
- 在线状态为 `AVAILABLE`。
- 医院或区域在服务范围内。
- 没有平台限制或未处理的高风险事件。

陪诊师可同时承接多项任务，平台不设置同时任务数量上限；时间安排由陪诊师在抢单前自行核对。

### 9.3 推荐排序

建议排序因素：

1. 用户明确指定的陪诊师。
2. 服务技能匹配。
3. 医院熟悉度。
4. 时间和排班匹配。
5. 当前任务负载。
6. 距离或预计到达时间（仅在合法授权和数据可用时使用）。
7. 近期履约质量。

首发不得把评分作为唯一派单依据。

### 9.4 接单规则

- 接单时限由后台配置，MVP 建议默认 5 分钟。
- 超时后任务进入 `EXPIRED`，平台重新派单。
- 拒单必须选择原因：
  - 时间冲突。
  - 距离过远。
  - 服务能力不匹配。
  - 临时不可服务。
  - 其他。
- 平台匹配模式可自动进入下一候选人。
- 用户指定模式下，拒绝或超时必须通知调度员，不得静默替换用户指定人员。

### 9.5 抢单规则

- 合作机构必须通过认证并拥有订单发布权限。
- 发布前校验服务类型、医院、时间、客户联系方式和付费状态。
- 抢单前只展示机构、服务、医院科室、日期时段、年龄段、必要服务需求和预计陪诊师收入。
- 抢单前不得返回客户姓名、手机号、详细集合地点或医疗资料。
- 抢单请求必须携带 `expectedVersion` 和 `clientActionId`。
- 服务端使用事务、条件更新或分布式锁保证只有一个陪诊师成功，不得依赖客户端按钮状态。
- 抢单成功后生成归属该陪诊师的 `CompanionTask`，状态从 `ACCEPTED` 开始，并解锁任务所需的脱敏客户资料。
- 非 `AVAILABLE`、医院或区域不在服务范围、账号受限时禁止抢单。
- 机构撤回、订单过期或已被抢走时，客户端刷新大厅并给出明确结果。

### 9.6 变更规则

- 医院、科室、时间、服务内容发生关键变化时，生成新版本。
- 陪诊师必须确认新版本后才能继续。
- 用户端和陪诊师端展示同一版本号和更新时间。
- 服务开始后，费用变化只能由平台确认。

## 10. 后端接口基线

建议接口组：

```text
POST   /companion/auth/wechat-login
GET    /companion/me
PATCH  /companion/me/availability

GET    /companion/tasks
GET    /companion/tasks/:id
GET    /companion/grab-orders
POST   /companion/grab-orders/:id/claim
POST   /companion/tasks/:id/accept
POST   /companion/tasks/:id/reject
POST   /companion/tasks/:id/transition
POST   /companion/tasks/:id/milestones
POST   /companion/tasks/:id/summary

POST   /companion/tasks/:id/exceptions
GET    /companion/tasks/:id/exceptions

POST   /companion/tasks/:id/expenses
GET    /companion/messages
POST   /companion/messages/:id/read

GET    /companion/settlements
```

所有写接口要求：

- Token 和角色鉴权。
- 任务归属校验。
- 当前状态和版本校验。
- `clientActionId` 幂等。
- 请求 ID。
- 服务端时间。
- 审计日志。

## 11. 核心数据结构

```ts
interface CompanionTask {
  id: string
  orderId: string
  orderNo: string
  companionId: string
  status: CompanionTaskStatus
  version: number

  serviceId: string
  serviceName: string
  serviceDurationMinutes?: number

  hospitalId: string
  hospitalName: string
  campusName?: string
  departmentName: string
  meetingPoint?: string

  bookingDate: string
  bookingTime: string
  acceptedAt?: string
  departedAt?: string
  arrivedAt?: string
  metPatientAt?: string
  serviceStartedAt?: string
  serviceEndedAt?: string
  completedAt?: string

  patientDisplayName?: string
  patientPhoneMasked?: string
  privacyCallEnabled: boolean
  specialNeeds: string[]
  remark?: string

  activeExceptionCount: number
  createdAt: string
  updatedAt: string
}

interface ServiceMilestone {
  id: string
  taskId: string
  code: string
  title: string
  required: boolean
  evidenceRequired: boolean
  status: 'PENDING' | 'COMPLETED' | 'SKIPPED'
  note?: string
  completedAt?: string
}
```

金额继续使用“分”存储，时间使用带时区语义的服务端时间。

## 12. 安全与隐私

- 服务端按任务归属返回数据。
- 接单前不返回患者身份和联系方式。
- 联系方式优先通过隐私通话。
- 图片上传前提示用途，服务端进行访问控制和留存管理。
- 日志、埋点和错误上报不得包含姓名、手机号、证件号和医疗内容。
- 任务完成后按规则收缩可见字段。
- 前端页面可加订单号和陪诊师 ID 水印，降低敏感页面外传风险。
- 退出登录时清理 Token、任务缓存和敏感临时文件。

## 13. 弱网与并发

- 状态操作显示提交中，禁止重复点击。
- 网络失败保留用户输入，但不得本地假装状态已成功。
- 重试必须复用同一 `clientActionId`。
- 服务端返回版本冲突时，刷新任务并提示“任务状态已更新”。
- 消息到达后重新拉取任务详情。
- 本地缓存只用于展示，不作为订单事实来源。

## 14. 运营后台最小能力

没有以下能力，不进入陪诊师端正式开发验收：

- 陪诊师审核、启用、暂停。
- 服务技能和医院范围配置。
- 订单候选人推荐。
- 合作机构订单创建、发布、撤回和过期处理。
- 抢单资格过滤与原子抢单确认。
- 人工派单、改派和撤回。
- 接单超时提醒。
- 履约节点和时间线查看。
- 异常工单处理。
- 客服处理记录。
- 费用和凭证审核。
- 操作审计日志。

## 15. MVP 验收标准

### 15.1 账户

- 未审核账号不能进入工作台。
- 被暂停账号无法执行任务动作。
- 退出后不能读取本地敏感任务数据。

### 15.2 派单

- 陪诊师只能看到派给自己的任务。
- 接受、拒绝和超时均能正确回写平台。
- 重复点击不产生重复状态记录。
- 时间冲突任务不能被接受。
- 抢单前不返回客户姓名、电话和详细集合地点。
- 并发抢同一订单时只能有一个陪诊师成功。
- 抢单成功后任务进入本人任务列表并沿用现有履约状态机。

### 15.3 履约

- 正常状态只能按允许顺序推进。
- 每个节点有服务端时间和操作者记录。
- 服务总结未完成时不能完成任务。
- C 端订单状态与陪诊任务映射正确。

### 15.4 异常

- 任一履约页面都能进入异常上报。
- 高优先级异常会通知调度和客服。
- 异常处理不覆盖主任务时间线。
- 平台处理结论可回传陪诊师端。

### 15.5 适配与稳定性

- iOS、Android、小屏和字体放大可用。
- 底部主操作不被安全区和键盘遮挡。
- 弱网重复提交不造成重复状态。
- 重新进入小程序后能恢复服务端真实任务状态。

## 16. 开发阶段

### 第 0 阶段：合同与状态机

- 确认本规格。
- 明确 API 鉴权和 AppID。
- 定稿 `CompanionTaskStatus`、异常模型和 C 端映射。
- 后端提供接口 Mock 契约，不使用页面内散落 Mock。

### 第 1 阶段：最小履约闭环

- 登录与审核状态。
- 工作台。
- 任务列表和详情。
- 接受/拒绝。
- 出发、到院、会合、开始服务。
- 服务总结和完成。
- 异常上报。
- 最小派单后台。

### 第 2 阶段：运营效率

- 排班。
- 医院和技能配置。
- 消息中心。
- 费用记录与结算明细。
- 培训与服务规范。
- 质量数据。

### 第 3 阶段：规模化

- 自动候选人推荐。
- SLA 预警。
- 智能排班。
- 更完整的风控和质量体系。
- 经验证后再考虑激励体系。

## 17. 下一步实施入口

规格确认后，开发顺序固定为：

1. 新建独立 `companion-miniprogram/` 工程。
2. 先建立类型、环境配置、请求层、身份守卫和状态机测试。
3. 再实现登录、审核状态、工作台三个页面。
4. 同步提供最小派单后台接口 Mock。
5. 工作台验收后再进入任务详情和服务执行。

不得先批量创建无数据、无权限、无状态约束的空页面。

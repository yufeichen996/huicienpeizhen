import type {
  CompanionAvailability,
  CompanionApplication,
  CompanionMessage,
  CompanionProfile,
  CompanionRegistrationInput,
  CompanionSession,
  CompanionTask,
  CompanionTaskStatus,
  ExceptionCreatePayload,
  ExpenseCreatePayload,
  GrabOrder,
  GrabOrderClaimPayload,
  MilestoneMutationPayload,
  QualityOverview,
  ServiceMilestone,
  ServiceSummary,
  ServiceSummaryPayload,
  ScheduleOverview,
  SettlementOverview,
  TaskDetail,
  TaskExpense,
  TaskException,
  TaskMutationPayload,
  TrainingOverview,
  ApprovedCompanionPublicProfile,
  WorkbenchSummary,
} from '../types/domain'
import { assertCompanionTransition } from '../utils/task-state'
import { StorageKeys, storage } from '../utils/storage'

const pad = (value: number) => `${value}`.padStart(2, '0')
const formatDate = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
const now = () => new Date().toISOString()

const createDefaultTask = (): CompanionTask => {
  const serviceDate = new Date()
  serviceDate.setDate(serviceDate.getDate() + 1)
  return {
    id: 'task-demo-001',
    orderId: 'order-demo-001',
    orderNo: 'SH20260718001',
    companionId: 'lin-xiaowen',
    status: 'OFFERED',
    assignmentMode: 'selected',
    version: 1,
    serviceId: 'full-companion',
    serviceName: '全程陪诊',
    serviceDurationMinutes: 240,
    hospitalId: 'ruijin',
    hospitalName: '上海瑞金医院',
    campusName: '黄浦院区',
    departmentName: '心内科',
    bookingDate: formatDate(serviceDate),
    bookingTime: '08:30',
    meetingPoint: '门诊大厅服务台旁',
    patientDisplayName: '张先生',
    patientPhoneMasked: '138****2046',
    privacyCallEnabled: true,
    specialNeeds: ['老人独自就诊', '行动不便'],
    remark: '请提前十分钟到达，协助确认挂号窗口。',
    activeExceptionCount: 0,
    createdAt: now(),
    updatedAt: now(),
  }
}

const createHistoryTask = (): CompanionTask => {
  const serviceDate = new Date()
  serviceDate.setDate(serviceDate.getDate() - 3)
  const completedAt = new Date(serviceDate)
  completedAt.setHours(12, 20, 0, 0)
  return {
    id: 'task-history-001',
    orderId: 'order-history-001',
    orderNo: 'SH20260715006',
    companionId: 'lin-xiaowen',
    status: 'COMPLETED',
    assignmentMode: 'platform',
    version: 8,
    serviceId: 'exam-companion',
    serviceName: '检查陪同',
    serviceDurationMinutes: 180,
    hospitalId: 'huashan',
    hospitalName: '华山医院',
    campusName: '静安院区',
    departmentName: '神经内科',
    bookingDate: formatDate(serviceDate),
    bookingTime: '09:00',
    meetingPoint: '门诊一楼总服务台',
    patientDisplayName: '李女士',
    patientPhoneMasked: '139****7310',
    privacyCallEnabled: true,
    specialNeeds: ['需要协助取检查报告'],
    remark: '陪同完成核磁共振检查。',
    activeExceptionCount: 0,
    acceptedAt: new Date(serviceDate.setHours(7, 50, 0, 0)).toISOString(),
    departedAt: new Date(serviceDate.setHours(8, 10, 0, 0)).toISOString(),
    arrivedAt: new Date(serviceDate.setHours(8, 42, 0, 0)).toISOString(),
    metPatientAt: new Date(serviceDate.setHours(8, 51, 0, 0)).toISOString(),
    serviceStartedAt: new Date(serviceDate.setHours(9, 0, 0, 0)).toISOString(),
    serviceEndedAt: new Date(serviceDate.setHours(12, 8, 0, 0)).toISOString(),
    completedAt: completedAt.toISOString(),
    createdAt: new Date(serviceDate.setDate(serviceDate.getDate() - 1)).toISOString(),
    updatedAt: completedAt.toISOString(),
  }
}

interface GrabOrderPrivateDetail {
  patientDisplayName: string
  patientPhoneMasked: string
  meetingPoint: string
  specialNeeds: string[]
  remark: string
}

interface MockGrabOrderSeed {
  order: GrabOrder
  privateDetail: GrabOrderPrivateDetail
}

const dateAfter = (days: number) => {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return formatDate(date)
}

const createGrabOrderSeeds = (): MockGrabOrderSeed[] => {
  const publishedAt = now()
  const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString()
  return [
    {
      order: {
        id: 'grab-order-001',
        orderNo: 'JG20260718001',
        institutionId: 'institution-kangyi',
        institutionName: '康颐养老服务中心',
        institutionVerified: true,
        status: 'OPEN',
        version: 1,
        serviceId: 'full-companion',
        serviceName: '全程陪诊',
        serviceDurationMinutes: 240,
        hospitalId: 'ruijin',
        hospitalName: '上海瑞金医院',
        campusName: '黄浦院区',
        departmentName: '心内科',
        bookingDate: dateAfter(2),
        bookingTime: '09:00',
        serviceDistrict: '黄浦区',
        patientSummary: '男性 · 60–69 岁',
        serviceNeeds: ['老人独自就诊', '需要轮椅协助'],
        companionFee: 16800,
        publishedAt,
        expiresAt,
      },
      privateDetail: {
        patientDisplayName: '王先生',
        patientPhoneMasked: '136****4182',
        meetingPoint: '门诊大厅东侧服务台',
        specialNeeds: ['老人独自就诊', '需要轮椅协助'],
        remark: '机构联系人会在服务前补充电子挂号凭证。',
      },
    },
    {
      order: {
        id: 'grab-order-002',
        orderNo: 'JG20260718002',
        institutionId: 'institution-heyue',
        institutionName: '和悦社区养老中心',
        institutionVerified: true,
        status: 'OPEN',
        version: 1,
        serviceId: 'exam-companion',
        serviceName: '检查陪同',
        serviceDurationMinutes: 180,
        hospitalId: 'huashan',
        hospitalName: '华山医院',
        campusName: '静安院区',
        departmentName: '神经内科',
        bookingDate: dateAfter(4),
        bookingTime: '13:30',
        serviceDistrict: '静安区',
        patientSummary: '女性 · 50–59 岁',
        serviceNeeds: ['检查前报到', '协助取检查报告'],
        companionFee: 13800,
        publishedAt,
        expiresAt,
      },
      privateDetail: {
        patientDisplayName: '赵女士',
        patientPhoneMasked: '139****6705',
        meetingPoint: '门诊一楼总服务台',
        specialNeeds: ['检查前报到', '协助取检查报告'],
        remark: '请协助核对检查楼层，不提供医学判断。',
      },
    },
    {
      order: {
        id: 'grab-order-003',
        orderNo: 'JG20260718003',
        institutionId: 'institution-ruian',
        institutionName: '瑞安健康管理中心',
        institutionVerified: true,
        status: 'OPEN',
        version: 1,
        serviceId: 'report-analysis',
        serviceName: '报告解读',
        serviceDurationMinutes: 90,
        hospitalId: 'renji',
        hospitalName: '仁济医院',
        campusName: '东院',
        departmentName: '检验科',
        bookingDate: dateAfter(3),
        bookingTime: '15:00',
        serviceDistrict: '浦东新区',
        patientSummary: '女性 · 40–49 岁',
        serviceNeeds: ['领取纸质报告', '整理检查资料'],
        companionFee: 6800,
        publishedAt,
        expiresAt,
      },
      privateDetail: {
        patientDisplayName: '孙女士',
        patientPhoneMasked: '137****0921',
        meetingPoint: '门诊检验中心服务台',
        specialNeeds: ['领取纸质报告', '整理检查资料'],
        remark: '仅协助整理资料，不提供医学诊断或报告结论。',
      },
    },
  ]
}

const getGrabOrders = (): GrabOrder[] =>
  storage.get<GrabOrder[]>(
    StorageKeys.mockGrabOrders,
    createGrabOrderSeeds().map(({ order }) => order),
  )

const isGrabOrderEligible = (order: GrabOrder, profile: CompanionProfile) =>
  profile.serviceHospitals.includes(order.hospitalName)

const getEligibleOpenGrabOrders = (): GrabOrder[] => {
  const profile = getProfile()
  return getGrabOrders()
    .filter((order) => order.status === 'OPEN' && isGrabOrderEligible(order, profile))
    .map((order) => ({ ...order, serviceNeeds: [...order.serviceNeeds] }))
}

const claimGrabOrder = (
  orderId: string,
  payload: GrabOrderClaimPayload,
): { order: GrabOrder; task: CompanionTask } => {
  const profile = getProfile()
  if (profile.accountStatus !== 'APPROVED') throw new Error('账号审核通过后才能抢单')

  const orders = getGrabOrders()
  const target = orders.find((order) => order.id === orderId)
  if (!target) throw new Error('抢单任务不存在')
  if (target.status !== 'OPEN') throw new Error('该任务已被其他陪诊师抢走')
  if (target.version !== payload.expectedVersion) throw new Error('任务状态已更新，请刷新后重试')
  if (!isGrabOrderEligible(target, profile)) throw new Error('当前服务医院不在可服务范围')
  if (getAvailability() !== 'AVAILABLE') throw new Error('请先开启可接单状态')

  const seed = createGrabOrderSeeds().find(({ order }) => order.id === orderId)
  if (!seed) throw new Error('抢单任务详情不存在')
  const claimedAt = now()
  const claimedOrder: GrabOrder = {
    ...target,
    status: 'CLAIMED',
    version: target.version + 1,
    claimedAt,
    serviceNeeds: [...target.serviceNeeds],
  }
  storage.set(
    StorageKeys.mockGrabOrders,
    orders.map((order) => order.id === orderId ? claimedOrder : order),
  )

  const task: CompanionTask = {
    id: `task-${orderId}`,
    orderId,
    orderNo: target.orderNo,
    companionId: profile.id,
    status: 'ACCEPTED',
    assignmentMode: 'market',
    version: 1,
    serviceId: target.serviceId,
    serviceName: target.serviceName,
    serviceDurationMinutes: target.serviceDurationMinutes,
    hospitalId: target.hospitalId,
    hospitalName: target.hospitalName,
    campusName: target.campusName,
    departmentName: target.departmentName,
    bookingDate: target.bookingDate,
    bookingTime: target.bookingTime,
    meetingPoint: seed.privateDetail.meetingPoint,
    patientDisplayName: seed.privateDetail.patientDisplayName,
    patientPhoneMasked: seed.privateDetail.patientPhoneMasked,
    privacyCallEnabled: true,
    specialNeeds: [...seed.privateDetail.specialNeeds],
    remark: seed.privateDetail.remark,
    activeExceptionCount: 0,
    acceptedAt: claimedAt,
    createdAt: target.publishedAt,
    updatedAt: claimedAt,
  }
  saveTask(task)
  storage.set(StorageKeys.mockMessages, [
    {
      id: `message-claim-${orderId}`,
      type: 'TASK_UPDATE',
      title: '抢单成功',
      content: `${task.bookingDate} ${task.bookingTime}，${task.hospitalName} ${task.departmentName}`,
      createdAt: claimedAt,
      read: false,
      taskId: task.id,
    },
    ...getMessages(),
  ] satisfies CompanionMessage[])
  return {
    order: claimedOrder,
    task: { ...task, specialNeeds: [...task.specialNeeds] },
  }
}

const createMilestones = (taskId: string, completed = false): ServiceMilestone[] => {
  const completedAt = completed ? now() : undefined
  const status = completed ? 'COMPLETED' as const : 'PENDING' as const
  return [
    { id: `${taskId}-meet`, taskId, code: 'MEETING_CONFIRMED', title: '确认集合', description: '与用户核对集合地点和服务安排', required: true, evidenceRequired: false, status, evidenceImages: [], completedAt },
    { id: `${taskId}-register`, taskId, code: 'HOSPITAL_CHECK_IN', title: '到院报到', description: '协助完成取号或报到流程', required: true, evidenceRequired: false, status, evidenceImages: [], completedAt },
    { id: `${taskId}-waiting`, taskId, code: 'DEPARTMENT_WAITING', title: '科室候诊', description: '确认候诊位置并留意叫号', required: true, evidenceRequired: false, status, evidenceImages: [], completedAt },
    { id: `${taskId}-care`, taskId, code: 'CARE_ASSISTANCE', title: '就诊检查协助', description: '按服务边界提供流程协助', required: true, evidenceRequired: false, status, evidenceImages: [], completedAt },
    { id: `${taskId}-medicine`, taskId, code: 'PAYMENT_MEDICINE', title: '缴费或取药协助', description: '按用户实际需求完成，可说明不适用', required: false, evidenceRequired: false, status, evidenceImages: [], completedAt },
    { id: `${taskId}-result`, taskId, code: 'RESULT_CONFIRMED', title: '服务结果确认', description: '与用户确认交付物和后续非诊断事项', required: true, evidenceRequired: false, status, evidenceImages: [], completedAt },
  ]
}

const getAvailability = (): CompanionAvailability => {
  const availability = storage.get<CompanionAvailability>(StorageKeys.availability, 'AVAILABLE')
  return availability === 'BUSY' ? 'AVAILABLE' : availability
}

const createDefaultProfile = (): CompanionProfile => ({
  id: 'lin-xiaowen',
  name: '林晓雯',
  phoneMasked: '138****5628',
  verified: true,
  accountStatus: 'APPROVED',
  availability: getAvailability(),
  serviceCount: 541,
  serviceSkills: ['全程陪诊', '检查陪同', '代取药物'],
  serviceHospitals: ['上海瑞金医院', '华山医院', '仁济医院'],
})

const getApplication = (): CompanionApplication | null =>
  storage.get<CompanionApplication | null>(StorageKeys.mockApplication, null)

const createProfileFromApplication = (application: CompanionApplication): CompanionProfile => ({
  id: `registered-${application.id}`,
  name: application.name,
  phoneMasked: application.phoneMasked,
  verified: application.status === 'APPROVED',
  accountStatus: application.status,
  availability: application.status === 'APPROVED' ? getAvailability() : 'OFFLINE',
  serviceCount: 0,
  serviceSkills: [...application.serviceSkillNames],
  serviceHospitals: [...application.serviceHospitalNames],
})

const getProfile = (): CompanionProfile => {
  const application = getApplication()
  return application ? createProfileFromApplication(application) : createDefaultProfile()
}

const createPublicProfile = (
  application: CompanionApplication,
): ApprovedCompanionPublicProfile => ({
  applicationId: application.id,
  companionId: `registered-${application.id}`,
  name: application.name,
  gender: application.gender,
  workingYears: application.workingYears,
  introduction: application.introduction,
  bio: application.introduction.length > 42
    ? `${application.introduction.slice(0, 42)}…`
    : application.introduction,
  tags: [
    '新入驻',
    ...application.serviceSkillNames.slice(0, 2),
  ],
  skillServiceIds: [...application.skillServiceIds],
  serviceHospitalIds: [...application.serviceHospitalIds],
  serviceDistricts: [...application.serviceDistricts],
  approvedAt: application.reviewedAt || application.updatedAt,
  isRecommended: true,
})

const terminalTaskStatuses: CompanionTaskStatus[] = [
  'COMPLETED',
  'REJECTED',
  'EXPIRED',
  'CANCELLED',
]

const getTaskRecords = (): CompanionTask[] => {
  const fallback = createDefaultTask()
  const storedTasks = storage.get<CompanionTask[] | null>(StorageKeys.mockTasks, null)
  if (storedTasks?.length) {
    return storedTasks.map((task) => ({
      ...(task.id === fallback.id ? fallback : {}),
      ...task,
      specialNeeds: [...task.specialNeeds],
    }))
  }
  const stored = storage.get<CompanionTask | null>(StorageKeys.mockTask, null)
  return [stored ? { ...fallback, ...stored, specialNeeds: [...stored.specialNeeds] } : fallback]
}

const getTask = (): CompanionTask => {
  const profileId = getProfile().id
  const ownedTasks = getTaskRecords().filter((task) => task.companionId === profileId)
  return ownedTasks.find((task) => !terminalTaskStatuses.includes(task.status))
    || ownedTasks[0]
    || createDefaultTask()
}

const saveTask = (task: CompanionTask) => {
  const tasks = getTaskRecords()
  const existingIndex = tasks.findIndex((item) => item.id === task.id)
  const nextTasks = existingIndex >= 0
    ? tasks.map((item) => item.id === task.id ? task : item)
    : [...tasks, task]
  storage.set(StorageKeys.mockTasks, nextTasks)
  storage.remove(StorageKeys.mockTask)
  return task
}

const getTaskById = (taskId: string): CompanionTask => {
  const activeTask = getTaskRecords().find((task) => task.id === taskId)
  if (activeTask) return activeTask
  const historyTask = createHistoryTask()
  if (historyTask.id === taskId) return historyTask
  throw new Error('任务不存在')
}

const hideSensitiveFieldsBeforeAcceptance = (task: CompanionTask): CompanionTask => {
  if (task.status !== 'OFFERED') return { ...task, specialNeeds: [...task.specialNeeds] }
  return {
    ...task,
    meetingPoint: undefined,
    patientDisplayName: undefined,
    patientPhoneMasked: undefined,
    specialNeeds: [],
    remark: undefined,
  }
}

const timestampFieldByStatus: Partial<Record<CompanionTaskStatus, keyof CompanionTask>> = {
  ACCEPTED: 'acceptedAt',
  DEPARTING: 'departedAt',
  ARRIVED: 'arrivedAt',
  MET_PATIENT: 'metPatientAt',
  IN_SERVICE: 'serviceStartedAt',
  PENDING_SUMMARY: 'serviceEndedAt',
  COMPLETED: 'completedAt',
}

const mutateTask = (
  taskId: string,
  nextStatus: CompanionTaskStatus,
  payload: TaskMutationPayload,
): CompanionTask => {
  const current = getTaskById(taskId)
  if (current.companionId !== getProfile().id) throw new Error('无权操作该任务')
  if (current.version !== payload.expectedVersion) throw new Error('任务状态已更新，请刷新后重试')
  assertCompanionTransition(current.status, nextStatus)
  const updatedAt = now()
  const timestampField = timestampFieldByStatus[nextStatus]
  const updated = saveTask({
    ...current,
    status: nextStatus,
    version: current.version + 1,
    ...(timestampField ? { [timestampField]: updatedAt } : {}),
    updatedAt,
  })
  return hideSensitiveFieldsBeforeAcceptance(updated)
}

const getMilestones = (task: CompanionTask): ServiceMilestone[] => {
  const stored = storage.get<ServiceMilestone[]>(StorageKeys.mockMilestones, [])
    .filter((item) => item.taskId === task.id)
  return (stored.length ? stored : createMilestones(task.id, task.status === 'COMPLETED'))
    .map((item) => ({
      ...item,
      evidenceImages: [...(item.evidenceImages || [])],
      failureReason: item.failureReason || (item.status === 'SKIPPED' ? item.note : undefined),
      failedAt: item.failedAt || (item.status === 'SKIPPED' ? item.completedAt : undefined),
    }))
}

const getExceptions = (taskId: string): TaskException[] =>
  storage.get<TaskException[]>(StorageKeys.mockExceptions, [])
    .filter((item) => item.taskId === taskId)

const createResolvedException = (): TaskException => ({
  id: 'exception-history-001',
  taskId: 'task-history-001',
  ticketNo: 'EX20260715001',
  category: 'HOSPITAL_CHANGED',
  urgency: 'LOW',
  status: 'RESOLVED',
  taskStatus: 'IN_SERVICE',
  description: '检查楼层临时调整，已与用户确认并按现场指引完成服务。',
  evidencePaths: [],
  occurredAt: '2026-07-15T09:30:00+08:00',
  submittedAt: '2026-07-15T09:34:00+08:00',
  resolution: '平台已确认属于医院现场正常调整，不影响本次服务结算。',
})

const getAllExceptions = (): TaskException[] => [
  ...storage.get<TaskException[]>(StorageKeys.mockExceptions, []),
  createResolvedException(),
].filter((item) => {
  const activeProfileId = getProfile().id
  const task = getTaskRecords().find((candidate) => candidate.id === item.taskId)
  if (task) return task.companionId === activeProfileId
  if (item.taskId === 'task-history-001') return createHistoryTask().companionId === activeProfileId
  return false
})

const getExpenses = (taskId: string): TaskExpense[] => {
  if (taskId === 'task-history-001') {
    return [{
      id: 'expense-history-001',
      taskId,
      category: 'EXAMINATION',
      amount: 3500,
      description: '代用户垫付检查资料打印费用',
      receiptPaths: [],
      paidAt: '2026-07-15T10:20:00+08:00',
      submittedAt: '2026-07-15T10:24:00+08:00',
      status: 'CONFIRMED',
    }]
  }
  return storage.get<TaskExpense[]>(StorageKeys.mockExpenses, [])
    .filter((item) => item.taskId === taskId)
}

const getSummary = (taskId: string): ServiceSummary | null => {
  const stored = storage.get<ServiceSummary | Record<string, ServiceSummary> | null>(
    StorageKeys.mockSummary,
    null,
  )
  if (!stored) return null
  if (typeof (stored as ServiceSummary).taskId === 'string') {
    const summary = stored as ServiceSummary
    return summary.taskId === taskId ? summary : null
  }
  return (stored as Record<string, ServiceSummary>)[taskId] || null
}

const saveSummary = (summary: ServiceSummary) => {
  const stored = storage.get<ServiceSummary | Record<string, ServiceSummary> | null>(
    StorageKeys.mockSummary,
    null,
  )
  const summaries = stored && typeof (stored as ServiceSummary).taskId !== 'string'
    ? stored as Record<string, ServiceSummary>
    : {}
  storage.set(StorageKeys.mockSummary, { ...summaries, [summary.taskId]: summary })
}

const createDefaultMessages = (): CompanionMessage[] => {
  const task = getTask()
  const timeBefore = (minutes: number) =>
    new Date(Date.now() - minutes * 60 * 1000).toISOString()
  if (task.companionId !== getProfile().id) {
    return [{
      id: 'message-approved-welcome',
      type: 'ANNOUNCEMENT',
      title: '审核已通过',
      content: '您的公开档案已进入推荐池，完善排班后即可等待平台派单。',
      createdAt: timeBefore(8),
      read: false,
    }]
  }
  return [
    {
      id: 'message-task-offer',
      type: 'NEW_TASK',
      title: '您有一项新的陪诊任务',
      content: `${task.bookingDate} ${task.bookingTime}，${task.hospitalName} ${task.departmentName}`,
      createdAt: timeBefore(8),
      read: false,
      taskId: task.id,
    },
    {
      id: 'message-reminder',
      type: 'SERVICE_REMINDER',
      title: '服务前准备提醒',
      content: '请提前核对预约时间、医院院区和服务边界。',
      createdAt: timeBefore(95),
      read: false,
      taskId: task.id,
    },
    {
      id: 'message-history',
      type: 'TASK_UPDATE',
      title: '服务总结已完成归档',
      content: '华山医院检查陪同任务已进入待用户评价。',
      createdAt: timeBefore(24 * 60),
      read: true,
      taskId: 'task-history-001',
    },
    {
      id: 'message-announcement',
      type: 'ANNOUNCEMENT',
      title: '平台服务规范提醒',
      content: '陪诊服务不包含诊断判断，突发情况请优先联系现场医务人员。',
      createdAt: timeBefore(2 * 24 * 60),
      read: true,
    },
  ]
}

const getMessages = (): CompanionMessage[] =>
  storage.get<CompanionMessage[]>(StorageKeys.mockMessages, createDefaultMessages())

const getSchedule = (): ScheduleOverview => {
  const activeTasks = getTaskRecords().filter(
    (task) => task.companionId === getProfile().id
      && !terminalTaskStatuses.includes(task.status),
  )
  const overrides = storage.get<Record<string, boolean>>(StorageKeys.mockSchedule, {})
  const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date()
    date.setDate(date.getDate() + index)
    const dateText = formatDate(date)
    const dayTasks = activeTasks.filter((task) => dateText === task.bookingDate)
    const hasTask = dayTasks.length > 0
    return {
      date: dateText,
      weekDay: index === 0 ? '今天' : weekDays[date.getDay()],
      dayNumber: `${date.getMonth() + 1}/${date.getDate()}`,
      available: hasTask ? true : overrides[dateText] ?? index < 5,
      hasTask,
      taskTime: hasTask ? dayTasks.map((task) => task.bookingTime).sort().join('、') : undefined,
    }
  })
  return {
    days,
    timezone: 'Asia/Shanghai',
    notice: '排班用于平台派单参考，已有任务日期不能关闭服务时间。',
  }
}

const createDefaultSettlements = (): SettlementOverview => ({
  pendingAmount: 35600,
  paidThisMonth: 128600,
  notice: '结算金额由平台按已完成并审核通过的服务生成，不支持陪诊师自行改价。',
  records: [
    {
      id: 'settlement-202607-02',
      settlementNo: 'JS20260715001',
      period: '2026-07-08 至 2026-07-14',
      serviceCount: 2,
      serviceAmount: 37600,
      adjustmentAmount: -2000,
      payableAmount: 35600,
      status: 'PENDING_CONFIRMATION',
    },
    {
      id: 'settlement-202607-01',
      settlementNo: 'JS20260708001',
      period: '2026-07-01 至 2026-07-07',
      serviceCount: 7,
      serviceAmount: 128600,
      adjustmentAmount: 0,
      payableAmount: 128600,
      status: 'PAID',
      paidAt: '2026-07-10T10:30:00+08:00',
    },
  ],
})

const getSettlements = (): SettlementOverview =>
  getProfile().id === 'lin-xiaowen'
    ? createDefaultSettlements()
    : {
      pendingAmount: 0,
      paidThisMonth: 0,
      records: [],
      notice: '完成并通过审核的服务会由平台生成结算记录。',
    }

const getTraining = (): TrainingOverview => {
  const progress = storage.get<Record<string, number>>(StorageKeys.mockTrainingProgress, {
    'course-boundary': 100,
    'course-emergency': 50,
    'course-privacy': 0,
  })
  const courses = [
    {
      id: 'course-boundary',
      title: '陪诊服务边界与沟通',
      category: '必修基础',
      durationMinutes: 18,
      required: true,
      summary: '明确陪诊协助范围，避免医疗判断和越界承诺。',
      lessons: ['服务开始前如何核对', '哪些话不能替医生回答', '新增需求如何转交平台'],
    },
    {
      id: 'course-emergency',
      title: '突发情况与异常上报',
      category: '安全必修',
      durationMinutes: 22,
      required: true,
      summary: '掌握身体不适、冲突、失联和费用争议的处理顺序。',
      lessons: ['先保障人身安全', '选择正确异常分类', '留下客观记录与必要凭证'],
    },
    {
      id: 'course-privacy',
      title: '用户隐私与信息安全',
      category: '合规必修',
      durationMinutes: 15,
      required: true,
      summary: '仅在履约所需范围内使用用户信息，避免截图和外传。',
      lessons: ['最小必要信息原则', '隐私通话与凭证处理', '任务结束后的信息收缩'],
    },
  ].map((course) => {
    const courseProgress = progress[course.id] ?? 0
    return {
      ...course,
      progress: courseProgress,
      status: courseProgress >= 100
        ? 'COMPLETED' as const
        : courseProgress > 0
          ? 'IN_PROGRESS' as const
          : 'NOT_STARTED' as const,
      updatedAt: courseProgress ? now() : undefined,
    }
  })
  return {
    requiredCompleted: courses.filter((course) => course.required && course.status === 'COMPLETED').length,
    requiredTotal: courses.filter((course) => course.required).length,
    courses,
    notice: '培训内容为本地演示数据，正式上线前由平台审核并发布。',
  }
}

const createDefaultQuality = (): QualityOverview => ({
  rating: 4.98,
  onTimeRate: 98.6,
  completionRate: 99.2,
  serviceCount: 541,
  openImprovementCount: 0,
  positiveTags: [
    { name: '耐心细致', count: 186 },
    { name: '流程熟悉', count: 143 },
    { name: '沟通清楚', count: 128 },
  ],
  feedback: [
    {
      id: 'feedback-001',
      taskId: 'task-history-001',
      serviceName: '检查陪同',
      rating: 5,
      tags: ['耐心细致', '流程熟悉'],
      comment: '到院后主动确认检查流程，结束时也把资料整理得很清楚。',
      createdAt: '2026-07-16T09:20:00+08:00',
    },
    {
      id: 'feedback-002',
      taskId: 'task-quality-002',
      serviceName: '全程陪诊',
      rating: 5,
      tags: ['沟通清楚'],
      comment: '全程说明下一步做什么，家属不在现场也很放心。',
      createdAt: '2026-07-09T18:05:00+08:00',
    },
  ],
  notice: '质量数据用于服务改进，不参与公开排名，也不作为唯一派单依据。',
})

const getQuality = (): QualityOverview =>
  getProfile().id === 'lin-xiaowen'
    ? createDefaultQuality()
    : {
      rating: 0,
      onTimeRate: 0,
      completionRate: 0,
      serviceCount: 0,
      openImprovementCount: 0,
      positiveTags: [],
      feedback: [],
      notice: '完成首个服务并收到用户评价后，这里会展示脱敏质量数据。',
    }

export const mockCompanionApi = {
  login(): CompanionSession {
    return {
      token: 'mock-companion-token',
      profile: getProfile(),
    }
  },

  register(input: CompanionRegistrationInput): {
    application: CompanionApplication
    session: CompanionSession
  } {
    const name = input.name.trim()
    const phone = input.phone.trim()
    const identityNumber = input.identityNumber.trim().toUpperCase()
    if (name.length < 2 || name.length > 10) throw new Error('姓名需填写 2 至 10 个字')
    if (!/^1[3-9]\d{9}$/.test(phone)) throw new Error('请输入正确的手机号')
    if (!/^\d{17}[\dX]$/.test(identityNumber)) throw new Error('请输入正确的身份证号码')
    if (!Number.isInteger(input.workingYears) || input.workingYears < 0 || input.workingYears > 40) {
      throw new Error('从业年限需在 0 至 40 年之间')
    }
    if (!input.skillServiceIds.length) throw new Error('请至少选择一项服务技能')
    if (!input.serviceHospitalIds.length) throw new Error('请至少选择一家服务医院')
    if (!input.serviceDistricts.length) throw new Error('请至少选择一个服务区域')
    if (input.introduction.trim().length < 10) throw new Error('个人介绍至少填写 10 个字')
    if (input.identityImagePaths.length < 2) throw new Error('请上传身份证正反面')
    if (!input.certificatePaths.length) throw new Error('请上传至少一项服务资质证明')

    const existing = getApplication()
    if (existing?.status === 'PENDING_REVIEW') throw new Error('申请正在审核中，请勿重复提交')
    if (existing?.status === 'APPROVED') throw new Error('当前账号已经通过审核')
    const submittedAt = now()
    const application: CompanionApplication = {
      id: existing?.id || `application-${Date.now()}`,
      applicationNo: existing?.applicationNo || `AP${Date.now()}`,
      status: 'PENDING_REVIEW',
      name,
      phoneMasked: `${phone.slice(0, 3)}****${phone.slice(-4)}`,
      gender: input.gender,
      identityNumberMasked: `${identityNumber.slice(0, 6)}********${identityNumber.slice(-4)}`,
      workingYears: input.workingYears,
      introduction: input.introduction.trim(),
      skillServiceIds: [...input.skillServiceIds],
      serviceSkillNames: [...input.serviceSkillNames],
      serviceHospitalIds: [...input.serviceHospitalIds],
      serviceHospitalNames: [...input.serviceHospitalNames],
      serviceDistricts: [...input.serviceDistricts],
      identityImageCount: input.identityImagePaths.length,
      certificateCount: input.certificatePaths.length,
      submittedAt,
      updatedAt: submittedAt,
    }
    const sessionCacheKeys = [
      StorageKeys.mockTask,
      StorageKeys.mockTasks,
      StorageKeys.mockMilestones,
      StorageKeys.mockExceptions,
      StorageKeys.mockSummary,
      StorageKeys.mockMessages,
      StorageKeys.mockSchedule,
      StorageKeys.mockExpenses,
      StorageKeys.mockTrainingProgress,
      StorageKeys.mockGrabOrders,
      StorageKeys.availability,
    ]
    sessionCacheKeys.forEach((key) => storage.remove(key))
    storage.set(StorageKeys.mockApplication, application)
    storage.remove(StorageKeys.mockApprovedPublicProfile)
    const session: CompanionSession = {
      token: 'mock-applicant-token',
      profile: createProfileFromApplication(application),
    }
    return { application, session }
  },

  getApplication(): CompanionApplication | null {
    const application = getApplication()
    return application ? {
      ...application,
      skillServiceIds: [...application.skillServiceIds],
      serviceSkillNames: [...application.serviceSkillNames],
      serviceHospitalIds: [...application.serviceHospitalIds],
      serviceHospitalNames: [...application.serviceHospitalNames],
      serviceDistricts: [...application.serviceDistricts],
    } : null
  },

  resumeApplication(): CompanionSession {
    const application = getApplication()
    if (!application) throw new Error('当前微信身份没有注册申请')
    return {
      token: 'mock-applicant-token',
      profile: createProfileFromApplication(application),
    }
  },

  reviewApplication(
    decision: 'APPROVED' | 'REJECTED',
    reason = '',
  ): {
    application: CompanionApplication
    session: CompanionSession
    publicProfile: ApprovedCompanionPublicProfile | null
  } {
    const current = getApplication()
    if (!current) throw new Error('注册申请不存在')
    if (current.status !== 'PENDING_REVIEW') throw new Error('只有待审核申请可以处理')
    if (decision === 'REJECTED' && !reason.trim()) throw new Error('驳回时必须填写原因')
    const reviewedAt = now()
    const application: CompanionApplication = {
      ...current,
      status: decision,
      reviewedAt,
      updatedAt: reviewedAt,
      reviewReason: decision === 'REJECTED' ? reason.trim() : undefined,
    }
    storage.set(StorageKeys.mockApplication, application)
    const publicProfile = decision === 'APPROVED'
      ? createPublicProfile(application)
      : null
    if (publicProfile) {
      storage.set(StorageKeys.mockApprovedPublicProfile, publicProfile)
    } else {
      storage.remove(StorageKeys.mockApprovedPublicProfile)
    }
    const session: CompanionSession = {
      token: 'mock-applicant-token',
      profile: createProfileFromApplication(application),
    }
    return { application, session, publicProfile }
  },

  getApprovedPublicProfile(): ApprovedCompanionPublicProfile | null {
    return storage.get<ApprovedCompanionPublicProfile | null>(
      StorageKeys.mockApprovedPublicProfile,
      null,
    )
  },

  getWorkbench(): WorkbenchSummary {
    const profile = getProfile()
    const ownedTasks = getTaskRecords().filter((task) => task.companionId === profile.id)
    const activeTasks = ownedTasks.filter((task) => !terminalTaskStatuses.includes(task.status))
    const nextTask = activeTasks.length
      ? hideSensitiveFieldsBeforeAcceptance(activeTasks[0])
      : null
    return {
      profile,
      nextTask,
      stats: {
        todayTotal: activeTasks.length,
        pendingConfirmation: activeTasks.filter((task) => task.status === 'OFFERED').length,
        inService: activeTasks.filter((task) => ['IN_SERVICE', 'PENDING_SUMMARY'].includes(task.status)).length,
        completedToday: ownedTasks.filter((task) => task.status === 'COMPLETED').length,
      },
      openGrabOrderCount: getEligibleOpenGrabOrders().length,
      openExceptionCount: activeTasks.reduce((total, task) => total + task.activeExceptionCount, 0),
      announcement: '服务前请核对预约时间、医院院区和用户特殊需求。',
    }
  },

  getGrabOrders(): GrabOrder[] {
    return getEligibleOpenGrabOrders()
  },

  claimGrabOrder(
    orderId: string,
    payload: GrabOrderClaimPayload,
  ): { order: GrabOrder; task: CompanionTask } {
    return claimGrabOrder(orderId, payload)
  },

  getTasks(): CompanionTask[] {
    const profileId = getProfile().id
    return [...getTaskRecords(), createHistoryTask()]
      .filter((task) => task.companionId === profileId)
      .map(hideSensitiveFieldsBeforeAcceptance)
  },

  getProfile(): CompanionProfile {
    return getProfile()
  },

  getMessages(): CompanionMessage[] {
    return getMessages().map((message) => ({ ...message }))
  },

  markMessageRead(messageId: string): CompanionMessage[] {
    const messages = getMessages()
    const updated = messages.map((message) =>
      message.id === messageId ? { ...message, read: true } : message)
    storage.set(StorageKeys.mockMessages, updated)
    return updated
  },

  markAllMessagesRead(): CompanionMessage[] {
    const updated = getMessages().map((message) => ({ ...message, read: true }))
    storage.set(StorageKeys.mockMessages, updated)
    return updated
  },

  getSchedule(): ScheduleOverview {
    return getSchedule()
  },

  setScheduleDay(date: string, available: boolean): ScheduleOverview {
    const current = getSchedule()
    const target = current.days.find((day) => day.date === date)
    if (!target) throw new Error('排班日期不存在')
    if (target.hasTask && !available) throw new Error('该日期已有任务，不能关闭服务时间')
    const overrides = storage.get<Record<string, boolean>>(StorageKeys.mockSchedule, {})
    storage.set(StorageKeys.mockSchedule, { ...overrides, [date]: available })
    return getSchedule()
  },

  getSettlements(): SettlementOverview {
    return getSettlements()
  },

  getAllExceptions(): TaskException[] {
    return getAllExceptions().map((item) => ({
      ...item,
      evidencePaths: [...item.evidencePaths],
    }))
  },

  getExpenses(taskId: string): TaskExpense[] {
    const task = getTaskById(taskId)
    if (task.companionId !== getProfile().id) throw new Error('无权查看该任务')
    return getExpenses(taskId).map((item) => ({
      ...item,
      receiptPaths: [...item.receiptPaths],
    }))
  },

  createExpense(taskId: string, payload: ExpenseCreatePayload): TaskExpense {
    const task = getTaskById(taskId)
    if (task.companionId !== getProfile().id) throw new Error('无权操作该任务')
    if (!['IN_SERVICE', 'PENDING_SUMMARY'].includes(task.status)) throw new Error('当前任务状态不能记录费用')
    if (!Number.isInteger(payload.amount) || payload.amount <= 0) throw new Error('费用金额必须大于 0')
    if (!payload.description.trim()) throw new Error('请填写费用用途')
    if (!payload.receiptPaths.length) throw new Error('请上传费用票据或支付凭证')
    const expense: TaskExpense = {
      id: `expense-${Date.now()}`,
      taskId,
      category: payload.category,
      amount: payload.amount,
      description: payload.description.trim(),
      receiptPaths: [...payload.receiptPaths],
      paidAt: payload.paidAt,
      submittedAt: now(),
      status: 'SUBMITTED',
    }
    const otherExpenses = storage.get<TaskExpense[]>(StorageKeys.mockExpenses, [])
      .filter((item) => item.taskId !== taskId)
    storage.set(StorageKeys.mockExpenses, [expense, ...getExpenses(taskId), ...otherExpenses])
    return expense
  },

  getTraining(): TrainingOverview {
    return getTraining()
  },

  updateTrainingProgress(courseId: string, progressValue: number): TrainingOverview {
    const overview = getTraining()
    const course = overview.courses.find((item) => item.id === courseId)
    if (!course) throw new Error('培训课程不存在')
    const progress = Math.min(100, Math.max(0, Math.round(progressValue)))
    const currentProgress = Object.fromEntries(
      overview.courses.map((item) => [item.id, item.progress]),
    )
    storage.set(StorageKeys.mockTrainingProgress, { ...currentProgress, [courseId]: progress })
    return getTraining()
  },

  getQuality(): QualityOverview {
    return getQuality()
  },

  getTaskDetail(taskId: string): TaskDetail {
    const task = getTaskById(taskId)
    if (task.companionId !== getProfile().id) throw new Error('无权查看该任务')
    return {
      task: hideSensitiveFieldsBeforeAcceptance(task),
      milestones: getMilestones(task),
      exceptions: getExceptions(taskId),
      expenses: getExpenses(taskId),
      summary: getSummary(taskId),
    }
  },

  setAvailability(availability: CompanionAvailability): CompanionProfile {
    storage.set(StorageKeys.availability, availability === 'BUSY' ? 'AVAILABLE' : availability)
    return getProfile()
  },

  acceptTask(taskId: string, payload: TaskMutationPayload): CompanionTask {
    return mutateTask(taskId, 'ACCEPTED', payload)
  },

  rejectTask(taskId: string, payload: TaskMutationPayload & { reason: string }): CompanionTask {
    if (!payload.reason.trim()) throw new Error('请选择拒绝原因')
    return mutateTask(taskId, 'REJECTED', payload)
  },

  transitionTask(
    taskId: string,
    nextStatus: CompanionTaskStatus,
    payload: TaskMutationPayload,
  ): CompanionTask {
    const task = getTaskById(taskId)
    if (task.companionId !== getProfile().id) throw new Error('无权操作该任务')
    if (nextStatus === 'PENDING_SUMMARY') {
      const incompleteRequired = getMilestones(task).some(
        (item) => item.required && item.status !== 'COMPLETED',
      )
      if (incompleteRequired) throw new Error('请先处理所有必需服务节点')
    }
    return mutateTask(taskId, nextStatus, payload)
  },

  updateMilestone(
    taskId: string,
    milestoneId: string,
    payload: MilestoneMutationPayload,
  ): ServiceMilestone[] {
    const task = getTaskById(taskId)
    if (task.status !== 'IN_SERVICE') throw new Error('当前任务不能记录服务节点')
    if (task.companionId !== getProfile().id) throw new Error('无权操作该任务')
    if (
      (payload.status === 'SKIPPED' || payload.status === 'FAILED')
      && !(payload.failureReason || payload.note).trim()
    ) throw new Error('无法完成节点时必须填写原因')
    const milestones = getMilestones(task)
    const target = milestones.find((item) => item.id === milestoneId)
    if (!target) throw new Error('服务节点不存在')
    if (target.status !== 'PENDING') throw new Error('该服务节点已经记录，请勿重复提交')
    const activeMilestone = milestones.find((item) => {
      if (item.status === 'COMPLETED') return false
      if (item.status === 'FAILED' || item.status === 'SKIPPED') return item.required
      return true
    })
    if (!activeMilestone || activeMilestone.id !== milestoneId) {
      throw new Error('只能记录当前进行中的服务节点')
    }
    const recordedAt = now()
    const failed = payload.status === 'FAILED' || payload.status === 'SKIPPED'
    const failureReason = failed
      ? (payload.failureReason || payload.note).trim()
      : undefined
    const updated = milestones.map((item) => item.id === milestoneId
      ? {
        ...item,
        status: failed ? 'FAILED' as const : payload.status,
        note: payload.note.trim() || undefined,
        failureReason,
        evidenceImages: [...(payload.evidenceImages || item.evidenceImages || [])],
        startedAt: item.startedAt || recordedAt,
        completedAt: failed ? undefined : recordedAt,
        failedAt: failed ? recordedAt : undefined,
      }
      : item)
    const otherMilestones = storage.get<ServiceMilestone[]>(StorageKeys.mockMilestones, [])
      .filter((item) => item.taskId !== taskId)
    storage.set(StorageKeys.mockMilestones, [...otherMilestones, ...updated])
    return updated
  },

  createException(taskId: string, payload: ExceptionCreatePayload): TaskException {
    const task = getTaskById(taskId)
    if (task.companionId !== getProfile().id) throw new Error('无权操作该任务')
    if (payload.description.trim().length < 10) throw new Error('异常说明至少填写 10 个字')
    const exceptions = getExceptions(taskId)
    const submittedAt = now()
    const exception: TaskException = {
      id: `exception-${Date.now()}`,
      taskId,
      ticketNo: `EX${Date.now()}`,
      category: payload.category,
      urgency: payload.urgency,
      status: 'OPEN',
      taskStatus: task.status,
      description: payload.description.trim(),
      evidencePaths: [...payload.evidencePaths],
      occurredAt: payload.occurredAt,
      submittedAt,
    }
    const otherExceptions = storage.get<TaskException[]>(StorageKeys.mockExceptions, [])
      .filter((item) => item.taskId !== taskId)
    storage.set(StorageKeys.mockExceptions, [exception, ...exceptions, ...otherExceptions])
    storage.set(StorageKeys.mockMessages, [
      {
        id: `message-${exception.id}`,
        type: 'EXCEPTION_UPDATE',
        title: '平台已接收异常上报',
        content: `${exception.ticketNo} 已进入待处理队列，请保持联系方式畅通。`,
        createdAt: submittedAt,
        read: false,
        taskId,
      },
      ...getMessages(),
    ] satisfies CompanionMessage[])
    saveTask({
      ...task,
      activeExceptionCount: task.activeExceptionCount + 1,
      version: task.version + 1,
      updatedAt: submittedAt,
    })
    return exception
  },

  submitSummary(taskId: string, payload: ServiceSummaryPayload): {
    task: CompanionTask
    summary: ServiceSummary
  } {
    const task = getTaskById(taskId)
    if (task.status !== 'PENDING_SUMMARY') throw new Error('当前任务不能提交总结')
    if (task.companionId !== getProfile().id) throw new Error('无权操作该任务')
    if (payload.resultSummary.trim().length < 10) throw new Error('服务结果摘要至少填写 10 个字')
    if (!payload.actualStartedAt || !payload.actualEndedAt) throw new Error('服务起止时间不能为空')
    if (task.activeExceptionCount > 0 && !payload.hasException) throw new Error('任务已有异常记录，请如实选择发生异常')
    const summary: ServiceSummary = {
      taskId,
      actualStartedAt: payload.actualStartedAt,
      actualEndedAt: payload.actualEndedAt,
      resultSummary: payload.resultSummary.trim(),
      unfinishedItems: payload.unfinishedItems.trim(),
      hasException: payload.hasException,
      submittedAt: now(),
    }
    saveSummary(summary)
    const updatedTask = mutateTask(taskId, 'COMPLETED', payload)
    return { task: updatedTask, summary }
  },
}

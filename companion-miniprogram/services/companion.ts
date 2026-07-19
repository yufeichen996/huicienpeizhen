import { mockCompanionApi } from '../mocks/companion-api'
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
  TrainingOverview,
  ApprovedCompanionPublicProfile,
  WorkbenchSummary,
} from '../types/domain'
import { createClientActionId } from '../utils/action-id'
import { getSession, saveSession } from '../utils/auth'
import { request } from '../utils/request'

export const companionService = {
  async login(): Promise<CompanionSession> {
    const session = await request<CompanionSession>({
      path: '/companion/auth/wechat-login',
      method: 'POST',
      authenticated: false,
      mock: () => mockCompanionApi.login(),
    })
    saveSession(session)
    return session
  },

  async register(input: CompanionRegistrationInput): Promise<{
    application: CompanionApplication
    session: CompanionSession
  }> {
    const result = await request<{
      application: CompanionApplication
      session: CompanionSession
    }>({
      path: '/companion/applications',
      method: 'POST',
      authenticated: false,
      data: input,
      mock: () => mockCompanionApi.register(input),
    })
    saveSession(result.session)
    return result
  },

  getApplication(): Promise<CompanionApplication | null> {
    return request({
      path: '/companion/application',
      authenticated: false,
      mock: () => mockCompanionApi.getApplication(),
    })
  },

  async resumeApplication(): Promise<CompanionSession> {
    const session = await request<CompanionSession>({
      path: '/companion/application/session',
      method: 'POST',
      authenticated: false,
      data: {},
      mock: () => mockCompanionApi.resumeApplication(),
    })
    saveSession(session)
    return session
  },

  async reviewApplication(
    decision: 'APPROVED' | 'REJECTED',
    reason = '',
  ): Promise<{
    application: CompanionApplication
    session: CompanionSession
    publicProfile: ApprovedCompanionPublicProfile | null
  }> {
    const result = await request<{
      application: CompanionApplication
      session: CompanionSession
      publicProfile: ApprovedCompanionPublicProfile | null
    }>({
      path: '/mock-admin/companion-application/review',
      method: 'POST',
      data: { decision, reason },
      mock: () => mockCompanionApi.reviewApplication(decision, reason),
    })
    saveSession(result.session)
    return result
  },

  getWorkbench(): Promise<WorkbenchSummary> {
    return request({
      path: '/companion/workbench',
      mock: () => mockCompanionApi.getWorkbench(),
    })
  },

  getGrabOrders(): Promise<GrabOrder[]> {
    return request({
      path: '/companion/grab-orders',
      mock: () => mockCompanionApi.getGrabOrders(),
    })
  },

  claimGrabOrder(order: GrabOrder): Promise<{ order: GrabOrder; task: CompanionTask }> {
    const payload = {
      expectedVersion: order.version,
      clientActionId: createClientActionId('grab-order'),
    }
    return request({
      path: `/companion/grab-orders/${order.id}/claim`,
      method: 'POST',
      data: payload,
      mock: () => mockCompanionApi.claimGrabOrder(order.id, payload),
    })
  },

  getTasks(): Promise<CompanionTask[]> {
    return request({
      path: '/companion/tasks',
      mock: () => mockCompanionApi.getTasks(),
    })
  },

  getTaskDetail(taskId: string): Promise<TaskDetail> {
    return request({
      path: `/companion/tasks/${taskId}`,
      mock: () => mockCompanionApi.getTaskDetail(taskId),
    })
  },

  getProfile(): Promise<CompanionProfile> {
    return request({
      path: '/companion/me',
      mock: () => mockCompanionApi.getProfile(),
    })
  },

  getMessages(): Promise<CompanionMessage[]> {
    return request({
      path: '/companion/messages',
      mock: () => mockCompanionApi.getMessages(),
    })
  },

  markMessageRead(messageId: string): Promise<CompanionMessage[]> {
    return request({
      path: `/companion/messages/${messageId}/read`,
      method: 'POST',
      data: {},
      mock: () => mockCompanionApi.markMessageRead(messageId),
    })
  },

  markAllMessagesRead(): Promise<CompanionMessage[]> {
    return request({
      path: '/companion/messages/read-all',
      method: 'POST',
      data: {},
      mock: () => mockCompanionApi.markAllMessagesRead(),
    })
  },

  getSchedule(): Promise<ScheduleOverview> {
    return request({
      path: '/companion/schedule',
      mock: () => mockCompanionApi.getSchedule(),
    })
  },

  setScheduleDay(date: string, available: boolean): Promise<ScheduleOverview> {
    return request({
      path: `/companion/schedule/${date}`,
      method: 'PUT',
      data: { available },
      mock: () => mockCompanionApi.setScheduleDay(date, available),
    })
  },

  getSettlements(): Promise<SettlementOverview> {
    return request({
      path: '/companion/settlements',
      mock: () => mockCompanionApi.getSettlements(),
    })
  },

  getAllExceptions(): Promise<TaskException[]> {
    return request({
      path: '/companion/exceptions',
      mock: () => mockCompanionApi.getAllExceptions(),
    })
  },

  getExpenses(taskId: string): Promise<TaskExpense[]> {
    return request({
      path: `/companion/tasks/${taskId}/expenses`,
      mock: () => mockCompanionApi.getExpenses(taskId),
    })
  },

  createExpense(
    taskId: string,
    input: Omit<ExpenseCreatePayload, 'clientActionId'>,
  ): Promise<TaskExpense> {
    const payload: ExpenseCreatePayload = {
      ...input,
      clientActionId: createClientActionId('expense'),
    }
    return request({
      path: `/companion/tasks/${taskId}/expenses`,
      method: 'POST',
      data: payload,
      mock: () => mockCompanionApi.createExpense(taskId, payload),
    })
  },

  getTraining(): Promise<TrainingOverview> {
    return request({
      path: '/companion/training',
      mock: () => mockCompanionApi.getTraining(),
    })
  },

  updateTrainingProgress(courseId: string, progress: number): Promise<TrainingOverview> {
    return request({
      path: `/companion/training/${courseId}/progress`,
      method: 'POST',
      data: { progress },
      mock: () => mockCompanionApi.updateTrainingProgress(courseId, progress),
    })
  },

  getQuality(): Promise<QualityOverview> {
    return request({
      path: '/companion/quality',
      mock: () => mockCompanionApi.getQuality(),
    })
  },

  async setAvailability(availability: CompanionAvailability): Promise<CompanionProfile> {
    const profile = await request<CompanionProfile>({
      path: '/companion/me/availability',
      method: 'PUT',
      data: { availability },
      mock: () => mockCompanionApi.setAvailability(availability),
    })
    const session = getSession()
    if (session) saveSession({ ...session, profile })
    return profile
  },

  acceptTask(task: CompanionTask): Promise<CompanionTask> {
    const payload = {
      expectedVersion: task.version,
      clientActionId: createClientActionId('accept'),
    }
    return request({
      path: `/companion/tasks/${task.id}/accept`,
      method: 'POST',
      data: payload,
      mock: () => mockCompanionApi.acceptTask(task.id, payload),
    })
  },

  rejectTask(task: CompanionTask, reason: string): Promise<CompanionTask> {
    const payload = {
      expectedVersion: task.version,
      clientActionId: createClientActionId('reject'),
      reason,
    }
    return request({
      path: `/companion/tasks/${task.id}/reject`,
      method: 'POST',
      data: payload,
      mock: () => mockCompanionApi.rejectTask(task.id, payload),
    })
  },

  transitionTask(task: CompanionTask, nextStatus: CompanionTaskStatus): Promise<CompanionTask> {
    const payload = {
      expectedVersion: task.version,
      clientActionId: createClientActionId('transition'),
    }
    return request({
      path: `/companion/tasks/${task.id}/transition`,
      method: 'POST',
      data: { ...payload, nextStatus },
      mock: () => mockCompanionApi.transitionTask(task.id, nextStatus, payload),
    })
  },

  updateMilestone(
    taskId: string,
    milestoneId: string,
    status: MilestoneMutationPayload['status'],
    note: string,
    options: Pick<MilestoneMutationPayload, 'failureReason' | 'evidenceImages'> = {},
  ): Promise<ServiceMilestone[]> {
    const payload: MilestoneMutationPayload = {
      status,
      note,
      ...options,
      clientActionId: createClientActionId('milestone'),
    }
    return request({
      path: `/companion/tasks/${taskId}/milestones`,
      method: 'POST',
      data: { milestoneId, ...payload },
      mock: () => mockCompanionApi.updateMilestone(taskId, milestoneId, payload),
    })
  },

  createException(
    taskId: string,
    input: Omit<ExceptionCreatePayload, 'clientActionId'>,
  ): Promise<TaskException> {
    const payload: ExceptionCreatePayload = {
      ...input,
      clientActionId: createClientActionId('exception'),
    }
    return request({
      path: `/companion/tasks/${taskId}/exceptions`,
      method: 'POST',
      data: payload,
      mock: () => mockCompanionApi.createException(taskId, payload),
    })
  },

  submitSummary(
    task: CompanionTask,
    input: Omit<ServiceSummaryPayload, 'expectedVersion' | 'clientActionId'>,
  ): Promise<{ task: CompanionTask; summary: ServiceSummary }> {
    const payload: ServiceSummaryPayload = {
      ...input,
      expectedVersion: task.version,
      clientActionId: createClientActionId('summary'),
    }
    return request({
      path: `/companion/tasks/${task.id}/summary`,
      method: 'POST',
      data: payload,
      mock: () => mockCompanionApi.submitSummary(task.id, payload),
    })
  },
}

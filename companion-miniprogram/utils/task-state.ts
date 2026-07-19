import type { AssignmentMode, CompanionTaskStatus } from '../types/domain'

export type ClientOrderStatus =
  | 'PENDING_CONFIRMATION'
  | 'PENDING_ASSIGNMENT'
  | 'PENDING_SERVICE'
  | 'IN_SERVICE'
  | 'PENDING_REVIEW'
  | 'CANCELLED'

export interface TaskStatusMeta {
  text: string
  tone: 'blue' | 'green' | 'orange' | 'gray'
  description: string
}

export const TASK_STATUS_META: Record<CompanionTaskStatus, TaskStatusMeta> = {
  OFFERED: { text: '待确认', tone: 'orange', description: '请在规定时间内确认是否接受任务。' },
  ACCEPTED: { text: '待出发', tone: 'blue', description: '任务已确认，请提前联系用户并做好准备。' },
  DEPARTING: { text: '前往医院', tone: 'blue', description: '请注意行程时间并按约定到达。' },
  ARRIVED: { text: '已到医院', tone: 'green', description: '请前往约定地点与用户会合。' },
  MET_PATIENT: { text: '已会合', tone: 'green', description: '核对身份和服务内容后开始服务。' },
  IN_SERVICE: { text: '服务中', tone: 'green', description: '请按服务节点完成记录。' },
  PENDING_SUMMARY: { text: '待收尾', tone: 'orange', description: '请提交服务总结和必要凭证。' },
  COMPLETED: { text: '已完成', tone: 'green', description: '本次陪诊任务已完成。' },
  REJECTED: { text: '已拒绝', tone: 'gray', description: '任务已退回平台重新安排。' },
  EXPIRED: { text: '已超时', tone: 'gray', description: '确认时限已过，任务已退回平台。' },
  CANCELLED: { text: '已取消', tone: 'gray', description: '平台已取消该任务。' },
}

export const COMPANION_TASK_TRANSITIONS: Record<CompanionTaskStatus, readonly CompanionTaskStatus[]> = {
  OFFERED: ['ACCEPTED', 'REJECTED'],
  ACCEPTED: ['DEPARTING'],
  DEPARTING: ['ARRIVED'],
  ARRIVED: ['MET_PATIENT'],
  MET_PATIENT: ['IN_SERVICE'],
  IN_SERVICE: ['PENDING_SUMMARY'],
  PENDING_SUMMARY: ['COMPLETED'],
  COMPLETED: [],
  REJECTED: [],
  EXPIRED: [],
  CANCELLED: [],
}

export function canCompanionTransition(
  current: CompanionTaskStatus,
  next: CompanionTaskStatus,
): boolean {
  return COMPANION_TASK_TRANSITIONS[current].includes(next)
}

export function assertCompanionTransition(
  current: CompanionTaskStatus,
  next: CompanionTaskStatus,
): void {
  if (!canCompanionTransition(current, next)) {
    throw new Error(`INVALID_TASK_TRANSITION:${current}->${next}`)
  }
}

export function mapTaskStatusToClientOrderStatus(
  status: CompanionTaskStatus,
  assignmentMode: AssignmentMode = 'platform',
): ClientOrderStatus {
  if (status === 'OFFERED') {
    return assignmentMode === 'selected' ? 'PENDING_CONFIRMATION' : 'PENDING_ASSIGNMENT'
  }
  if (status === 'REJECTED' || status === 'EXPIRED') return 'PENDING_ASSIGNMENT'
  if (status === 'CANCELLED') return 'CANCELLED'
  if (['ACCEPTED', 'DEPARTING', 'ARRIVED', 'MET_PATIENT'].includes(status)) {
    return 'PENDING_SERVICE'
  }
  if (status === 'IN_SERVICE' || status === 'PENDING_SUMMARY') return 'IN_SERVICE'
  return 'PENDING_REVIEW'
}

export function getPrimaryAction(status: CompanionTaskStatus): {
  text: string
  nextStatus?: CompanionTaskStatus
} | null {
  const actions: Partial<Record<CompanionTaskStatus, { text: string; nextStatus?: CompanionTaskStatus }>> = {
    OFFERED: { text: '接受任务', nextStatus: 'ACCEPTED' },
    ACCEPTED: { text: '确认出发', nextStatus: 'DEPARTING' },
    DEPARTING: { text: '已到医院', nextStatus: 'ARRIVED' },
    ARRIVED: { text: '已与用户会合', nextStatus: 'MET_PATIENT' },
    MET_PATIENT: { text: '开始服务', nextStatus: 'IN_SERVICE' },
    IN_SERVICE: { text: '进入服务记录' },
    PENDING_SUMMARY: { text: '继续填写服务总结' },
  }
  return actions[status] || null
}

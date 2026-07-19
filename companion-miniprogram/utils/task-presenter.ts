import type { CompanionTask, CompanionTaskStatus } from '../types/domain'
import { getPrimaryAction, TASK_STATUS_META } from './task-state'

export type TaskFilter = 'confirmation' | 'upcoming' | 'active' | 'history'

export interface TaskCardView extends CompanionTask {
  statusText: string
  statusTone: string
  bookingText: string
  locationText: string
  primaryActionText: string
}

export interface TaskTimelineItem {
  status: CompanionTaskStatus
  title: string
  state: 'done' | 'current' | 'pending'
  time: string
}

const formatDateTime = (value?: string): string => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (part: number) => `${part}`.padStart(2, '0')
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function toTaskCardView(task: CompanionTask): TaskCardView {
  const status = TASK_STATUS_META[task.status]
  return {
    ...task,
    statusText: status.text,
    statusTone: status.tone,
    bookingText: `${task.bookingDate} ${task.bookingTime}`,
    locationText: `${task.hospitalName}${task.campusName ? ` · ${task.campusName}` : ''}`,
    primaryActionText: getPrimaryAction(task.status)?.text || '查看详情',
  }
}

export function matchesTaskFilter(task: CompanionTask, filter: TaskFilter): boolean {
  const groups: Record<TaskFilter, CompanionTaskStatus[]> = {
    confirmation: ['OFFERED'],
    upcoming: ['ACCEPTED', 'DEPARTING', 'ARRIVED', 'MET_PATIENT'],
    active: ['IN_SERVICE', 'PENDING_SUMMARY'],
    history: ['COMPLETED', 'REJECTED', 'EXPIRED', 'CANCELLED'],
  }
  return groups[filter].includes(task.status)
}

const timelineSteps: Array<{
  status: CompanionTaskStatus
  title: string
  timeKey: keyof CompanionTask
}> = [
  { status: 'ACCEPTED', title: '接受任务', timeKey: 'acceptedAt' },
  { status: 'DEPARTING', title: '确认出发', timeKey: 'departedAt' },
  { status: 'ARRIVED', title: '到达医院', timeKey: 'arrivedAt' },
  { status: 'MET_PATIENT', title: '与用户会合', timeKey: 'metPatientAt' },
  { status: 'IN_SERVICE', title: '开始服务', timeKey: 'serviceStartedAt' },
  { status: 'PENDING_SUMMARY', title: '服务流程结束', timeKey: 'serviceEndedAt' },
  { status: 'COMPLETED', title: '提交服务总结', timeKey: 'completedAt' },
]

export function buildTaskTimeline(task: CompanionTask): TaskTimelineItem[] {
  const currentIndex = timelineSteps.findIndex((item) => item.status === task.status)
  const completedIndex = task.status === 'COMPLETED' ? timelineSteps.length - 1 : currentIndex - 1
  return timelineSteps.map((item, index) => {
    const rawTime = task[item.timeKey]
    return {
      status: item.status,
      title: item.title,
      state: index <= completedIndex
        ? 'done'
        : index === currentIndex
          ? 'current'
          : 'pending',
      time: typeof rawTime === 'string' ? formatDateTime(rawTime) : '',
    }
  })
}

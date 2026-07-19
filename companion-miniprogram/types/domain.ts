export type CompanionAccountStatus =
  | 'PENDING_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'SUSPENDED'
  | 'DISABLED'

export type CompanionAvailability = 'AVAILABLE' | 'BUSY' | 'OFFLINE'

export type CompanionTaskStatus =
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

export type AssignmentMode = 'platform' | 'selected' | 'market'

export type GrabOrderStatus = 'OPEN' | 'CLAIMED' | 'WITHDRAWN' | 'EXPIRED'

export type ServiceMilestoneStatus = 'PENDING' | 'COMPLETED' | 'SKIPPED' | 'FAILED'

export type TaskExceptionStatus = 'OPEN' | 'PROCESSING' | 'RESOLVED' | 'CLOSED'

export type TaskExceptionCategory =
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

export type TaskExceptionUrgency = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

export type CompanionMessageType =
  | 'NEW_TASK'
  | 'TASK_UPDATE'
  | 'SERVICE_REMINDER'
  | 'EXCEPTION_UPDATE'
  | 'ANNOUNCEMENT'

export type SettlementStatus = 'PENDING_CONFIRMATION' | 'CONFIRMED' | 'PAID'

export type TaskExpenseCategory =
  | 'REGISTRATION'
  | 'MEDICINE'
  | 'EXAMINATION'
  | 'TRANSPORT'
  | 'OTHER'

export type TaskExpenseStatus = 'SUBMITTED' | 'CONFIRMED' | 'REJECTED'

export type TrainingCourseStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED'

export type CompanionApplicationStatus = Extract<
  CompanionAccountStatus,
  'PENDING_REVIEW' | 'APPROVED' | 'REJECTED'
>

export interface CompanionProfile {
  id: string
  name: string
  phoneMasked: string
  verified: boolean
  accountStatus: CompanionAccountStatus
  availability: CompanionAvailability
  serviceCount: number
  serviceSkills: string[]
  serviceHospitals: string[]
}

export interface CompanionSession {
  token: string
  profile: CompanionProfile
}

export interface CompanionRegistrationInput {
  name: string
  phone: string
  gender: 'male' | 'female'
  identityNumber: string
  workingYears: number
  introduction: string
  skillServiceIds: string[]
  serviceSkillNames: string[]
  serviceHospitalIds: string[]
  serviceHospitalNames: string[]
  serviceDistricts: string[]
  identityImagePaths: string[]
  certificatePaths: string[]
}

export interface CompanionApplication {
  id: string
  applicationNo: string
  status: CompanionApplicationStatus
  name: string
  phoneMasked: string
  gender: 'male' | 'female'
  identityNumberMasked: string
  workingYears: number
  introduction: string
  skillServiceIds: string[]
  serviceSkillNames: string[]
  serviceHospitalIds: string[]
  serviceHospitalNames: string[]
  serviceDistricts: string[]
  identityImageCount: number
  certificateCount: number
  submittedAt: string
  updatedAt: string
  reviewedAt?: string
  reviewReason?: string
}

export interface ApprovedCompanionPublicProfile {
  applicationId: string
  companionId: string
  name: string
  gender: 'male' | 'female'
  workingYears: number
  introduction: string
  bio: string
  tags: string[]
  skillServiceIds: string[]
  serviceHospitalIds: string[]
  serviceDistricts: string[]
  approvedAt: string
  isRecommended: boolean
}

export interface CompanionTask {
  id: string
  orderId: string
  orderNo: string
  companionId: string
  status: CompanionTaskStatus
  assignmentMode: AssignmentMode
  version: number
  serviceId: string
  serviceName: string
  serviceDurationMinutes: number
  hospitalId: string
  hospitalName: string
  campusName?: string
  departmentName: string
  bookingDate: string
  bookingTime: string
  meetingPoint?: string
  patientDisplayName?: string
  patientPhoneMasked?: string
  privacyCallEnabled: boolean
  specialNeeds: string[]
  remark?: string
  activeExceptionCount: number
  acceptedAt?: string
  departedAt?: string
  arrivedAt?: string
  metPatientAt?: string
  serviceStartedAt?: string
  serviceEndedAt?: string
  completedAt?: string
  createdAt: string
  updatedAt: string
}

export interface GrabOrder {
  id: string
  orderNo: string
  institutionId: string
  institutionName: string
  institutionVerified: boolean
  status: GrabOrderStatus
  version: number
  serviceId: string
  serviceName: string
  serviceDurationMinutes: number
  hospitalId: string
  hospitalName: string
  campusName?: string
  departmentName: string
  bookingDate: string
  bookingTime: string
  serviceDistrict: string
  patientSummary: string
  serviceNeeds: string[]
  companionFee: number
  publishedAt: string
  expiresAt: string
  claimedAt?: string
}

export interface GrabOrderClaimPayload {
  expectedVersion: number
  clientActionId: string
}

export interface ServiceMilestone {
  id: string
  taskId: string
  code: string
  title: string
  description: string
  required: boolean
  evidenceRequired: boolean
  status: ServiceMilestoneStatus
  note?: string
  failureReason?: string
  evidenceImages?: string[]
  startedAt?: string
  completedAt?: string
  failedAt?: string
}

export interface TaskException {
  id: string
  taskId: string
  ticketNo: string
  category: TaskExceptionCategory
  urgency: TaskExceptionUrgency
  status: TaskExceptionStatus
  taskStatus: CompanionTaskStatus
  description: string
  evidencePaths: string[]
  occurredAt: string
  submittedAt: string
  resolution?: string
}

export interface ServiceSummary {
  taskId: string
  actualStartedAt: string
  actualEndedAt: string
  resultSummary: string
  unfinishedItems: string
  hasException: boolean
  submittedAt: string
}

export interface TaskDetail {
  task: CompanionTask
  milestones: ServiceMilestone[]
  exceptions: TaskException[]
  expenses: TaskExpense[]
  summary: ServiceSummary | null
}

export interface TaskExpense {
  id: string
  taskId: string
  category: TaskExpenseCategory
  amount: number
  description: string
  receiptPaths: string[]
  paidAt: string
  submittedAt: string
  status: TaskExpenseStatus
}

export interface CompanionMessage {
  id: string
  type: CompanionMessageType
  title: string
  content: string
  createdAt: string
  read: boolean
  taskId?: string
}

export interface ScheduleDay {
  date: string
  weekDay: string
  dayNumber: string
  available: boolean
  hasTask: boolean
  taskTime?: string
}

export interface ScheduleOverview {
  days: ScheduleDay[]
  timezone: string
  notice: string
}

export interface SettlementRecord {
  id: string
  settlementNo: string
  period: string
  serviceCount: number
  serviceAmount: number
  adjustmentAmount: number
  payableAmount: number
  status: SettlementStatus
  paidAt?: string
}

export interface SettlementOverview {
  pendingAmount: number
  paidThisMonth: number
  records: SettlementRecord[]
  notice: string
}

export interface TrainingCourse {
  id: string
  title: string
  category: string
  durationMinutes: number
  required: boolean
  status: TrainingCourseStatus
  progress: number
  summary: string
  lessons: string[]
  updatedAt?: string
}

export interface TrainingOverview {
  requiredCompleted: number
  requiredTotal: number
  courses: TrainingCourse[]
  notice: string
}

export interface QualityFeedback {
  id: string
  taskId: string
  serviceName: string
  rating: number
  tags: string[]
  comment: string
  createdAt: string
}

export interface QualityOverview {
  rating: number
  onTimeRate: number
  completionRate: number
  serviceCount: number
  openImprovementCount: number
  positiveTags: Array<{ name: string; count: number }>
  feedback: QualityFeedback[]
  notice: string
}

export interface WorkbenchStats {
  todayTotal: number
  pendingConfirmation: number
  inService: number
  completedToday: number
}

export interface WorkbenchSummary {
  profile: CompanionProfile
  nextTask: CompanionTask | null
  stats: WorkbenchStats
  openGrabOrderCount: number
  openExceptionCount: number
  announcement: string
}

export interface TaskMutationPayload {
  expectedVersion: number
  clientActionId: string
}

export interface MilestoneMutationPayload {
  status: Exclude<ServiceMilestoneStatus, 'PENDING'>
  note: string
  failureReason?: string
  evidenceImages?: string[]
  clientActionId: string
}

export interface ExceptionCreatePayload {
  category: TaskExceptionCategory
  urgency: TaskExceptionUrgency
  description: string
  evidencePaths: string[]
  occurredAt: string
  clientActionId: string
}

export interface ServiceSummaryPayload {
  expectedVersion: number
  actualStartedAt: string
  actualEndedAt: string
  resultSummary: string
  unfinishedItems: string
  hasException: boolean
  clientActionId: string
}

export interface ExpenseCreatePayload {
  category: TaskExpenseCategory
  amount: number
  description: string
  receiptPaths: string[]
  paidAt: string
  clientActionId: string
}

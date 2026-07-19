export type BookingServiceId = 'full' | 'exam' | 'medicine' | 'report' | 'delivery' | 'inpatient'
export type CompanionMode = 'platform' | 'selected'

export interface BookingServiceOption { id: BookingServiceId; name: string; icon: string; description: string; duration: number; price: number; recommended: boolean }

export interface BookingDraft {
  serviceId?: BookingServiceId; serviceName?: string; servicePrice?: number
  hospitalId?: string; hospitalName?: string; departmentName?: string
  bookingDate?: string; bookingDateLabel?: string; bookingTime?: string; duration?: number
  companionMode: CompanionMode; companionId?: string; companionName?: string; companionPrice?: number
  patientId?: string; patientName?: string; patientPhone?: string
  remark: string; specialNeeds: string[]
  serviceFee: number; companionFee: number; discountAmount: number; totalAmount: number
  agreementAccepted: boolean; updatedAt: number
  progressStep: number
  couponId?: string
}

export interface BookingDateOption { date: string; weekday: string; day: string; label: string; isToday: boolean; disabled: boolean }
export interface BookingTimeSlot { value: string; disabled: boolean }

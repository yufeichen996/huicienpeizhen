import { storage } from '../utils/storage'
import { StorageKeys } from '../utils/storage-keys'
import { formatPrice } from '../utils/format'
import type { BookingDraft, BookingServiceOption, CompanionMode } from '../types/booking'

const emptyDraft = (): BookingDraft => ({ companionMode: 'platform', remark: '', specialNeeds: [], serviceFee: 0, companionFee: 0, discountAmount: 0, totalAmount: 0, agreementAccepted: false, updatedAt: Date.now(), progressStep: 0 })
const isDraft = (value: unknown): value is Partial<BookingDraft> => Boolean(value && typeof value === 'object' && !Array.isArray(value))

export function calculateBookingFees(draft: BookingDraft) {
  const serviceFee = draft.servicePrice || 0
  const companionFee = draft.companionMode === 'selected' ? Math.max(0, (draft.companionPrice || 0) - serviceFee) : 0
  const discountAmount = serviceFee >= 19800 ? 1000 : 0
  return { serviceFee, companionFee, discountAmount, totalAmount: Math.max(0, serviceFee + companionFee - discountAmount) }
}

class BookingStore {
  private draft: BookingDraft = emptyDraft()
  hydrate() { const saved = storage.get<Partial<BookingDraft> | null>(StorageKeys.bookingDraft, null); this.draft = { ...emptyDraft(), ...(isDraft(saved) ? saved : {}) }; this.recalculate(false) }
  getDraft() { return { ...this.draft, specialNeeds: [...this.draft.specialNeeds] } }
  hasDraft() { return Boolean(this.draft.serviceId || this.draft.hospitalId || this.draft.patientId) }
  update(patch: Partial<BookingDraft>) { this.draft = { ...this.draft, ...patch, updatedAt: Date.now() }; this.recalculate() }
  selectService(service: BookingServiceOption) { this.update({ serviceId: service.id, serviceName: service.name, servicePrice: service.price, duration: service.duration }) }
  setCompanionMode(mode: CompanionMode) { this.update(mode === 'platform' ? { companionMode: mode, companionId: undefined, companionName: undefined, companionPrice: undefined } : { companionMode: mode }) }
  clear() { this.draft = emptyDraft(); storage.remove(StorageKeys.bookingDraft) }
  getNextRoute() {
    if (!this.draft.serviceId || this.draft.progressStep < 1) return '/pages/booking-service/index'
    if (!this.draft.hospitalId || !this.draft.departmentName || !this.draft.bookingDate || !this.draft.bookingTime || this.draft.progressStep < 2) return '/pages/booking-time/index'
    if (this.draft.progressStep < 3 || (this.draft.companionMode === 'selected' && !this.draft.companionId)) return '/pages/booking-companion/index'
    return '/pages/booking-confirm/index'
  }
  private recalculate(persist = true) { this.draft = { ...this.draft, ...calculateBookingFees(this.draft) }; if (persist) storage.set(StorageKeys.bookingDraft, this.draft) }
}
export const bookingStore = new BookingStore()
export const formatMoney = formatPrice

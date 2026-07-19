import type { BookingServiceId } from './booking'
export interface ServiceProcessStep { title: string; description: string }
export interface ServiceFaq { question: string; answer: string }
export interface ServiceItem { id: BookingServiceId; categoryId: 'medical'|'exam'|'agency'|'report'|'inpatient'; name: string; shortDescription: string; description: string; icon: string; coverImage?: string; themeColor: string; themeBackground: string; durationMinutes: number; price: number; originalPrice?: number; priceUnit: string; features: string[]; includedItems: string[]; excludedItems: string[]; processSteps: ServiceProcessStep[]; suitableFor: string[]; notices: string[]; faq: ServiceFaq[]; supportedHospitalIds: string[]; isRecommended: boolean; isEnabled: boolean }

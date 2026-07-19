import type { Companion } from '../types/companion'

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

interface CompanionReviewRegistryRecord {
  applicationId: string
  status: 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED'
  publicProfile?: ApprovedCompanionPublicProfile
}

const SERVICE_PRICE: Record<string, number> = {
  full: 19800,
  exam: 16800,
  medicine: 6800,
  inpatient: 29800,
}

export function mapApprovedPublicProfileToCompanion(
  profile: ApprovedCompanionPublicProfile,
): Companion {
  const availablePrices = profile.skillServiceIds
    .map((serviceId) => SERVICE_PRICE[serviceId])
    .filter((price): price is number => typeof price === 'number')
  const price = availablePrices.length ? Math.min(...availablePrices) : 19800
  return {
    id: profile.companionId,
    name: profile.name,
    avatar: '/assets/images/companion-registered-default.svg',
    gender: profile.gender,
    verified: true,
    rating: 5,
    serviceCount: 0,
    responseText: '10分钟内',
    responseTime: '10分钟内',
    workingYears: profile.workingYears,
    introduction: profile.introduction,
    bio: profile.bio,
    tags: [...profile.tags],
    skillServiceIds: [...profile.skillServiceIds],
    serviceHospitalIds: [...profile.serviceHospitalIds],
    serviceDistricts: [...profile.serviceDistricts],
    price,
    priceFrom: price / 100,
    priceUnit: '起/次',
    availableDates: ['审核通过后开放排班'],
    reviewCount: 0,
    isRecommended: profile.isRecommended,
    isAvailable: true,
  }
}

export const companionReviewRegistry: CompanionReviewRegistryRecord[] = [
  {
    applicationId: 'mock-application-zhou-ning',
    status: 'APPROVED',
    publicProfile: {
      applicationId: 'mock-application-zhou-ning',
      companionId: 'registered-mock-application-zhou-ning',
      name: '周宁',
      gender: 'female',
      workingYears: 4,
      introduction: '护理相关从业四年，熟悉三甲医院就诊流程，擅长老人检查陪同和信息记录。',
      bio: '护理相关从业四年，熟悉三甲医院流程，擅长老人检查陪同。',
      tags: ['新入驻', '全程陪诊', '检查陪同'],
      skillServiceIds: ['full', 'exam'],
      serviceHospitalIds: ['ruijin', 'huashan'],
      serviceDistricts: ['黄浦区', '静安区'],
      approvedAt: '2026-07-18T14:30:00+08:00',
      isRecommended: true,
    },
  },
  {
    applicationId: 'mock-application-pending',
    status: 'PENDING_REVIEW',
  },
  {
    applicationId: 'mock-application-rejected',
    status: 'REJECTED',
  },
]

export const approvedRegisteredCompanions: Companion[] = companionReviewRegistry
  .filter((record) => record.status === 'APPROVED' && record.publicProfile)
  .map((record) => mapApprovedPublicProfileToCompanion(record.publicProfile!))

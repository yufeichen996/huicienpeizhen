import type { Hospital } from '../types/hospital'
import type { Order } from '../types/order'

const MIN_HOSPITAL_USE_COUNT = 2
const EXCLUDED_STATUSES = ['CANCELLED', 'REFUNDING', 'REFUNDED']

interface HospitalUsage {
  count: number
  latestUsedAt: number
}

export function getFrequentlyUsedHospitals(
  orders: Order[],
  allHospitals: Hospital[],
  limit = 3,
): Hospital[] {
  const usageByHospital = new Map<string, HospitalUsage>()

  orders
    .filter((order) =>
      Boolean(order.hospitalId)
      && !order.id.startsWith('mock-order-')
      && order.paymentStatus === 'PAID'
      && !EXCLUDED_STATUSES.includes(order.status),
    )
    .forEach((order) => {
      const current = usageByHospital.get(order.hospitalId) || { count: 0, latestUsedAt: 0 }
      usageByHospital.set(order.hospitalId, {
        count: current.count + 1,
        latestUsedAt: Math.max(current.latestUsedAt, Date.parse(order.createdAt) || 0),
      })
    })

  const hospitalById = new Map(allHospitals.map((hospital) => [hospital.id, hospital]))

  return [...usageByHospital.entries()]
    .filter(([, usage]) => usage.count >= MIN_HOSPITAL_USE_COUNT)
    .sort(([, left], [, right]) =>
      right.count - left.count || right.latestUsedAt - left.latestUsedAt,
    )
    .slice(0, limit)
    .map(([hospitalId]) => hospitalById.get(hospitalId))
    .filter((hospital): hospital is Hospital => Boolean(hospital))
}

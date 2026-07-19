import type { BookingServiceOption, BookingTimeSlot } from '../types/booking'
import { catalogServices } from './catalog-services'

export const bookingServices: BookingServiceOption[] = catalogServices.map((item) => ({ id:item.id,name:item.name,icon:item.icon,description:item.shortDescription,duration:item.durationMinutes,price:item.price,recommended:item.isRecommended }))

export const departments = ['内科', '外科', '儿科', '妇科', '眼科', '口腔科', '检查中心', '其他']
export const bookingTimeSlots: BookingTimeSlot[] = [
  { value: '08:00', disabled: false }, { value: '09:00', disabled: false }, { value: '10:00', disabled: true }, { value: '11:00', disabled: false },
  { value: '13:30', disabled: false }, { value: '14:30', disabled: true }, { value: '15:30', disabled: false }, { value: '16:30', disabled: false },
]
export const specialNeedOptions = ['行动不便', '需要轮椅', '老人独自就诊', '需要代取药', '需要检查陪同', '其他']

const pad = (value: number) => `${value}`.padStart(2, '0')
export function createBookingDates(days = 14) {
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  const today = new Date(); today.setHours(12, 0, 0, 0)
  return Array.from({ length: days }, (_, index) => {
    const current = new Date(today); current.setDate(today.getDate() + index)
    const date = `${current.getFullYear()}-${pad(current.getMonth() + 1)}-${pad(current.getDate())}`
    return { date, weekday: weekdays[current.getDay()], day: `${current.getDate()}`, label: index === 0 ? '今天' : `${current.getMonth() + 1}月${current.getDate()}日`, isToday: index === 0, disabled: index === 6 }
  })
}

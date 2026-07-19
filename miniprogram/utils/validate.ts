import type { PatientInput } from '../types/patient'

export const isValidPhone = (value: string) => /^1[3-9]\d{9}$/.test(value.trim())
export const isValidIdCard = (value: string) => /^(\d{15}|\d{17}[\dXx])$/.test(value.trim())

export function validatePatient(input: PatientInput) {
  if (!input.name.trim()) return '请输入就诊人姓名'
  if (!isValidPhone(input.phone)) return '请输入正确的手机号码'
  const birthday = new Date(`${input.birthday}T00:00:00`)
  if (!input.birthday || Number.isNaN(birthday.getTime()) || birthday > new Date()) return '出生日期不能晚于今天'
  if (input.idCard && !isValidIdCard(input.idCard)) return '请输入正确的身份证号码'
  if (input.emergencyPhone && !isValidPhone(input.emergencyPhone)) return '请输入正确的紧急联系电话'
  if ((input.remark || '').length > 200) return '备注不能超过 200 字'
  return ''
}

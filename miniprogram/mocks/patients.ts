import type { Patient } from '../types/patient'
export const mockPatients: Patient[] = [
  { id: 'patient-self', name: '陈先生', gender: 'male', birthday: '1986-05-18', age: 40, phone: '13812345678', phoneMasked: '138****5678', relationship: 'self', idCard: '310101198605181234', idCardMasked: '310***********1234', mobilityStatus: 'normal', medicalInsurance: '上海医保', isDefault: true, createdAt: '2026-07-01T08:00:00.000Z', updatedAt: '2026-07-01T08:00:00.000Z' },
  { id: 'patient-mother', name: '陈母', gender: 'female', birthday: '1958-03-12', age: 68, phone: '13612345821', phoneMasked: '136****5821', relationship: 'parent', mobilityStatus: 'limited', allergyHistory: '青霉素过敏', emergencyContact: '陈先生', emergencyPhone: '13812345678', isDefault: false, createdAt: '2026-07-01T08:00:00.000Z', updatedAt: '2026-07-01T08:00:00.000Z' },
  { id: 'patient-father', name: '陈父', gender: 'male', birthday: '1956-11-02', age: 69, phone: '13912347310', phoneMasked: '139****7310', relationship: 'parent', mobilityStatus: 'normal', isDefault: false, createdAt: '2026-07-01T08:00:00.000Z', updatedAt: '2026-07-01T08:00:00.000Z' },
]

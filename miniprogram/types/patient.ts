export type PatientRelationship = 'self' | 'parent' | 'child' | 'spouse' | 'other'
export type MobilityStatus = 'normal' | 'limited' | 'wheelchair'
export interface Patient { id: string; name: string; gender: 'male' | 'female'; birthday: string; age: number; phone: string; phoneMasked: string; relationship: PatientRelationship; idCard?: string; idCardMasked?: string; mobilityStatus: MobilityStatus; medicalInsurance?: string; allergyHistory?: string; emergencyContact?: string; emergencyPhone?: string; remark?: string; isDefault: boolean; createdAt: string; updatedAt: string }
export type PatientInput = Omit<Patient, 'id' | 'age' | 'phoneMasked' | 'idCardMasked' | 'createdAt' | 'updatedAt'>
export type PatientSummary = Omit<Patient, 'phone' | 'idCard' | 'emergencyPhone'>

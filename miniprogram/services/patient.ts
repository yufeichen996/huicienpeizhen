import { patientStore } from '../stores/patient'
import type { PatientInput } from '../types/patient'
export { validatePatient } from '../utils/validate'
export const patientService = { list: () => patientStore.list(), get: (id: string) => patientStore.get(id), getDefault: () => patientStore.getDefault(), save: (input: PatientInput, id?: string) => patientStore.save(input, id), setDefault: (id: string) => patientStore.setDefault(id), remove: (id: string) => patientStore.remove(id) }

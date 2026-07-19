import type { Companion } from './companion'; import type { Hospital } from './hospital'; import type { ServiceItem } from './service'
export interface DepartmentSearchResult { id: string; name: string; hospitalId: string; hospitalName: string; groupName: string }
export interface SearchResult { services: ServiceItem[]; hospitals: Hospital[]; departments: DepartmentSearchResult[]; companions: Companion[]; total: number }

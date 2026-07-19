import { storage } from './storage'
import { StorageKeys } from './storage-keys'
export function createOrderNumber(now = new Date()) { const pad = (n: number) => `${n}`.padStart(2, '0'); const date = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`; const saved = storage.get<{ date: string; value: number }>(StorageKeys.orderSequence, { date, value: 0 }); const value = saved.date === date ? saved.value + 1 : 1; storage.set(StorageKeys.orderSequence, { date, value }); return `SH${date}${`${value}`.padStart(3, '0')}` }

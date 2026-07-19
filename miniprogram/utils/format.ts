export const formatPrice = (cents: number) => {
  const safe = Number.isFinite(cents) ? Math.max(0, cents) : 0
  return (safe / 100).toFixed(safe % 100 === 0 ? 0 : 2)
}

export const formatDate = (value?: string | number | Date, style: 'iso' | 'zh' = 'iso') => {
  if (!value) return ''
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  if (style === 'zh') return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`
  return `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, '0')}-${`${date.getDate()}`.padStart(2, '0')}`
}

export const formatDateTime = (value?: string | number | Date) => {
  if (!value) return ''
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return `${formatDate(date)} ${`${date.getHours()}`.padStart(2, '0')}:${`${date.getMinutes()}`.padStart(2, '0')}`
}

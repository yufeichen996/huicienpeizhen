import { appendFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const sensitiveKey = /password|token|secret|authorization|identity|phone|patient/i

const redact = (value) => {
  if (!value || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map(redact)
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      sensitiveKey.test(key) ? '[REDACTED]' : redact(item),
    ]),
  )
}

export function createLogger(logDir) {
  mkdirSync(logDir, { recursive: true })
  const write = (file, level, event) => {
    const line = JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      ...redact(event),
    })
    appendFileSync(join(logDir, file), `${line}\n`, 'utf8')
  }
  return {
    access: (event) => write('access.log', 'info', event),
    error: (event) => write('error.log', 'error', event),
    security: (event) => write('security.log', 'warn', event),
  }
}

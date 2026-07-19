import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const serverRoot = resolve(fileURLToPath(new URL('.', import.meta.url)))
const projectRoot = resolve(serverRoot, '..')

const booleanValue = (name, fallback = false) => {
  const value = process.env[name]
  if (value === undefined) return fallback
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase())
}

const integerValue = (name, fallback) => {
  const value = Number(process.env[name] ?? fallback)
  if (!Number.isInteger(value) || value <= 0) throw new Error(`ENV_INVALID:${name}`)
  return value
}

const secretValue = (primaryName, fallbackName, fallback) =>
  process.env[primaryName] || process.env[fallbackName] || fallback

const unsafeSecret = (value, minLength) => {
  const normalized = String(value || '').trim()
  return normalized.length < minLength
    || /^(replace|change|development|test|example|placeholder)/i.test(normalized)
    || normalized.includes('SECRET_MANAGER_VALUE')
}

const appEnv = process.env.APP_ENV || process.env.NODE_ENV || 'development'
const production = appEnv === 'production'
const databaseFile = resolve(
  process.env.DATABASE_FILE || resolve(serverRoot, '.data', `${appEnv}.sqlite`),
)

export const config = Object.freeze({
  nodeEnv: process.env.NODE_ENV || 'development',
  appEnv,
  production,
  host: process.env.HOST || '127.0.0.1',
  port: integerValue('PORT', 8797),
  databaseFile,
  logDir: resolve(process.env.LOG_DIR || resolve(serverRoot, '.logs')),
  uploadDir: resolve(process.env.UPLOAD_DIR || resolve(serverRoot, '.uploads')),
  maxBodyBytes: integerValue('MAX_BODY_BYTES', 1024 * 1024),
  tokenTtlSeconds: integerValue('TOKEN_TTL_SECONDS', 7200),
  corsOrigins: (process.env.CORS_ALLOWED_ORIGINS || 'http://127.0.0.1:8797')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean),
  trustProxy: booleanValue('TRUST_PROXY', false),
  seedTestData: booleanValue('SEED_TEST_DATA', !production),
  allowDemoAuth: booleanValue('ALLOW_DEMO_AUTH', false),
  wechatLoginEnabled: booleanValue('WECHAT_LOGIN_ENABLED', false),
  wechatPaymentEnabled: booleanValue('WECHAT_PAYMENT_ENABLED', false),
  miniprogramEnabled: booleanValue('MINIPROGRAM_ENABLED', false),
  subscribeMessageEnabled: booleanValue('SUBSCRIBE_MESSAGE_ENABLED', false),
  demoInstitutionPassword: secretValue(
    'BOOTSTRAP_INSTITUTION_PASSWORD',
    'TEST_INSTITUTION_PASSWORD',
    'Huicien@2026',
  ),
  demoAdminPassword: secretValue(
    'BOOTSTRAP_ADMIN_PASSWORD',
    'TEST_ADMIN_PASSWORD',
    'Admin@2026!',
  ),
  dataEncryptionKey: process.env.DATA_ENCRYPTION_KEY || 'development-only-data-key',
  projectRoot,
  serverRoot,
})

if (production) {
  const unsafe = [
    config.allowDemoAuth && 'ALLOW_DEMO_AUTH',
    config.seedTestData && 'SEED_TEST_DATA',
    unsafeSecret(config.demoInstitutionPassword, 12) && 'BOOTSTRAP_INSTITUTION_PASSWORD',
    unsafeSecret(config.demoAdminPassword, 12) && 'BOOTSTRAP_ADMIN_PASSWORD',
    unsafeSecret(config.dataEncryptionKey, 32) && 'DATA_ENCRYPTION_KEY',
  ].filter(Boolean)
  if (unsafe.length) throw new Error(`PRODUCTION_CONFIG_UNSAFE:${unsafe.join(',')}`)
}

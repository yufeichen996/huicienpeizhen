import { config } from './config.mjs'
import { createRepository } from './db.mjs'

const repository = createRepository(config.databaseFile, {
  seedData: config.seedTestData,
  demoInstitutionPassword: config.demoInstitutionPassword,
  demoAdminPassword: config.demoAdminPassword,
  dataEncryptionKey: config.dataEncryptionKey,
  tokenTtlSeconds: config.tokenTtlSeconds,
})

try {
  const schema = repository.schemaInfo()
  console.log(JSON.stringify({
    databaseFile: config.databaseFile,
    schemaVersion: schema.version,
    migrations: schema.migrations,
    tableCount: schema.tables.length,
    indexCount: schema.indexes.length,
  }, null, 2))
} finally {
  repository.checkpoint()
  repository.close()
}

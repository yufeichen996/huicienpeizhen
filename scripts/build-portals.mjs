import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = resolve('.')
const source = resolve(root, 'server/public')
const distRoot = resolve(root, 'dist')
const institutionRoot = resolve(distRoot, 'institution')
const adminRoot = resolve(distRoot, 'admin')

const configSource = (apiBaseUrl, appEnv) => `window.__HUICIEN_CONFIG__ = ${JSON.stringify({
  apiBaseUrl,
  appEnv,
}, null, 2)}\n`

await rm(distRoot, { recursive: true, force: true })
await Promise.all([
  mkdir(institutionRoot, { recursive: true }),
  mkdir(adminRoot, { recursive: true }),
])

await Promise.all([
  cp(resolve(source, 'app.css'), resolve(institutionRoot, 'app.css')),
  cp(resolve(source, 'app.js'), resolve(institutionRoot, 'app.js')),
  cp(resolve(source, 'index.html'), resolve(institutionRoot, 'index.html')),
  cp(resolve(source, 'app.css'), resolve(adminRoot, 'app.css')),
  cp(resolve(source, 'admin.js'), resolve(adminRoot, 'admin.js')),
  cp(resolve(source, 'admin.html'), resolve(adminRoot, 'index.html')),
])

const institutionHtml = (await readFile(resolve(institutionRoot, 'index.html'), 'utf8'))
  .replaceAll('src="/org-config.js"', 'src="./org-config.js"')
  .replaceAll('src="/app.js', 'src="./app.js')
  .replaceAll('href="/app.css', 'href="./app.css')
const adminHtml = (await readFile(resolve(adminRoot, 'index.html'), 'utf8'))
  .replaceAll('src="/admin-config.js"', 'src="./admin-config.js"')
  .replaceAll('src="/admin.js', 'src="./admin.js')
  .replaceAll('href="/app.css', 'href="./app.css')

await Promise.all([
  writeFile(resolve(institutionRoot, 'index.html'), institutionHtml),
  writeFile(resolve(adminRoot, 'index.html'), adminHtml),
  writeFile(
    resolve(institutionRoot, 'org-config.js'),
    configSource(process.env.ORG_API_BASE_URL || '', process.env.APP_ENV || 'development'),
  ),
  writeFile(
    resolve(adminRoot, 'admin-config.js'),
    configSource(process.env.ADMIN_API_BASE_URL || '', process.env.APP_ENV || 'development'),
  ),
])

console.log(`Built institution portal: ${institutionRoot}`)
console.log(`Built admin portal: ${adminRoot}`)

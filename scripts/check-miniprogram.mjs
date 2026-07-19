import { access, readFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'

const root = resolve('miniprogram')
const appConfig = JSON.parse(await readFile(join(root, 'app.json'), 'utf8'))
const failures = []

async function mustExist(path, label) {
  try {
    await access(path)
  } catch {
    failures.push(`${label}: ${path}`)
  }
}

for (const page of appConfig.pages) {
  for (const extension of ['.ts', '.json', '.wxml', '.wxss']) {
    await mustExist(join(root, `${page}${extension}`), `Missing page file`)
  }
  try {
    await access(join(root, `${page}.js`))
    failures.push(`Conflicting generated JavaScript exists beside TypeScript: ${page}.js`)
  } catch {
    // Expected: WeChat DevTools compiles TypeScript in memory.
  }
}

const jsonFiles = await Promise.all(appConfig.pages.map((page) => readFile(join(root, `${page}.json`), 'utf8')))
for (let index = 0; index < jsonFiles.length; index += 1) {
  const config = JSON.parse(jsonFiles[index])
  for (const componentPath of Object.values(config.usingComponents || {})) {
    const base = join(root, String(componentPath).replace(/^\//, ''))
    for (const extension of ['.ts', '.json', '.wxml', '.wxss']) {
      await mustExist(`${base}${extension}`, `Missing component file`)
    }
  }
}

for (const page of appConfig.pages) {
  const wxmlPath = join(root, `${page}.wxml`)
  const tsPath = join(root, `${page}.ts`)
  const [wxml, source] = await Promise.all([readFile(wxmlPath, 'utf8'), readFile(tsPath, 'utf8')])
  const handlers = [...wxml.matchAll(/(?:bindtap|catchtap|bind:[\w-]+)="([\w]+)"/g)].map((match) => match[1])
  for (const handler of new Set(handlers)) {
    if (!new RegExp(`\\b${handler}\\s*\\(`).test(source)) failures.push(`Missing handler ${handler} in ${tsPath}`)
  }
  for (const match of wxml.matchAll(/(?:src)="(\/assets\/[^"{]+)"/g)) {
    await mustExist(join(root, match[1]), `Missing local asset`)
  }
}

const tabBarSource = await readFile(join(root, 'custom-tab-bar/index.wxss'), 'utf8')
if (!tabBarSource.includes('env(safe-area-inset-bottom)')) failures.push('Custom tab bar does not include safe-area-inset-bottom')

const navbarSource = await readFile(join(root, 'components/custom-navbar/index.ts'), 'utf8')
for (const api of ['wx.getWindowInfo()', 'wx.getMenuButtonBoundingClientRect()']) {
  if (!navbarSource.includes(api)) failures.push(`Custom navbar does not use ${api}`)
}

if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}

console.log(`Validated ${appConfig.pages.length} routes, component references, handlers, assets, navigation and safe areas.`)

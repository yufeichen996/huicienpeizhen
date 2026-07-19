import { readdirSync, readFileSync } from 'node:fs'
import { extname, join, relative } from 'node:path'

const root = process.cwd()
const ignoredDirectories = new Set([
  '.git',
  'node_modules',
  'dist',
  '.data',
  '.logs',
  '.uploads',
])
const textExtensions = new Set([
  '',
  '.cjs',
  '.css',
  '.env',
  '.example',
  '.html',
  '.js',
  '.json',
  '.md',
  '.mjs',
  '.sh',
  '.sql',
  '.svg',
  '.ts',
  '.wxml',
  '.wxss',
])
const legacyChineseBrand = ['安心', '陪诊'].join('')
const legacyTechnicalBrand = ['an', 'xin'].join('')
const violations = []

const inspect = (directory) => {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue
    const absolutePath = join(directory, entry.name)
    const displayPath = relative(root, absolutePath)
    if (
      entry.name.includes(legacyChineseBrand)
      || entry.name.toLowerCase().includes(legacyTechnicalBrand)
    ) {
      violations.push(`${displayPath}: 文件名包含旧品牌`)
    }
    if (entry.isDirectory()) {
      inspect(absolutePath)
      continue
    }
    if (!entry.isFile() || !textExtensions.has(extname(entry.name).toLowerCase())) continue
    const content = readFileSync(absolutePath, 'utf8')
    if (content.includes(legacyChineseBrand)) {
      violations.push(`${displayPath}: 内容包含旧中文品牌`)
    }
    if (content.toLowerCase().includes(legacyTechnicalBrand)) {
      violations.push(`${displayPath}: 内容包含旧技术品牌`)
    }
  }
}

inspect(root)

if (violations.length) {
  console.error(violations.join('\n'))
  process.exit(1)
}

console.log('Validated Huicien brand: no legacy Chinese or technical brand references.')

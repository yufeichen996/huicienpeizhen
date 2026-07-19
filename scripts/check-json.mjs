import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

const roots = ['miniprogram', '.']
const ignored = new Set(['node_modules', '.git'])
const files = []

async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) await walk(fullPath)
    else if (entry.name.endsWith('.json')) files.push(fullPath)
  }
}

for (const root of roots) {
  try {
    await walk(root)
  } catch {
    // Optional root.
  }
}

for (const file of [...new Set(files)]) {
  JSON.parse(await readFile(file, 'utf8'))
}

console.log(`Validated ${new Set(files).size} JSON files.`)

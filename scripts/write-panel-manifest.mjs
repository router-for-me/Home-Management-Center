import { createHash } from 'node:crypto'
import { readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { join, relative, sep } from 'node:path'
import { execFileSync } from 'node:child_process'

const distDir = new URL('../dist/', import.meta.url)
const manifestPath = new URL('../dist/panel-manifest.json', import.meta.url)
const requiredEntries = ['index.html', 'management.html', 'user.html']

function gitValue(args) {
  try {
    return execFileSync('git', args, {
      cwd: new URL('..', import.meta.url),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    return null
  }
}

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await walk(path)))
      continue
    }
    if (!entry.isFile()) continue
    files.push(path)
  }

  return files
}

async function fileRecord(path) {
  const [metadata, data] = await Promise.all([stat(path), readFile(path)])
  const pathname = relative(distDir.pathname, path).split(sep).join('/')

  return {
    path: pathname,
    size: metadata.size,
    sha256: createHash('sha256').update(data).digest('hex'),
  }
}

const files = (await walk(distDir.pathname))
  .filter((path) => !path.endsWith('/panel-manifest.json'))
  .sort()

const fileRecords = await Promise.all(files.map(fileRecord))
const filePathSet = new Set(fileRecords.map((file) => file.path))
const missingEntries = requiredEntries.filter((entry) => !filePathSet.has(entry))

if (missingEntries.length > 0) {
  throw new Error(`Embedded panel build is missing required entries: ${missingEntries.join(', ')}`)
}

const manifest = {
  name: 'home-management-center',
  buildTarget: 'embedded',
  schemaVersion: 1,
  builtAt: new Date().toISOString(),
  git: {
    commit: gitValue(['rev-parse', 'HEAD']),
    branch: gitValue(['rev-parse', '--abbrev-ref', 'HEAD']),
    tag: gitValue(['describe', '--tags', '--exact-match']),
    dirty: gitValue(['status', '--porcelain']) !== '',
  },
  entries: requiredEntries,
  assetsBasePath: 'assets/',
  files: fileRecords,
}

await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)

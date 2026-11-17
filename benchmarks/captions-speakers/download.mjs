import { createHash } from 'node:crypto'
import { createReadStream, createWriteStream, existsSync, mkdirSync, renameSync, rmSync } from 'node:fs'
import { dirname } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { getModel } from 'vellum/src/main/models/catalog'
import { MODEL_IDS, SPEAKERS_ID, filesOf } from './models.mjs'

const sha256 = (path) =>
  new Promise((resolve, reject) => {
    const hash = createHash('sha256')
    createReadStream(path).on('data', (chunk) => hash.update(chunk)).on('end', () => resolve(hash.digest('hex'))).on('error', reject)
  })

for (const id of [...MODEL_IDS, SPEAKERS_ID]) {
  for (const { url, sha256: expected, path } of filesOf(getModel(id), getModel)) {
    if (existsSync(path)) continue
    console.log('downloading', path)
    mkdirSync(dirname(path), { recursive: true })
    const response = await fetch(url)
    if (!response.ok) throw new Error(`${url}: ${response.status}`)
    await pipeline(Readable.fromWeb(response.body), createWriteStream(`${path}.part`))
    if ((await sha256(`${path}.part`)) !== expected) {
      rmSync(`${path}.part`)
      throw new Error(`${path}: wrong SHA-256`)
    }
    renameSync(`${path}.part`, path)
  }
}

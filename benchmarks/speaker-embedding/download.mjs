import { createWriteStream, existsSync, mkdirSync, renameSync, writeFileSync } from 'node:fs'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import * as tar from 'tar'
import models from './models.json' with { type: 'json' }

const MODELS_URL = 'https://huggingface.co/csukuangfj/speaker-embedding-models/resolve/main'
const CHINESE_URL = 'https://openslr.trmal.net/resources/82/cn-celeb_v2.tar.gz'
const ENGLISH_URL =
  'https://huggingface.co/datasets/Codec-SUPERB/Voxceleb1_test_original/resolve/main/data'
const ENGLISH_FILES = [
  'test-00000-of-00003-d0eea6966e0eba2f.parquet',
  'test-00001-of-00003-1ab27c4d03da1754.parquet',
  'test-00002-of-00003-4d6815b5778a4368.parquet'
]

async function download(url, path) {
  if (existsSync(path)) return
  console.log('downloading', path)
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${url}: ${response.status}`)
  await pipeline(Readable.fromWeb(response.body), createWriteStream(`${path}.part`))
  renameSync(`${path}.part`, path)
}

// CN-Celeb is one 22 GB archive whose eval folder comes first: keep its test clips and stop reading after it
async function downloadChinese() {
  const folder = 'data/chinese-flac'
  if (existsSync(`${folder}/.done`)) return
  console.log('downloading', folder)
  mkdirSync(folder, { recursive: true })
  const stop = new AbortController()
  const response = await fetch(CHINESE_URL, { signal: stop.signal })
  const extract = tar.x({
    cwd: folder,
    strip: 3,
    filter: (path) => {
      if (path !== 'CN-Celeb_flac/' && !path.startsWith('CN-Celeb_flac/eval')) stop.abort()
      return path.startsWith('CN-Celeb_flac/eval/test/')
    }
  })
  await pipeline(Readable.fromWeb(response.body), extract).catch((error) => {
    if (!stop.signal.aborted) throw error
  })
  writeFileSync(`${folder}/.done`, '')
}

mkdirSync('data/models', { recursive: true })
for (const model of models) await download(`${MODELS_URL}/${model.file}`, `data/models/${model.file}`)

mkdirSync('data/english-parquet', { recursive: true })
for (const file of ENGLISH_FILES) await download(`${ENGLISH_URL}/${file}`, `data/english-parquet/${file}`)

await downloadChinese()

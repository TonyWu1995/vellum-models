import { execFileSync } from 'node:child_process'
import { createWriteStream, existsSync, mkdirSync, renameSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import models from './models.json' with { type: 'json' }

const VAD_URL = 'https://huggingface.co/csukuangfj/vad/resolve/main/silero_vad.onnx'
const ARCHIVES_URL = 'https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models'
const CHINESE_URL =
  'https://huggingface.co/datasets/AudioLLMs/aishell_1_zh_test/resolve/main/data/test-00000-of-00003.parquet'
const ENGLISH_URL =
  'https://huggingface.co/datasets/openslr/librispeech_asr/resolve/main/all/test.clean/0000.parquet'
// Windows' own tar reads .tar.bz2; Git's tar, often first on the PATH, cannot run bzip2 there
const TAR = process.platform === 'win32' ? join(process.env.SystemRoot, 'System32', 'tar.exe') : 'tar'
const CRISPASR_URL =
  'https://github.com/CrispStrobe/CrispASR/releases/download/v0.8.53/crispasr-windows-x86_64-vulkan.zip'

async function download(url, path) {
  if (existsSync(path)) return
  console.log('downloading', path)
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${url}: ${response.status}`)
  await pipeline(Readable.fromWeb(response.body), createWriteStream(`${path}.part`))
  renameSync(`${path}.part`, path)
}

async function downloadArchive(name) {
  if (existsSync(`data/models/${name}`)) return
  const archive = `data/models/${name}.tar.bz2`
  await download(`${ARCHIVES_URL}/${name}.tar.bz2`, archive)
  console.log('extracting', name)
  execFileSync(TAR, ['-xjf', `${name}.tar.bz2`], { cwd: 'data/models', stdio: 'inherit' })
  rmSync(archive)
}

mkdirSync('data/models', { recursive: true })
if (process.platform === 'win32' && !existsSync('data/crispasr')) {
  mkdirSync('data/crispasr')
  await download(CRISPASR_URL, 'data/crispasr/crispasr.zip')
  execFileSync(TAR, ['-xf', 'crispasr.zip'], { cwd: 'data/crispasr', stdio: 'inherit' })
  rmSync('data/crispasr/crispasr.zip')
}
await download(CHINESE_URL, 'data/chinese.parquet')
await download(ENGLISH_URL, 'data/english.parquet')
await download(VAD_URL, 'data/models/silero_vad.onnx')
for (const model of models) {
  if (model.archive) await downloadArchive(model.archive)
  else if (model.repo) {
    mkdirSync('data/models/transcribe-cpp', { recursive: true })
    await download(`https://huggingface.co/${model.repo}/resolve/main/${model.gguf}`, `data/models/transcribe-cpp/${model.gguf}`)
  } else if (model.gguf) {
    mkdirSync(`data/models/${model.folder}`, { recursive: true })
    for (const file of [model.gguf, model.mmproj]) await download(`${model.url}/${file}`, `data/models/${model.folder}/${file}`)
  } else await download(model.url, `data/models/${model.id}.bin`)
}

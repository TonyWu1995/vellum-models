// Makes CAM++ voiceprints of every LibriSpeech test-clean clip with fbank.mjs on one onnxruntime version, for score.mjs
// Usage: node runtimes.mjs <model.onnx> <librispeech parquet> <folder holding node_modules/onnxruntime-node>
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import ffmpeg from 'ffmpeg-static'
import { asyncBufferFromFile, parquetReadObjects } from 'hyparquet'
import { BINS, fbank, SAMPLE_RATE } from './fbank.mjs'

const [modelFile, parquet, ortFolder] = process.argv.slice(2)
const CLIPS = 'data/librispeech'
const MAX_SECONDS = 10

function decode(bytes) {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpeg, ['-v', 'error', '-i', 'pipe:0', '-ac', '1', '-ar', '16000', '-f', 'f32le', 'pipe:1'])
    const chunks = []
    child.stdout.on('data', (chunk) => chunks.push(chunk))
    child.on('close', (code) => (code === 0 ? resolve(Buffer.concat(chunks)) : reject(new Error('ffmpeg failed'))))
    child.stdin.end(bytes)
  })
}

if (!existsSync(CLIPS)) {
  mkdirSync(CLIPS, { recursive: true })
  const rows = await parquetReadObjects({ file: await asyncBufferFromFile(parquet), utf8: false })
  for (const { audio, speaker_id: speaker, chapter_id: chapter, id } of rows) {
    const n = String(id).split('-').at(-1)
    writeFileSync(`${CLIPS}/${speaker}-${chapter}-${n}.f32`, await decode(audio.bytes))
  }
}

const ort = createRequire(`${ortFolder}/package.json`)('onnxruntime-node')
const version = createRequire(`${ortFolder}/package.json`)('onnxruntime-node/package.json').version
const session = await ort.InferenceSession.create(modelFile, { executionProviders: ['cpu'], intraOpNumThreads: 2 })
const result = {}
for (const clip of readdirSync(CLIPS)) {
  const buffer = readFileSync(`${CLIPS}/${clip}`)
  const samples = new Float32Array(buffer.buffer, buffer.byteOffset, buffer.length / 4).slice(0, SAMPLE_RATE * MAX_SECONDS)
  const { features, frames } = fbank(samples)
  const { embedding } = await session.run({ x: new ort.Tensor('float32', features, [1, frames, BINS]) })
  result[clip.replace('.f32', '')] = { seconds: samples.length / SAMPLE_RATE, embedding: Array.from(embedding.data) }
}
mkdirSync('data/voiceprints', { recursive: true })
writeFileSync(`data/voiceprints/librispeech-campplus-onnxruntime-${version}.json`, JSON.stringify(result))
console.log(`onnxruntime ${version}: ${Object.keys(result).length} clips`)

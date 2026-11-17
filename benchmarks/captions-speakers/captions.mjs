// Runs Vellum's own transcribe.cpp captioners over each recording, each model, device and language in a process of its own
import { execFileSync } from 'node:child_process'
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { getModel } from 'vellum/src/main/models/catalog'
import { createSentenceCaptioner } from 'vellum/src/main/captions/sentenceCaptioner'
import { createStreamCaptioner } from 'vellum/src/main/captions/streamCaptioner'
import { MODEL_IDS, filesOf } from './models.mjs'

const SAMPLE_RATE = 16000
// Vellum's window sends about 100 ms of audio at a time, and its caption process uses 2 threads
const CHUNK = SAMPLE_RATE / 10
const THREADS = 2
const GPU = process.platform === 'darwin' ? 'metal' : 'vulkan'
const DEVICES = process.env.DEVICES?.split(',') ?? ['cpu', 'gpu']
const SETS = process.env.SETS?.split(',') ?? ['chinese', 'english']
const textPath = (id, device, set) => `data/text/${id}-${device}-${set}.txt`

async function run(id, device, set) {
  const model = getModel(id)
  const files = filesOf(model, getModel)
  const fileOf = (owner) => files.find((file) => file.owner === owner).path
  const transcribeCpp = import('transcribe-cpp')
  const captioner =
    model.recognizer.kind === 'stream' ? createStreamCaptioner(transcribeCpp) : createSentenceCaptioner(transcribeCpp)
  const wav = readFileSync(`data/${set}.wav`)
  const pcm = new Int16Array(wav.buffer, wav.byteOffset + 44, (wav.length - 44) / 2)
  const samples = Float32Array.from(pcm, (value) => value / 32768)

  const loadStart = performance.now()
  const vad = files.find((file) => file.owner !== model)?.owner
  await captioner.open({
    recognizer: model.recognizer,
    files: { model: fileOf(model) },
    required: vad ? { 'speech-detection': { model: fileOf(vad) } } : {},
    language: null,
    script: null,
    threads: THREADS,
    provider: device === 'gpu' ? GPU : 'cpu'
  })
  const loadMs = performance.now() - loadStart

  const lines = []
  const chunkMs = []
  const cpuStart = process.cpuUsage()
  const start = performance.now()
  for (let i = 0; i < samples.length; i += CHUNK) {
    const chunkStart = performance.now()
    const answer = await captioner.accept({ samples: samples.slice(i, i + CHUNK) })
    chunkMs.push(performance.now() - chunkStart)
    if (answer) lines.push(...answer.lines)
  }
  lines.push(...(await captioner.finish()).lines)
  const wallMs = performance.now() - start
  const cpu = process.cpuUsage(cpuStart)

  writeFileSync(textPath(id, device, set), lines.map((line) => line.text).join('\n'))
  const sorted = [...chunkMs].sort((a, b) => a - b)
  const audioSeconds = samples.length / SAMPLE_RATE
  return {
    model: id,
    device,
    backend: device === 'gpu' ? GPU : 'cpu',
    set,
    audioSeconds: Math.round(audioSeconds),
    loadMs: Math.round(loadMs),
    firstChunkMs: Number(chunkMs[0].toFixed(1)),
    p95Ms: Number(sorted[Math.floor(sorted.length * 0.95)].toFixed(1)),
    maxMs: Number(sorted.at(-1).toFixed(1)),
    rtf: Number((wallMs / 1000 / audioSeconds).toFixed(4)),
    // CPU time per second of audio is how many cores live captions keep busy
    cpuCores: Number(((cpu.user + cpu.system) / 1e6 / audioSeconds).toFixed(3))
  }
}

if (process.argv[2]) {
  const [id, device, set] = process.argv.slice(2)
  console.log(JSON.stringify(await run(id, device, set)))
  process.exit(0)
}

mkdirSync('data/text', { recursive: true })
for (const id of MODEL_IDS) {
  for (const device of DEVICES) {
    for (const set of SETS) {
      if (existsSync(textPath(id, device, set))) continue
      console.log(id, device, set)
      const line = execFileSync(process.execPath, [process.argv[1], id, device, set], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
      appendFileSync('data/results.jsonl', line.trim().split('\n').at(-1) + '\n')
    }
  }
}

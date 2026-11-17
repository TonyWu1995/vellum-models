// Times Vellum's own speaker code (Nemotron-3-Diarization, then CAM++ voiceprints) on an hour of audio
import { execFileSync } from 'node:child_process'
import { appendFileSync, existsSync, readFileSync } from 'node:fs'
import { getModel } from 'vellum/src/main/models/catalog'
import { identifySpeakers } from 'vellum/src/main/speakers/diarization'
import { embedTurns } from 'vellum/src/main/speakers/embeddings'
import { SPEAKERS_ID, filesOf } from './models.mjs'

const AUDIO = 'data/hour.wav'
const RESULTS = 'data/speakers.jsonl'
const GPU = { darwin: 'coreml', win32: 'dml' }[process.platform]
const PROVIDERS = process.env.PROVIDERS?.split(',') ?? ['cpu', ...(GPU ? [GPU] : [])]
// The CPU runs q4 and a GPU fp16 in Vellum; each is tried on both here
const WEIGHTS = { q4: 'cpuModel', fp16: 'gpuModel' }

async function run(weights, provider) {
  const files = filesOf(getModel(SPEAKERS_ID), getModel)
  const pathOf = (role) => files.find((file) => file.role === role).path
  const cpuStart = process.cpuUsage()
  const start = performance.now()
  const turns = await identifySpeakers(AUDIO, pathOf(WEIGHTS[weights]), provider)
  const identified = performance.now()
  await embedTurns(AUDIO, turns, pathOf('embedding'))
  const end = performance.now()
  const cpu = process.cpuUsage(cpuStart)
  return {
    weights,
    provider,
    audioSeconds: Math.round((readFileSync(AUDIO).length - 44) / 32000),
    identifySeconds: Number(((identified - start) / 1000).toFixed(1)),
    voiceprintSeconds: Number(((end - identified) / 1000).toFixed(1)),
    cpuCores: Number(((cpu.user + cpu.system) / 1000 / (end - start)).toFixed(2)),
    turns: turns.length,
    speakers: new Set(turns.map(({ speaker }) => speaker)).size,
    peakMemoryMb: Math.round(process.resourceUsage().maxRSS / 1024)
  }
}

if (process.argv[2]) {
  const [weights, provider] = process.argv.slice(2)
  console.log(JSON.stringify(await run(weights, provider)))
  process.exit(0)
}

const done = existsSync(RESULTS) ? readFileSync(RESULTS, 'utf8') : ''
for (const weights of Object.keys(WEIGHTS)) {
  for (const provider of PROVIDERS) {
    if (done.includes(`"weights":"${weights}","provider":"${provider}"`)) continue
    console.log(weights, provider)
    const line = execFileSync(process.execPath, [process.argv[1], weights, provider], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
    appendFileSync(RESULTS, line.trim().split('\n').at(-1) + '\n')
  }
}

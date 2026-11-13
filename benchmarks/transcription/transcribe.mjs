// Each model, device and language runs in a process of its own, so its peak memory is its own
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import models from './models.json' with { type: 'json' }
import { openModel } from './recognizers.mjs'

const LANGUAGES = { chinese: 'zh', english: 'en' }
const DEVICES = ['cpu', 'gpu']
const FOLDER = process.env.FOLDER ?? 'data/transcripts'
const SETS = process.env.SETS?.split(',') ?? Object.keys(LANGUAGES)

const pcmOf = (path) => {
  const wav = readFileSync(path)
  return wav.buffer.slice(wav.byteOffset + 44, wav.byteOffset + wav.length)
}

async function run(modelId, device, set) {
  const model = models.find(({ id }) => id === modelId)
  const clips = JSON.parse(readFileSync(`data/${set}/clips.json`, 'utf8'))
  const loadStart = performance.now()
  const transcribe = await openModel(model, device, LANGUAGES[set])
  const loadMs = Math.round(performance.now() - loadStart)
  const results = []
  for (const clip of clips) {
    const start = performance.now()
    let found
    try {
      const { text, timing, fields } = await transcribe(pcmOf(`data/${set}/${clip.id}.wav`))
      found = { text, timing, fields }
    } catch (error) {
      found = { text: '', error: String(error?.message ?? error) }
    }
    results.push({ id: clip.id, ms: Math.round(performance.now() - start), ...found })
  }
  const maxRssMb = Math.round(process.resourceUsage().maxRSS / 1024)
  return { model: model.id, device, set, loadMs, maxRssMb, results }
}

if (process.argv[2]) {
  const [modelId, device, set] = process.argv.slice(2)
  const output = `${FOLDER}/${modelId}-${device}-${set}.json`
  writeFileSync(output, JSON.stringify(await run(modelId, device, set), null, 2))
  process.exit(0)
}

mkdirSync(FOLDER, { recursive: true })
const only = process.env.MODELS?.split(',')
const devices = process.env.DEVICES?.split(',') ?? DEVICES
const chosen = (only ? only.map((id) => models.find((model) => model.id === id)) : models).filter(({ kind }) => kind !== 'crispasr')
for (const model of chosen) {
  for (const device of (model.devices ?? DEVICES).filter((name) => devices.includes(name))) {
    for (const set of SETS) {
      const output = `${FOLDER}/${model.id}-${device}-${set}.json`
      if (existsSync(output)) continue
      console.log(model.id, device, set)
      try {
        execFileSync(process.execPath, ['transcribe.mjs', model.id, device, set], { stdio: 'inherit' })
      } catch {
        writeFileSync(output, JSON.stringify({ model: model.id, device, set, crashed: true }))
        console.log('  crashed')
      }
    }
  }
}

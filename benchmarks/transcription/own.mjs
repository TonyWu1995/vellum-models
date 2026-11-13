// Transcribes your own recordings the way Vellum does: speech detection, then pieces of up to 120 s.
// Usage: node own.mjs <recording>... ; everything it writes stays in data/own/, which is not committed
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, extname } from 'node:path'
import ffmpeg from 'ffmpeg-static'
import models from './models.json' with { type: 'json' }
import { openModel, pieces } from './recognizers.mjs'

const SAMPLE_RATE = 16000
const DEVICES = ['cpu', 'gpu']

const clock = (seconds) =>
  `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${(seconds % 60).toFixed(1).padStart(4, '0')}`

const recordings = process.argv.slice(2)
mkdirSync('data/own', { recursive: true })
if (recordings.length) {
  for (const recording of recordings) {
    const output = `data/own/${basename(recording, extname(recording))}.pcm`
    if (!existsSync(output)) {
      execFileSync(ffmpeg, ['-v', 'error', '-i', recording, '-ac', '1', '-ar', String(SAMPLE_RATE), '-f', 's16le', output])
    }
  }
  process.exit(0)
}

const [modelId, device] = [process.env.MODEL, process.env.DEVICE]
if (modelId) {
  const model = models.find(({ id }) => id === modelId)
  const transcribe = await openModel(model, device, 'zh')
  const out = []
  for (const name of readdirSync('data/own').filter((file) => file.endsWith('.pcm'))) {
    const pcm = readFileSync(`data/own/${name}`)
    const buffer = pcm.buffer.slice(pcm.byteOffset, pcm.byteOffset + pcm.length)
    let busy = 0
    out.push(`# ${name}`)
    for (const { start, end } of pieces(buffer, 120)) {
      const begin = performance.now()
      const found = await transcribe(buffer.slice(start * 2, end * 2)).catch((error) => ({ text: `[failed: ${error.message}]`, timing: 'none' }))
      busy += performance.now() - begin
      const firstTimes = found.timestamps?.slice(0, 3).map((t) => (start / SAMPLE_RATE + t).toFixed(2)).join(', ')
      out.push(`[${clock(start / SAMPLE_RATE)} – ${clock(end / SAMPLE_RATE)}] (${found.timing}${firstTimes ? `: ${firstTimes}` : ''}) ${found.text}`)
    }
    out.push(`time: ${(busy / 1000).toFixed(1)} s for ${(pcm.length / 2 / SAMPLE_RATE).toFixed(0)} s of audio`, '')
  }
  writeFileSync(`data/own/${modelId}-${device}.txt`, out.join('\n'))
  process.exit(0)
}

const only = process.env.MODELS?.split(',')
const devices = process.env.DEVICES?.split(',') ?? DEVICES
for (const model of models.filter(({ id, kind }) => kind !== 'crispasr' && (!only || only.includes(id)))) {
  for (const device of (model.devices ?? DEVICES).filter((name) => devices.includes(name))) {
    if (existsSync(`data/own/${model.id}-${device}.txt`)) continue
    console.log(model.id, device)
    try {
      execFileSync(process.execPath, ['own.mjs'], { stdio: 'inherit', env: { ...process.env, MODEL: model.id, DEVICE: device } })
    } catch {
      writeFileSync(`data/own/${model.id}-${device}.txt`, 'crashed\n')
    }
  }
}

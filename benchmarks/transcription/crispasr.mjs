// CrispASR has no Node package, so its command line transcribes each language in one process
// and the result is written like transcribe.mjs output; its timing excludes loading the model
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import models from './models.json' with { type: 'json' }

const EXE = 'data/crispasr/crispasr-windows-x86_64-vulkan/crispasr.exe'
const LANGUAGES = { chinese: 'zh', english: 'en' }

if (process.platform !== 'win32') process.exit(0)
for (const model of models.filter(({ kind }) => kind === 'crispasr')) {
  for (const [set, language] of Object.entries(LANGUAGES)) {
    const output = `data/transcripts/${model.id}-gpu-${set}.json`
    if (existsSync(output)) continue
    console.log(model.id, 'gpu', set)
    const clips = JSON.parse(readFileSync(`data/${set}/clips.json`, 'utf8'))
    const files = clips.flatMap(({ id }) => ['-f', `data/${set}/${id}.wav`])
    const args = ['-m', `data/models/transcribe-cpp/${model.gguf}`, '-l', language, '-otxt', ...files]
    const run = spawnSync(EXE, args, { encoding: 'utf8', maxBuffer: 1 << 28 })
    const times = [...`${run.stdout}${run.stderr}`.matchAll(/transcribed [\d.]+s audio in ([\d.]+)s/g)]
    const results = clips.map(({ id }, i) => {
      const path = `data/${set}/${id}.txt`
      const text = existsSync(path) ? readFileSync(path, 'utf8').trim() : ''
      rmSync(path, { force: true })
      return { id, ms: Math.round(Number(times[i]?.[1] ?? 0) * 1000), text, timing: 'none', fields: [] }
    })
    writeFileSync(output, JSON.stringify({ model: model.id, device: 'gpu', set, loadMs: 0, maxRssMb: 0, results }, null, 2))
  }
}

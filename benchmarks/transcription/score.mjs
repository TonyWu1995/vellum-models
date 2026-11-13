// Scores every transcript in data/transcripts: Chinese by characters (CER), English by words (WER)
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import models from './models.json' with { type: 'json' }
import { NORMALIZE } from './normalize.mjs'

function editDistance(a, b) {
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i]
    for (let j = 1; j <= b.length; j += 1) {
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    previous = current
  }
  return previous[b.length]
}

const seconds = (set, id) => (statSync(`data/${set}/${id}.wav`).size - 44) / 32000
const percent = (errors, total) => `${((100 * errors) / total).toFixed(1)}%`

function score(set, transcript, clips) {
  const groups = {}
  let audio = 0
  let busy = 0
  for (const clip of clips) {
    const found = transcript.results.find(({ id }) => id === clip.id)
    const reference = NORMALIZE[set](clip.text)
    const group = (groups[clip.length] ??= { errors: 0, total: 0, failed: 0 })
    group.errors += editDistance(reference, NORMALIZE[set](found.text))
    group.total += reference.length
    if (found.error || !found.text.trim()) group.failed += 1
    audio += seconds(set, clip.id)
    busy += found.ms
  }
  const timings = [...new Set(transcript.results.map(({ timing }) => timing).filter(Boolean))]
  return { groups, rtf: busy / 1000 / audio, timings }
}

mkdirSync('results', { recursive: true })
for (const set of ['chinese', 'english']) {
  const clips = JSON.parse(readFileSync(`data/${set}/clips.json`, 'utf8'))
  const lengths = [...new Set(clips.map(({ length }) => length))]
  const unit = set === 'chinese' ? 'CER' : 'WER'
  const lines = [
    `| Model | Device | ${lengths.map((length) => `${unit} ${length}`).join(' | ')} | Speed (RTF) | Load | Peak memory | Times |`,
    `| --- | --- | ${lengths.map(() => '---').join(' | ')} | --- | --- | --- | --- |`
  ]
  for (const model of models) {
    for (const device of ['cpu', 'gpu']) {
      const path = `data/transcripts/${model.id}-${device}-${set}.json`
      if (!existsSync(path)) continue
      const transcript = JSON.parse(readFileSync(path, 'utf8'))
      const status = ['skipped', 'crashed'].find((name) => transcript[name])
      if (status) {
        lines.push(`| ${model.label} | ${device} | ${lengths.map(() => status).join(' | ')} | | | | |`)
        continue
      }
      const { groups, rtf, timings } = score(set, transcript, clips)
      const cells = lengths.map((length) => {
        const { errors, total, failed } = groups[length]
        return `${percent(errors, total)}${failed ? ` (${failed} empty)` : ''}`
      })
      lines.push(
        `| ${model.label} | ${device} | ${cells.join(' | ')} | ${rtf.toFixed(3)} | ${transcript.maxRssMb ? `${(transcript.loadMs / 1000).toFixed(1)} s | ${transcript.maxRssMb} MB` : 'not measured | not measured'} | ${timings.join(', ')} |`
      )
    }
  }
  writeFileSync(`results/${set}.md`, `${lines.join('\n')}\n`)
  console.log(`\n${set}\n${lines.join('\n')}`)
}

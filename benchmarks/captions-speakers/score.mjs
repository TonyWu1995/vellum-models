// Writes captions.md (CPU use, delay and accuracy against the reference text) and speakers.md (time on an hour)
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { NORMALIZE } from '../transcription/normalize.mjs'

const RESULTS = process.env.RESULTS ?? 'results'

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


const runs = readFileSync('data/results.jsonl', 'utf8').trim().split('\n').map((line) => JSON.parse(line))
const lines = [
  '| Model | Language | Device | CPU cores | p95 per chunk | Max per chunk | RTF | Load | CER / WER |',
  '| --- | --- | --- | --- | --- | --- | --- | --- | --- |'
]
for (const run of runs) {
  const textPath = `data/text/${run.model}-${run.device}-${run.set}.txt`
  if (!existsSync(textPath)) continue
  const reference = NORMALIZE[run.set](readFileSync(`data/${run.set}.txt`, 'utf8'))
  const found = NORMALIZE[run.set](readFileSync(textPath, 'utf8').replace(/\n/g, ' '))
  const error = ((100 * editDistance(reference, found)) / reference.length).toFixed(1)
  lines.push(
    `| ${run.model} | ${run.set} | ${run.backend} | ${run.cpuCores} | ${run.p95Ms} ms | ${run.maxMs} ms | ${run.rtf} | ${run.loadMs == null ? "not measured" : `${(run.loadMs / 1000).toFixed(1)} s`} | ${error} % |`
  )
}
mkdirSync(RESULTS, { recursive: true })
writeFileSync(`${RESULTS}/captions.md`, `${lines.join('\n')}\n`)
console.log(lines.join('\n'))

const speakers = readFileSync('data/speakers.jsonl', 'utf8').trim().split('\n').map((line) => JSON.parse(line))
const speakerLines = [
  '| Weights | Provider | Find speakers | Voiceprints | Total | CPU cores | Peak memory | Speakers / turns |',
  '| --- | --- | --- | --- | --- | --- | --- | --- |',
  ...speakers.map(
    (run) =>
      `| ${run.weights} | ${run.provider} | ${run.identifySeconds} s | ${run.voiceprintSeconds} s | ${(run.identifySeconds + run.voiceprintSeconds).toFixed(1)} s | ${run.cpuCores} | ${run.peakMemoryMb} MB | ${run.speakers} / ${run.turns} |`
  )
]
writeFileSync(`${RESULTS}/speakers.md`, `${speakerLines.join('\n')}\n`)
console.log(`\n${speakerLines.join('\n')}`)

// Measures where a forced aligner puts each sentence of the long pieces. The truth is where speech starts
// and ends inside each joined clip (by speech detection, so the silence around a clip is not an error).
// The aligner gets either the reference text or a model's own transcript, as Vellum would give it.
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { NORMALIZE } from './normalize.mjs'
import { pieces } from './recognizers.mjs'

const EXE = 'data/crispasr/crispasr-windows-x86_64-vulkan/crispasr.exe'
const ALIGNERS = { 'qwen3-forced-aligner': 'data/models/aligners/qwen3-forced-aligner-0.6b-q8_0.gguf' }
const TEXTS = ['reference', 'qwen3-asr-0.6b-tcpp-gpu', 'funasr-nano-tcpp-30s-gpu', 'sense-voice-tcpp-gpu']
const LANGUAGES = { chinese: 'zh', english: 'en' }
const BYTES_PER_SECOND = 32000

function speechBounds(wav, part) {
  const from = 44 + Math.round(part.start * 16000) * 2
  const pcm = wav.buffer.slice(wav.byteOffset + from, wav.byteOffset + from + Math.round((part.end - part.start) * 16000) * 2)
  const found = pieces(pcm, 3600)
  if (!found.length) return null
  return { start: part.start + found[0].start / 16000, end: part.start + found.at(-1).end / 16000 }
}

function align(aligner, set, clip, text) {
  writeFileSync('data/align-text.txt', text)
  const begin = performance.now()
  const run = spawnSync(EXE, ['--align-only', '-am', ALIGNERS[aligner], '-f', `data/${set}/${clip.id}.wav`, '--text-file', 'data/align-text.txt',
    '--align-granularity', 'word', '--align-format', 'json', '-l', LANGUAGES[set]], { encoding: 'utf8', maxBuffer: 1 << 26 })
  const ms = performance.now() - begin
  try {
    return { ms, words: JSON.parse(run.stdout) }
  } catch {
    return { ms, words: [] }
  }
}

// Matches the aligned words to the reference words by edit distance, so a transcript with mistakes still
// tells which of its words belong to which sentence
function matchedPairs(reference, found) {
  const rows = reference.length + 1
  const cols = found.length + 1
  const cost = new Uint32Array(rows * cols)
  for (let i = 0; i < rows; i += 1) cost[i * cols] = i
  for (let j = 0; j < cols; j += 1) cost[j] = j
  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const same = reference[i - 1].token === found[j - 1].token ? 0 : 1
      cost[i * cols + j] = Math.min(cost[(i - 1) * cols + j] + 1, cost[i * cols + j - 1] + 1, cost[(i - 1) * cols + j - 1] + same)
    }
  }
  const pairs = []
  for (let i = rows - 1, j = cols - 1; i > 0 && j > 0; ) {
    const same = reference[i - 1].token === found[j - 1].token
    if (same && cost[i * cols + j] === cost[(i - 1) * cols + j - 1]) {
      pairs.push([i - 1, j - 1])
      i -= 1
      j -= 1
    } else if (cost[i * cols + j] === cost[(i - 1) * cols + j - 1] + 1) {
      i -= 1
      j -= 1
    } else if (cost[i * cols + j] === cost[(i - 1) * cols + j] + 1) i -= 1
    else j -= 1
  }
  return pairs
}

function measure(set, clip, words) {
  const wav = readFileSync(`data/${set}/${clip.id}.wav`)
  const reference = clip.parts.flatMap((part, sentence) => NORMALIZE[set](part.text).map((token) => ({ token, sentence })))
  const found = words.flatMap(({ word, start, end }) => NORMALIZE[set](word).map((token) => ({ token, start, end })))
  const spans = clip.parts.map(() => null)
  for (const [i, j] of matchedPairs(reference, found)) {
    const { sentence } = reference[i]
    const { start, end } = found[j]
    spans[sentence] = spans[sentence] ? { start: Math.min(spans[sentence].start, start), end: Math.max(spans[sentence].end, end) } : { start, end }
  }
  return clip.parts.map((part, sentence) => {
    const truth = speechBounds(wav, part)
    const span = spans[sentence]
    if (!truth) return { skipped: true }
    if (!span) return { missed: true }
    return { start: span.start - truth.start, end: span.end - truth.end }
  })
}

if (process.platform !== 'win32') process.exit(0)
mkdirSync('data/align', { recursive: true })
for (const aligner of Object.keys(ALIGNERS)) {
  for (const source of TEXTS) {
    for (const set of Object.keys(LANGUAGES)) {
      const output = `data/align/${aligner}-${source}-${set}.json`
      const transcripts = `data/transcripts/${source}-${set}.json`
      if (existsSync(output) || (source !== 'reference' && !existsSync(transcripts))) continue
      console.log(aligner, source, set)
      const clips = JSON.parse(readFileSync(`data/${set}/clips.json`, 'utf8')).filter(({ parts }) => parts)
      const texts = source === 'reference' ? null : JSON.parse(readFileSync(transcripts, 'utf8')).results
      const results = clips.map((clip) => {
        const text = texts ? texts.find(({ id }) => id === clip.id).text : clip.parts.map(({ text }) => text).join(' ')
        const { ms, words } = align(aligner, set, clip, text)
        return { id: clip.id, ms: Math.round(ms), seconds: clip.seconds, sentences: measure(set, clip, words) }
      })
      writeFileSync(output, JSON.stringify({ aligner, source, set, results }, null, 2))
    }
  }
}

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted.length ? sorted[Math.floor(sorted.length / 2)] : NaN
}
const share = (values, limit) => `${Math.round((100 * values.filter((value) => value <= limit).length) / values.length)} %`
const lines = [
  '| Aligner | Text | Language | Sentences | Missed | Median start error | Median end error | Within 0.2 s | Within 0.5 s | RTF |',
  '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |'
]
for (const aligner of Object.keys(ALIGNERS)) {
  for (const source of TEXTS) {
    for (const set of Object.keys(LANGUAGES)) {
      const path = `data/align/${aligner}-${source}-${set}.json`
      if (!existsSync(path)) continue
      const { results } = JSON.parse(readFileSync(path, 'utf8'))
      const sentences = results.flatMap(({ sentences }) => sentences).filter(({ skipped }) => !skipped)
      const timed = sentences.filter(({ missed }) => !missed)
      const starts = timed.map(({ start }) => Math.abs(start))
      const ends = timed.map(({ end }) => Math.abs(end))
      const rtf = results.reduce((sum, { ms }) => sum + ms, 0) / 1000 / results.reduce((sum, { seconds }) => sum + seconds, 0)
      lines.push(
        `| ${aligner} | ${source} | ${set} | ${sentences.length} | ${sentences.length - timed.length} | ${median(starts).toFixed(2)} s | ${median(ends).toFixed(2)} s | ${share([...starts, ...ends], 0.2)} | ${share([...starts, ...ends], 0.5)} | ${rtf.toFixed(3)} |`
      )
    }
  }
}
writeFileSync('results/alignment.md', `${lines.join('\n')}\n`)
console.log(lines.join('\n'))

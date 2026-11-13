// Measures where a forced aligner puts each sentence of the long pieces. The truth is where speech starts
// and ends inside each joined clip (by speech detection, so the silence around a clip is not an error).
// The aligner gets either the reference text or a model's own transcript, as Vellum would give it.
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { NORMALIZE } from './normalize.mjs'
import { openOnnxAligner } from './onnxAligner.mjs'
import { pieces } from './recognizers.mjs'

const EXE = 'data/crispasr/crispasr-windows-x86_64-vulkan/crispasr.exe'
const ONNX = 'data/models/aligners/qwen3-forced-aligner-onnx'
const ALL_TEXTS = ['reference', 'qwen3-asr-0.6b-tcpp-gpu', 'funasr-nano-tcpp-30s-gpu', 'sense-voice-tcpp-gpu']
// The CrispASR run started and loaded the aligner for every piece; the onnxruntime runs load it once
const ALIGNERS = {
  'qwen3-forced-aligner': { label: 'Qwen3-ForcedAligner Q8 (CrispASR, Vulkan)', crispasr: 'data/models/aligners/qwen3-forced-aligner-0.6b-q8_0.gguf', texts: ALL_TEXTS },
  'qwen3-forced-aligner-onnx-q4-dml': { label: 'Qwen3-ForcedAligner q4 (onnxruntime, DirectML)', file: 'model_q4.onnx', provider: 'dml', texts: ALL_TEXTS },
  'qwen3-forced-aligner-onnx-fp32-dml': { label: 'Qwen3-ForcedAligner fp32 (onnxruntime, DirectML)', file: 'model.onnx', provider: 'dml', texts: ALL_TEXTS.slice(0, 2) },
  'qwen3-forced-aligner-onnx-q4-cpu': { label: 'Qwen3-ForcedAligner q4 (onnxruntime, CPU)', file: 'model_q4.onnx', provider: 'cpu', texts: ALL_TEXTS.slice(0, 2) },
  // Vellum cuts speech into pieces of up to 30 s, so it aligns each piece's text against that piece only
  'qwen3-forced-aligner-onnx-q4-dml-30s': { label: 'Qwen3-ForcedAligner q4 (onnxruntime, DirectML), 30 s pieces', file: 'model_q4.onnx', provider: 'dml', texts: ['reference'], pieceSeconds: 30 },
  'qwen3-forced-aligner-onnx-q4-cpu-30s': { label: 'Qwen3-ForcedAligner q4 (onnxruntime, CPU), 30 s pieces', file: 'model_q4.onnx', provider: 'cpu', texts: ['reference'], pieceSeconds: 30 }
}

// Joins sentences into pieces of up to maxSeconds; a longer sentence is a piece of its own
function sentencePieces(parts, maxSeconds) {
  const out = []
  for (const part of parts) {
    const last = out.at(-1)
    if (last && part.end - last.start <= maxSeconds) {
      last.end = part.end
      last.texts.push(part.text)
    } else out.push({ start: part.start, end: part.end, texts: [part.text] })
  }
  return out
}
const LANGUAGES = { chinese: 'zh', english: 'en' }

function speechBounds(wav, part) {
  const from = 44 + Math.round(part.start * 16000) * 2
  const pcm = wav.buffer.slice(wav.byteOffset + from, wav.byteOffset + from + Math.round((part.end - part.start) * 16000) * 2)
  const found = pieces(pcm, 3600)
  if (!found.length) return null
  return { start: part.start + found[0].start / 16000, end: part.start + found.at(-1).end / 16000 }
}

async function openAligner(aligner) {
  const { crispasr, file, provider, pieceSeconds } = ALIGNERS[aligner]
  if (!crispasr) {
    const align = await openOnnxAligner(ONNX, file, provider)
    return async (set, clip, text) => {
      const wav = readFileSync(`data/${set}/${clip.id}.wav`)
      const samples = Float32Array.from(new Int16Array(wav.buffer.slice(wav.byteOffset + 44, wav.byteOffset + wav.length)), (value) => value / 32768)
      const begin = performance.now()
      if (!pieceSeconds) return { words: await align(samples, text), ms: performance.now() - begin }
      const words = []
      for (const piece of sentencePieces(clip.parts, pieceSeconds)) {
        const found = await align(samples.subarray(Math.round(piece.start * 16000), Math.round(piece.end * 16000)), piece.texts.join(' '))
        words.push(...found.map((word) => ({ ...word, start: word.start + piece.start, end: word.end + piece.start })))
      }
      return { words, ms: performance.now() - begin }
    }
  }
  return async (set, clip, text) => crispasrAlign(crispasr, set, clip, text)
}

function crispasrAlign(model, set, clip, text) {
  writeFileSync('data/align-text.txt', text)
  const begin = performance.now()
  const run = spawnSync(EXE, ['--align-only', '-am', model, '-f', `data/${set}/${clip.id}.wav`, '--text-file', 'data/align-text.txt',
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

const outputOf = (aligner, source, set) => `data/align/${aligner}-${source}-${set}.json`
const missing = (aligner) =>
  ALIGNERS[aligner].texts.flatMap((source) => Object.keys(LANGUAGES).map((set) => [source, set])).filter(
    ([source, set]) => !existsSync(outputOf(aligner, source, set)) && (source === 'reference' || existsSync(`data/transcripts/${source}-${set}.json`))
  )

// Each aligner runs in a process of its own, so its peak memory is its own
async function run(aligner) {
  const loadStart = performance.now()
  const align = await openAligner(aligner)
  const loadMs = Math.round(performance.now() - loadStart)
  for (const [source, set] of missing(aligner)) {
    console.log(aligner, source, set)
    const clips = JSON.parse(readFileSync(`data/${set}/clips.json`, 'utf8')).filter(({ parts }) => parts)
    const texts = source === 'reference' ? null : JSON.parse(readFileSync(`data/transcripts/${source}-${set}.json`, 'utf8')).results
    const results = []
    for (const clip of clips) {
      const text = texts ? texts.find(({ id }) => id === clip.id).text : clip.parts.map(({ text }) => text).join(' ')
      const { ms, words } = await align(set, clip, text)
      results.push({ id: clip.id, ms: Math.round(ms), seconds: clip.seconds, sentences: measure(set, clip, words) })
    }
    const maxRssMb = Math.round(process.resourceUsage().maxRSS / 1024)
    writeFileSync(outputOf(aligner, source, set), JSON.stringify({ aligner, source, set, loadMs, maxRssMb, results }, null, 2))
  }
}

if (process.platform !== 'win32') process.exit(0)
if (process.env.ALIGNER) {
  await run(process.env.ALIGNER)
  process.exit(0)
}
mkdirSync('data/align', { recursive: true })
for (const aligner of Object.keys(ALIGNERS)) {
  if (missing(aligner).length) execFileSync(process.execPath, ['align.mjs'], { stdio: 'inherit', env: { ...process.env, ALIGNER: aligner } })
}

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted.length ? sorted[Math.floor(sorted.length / 2)] : NaN
}
const share = (values, limit) => `${Math.round((100 * values.filter((value) => value <= limit).length) / values.length)} %`
const lines = [
  '| Aligner | Text | Language | Sentences | Missed | Median start error | Median end error | Within 0.2 s | Within 0.5 s | RTF | Load | Peak memory |',
  '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |'
]
for (const aligner of Object.keys(ALIGNERS)) {
  for (const source of ALIGNERS[aligner].texts) {
    for (const set of Object.keys(LANGUAGES)) {
      const path = `data/align/${aligner}-${source}-${set}.json`
      if (!existsSync(path)) continue
      const { results, loadMs, maxRssMb } = JSON.parse(readFileSync(path, 'utf8'))
      const sentences = results.flatMap(({ sentences }) => sentences).filter(({ skipped }) => !skipped)
      const timed = sentences.filter(({ missed }) => !missed)
      const starts = timed.map(({ start }) => Math.abs(start))
      const ends = timed.map(({ end }) => Math.abs(end))
      const rtf = results.reduce((sum, { ms }) => sum + ms, 0) / 1000 / results.reduce((sum, { seconds }) => sum + seconds, 0)
      lines.push(
        `| ${ALIGNERS[aligner].label} | ${source} | ${set} | ${sentences.length} | ${sentences.length - timed.length} | ${median(starts).toFixed(2)} s | ${median(ends).toFixed(2)} s | ${share([...starts, ...ends], 0.2)} | ${share([...starts, ...ends], 0.5)} | ${rtf.toFixed(3)} | ${loadMs ? `${(loadMs / 1000).toFixed(1)} s` : 'per piece'} | ${maxRssMb ? `${maxRssMb} MB` : 'not measured'} |`
      )
    }
  }
}
writeFileSync('results/alignment.md', `${lines.join('\n')}\n`)
console.log(lines.join('\n'))

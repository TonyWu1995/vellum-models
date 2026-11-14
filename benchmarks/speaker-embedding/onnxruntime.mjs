// Makes CAM++ voiceprints with onnxruntime and fbank.mjs, and compares them with sherpa-onnx's on the same clips
// Usage: node onnxruntime.mjs <model.onnx> <folder of 16 kHz mono wav files>...
// sherpa-onnx runs in a process of its own: once onnxruntime-node is loaded, sherpa-onnx uses that onnxruntime instead of its own
import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import { BINS, fbank, SAMPLE_RATE } from './fbank.mjs'

const sherpaOnly = process.argv[2] === '--sherpa'
const [modelFile, ...folders] = process.argv.slice(sherpaOnly ? 3 : 2)
const LENGTHS = [1, 3, 10]

const readWav = (file) => {
  const bytes = readFileSync(file)
  const at = bytes.indexOf('data') + 8
  return Float32Array.from(
    new Int16Array(bytes.buffer, bytes.byteOffset + at, (bytes.length - at) >> 1),
    (x) => x / 32768
  )
}
const cosine = (a, b) => {
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    na += a[i] ** 2
    nb += b[i] ** 2
  }
  return dot / Math.sqrt(na * nb)
}
const stats = (values) => {
  const sorted = [...values].sort((a, b) => a - b)
  return `min ${sorted[0].toFixed(4)}, median ${sorted[sorted.length >> 1].toFixed(4)}`
}

const piecesOf = (folder, seconds) =>
  readdirSync(folder)
    .filter((f) => f.endsWith('.wav'))
    .map((f) => readWav(`${folder}/${f}`).slice(0, SAMPLE_RATE * seconds))
    .filter((c) => c.length)

if (sherpaOnly) {
  const { default: sherpa } = await import('sherpa-onnx-node')
  const extractor = new sherpa.SpeakerEmbeddingExtractor({ model: modelFile, numThreads: 2 })
  const prints = {}
  for (const folder of folders) {
    for (const seconds of LENGTHS) {
      const started = performance.now()
      const embeddings = piecesOf(folder, seconds).map((samples) => {
        const stream = extractor.createStream()
        stream.acceptWaveform({ sampleRate: SAMPLE_RATE, samples })
        stream.inputFinished()
        return Array.from(extractor.compute(stream, false))
      })
      prints[`${folder} ${seconds}`] = { embeddings, ms: (performance.now() - started) / embeddings.length }
    }
  }
  process.stdout.write(JSON.stringify(prints))
  process.exit(0)
}

const ownSherpa = JSON.parse(
  execFileSync(process.execPath, [process.argv[1], '--sherpa', modelFile, ...folders], {
    maxBuffer: 1 << 30
  })
)
const { default: ort } = await import('onnxruntime-node')
const { default: sherpa } = await import('sherpa-onnx-node')
const extractor = new sherpa.SpeakerEmbeddingExtractor({ model: modelFile, numThreads: 2 })
const sherpaPrint = (samples) => {
  const stream = extractor.createStream()
  stream.acceptWaveform({ sampleRate: SAMPLE_RATE, samples })
  stream.inputFinished()
  return Array.from(extractor.compute(stream, false))
}
const session = await ort.InferenceSession.create(modelFile, {
  executionProviders: ['cpu'],
  intraOpNumThreads: 2
})
const onnxPrint = async (samples) => {
  const { features, frames } = fbank(samples)
  const result = await session.run({ x: new ort.Tensor('float32', features, [1, frames, BINS]) })
  return Array.from(result.embedding.data)
}

const compare = (label, reference, ours) => {
  const same = reference.map((a, i) => cosine(a, ours[i]))
  let worstGap = 0
  for (let i = 0; i < ours.length; i++) {
    for (let j = i + 1; j < ours.length; j++) {
      const gap = Math.abs(cosine(reference[i], reference[j]) - cosine(ours[i], ours[j]))
      worstGap = Math.max(worstGap, gap)
    }
  }
  return `${label}: ${stats(same)}, largest change in a pair's similarity ${worstGap.toFixed(4)}`
}

for (const folder of folders) {
  for (const seconds of LENGTHS) {
    const pieces = piecesOf(folder, seconds)
    let started = performance.now()
    const ours = []
    for (const piece of pieces) ours.push(await onnxPrint(piece))
    const oursMs = (performance.now() - started) / pieces.length
    const shared = pieces.map(sherpaPrint)
    const own = ownSherpa[`${folder} ${seconds}`]
    console.log(
      `${folder.split("/").at(-1)} ${seconds} s x ${pieces.length} |`,
      compare("vs sherpa-onnx on its own onnxruntime 1.24", own.embeddings, ours),
      "|",
      compare("vs sherpa-onnx on onnxruntime 1.31", shared, ours),
      `| ms per clip: sherpa-onnx ${own.ms.toFixed(1)}, onnxruntime ${oursMs.toFixed(1)}`
    )
  }
}

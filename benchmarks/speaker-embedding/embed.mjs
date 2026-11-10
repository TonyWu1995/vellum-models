// Embeds the first 10 s of every clip: node embed.mjs <clips folder> <model.onnx> <out.json>
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import sherpa from 'sherpa-onnx-node'

const SAMPLE_RATE = 16000
const MAX_SECONDS = 10

const [clips, model, out] = process.argv.slice(2)
const extractor = new sherpa.SpeakerEmbeddingExtractor({ model, numThreads: 2 })
const files = readdirSync(clips)
  .filter((f) => f.endsWith('.f32'))
  .sort()
const result = {}
const started = Date.now()
files.forEach((file, i) => {
  const buffer = readFileSync(`${clips}/${file}`)
  const samples = new Float32Array(buffer.buffer, buffer.byteOffset, buffer.length / 4).slice(
    0,
    SAMPLE_RATE * MAX_SECONDS
  )
  const stream = extractor.createStream()
  stream.acceptWaveform({ sampleRate: SAMPLE_RATE, samples })
  stream.inputFinished()
  result[file.replace('.f32', '')] = {
    seconds: samples.length / SAMPLE_RATE,
    embedding: Array.from(extractor.compute(stream, false))
  }
  if ((i + 1) % 500 === 0) console.log(`${i + 1}/${files.length}`)
})
writeFileSync(out, JSON.stringify(result))
const seconds = ((Date.now() - started) / 1000).toFixed(0)
console.log(`${model.split(/[\\/]/).pop()}: ${files.length} clips in ${seconds} s`)

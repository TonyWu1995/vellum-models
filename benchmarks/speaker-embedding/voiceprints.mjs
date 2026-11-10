// Makes an embedding of the first 10 s of every clip with every model in models.json; score.mjs averages them into voiceprints
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import sherpa from 'sherpa-onnx-node'
import models from './models.json' with { type: 'json' }

const SAMPLE_RATE = 16000
const MAX_SECONDS = 10

function voiceprints(modelFile, language) {
  const extractor = new sherpa.SpeakerEmbeddingExtractor({ model: modelFile, numThreads: 2 })
  const result = {}
  for (const clip of readdirSync(`data/${language}`).filter((f) => f.endsWith('.f32'))) {
    const buffer = readFileSync(`data/${language}/${clip}`)
    const samples = new Float32Array(buffer.buffer, buffer.byteOffset, buffer.length / 4).slice(
      0,
      SAMPLE_RATE * MAX_SECONDS
    )
    const stream = extractor.createStream()
    stream.acceptWaveform({ sampleRate: SAMPLE_RATE, samples })
    stream.inputFinished()
    result[clip.replace('.f32', '')] = {
      seconds: samples.length / SAMPLE_RATE,
      embedding: Array.from(extractor.compute(stream, false))
    }
  }
  return result
}

mkdirSync('data/voiceprints', { recursive: true })
for (const model of models) {
  for (const language of model.languages) {
    const output = `data/voiceprints/${language}-${model.id}.json`
    if (existsSync(output)) continue
    const started = Date.now()
    writeFileSync(output, JSON.stringify(voiceprints(`data/models/${model.file}`, language)))
    console.log(`${language} ${model.id}: ${((Date.now() - started) / 1000).toFixed(0)} s`)
  }
}

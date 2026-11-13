// Opens a model the way Vellum does; the returned function transcribes 16 kHz 16-bit mono samples
import { existsSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'

const require = createRequire(import.meta.url)
const THREADS = 4
const DIRECTML = `directml:${resolve('onnx-directml.config')}`

const inFolder = (model, name) => `data/models/${model.archive}/${name}`
const firstOf = (model, names) => names.map((name) => inFolder(model, name)).find(existsSync)

const SHERPA_MODELS = {
  'nemo-transducer': (model) => ({
    transducer: {
      encoder: inFolder(model, 'encoder.int8.onnx'),
      decoder: inFolder(model, 'decoder.int8.onnx'),
      joiner: inFolder(model, 'joiner.int8.onnx')
    },
    modelType: 'nemo_transducer',
    tokens: inFolder(model, 'tokens.txt')
  }),
  'qwen3-asr': (model) => ({
    qwen3Asr: {
      convFrontend: inFolder(model, 'conv_frontend.onnx'),
      encoder: inFolder(model, 'encoder.int8.onnx'),
      decoder: inFolder(model, 'decoder.int8.onnx'),
      tokenizer: inFolder(model, 'tokenizer'),
      hotwords: '',
      ...model.options
    },
    tokens: ''
  }),
  'cohere-transcribe': (model) => ({
    cohereTranscribe: {
      encoder: inFolder(model, 'encoder.int8.onnx'),
      decoder: inFolder(model, 'decoder.int8.onnx'),
      usePunct: 1,
      useItn: 1
    },
    tokens: inFolder(model, 'tokens.txt')
  }),
  'fire-red-asr': (model) => ({
    fireRedAsr: {
      encoder: firstOf(model, ['encoder.int8.onnx', 'encoder.onnx']),
      decoder: firstOf(model, ['decoder.int8.onnx', 'decoder.onnx'])
    },
    tokens: inFolder(model, 'tokens.txt')
  }),
  'fire-red-asr-ctc': (model) => ({
    fireRedAsrCtc: { model: firstOf(model, ['model.int8.onnx', 'model.onnx']) },
    tokens: inFolder(model, 'tokens.txt')
  }),
  'funasr-nano': (model) => ({
    funasrNano: {
      encoderAdaptor: inFolder(model, 'encoder_adaptor.int8.onnx'),
      llm: inFolder(model, 'llm.int8.onnx'),
      embedding: inFolder(model, 'embedding.int8.onnx'),
      tokenizer: inFolder(model, 'Qwen3-0.6B')
    },
    tokens: ''
  }),
  'sense-voice': (model, language) => ({
    senseVoice: { model: inFolder(model, model.file ?? 'model.int8.onnx'), language, useInverseTextNormalization: 1 },
    tokens: inFolder(model, 'tokens.txt')
  })
}

function timingOf(result) {
  if (result.words?.length) return 'word'
  if (result.timestamps?.length && result.timestamps.length === result.tokens?.length) return 'token'
  if (result.timestamps?.length) return 'partial'
  return 'none'
}

function openSherpa(model, device, language) {
  const sherpa = require('sherpa-onnx-node')
  const recognizer = new sherpa.OfflineRecognizer({
    featConfig: { sampleRate: 16000, featureDim: model.kind === 'nemo-transducer' ? 128 : 80 },
    modelConfig: {
      ...SHERPA_MODELS[model.kind](model, language),
      numThreads: THREADS,
      provider: device === 'gpu' ? DIRECTML : 'cpu',
      debug: 0
    }
  })
  return async (pcm) => {
    const stream = recognizer.createStream()
    if (model.kind === 'cohere-transcribe') stream.setOption('language', language)
    const samples = Float32Array.from(new Int16Array(pcm), (value) => value / 32768)
    stream.acceptWaveform({ sampleRate: 16000, samples })
    recognizer.decode(stream)
    const result = recognizer.getResult(stream)
    return {
      text: result.text,
      timing: timingOf(result),
      fields: Object.keys(result),
      tokens: result.tokens,
      timestamps: result.timestamps
    }
  }
}

async function openWhisper(model, device, language) {
  const { initWhisper } = await import('@fugood/whisper.node')
  const context = await initWhisper(
    { filePath: `data/models/${model.id}.bin`, useGpu: device === 'gpu' },
    device === 'gpu' ? 'vulkan' : undefined
  )
  return async (pcm) => {
    const { segments } = await context.transcribeData(pcm, { language }).promise
    return { text: segments.map(({ text }) => text).join(''), timing: 'segment', fields: ['segments'], segments }
  }
}

function wavOf(pcm) {
  const header = Buffer.alloc(44)
  header.write('RIFF', 0)
  header.writeUInt32LE(36 + pcm.byteLength, 4)
  header.write('WAVEfmt ', 8)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20)
  header.writeUInt16LE(1, 22)
  header.writeUInt32LE(16000, 24)
  header.writeUInt32LE(32000, 28)
  header.writeUInt16LE(2, 32)
  header.writeUInt16LE(16, 34)
  header.write('data', 36)
  header.writeUInt32LE(pcm.byteLength, 40)
  return Buffer.concat([header, Buffer.from(pcm)])
}

// llama.cpp reads audio only from a file, and answers "language Chinese<asr_text>..."
async function openLlama(model, device) {
  const { loadModel } = await import('@fugood/llama.node')
  const folder = `data/models/${model.folder}`
  const context = await loadModel({
    model: `${folder}/${model.gguf}`,
    n_ctx: 4096,
    n_gpu_layers: device === 'gpu' ? 99 : 0,
    lib_variant: device === 'gpu' ? 'vulkan' : 'default'
  })
  context.initMultimodal({ path: `${folder}/${model.mmproj}`, use_gpu: device === 'gpu' })
  const audio = resolve(`data/llama-${process.pid}.wav`)
  return async (pcm) => {
    writeFileSync(audio, wavOf(pcm))
    const { text } = await context.completion({
      messages: [{ role: 'user', content: [{ type: 'input_audio', input_audio: { format: 'wav', url: audio } }] }],
      n_predict: 1024,
      temperature: 0
    })
    return { text: text.replace(/^language \S+<asr_text>/, ''), timing: 'none', fields: ['text'] }
  }
}

async function openTranscribeCpp(model, device, language) {
  const { TranscribeModel } = await import('transcribe-cpp')
  const loaded = await TranscribeModel.load(`data/models/transcribe-cpp/${model.gguf}`, {
    backend: device === 'gpu' ? 'vulkan' : 'cpu'
  })
  const session = loaded.createSession({ nThreads: THREADS })
  return async (pcm) => {
    const samples = Float32Array.from(new Int16Array(pcm), (value) => value / 32768)
    const result = await session.run(samples, model.language ? { language } : {})
    const timing = result.words.length ? 'word' : result.tokens.some((token) => token.t1Ms > 0) ? 'token' : result.timestampKind
    return {
      text: result.text,
      timing,
      fields: [`maxAudioMs=${session.limits.effectiveMaxAudioMs}`, result.truncated ? 'truncated' : 'complete'],
      timestamps: result.tokens.map((token) => token.t0Ms / 1000)
    }
  }
}

function open(model, device, language) {
  if (model.kind === 'whisper') return openWhisper(model, device, language)
  if (model.kind === 'transcribe-cpp') return openTranscribeCpp(model, device, language)
  if (model.kind === 'llama') return openLlama(model, device)
  return openSherpa(model, device, language)
}

// Finds speech and joins it into pieces of up to maxSeconds, the way Vellum cuts a recording
export function pieces(pcm, maxSeconds) {
  const sherpa = require('sherpa-onnx-node')
  const vad = new sherpa.Vad(
    {
      sileroVad: { model: 'data/models/silero_vad.onnx', windowSize: 512, threshold: 0.5, minSilenceDuration: 0.5, minSpeechDuration: 0.25, maxSpeechDuration: 30 },
      sampleRate: 16000,
      numThreads: 1,
      provider: 'cpu',
      debug: 0
    },
    60
  )
  const samples = Float32Array.from(new Int16Array(pcm), (value) => value / 32768)
  const speech = []
  const take = () => {
    while (!vad.isEmpty()) {
      const { start, samples: spoken } = vad.front()
      speech.push({ start, end: start + spoken.length })
      vad.pop()
    }
  }
  for (let i = 0; i + 512 <= samples.length; i += 512) {
    vad.acceptWaveform(samples.subarray(i, i + 512))
    take()
  }
  vad.flush()
  take()
  const joined = []
  for (const part of speech) {
    const last = joined.at(-1)
    if (last && part.end - last.start <= maxSeconds * 16000) last.end = part.end
    else joined.push({ ...part })
  }
  return joined
}

// Some models only learned short audio, so they hear one piece at a time like their own tools do
export async function openModel(model, device, language) {
  const transcribe = await open(model, device, language)
  if (!model.pieceSeconds) return transcribe
  return async (pcm) => {
    const texts = []
    let failed = 0
    for (const { start, end } of pieces(pcm, model.pieceSeconds)) {
      const found = await transcribe(pcm.slice(start * 2, end * 2)).catch(() => ((failed += 1), { text: '' }))
      texts.push(found.text)
    }
    return { text: texts.join(' '), timing: 'none', fields: [`pieces=${texts.length}`, `failed=${failed}`] }
  }
}

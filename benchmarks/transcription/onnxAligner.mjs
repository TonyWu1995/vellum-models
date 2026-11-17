// Qwen3-ForcedAligner on onnxruntime-node, ported from Qwen's qwen_asr/inference/qwen3_forced_aligner.py:
// each word is followed by two <timestamp> tokens, one pass of the model classifies every <timestamp> into
// an 80 ms slot, and slots that go backwards are repaired the way Qwen's fix_timestamp does
import { Tokenizer } from '@huggingface/tokenizers'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { whisperMel } from './whisperMel.mjs'

const require = createRequire(import.meta.url)

const isCjk = (ch) => {
  const code = ch.codePointAt(0)
  return (
    (code >= 0x4e00 && code <= 0x9fff) ||
    (code >= 0x3400 && code <= 0x4dbf) ||
    (code >= 0x20000 && code <= 0x2ceaf) ||
    (code >= 0xf900 && code <= 0xfaff)
  )
}
const clean = (token) => [...token].filter((ch) => ch === "'" || /[\p{L}\p{N}]/u.test(ch)).join('')

export function words(text) {
  const out = []
  for (const segment of text.split(/\s+/)) {
    let buffer = ''
    for (const ch of clean(segment)) {
      if (isCjk(ch)) {
        if (buffer) out.push(buffer)
        buffer = ''
        out.push(ch)
      } else buffer += ch
    }
    if (buffer) out.push(buffer)
  }
  return out
}

const audioTokens = (frames) => {
  const leave = frames % 100
  const features = Math.floor((leave - 1) / 2) + 1
  return Math.floor((Math.floor((features - 1) / 2) + 1 - 1) / 2) + 1 + Math.floor(frames / 100) * 13
}

export function repaired(slots) {
  const n = slots.length
  const length = new Array(n).fill(1)
  const parent = new Array(n).fill(-1)
  for (let i = 1; i < n; i += 1) {
    for (let j = 0; j < i; j += 1) {
      if (slots[j] <= slots[i] && length[j] + 1 > length[i]) {
        length[i] = length[j] + 1
        parent[i] = j
      }
    }
  }
  const normal = new Array(n).fill(false)
  for (let i = length.indexOf(Math.max(...length)); i !== -1; i = parent[i]) normal[i] = true
  const out = [...slots]
  for (let i = 0; i < n; ) {
    if (normal[i]) {
      i += 1
      continue
    }
    let j = i
    while (j < n && !normal[j]) j += 1
    let left = null
    for (let k = i - 1; k >= 0; k -= 1) if (normal[k]) { left = out[k]; break }
    let right = null
    for (let k = j; k < n; k += 1) if (normal[k]) { right = out[k]; break }
    for (let k = i; k < j; k += 1) {
      if (j - i <= 2) out[k] = left === null ? right : right === null ? left : k - (i - 1) <= j - k ? left : right
      else if (left !== null && right !== null) out[k] = left + ((right - left) / (j - i + 1)) * (k - i + 1)
      else out[k] = left ?? right
    }
    i = j
  }
  return out.map((value) => Math.trunc(value))
}

export async function openOnnxAligner(folder, file, provider) {
  const ort = require('onnxruntime-node')
  const read = (name) => JSON.parse(readFileSync(`${folder}/${name}`, 'utf8'))
  const config = read('config.json')
  const tokenizer = new Tokenizer(read('tokenizer.json'), read('tokenizer_config.json'))
  const session = await ort.InferenceSession.create(`${folder}/onnx/${file}`, { executionProviders: [provider] })

  return async (samples, text) => {
    const list = words(text)
    if (!list.length) return []
    const { data, frames } = whisperMel(samples)
    const prompt = `<|audio_start|>${'<|audio_pad|>'.repeat(audioTokens(frames))}<|audio_end|>${list.join('<timestamp><timestamp>')}<timestamp><timestamp>`
    const { ids } = tokenizer.encode(prompt, { add_special_tokens: false })
    const feeds = {
      input_ids: new ort.Tensor('int64', BigInt64Array.from(ids, BigInt), [1, ids.length]),
      attention_mask: new ort.Tensor('int64', new BigInt64Array(ids.length).fill(1n), [1, ids.length]),
      input_features: new ort.Tensor('float32', data, [1, 128, frames]),
      feature_attention_mask: new ort.Tensor('int32', new Int32Array(frames).fill(1), [1, frames])
    }
    const { logits } = await session.run(feeds)
    const classes = logits.dims[2]
    const slots = []
    ids.forEach((id, position) => {
      if (id !== config.timestamp_token_id) return
      let best = 0
      for (let c = 1; c < classes; c += 1) {
        if (logits.data[position * classes + c] > logits.data[position * classes + best]) best = c
      }
      slots.push(best * config.timestamp_segment_time)
    })
    const times = repaired(slots)
    return list.map((word, i) => ({ word, start: times[i * 2] / 1000, end: times[i * 2 + 1] / 1000 }))
  }
}

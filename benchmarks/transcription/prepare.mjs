// Picks short clips spread over each test set, and joins the clips that follow into long pieces
// of 30, 60 and 120 s, since Vellum hands a model up to 120 s of speech at once
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import ffmpeg from 'ffmpeg-static'
import { asyncBufferFromFile, parquetReadObjects } from 'hyparquet'

const SAMPLE_RATE = 16000
const SHORT_CLIPS = 100
const LONG_SECONDS = [30, 60, 120]
const LONG_PIECES = 3
const GAP = new Int16Array(SAMPLE_RATE / 2)

const SETS = {
  chinese: {
    parquet: 'data/chinese.parquet',
    clip: ({ context, answer }, index) => ({ id: `aishell-${index}`, audio: context.bytes, text: answer })
  },
  english: {
    parquet: 'data/english.parquet',
    clip: ({ id, audio, text }) => ({ id, audio: audio.bytes, text })
  }
}

function decode(bytes) {
  return new Promise((resolve, reject) => {
    const args = ['-v', 'error', '-i', 'pipe:0', '-ac', '1', '-ar', String(SAMPLE_RATE), '-f', 's16le', 'pipe:1']
    const child = spawn(ffmpeg, args)
    const out = []
    child.stdout.on('data', (chunk) => out.push(chunk))
    child.on('error', reject)
    child.on('close', (code) => {
      if (code !== 0) return reject(new Error('ffmpeg failed'))
      const pcm = Buffer.concat(out)
      resolve(new Int16Array(pcm.buffer, pcm.byteOffset, pcm.length / 2))
    })
    child.stdin.end(bytes)
  })
}

function writeWav(path, pieces) {
  const length = pieces.reduce((sum, piece) => sum + piece.length, 0)
  const header = Buffer.alloc(44)
  header.write('RIFF', 0)
  header.writeUInt32LE(36 + length * 2, 4)
  header.write('WAVEfmt ', 8)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20)
  header.writeUInt16LE(1, 22)
  header.writeUInt32LE(SAMPLE_RATE, 24)
  header.writeUInt32LE(SAMPLE_RATE * 2, 28)
  header.writeUInt16LE(2, 32)
  header.writeUInt16LE(16, 34)
  header.write('data', 36)
  header.writeUInt32LE(length * 2, 40)
  writeFileSync(path, Buffer.concat([header, ...pieces.map((piece) => Buffer.from(piece.buffer, piece.byteOffset, piece.byteLength))]))
}

async function prepare(language, { parquet, clip }) {
  const folder = `data/${language}`
  if (existsSync(`${folder}/clips.json`)) return
  mkdirSync(folder, { recursive: true })
  const rows = (await parquetReadObjects({ file: await asyncBufferFromFile(parquet), utf8: false })).map(clip)
  const step = Math.floor(rows.length / 2 / SHORT_CLIPS)
  const clips = []
  for (let i = 0; i < SHORT_CLIPS; i += 1) {
    const { id, audio, text } = rows[i * step]
    writeWav(`${folder}/${id}.wav`, [await decode(audio)])
    clips.push({ id, length: 'short', text })
  }
  // Long pieces come from the second half, so no short clip is in them
  let next = Math.floor(rows.length / 2)
  for (const seconds of LONG_SECONDS) {
    for (let n = 1; n <= LONG_PIECES; n += 1) {
      const pieces = []
      const texts = []
      let samples = 0
      while (samples < seconds * SAMPLE_RATE) {
        const { audio, text } = rows[next++]
        const pcm = await decode(audio)
        if (samples + pcm.length > (seconds + 5) * SAMPLE_RATE) break
        pieces.push(pcm, GAP)
        texts.push(text)
        samples += pcm.length + GAP.length
      }
      const id = `long-${seconds}s-${n}`
      writeWav(`${folder}/${id}.wav`, pieces)
      clips.push({ id, length: `${seconds}s`, seconds: samples / SAMPLE_RATE, text: texts.join(' ') })
    }
  }
  writeFileSync(`${folder}/clips.json`, JSON.stringify(clips, null, 2))
  console.log(language, clips.length, 'clips')
}

for (const [language, set] of Object.entries(SETS)) await prepare(language, set)
